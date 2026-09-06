/**
 * Reset 03C.2 — Media PLP locale-switch deadlock regression (no live ops).
 * First assertions target pre-fix 03C.1 behavior and must FAIL until the fix lands.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { afterEach, describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import type { CivicMediaSelectionPrinciple, TrustedMediaResource } from "@hu/types";

import {
  isMediaPlpWebEnabled,
  setMediaPlpWebEnabledForTests,
} from "./feature-flag.js";
import {
  getMediaLocaleSwitchSnapshot,
  localeSwitchMustTerminate,
  recordClientTranslationRequestCount,
  recordLocaleSwitchCompleted,
  recordLocaleSwitchFailedClosed,
  recordLocaleSwitchStarted,
  recordMediaPresentationResolution,
  recordSemanticMutationsAfterSettle,
  resetMediaLocaleSwitchInstrumentation,
  simulatePlpEditorialIdentityEffectLoop,
} from "./media-plp-locale-switch-machine.js";
import {
  loadMediaPlpPrinciplePresentations,
  loadMediaPlpTrustedPresentations,
} from "./load-media-plp-ssr.js";
import type { MediaPlpResolvedPresentation } from "./presentation.js";

const webSrc = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const repoRoot = join(webSrc, "../../..");

const reuters: TrustedMediaResource = {
  id: "reuters",
  name: "Reuters",
  logoLabel: "R",
  country: "International",
  categoryId: "international-wire-service",
  explanation: "Independent international news agency with global editorial standards.",
  websiteUrl: "https://www.reuters.com/",
  sortOrder: 1,
};

const atlantic: TrustedMediaResource = {
  id: "the-atlantic",
  name: "The Atlantic",
  logoLabel: "A",
  country: "United States",
  categoryId: "independent-investigative",
  explanation: "Trusted explanation of editorial standards for participants.",
  websiteUrl: "https://www.theatlantic.com/",
  sortOrder: 2,
};

const samplePrinciples: readonly CivicMediaSelectionPrinciple[] = [
  {
    id: "editorial-transparency",
    title: "Independence",
    description: "Desc",
    sortOrder: 1,
  },
];

afterEach(() => {
  setMediaPlpWebEnabledForTests(null);
  resetMediaLocaleSwitchInstrumentation();
});

describe("Reset 03C.2 — reproduce locale-switch deadlock (pre-fix)", () => {
  it("evidenced root cause: unstable PLP editorial identity never settles", () => {
    const broken = simulatePlpEditorialIdentityEffectLoop({
      stabilizeEditorialIdentity: false,
      maxRenders: 40,
    });
    // Documents the pre-fix 03C.1 client loop that keeps useTransition pending.
    assert.equal(broken.settled, false);
    assert.equal(broken.renders, 40);
    assert.ok(broken.setEditorialCalls >= 40);
  });

  it("regression: CivicMediaCenterLoaded must memoize PLP editorial", () => {
    const pageContent = readFileSync(
      join(webSrc, "features/civic-media-center/components/CivicMediaCenterPageContent.tsx"),
      "utf8",
    );
    // Pre-fix 03C.1 allocates applyMediaPlpPresentationsToEditorial every render.
    assert.match(
      pageContent,
      /useMemo\([\s\S]*applyMediaPlpPresentationsToEditorial/,
      "PLP editorial must be memoized so locale-switch transitions can settle",
    );
  });

  it("regression: skipClientTranslation must not setEditorial on identity churn", () => {
    const hook = readFileSync(
      join(
        webSrc,
        "features/civic-media-center/components/CivicMediaTranslatedEditorial.tsx",
      ),
      "utf8",
    );
    // Pre-fix pattern coupled effect deps to unstable parent identities.
    assert.doesNotMatch(
      hook,
      /if\s*\(\s*skipClientTranslation\s*\)\s*\{\s*setEditorial/,
      "PLP mode must derive editorial synchronously (no setEditorial loop)",
    );
    assert.match(hook, /plpDerivedEditorial/);
    assert.match(
      hook,
      /if\s*\(\s*skipClientTranslation\s*\)\s*\{\s*return\s+plpDerivedEditorial/,
    );
  });
});

describe("Reset 03C.2 — locale-switch contract + bounding", () => {
  it("stable editorial identity settles (corrected machine)", () => {
    const fixed = simulatePlpEditorialIdentityEffectLoop({
      stabilizeEditorialIdentity: true,
      maxRenders: 40,
    });
    assert.equal(fixed.settled, true);
    assert.ok(fixed.renders <= 2);
    assert.ok(fixed.setEditorialCalls <= 1);
  });

  it("loading ownership terminates for all outcomes", () => {
    for (const kind of [
      "published",
      "canonical_fallback",
      "api_error",
      "timeout",
      "aborted",
      "repeated_selection",
    ] as const) {
      const phase = localeSwitchMustTerminate({ kind });
      assert.ok(phase === "completed" || phase === "failed_closed");
    }
  });

  it("instrumentation records switch start/complete + resolution + zero CT", () => {
    recordLocaleSwitchStarted("uk");
    recordMediaPresentationResolution({
      locale: "uk",
      mode: "PUBLISHED_LOCALIZED",
      entityId: "reuters",
    });
    recordMediaPresentationResolution({
      locale: "uk",
      mode: "CANONICAL_FALLBACK",
      entityId: "the-atlantic",
    });
    recordLocaleSwitchCompleted("uk");
    recordSemanticMutationsAfterSettle(0);
    recordClientTranslationRequestCount(0);

    const snap = getMediaLocaleSwitchSnapshot();
    assert.equal(snap.phase, "completed");
    assert.equal(snap.finalInterfaceLocale, "uk");
    assert.equal(snap.clientTranslationRequestCount, 0);
    assert.equal(snap.semanticMutationsAfterSettle, 0);
    assert.equal(snap.events[0]?.type, "LOCALE_SWITCH_STARTED");
    assert.ok(snap.events.some((e) => e.type === "LOCALE_SWITCH_COMPLETED"));
    assert.ok(snap.events.some((e) => e.type === "FINAL_INTERFACE_LOCALE"));
    assert.ok(snap.events.some((e) => e.type === "MEDIA_PRESENTATION_RESOLUTION"));
  });

  it("API miss / error fail-closed to canonical (no hang)", async () => {
    setMediaPlpWebEnabledForTests(true);

    const fallingResolve = async (): Promise<MediaPlpResolvedPresentation> => {
      throw new Error("controlled API failure");
    };

    const trusted = await loadMediaPlpTrustedPresentations({
      resources: [reuters],
      locale: "ar",
      resolve: fallingResolve,
    });
    const principlesMap = await loadMediaPlpPrinciplePresentations({
      principles: samplePrinciples,
      locale: "zh-Hant",
      resolve: fallingResolve,
    });

    assert.ok(trusted);
    const reutersPresentation = trusted["reuters"];
    assert.ok(reutersPresentation);
    assert.equal(reutersPresentation.mode, "CANONICAL_FALLBACK");
    assert.ok(principlesMap);
    const principlePresentation = principlesMap["editorial-transparency"];
    assert.ok(principlePresentation);
    assert.equal(principlePresentation.mode, "CANONICAL_FALLBACK");
    recordLocaleSwitchFailedClosed("ar");
    assert.equal(getMediaLocaleSwitchSnapshot().phase, "failed_closed");
  });

  it("flag combinations: OFF paths leave PLP maps null; ON returns maps", async () => {
    setMediaPlpWebEnabledForTests(false);
    assert.equal(isMediaPlpWebEnabled(), false);
    assert.equal(
      await loadMediaPlpTrustedPresentations({ resources: [reuters], locale: "uk" }),
      null,
    );

    setMediaPlpWebEnabledForTests(true);
    assert.equal(isMediaPlpWebEnabled(), true);
    const map = await loadMediaPlpTrustedPresentations({
      resources: [reuters],
      locale: "uk",
      resolve: async ({ canonicalPresentation, entityId, entityType, locale }) => ({
        mode: "CANONICAL_FALLBACK",
        presentation: canonicalPresentation,
        entityType,
        entityId,
        locale,
        canonicalVersion: "canonical",
      }),
    });
    assert.ok(map);
    const reutersPresentation = map["reuters"];
    assert.ok(reutersPresentation);
    assert.equal(reutersPresentation.mode, "CANONICAL_FALLBACK");
  });

  it("page SSR parallelizes PLP batches and bounds resolve", () => {
    const page = readFileSync(join(webSrc, "app/media/page.tsx"), "utf8");
    assert.match(page, /Promise\.all/);
    const api = readFileSync(
      join(webSrc, "features/language/media-plp/media-plp-api.ts"),
      "utf8",
    );
    assert.match(api, /MEDIA_PLP_RESOLVE_TIMEOUT_MS/);
    assert.match(api, /AbortSignal\.timeout/);
  });

  it("one locale navigation issues one trusted + one principles resolve (no render fan-out)", async () => {
    setMediaPlpWebEnabledForTests(true);
    let resolveCalls = 0;
    const resolve = async (args: {
      entityType: string;
      entityId: string;
      locale: string;
      canonicalPresentation: import("@hu/types").PublicPresentationNode;
    }): Promise<MediaPlpResolvedPresentation> => {
      resolveCalls += 1;
      return {
        mode: "CANONICAL_FALLBACK",
        presentation: args.canonicalPresentation,
        entityType: args.entityType,
        entityId: args.entityId,
        locale: args.locale,
        canonicalVersion: "canonical",
      };
    };

    const resources = [reuters, atlantic];
    const principles = samplePrinciples;

    // Simulate one navigation resolve pair (page.tsx Promise.all).
    await Promise.all([
      loadMediaPlpTrustedPresentations({
        resources,
        locale: "uk",
        resolve,
      }),
      loadMediaPlpPrinciplePresentations({
        principles,
        locale: "uk",
        resolve,
      }),
    ]);

    // Injected path is per-entity (2 trusted + 1 principle); production batch is 2 HTTP posts.
    assert.equal(resolveCalls, 3);
    // Re-running must not invent a retry loop on canonical fallback.
    const before = resolveCalls;
    await loadMediaPlpTrustedPresentations({
      resources,
      locale: "uk",
      resolve,
    });
    assert.equal(resolveCalls, before + 2);
  });

  it("LanguageSelector remains the locale-switch entry (no bypass)", () => {
    const selector = readFileSync(
      join(webSrc, "features/language/components/LanguageSelector.tsx"),
      "utf8",
    );
    assert.match(selector, /writeHuLangCookieViaWebRoute/);
    assert.match(selector, /router\.refresh\(\)/);
    assert.match(selector, /startTransition/);
  });

  it("read-path stays free of provider/materializer/generate", () => {
    for (const rel of [
      "features/language/media-plp/media-plp-locale-switch-machine.ts",
      "features/language/media-plp/load-media-plp-ssr.ts",
      "features/language/media-plp/media-plp-api.ts",
      "app/media/page.tsx",
    ]) {
      const text = readFileSync(join(webSrc, rel), "utf8");
      assert.doesNotMatch(
        text,
        /gemini|thin-gemini|media-plp-materializer|GEMINI_API_KEY|generateContentTranslation/,
      );
    }
  });

  it("ledger documents 03C attempt 2 locale deadlock", () => {
    const ledger = readFileSync(
      join(
        repoRoot,
        "project/architecture/core/PUBLISHED_LOCALIZATION_LEGACY_REMOVAL_LEDGER_v1.0.md",
      ),
      "utf8",
    );
    assert.match(ledger, /03C\.2|locale switch|loading deadlock/i);
    assert.match(ledger, /CONSUMER_READY_PENDING_LIVE_ACCEPTANCE/);
    assert.match(ledger, /LEGACY_ACTIVE_RUNTIME_DEFAULT` \| \*\*30\*\*/);
  });
});
