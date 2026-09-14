/**
 * RESET 05D.6 — provider-owned prose, Brand-owned slots.
 */

import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";

import {
  BRAND_SITE_NAME_MACHINE_SENTINEL,
  BRAND_SITE_NAME_TOKEN,
  MEDIA_PLP_ENTITY_TYPE,
  assertProviderPayloadHasNoBrandArtifacts,
  buildProviderOwnedMachinePayload,
  composeBrandTokens,
  extractBrandSlotsForProvider,
  machineSegmentProviderKey,
  reassembleBrandSlotPlans,
  stripBrandSlotsForMachineCompare,
} from "@hu/types";

import {
  FakeLocalMediaPlpTransport,
  MEDIA_PLP_FAKE_LOCAL_TRANSPORT_ID,
  callMediaPlpMaterializerProviderOnce,
  validateMediaPlpProviderLocalizationValues,
} from "../../../src/modules/language/media-plp-materializer/index.js";
import { resetMediaPlpMaterializerCountersForTests } from "../../../src/modules/language/media-plp-materializer/counters.js";
import {
  CIVIC_MEDIA_FAQ,
  CIVIC_MEDIA_OVERVIEW,
} from "../../../src/modules/civic-media-center/content/sections.js";
import {
  asMediaPlpPresentationNode,
  buildCanonicalEditorialPresentation,
} from "../../../src/modules/language/published-localized-presentation/media/canonical-trees.js";
import { collectAutoPaths } from "../../../src/modules/language/published-localized-presentation/presentation-paths.js";
import {
  ensureMediaPlpAdapterRegistered,
  isCollectedPathMachineEligible,
  resolveFieldPolicyForEntityType,
  resetMediaPlpAdapterRegistrationForTests,
  resetPlpDomainAdapterRegistryForTests,
} from "../../../src/modules/language/published-localized-presentation/index.js";
import { classifyFaqMachineProseLocalization } from "@hu/types";

beforeEach(() => {
  resetMediaPlpMaterializerCountersForTests();
  resetPlpDomainAdapterRegistryForTests();
  resetMediaPlpAdapterRegistrationForTests();
  ensureMediaPlpAdapterRegistered();
});

afterEach(() => {
  resetMediaPlpMaterializerCountersForTests();
});

describe("RESET 05D.6 — Brand-slot composition", () => {
  it("1–3: provider payload for Brand-bearing FAQ has zero tokens/sentinels; slots outside provider", () => {
    const path = "faq[2].question";
    const canonical = "Can {siteName} recommend new sources?";
    const { payload, plans } = buildProviderOwnedMachinePayload({
      [path]: canonical,
      title: "Plain title",
    });
    assert.equal(assertProviderPayloadHasNoBrandArtifacts(payload).length, 0);
    assert.equal(Object.values(payload).some((v) => v.includes(BRAND_SITE_NAME_TOKEN)), false);
    assert.equal(
      Object.values(payload).some((v) => v.includes(BRAND_SITE_NAME_MACHINE_SENTINEL)),
      false,
    );
    assert.ok(!(path in payload));
    assert.ok(machineSegmentProviderKey(path, 0) in payload);
    assert.ok(machineSegmentProviderKey(path, 1) in payload);
    assert.equal(plans.find((p) => p.path === path)?.hasBrandSlots, true);
    assert.equal(payload.title, "Plain title");
  });

  it("4–6: surrounding prose translates; reassembly restores {siteName}; Brand resolves at presentation", async () => {
    const path = "faq[2].question";
    const canonical = "Can {siteName} recommend new sources?";
    resetMediaPlpMaterializerCountersForTests();
    const result = await callMediaPlpMaterializerProviderOnce({
      provider: new FakeLocalMediaPlpTransport({}),
      locale: "uk",
      autoValues: { [path]: canonical },
      sourceRecordId: "civic_media_editorial:civic-media-center",
      sourceVersion: "v-2dd8a2b73768d26f",
      PROVIDER_TRANSPORT: MEDIA_PLP_FAKE_LOCAL_TRANSPORT_ID,
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    const out = result.values[path]!;
    assert.match(out, /\{siteName\}/);
    assert.match(out, /\[uk\]/);
    assert.doesNotMatch(out, /__HU_BRAND_SITE_NAME__/);
    assert.equal(countBrandSlots(out), 1);
    const resolved = composeBrandTokens(out, { siteName: "Союз Людяності" });
    assert.match(resolved, /Союз Людяності/);
    assert.doesNotMatch(resolved, /\{siteName\}/);
  });

  it("7: Brand substitution alone cannot satisfy MACHINE completeness", () => {
    const canonical = "Can {siteName} recommend new sources?";
    const brandOnly = "Can {siteName} recommend new sources?";
    const classified = classifyFaqMachineProseLocalization({
      template: brandOnly,
      canonicalTemplate: canonical,
      editorialMode: "CANONICAL_FALLBACK",
    });
    assert.equal(classified.machineLocalized, false);
    assert.equal(classified.brandOnlyIllusion, true);
  });

  it("8–9: multiple Brand slots and begin/middle/end positions", () => {
    const cases = [
      "{siteName} leads.",
      "Ask {siteName} today.",
      "End with {siteName}",
      "{siteName} and {siteName} together.",
    ];
    for (const canonical of cases) {
      const plan = extractBrandSlotsForProvider("faq[0].answer", canonical);
      assert.equal(plan.hasBrandSlots, true);
      const sourceSegs: Record<string, string> = {};
      for (const part of plan.parts) {
        if (part.kind === "machine" && part.sourceText.length > 0) {
          sourceSegs[machineSegmentProviderKey(plan.path, part.segmentIndex)] =
            `[uk] ${part.sourceText}`;
        }
      }
      const { values, missingSegmentKeys } = reassembleBrandSlotPlans({
        plans: [plan],
        translatedSegments: sourceSegs,
      });
      assert.deepEqual(missingSegmentKeys, []);
      const out = values[plan.path]!;
      assert.equal(
        (out.match(/\{siteName\}/g) ?? []).length,
        (canonical.match(/\{siteName\}/g) ?? []).length,
      );
      assert.equal(
        stripBrandSlotsForMachineCompare(out).includes("[uk]"),
        true,
      );
    }
  });

  it("10: provider cannot drop Brand because it never receives Brand", async () => {
    const path = "faq[2].question";
    const canonical = "Can {siteName} recommend new sources?";
    const { payload } = buildProviderOwnedMachinePayload({ [path]: canonical });
    // Simulate Gemini translating segments without any Brand artifact.
    const translated: Record<string, string> = {};
    for (const [k, v] of Object.entries(payload)) {
      translated[k] = `[uk] ${v}`;
    }
    resetMediaPlpMaterializerCountersForTests();
    const result = await callMediaPlpMaterializerProviderOnce({
      provider: new FakeLocalMediaPlpTransport({
        responseText: () => JSON.stringify(translated),
      }),
      locale: "uk",
      autoValues: { [path]: canonical },
      sourceRecordId: "x",
      sourceVersion: "v",
      PROVIDER_TRANSPORT: MEDIA_PLP_FAKE_LOCAL_TRANSPORT_ID,
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.match(result.values[path]!, /\{siteName\}/);
    assert.equal(
      result.forensics?.BRAND_TOKEN_PATH_STATES.every(
        (r) => r.TOKEN_STATE === "PRESERVED",
      ),
      true,
    );
  });

  it("10b: provider injecting Brand artifact is rejected", async () => {
    resetMediaPlpMaterializerCountersForTests();
    const result = await callMediaPlpMaterializerProviderOnce({
      provider: new FakeLocalMediaPlpTransport({
        responseText: () =>
          JSON.stringify({
            title: `[uk] hello ${BRAND_SITE_NAME_TOKEN}`,
          }),
      }),
      locale: "uk",
      autoValues: { title: "hello world title here" },
      sourceRecordId: "x",
      sourceVersion: "v",
      PROVIDER_TRANSPORT: MEDIA_PLP_FAKE_LOCAL_TRANSPORT_ID,
    });
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.reason, "BRAND_TOKEN_PRESERVATION_FAILED");
  });

  it("11–12: target-language acceptance — proper nouns ok; unchanged English fails", () => {
    // Ukrainian prose with English proper noun / org name — not identical to source.
    const ok = validateMediaPlpProviderLocalizationValues({
      locale: "uk",
      autoValues: {
        title: "BBC reports on climate talks in Kyiv",
        summary: "The UN Security Council met today about peace.",
      },
      translated: {
        title: "BBC повідомляє про кліматичні переговори в Києві",
        summary: "Рада Безпеки ООН сьогодні зібралася щодо миру.",
      },
      presentKeys: ["title", "summary"],
    });
    assert.equal(ok.ok, true);

    // Short headline with acronyms/numbers still changes surrounding prose.
    const shortOk = validateMediaPlpProviderLocalizationValues({
      locale: "uk",
      autoValues: { title: "NATO summit 2026 opens", summary: "URL https://example.com stays" },
      translated: {
        title: "Саміт NATO 2026 відкривається",
        summary: "URL https://example.com залишається",
      },
      presentKeys: ["title", "summary"],
    });
    assert.equal(shortOk.ok, true);

    // Genuinely unchanged English output fails Ukrainian acceptance.
    const fail = validateMediaPlpProviderLocalizationValues({
      locale: "uk",
      autoValues: {
        title: "Title long enough for checks",
        summary: "Summary long enough for checks here.",
      },
      translated: {
        title: "Title long enough for checks",
        summary: "Summary long enough for checks here.",
      },
      presentKeys: ["title", "summary"],
    });
    assert.equal(fail.ok, false);
    if (!fail.ok) {
      assert.equal(fail.reason, "WRONG_TARGET_LANGUAGE");
    }
  });

  it("13–15: editorial Brand fields round-trip without provider Brand; Country/ownership untouched", async () => {
    const tree = asMediaPlpPresentationNode(
      buildCanonicalEditorialPresentation({
        overview: CIVIC_MEDIA_OVERVIEW,
        faq: [...CIVIC_MEDIA_FAQ],
      }),
    );
    const policy = resolveFieldPolicyForEntityType(
      MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_EDITORIAL,
    );
    const autoValues: Record<string, string> = {};
    for (const node of collectAutoPaths(tree)) {
      if (isCollectedPathMachineEligible(node.path, policy)) {
        autoValues[node.path] = node.value;
      }
    }
    const { payload } = buildProviderOwnedMachinePayload(autoValues);
    assert.equal(assertProviderPayloadHasNoBrandArtifacts(payload).length, 0);
    assert.ok(
      Object.keys(payload).some((k) => k.includes("faq[2].question#m")),
    );

    resetMediaPlpMaterializerCountersForTests();
    const result = await callMediaPlpMaterializerProviderOnce({
      provider: new FakeLocalMediaPlpTransport({}),
      locale: "uk",
      autoValues,
      sourceRecordId: "civic_media_editorial:civic-media-center",
      sourceVersion: "v-2dd8a2b73768d26f",
      PROVIDER_TRANSPORT: MEDIA_PLP_FAKE_LOCAL_TRANSPORT_ID,
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.match(result.values["faq[2].question"]!, /\{siteName\}/);
    assert.match(result.values["faq[0].answer"]!, /\{siteName\}/);

    const { readFileSync } = await import("node:fs");
    const { dirname, join } = await import("node:path");
    const { fileURLToPath } = await import("node:url");
    const apiRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");
    const diag = readFileSync(
      join(
        apiRoot,
        "src/modules/language/media-plp-carousel/media-live-closure-diagnostic.ts",
      ),
      "utf8",
    );
    assert.doesNotMatch(diag, /callMediaPlpMaterializerProviderOnce|enqueuePlpBuildRequest/);
    const editorial = readFileSync(
      join(
        apiRoot,
        "src/modules/language/published-localized-presentation/universal/editorial-build-trigger.ts",
      ),
      "utf8",
    );
    assert.match(editorial, /reopenFailedSameVersion:\s*true/);
  });
});

function countBrandSlots(text: string): number {
  return (text.match(/\{siteName\}/g) ?? []).length;
}
