/**
 * Reset 03C — web Media PLP consumer gate (SSR resolve wiring; flag default OFF).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { afterEach, describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  MEDIA_PLP_ENTITY_TYPE,
  mediaPlpTrustedEntityId,
  type TrustedMediaResource,
} from "@hu/types";

import {
  isMediaPlpWebEnabled,
  setMediaPlpWebEnabledForTests,
} from "./feature-flag.js";
import {
  buildCanonicalTrustedPresentationNode,
  loadMediaPlpTrustedPresentations,
} from "./load-media-plp-ssr.js";
import { readMediaPlpStringField } from "./presentation.js";

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

afterEach(() => {
  setMediaPlpWebEnabledForTests(null);
});

describe("Reset 03C web Media PLP consumer", () => {
  it("N: flag defaults OFF; OFF skips PLP loader", async () => {
    setMediaPlpWebEnabledForTests(null);
    assert.equal(isMediaPlpWebEnabled(), false);
    const off = await loadMediaPlpTrustedPresentations({
      resources: [reuters],
      locale: "uk",
    });
    assert.equal(off, null);
  });

  it("A/B/F: injected resolve yields localized reuters + canonical atlantic; no mix", async () => {
    setMediaPlpWebEnabledForTests(true);
    const map = await loadMediaPlpTrustedPresentations({
      resources: [reuters, atlantic],
      locale: "uk",
      resolve: async ({ entityId, canonicalPresentation, locale }) => {
        if (entityId === "reuters") {
          const presentation =
            typeof canonicalPresentation === "object" &&
            canonicalPresentation !== null &&
            !Array.isArray(canonicalPresentation)
              ? {
                  ...(canonicalPresentation as Record<string, unknown>),
                  explanation: "[uk] Independent international news agency",
                }
              : { explanation: "[uk] Independent international news agency" };
          return {
            mode: "PUBLISHED_LOCALIZED",
            presentation: presentation as typeof canonicalPresentation,
            entityType: MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_TRUSTED,
            entityId,
            locale,
            canonicalVersion: "v-fixture",
          };
        }
        return {
          mode: "CANONICAL_FALLBACK",
          presentation: canonicalPresentation,
          entityType: MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_TRUSTED,
          entityId,
          locale,
          canonicalVersion: "v-fixture",
        };
      },
    });
    assert.ok(map);
    const reutersResolved = map.reuters;
    const atlanticResolved = map["the-atlantic"];
    assert.ok(reutersResolved);
    assert.ok(atlanticResolved);
    assert.equal(reutersResolved.mode, "PUBLISHED_LOCALIZED");
    assert.equal(atlanticResolved.mode, "CANONICAL_FALLBACK");
    assert.equal(
      readMediaPlpStringField(reutersResolved.presentation, "explanation"),
      "[uk] Independent international news agency",
    );
    assert.equal(
      readMediaPlpStringField(atlanticResolved.presentation, "explanation"),
      atlantic.explanation,
    );
    assert.notEqual(reutersResolved.mode, atlanticResolved.mode);
  });

  it("K: shared trusted identity", () => {
    assert.equal(mediaPlpTrustedEntityId(reuters.id), "reuters");
    const node = buildCanonicalTrustedPresentationNode(reuters);
    assert.ok(node);
  });

  it("G/H/I: PLP modules exclude provider/generate/write paths", () => {
    const files = [
      "features/language/media-plp/load-media-plp-ssr.ts",
      "features/language/media-plp/media-plp-api.ts",
      "features/language/media-plp/CivicMediaCenterPlpContent.tsx",
      "features/language/media-plp/MediaPlpTrustedCard.tsx",
      "app/media/page.tsx",
    ];
    for (const rel of files) {
      const text = readFileSync(join(webSrc, rel), "utf8");
      assert.doesNotMatch(
        text,
        /generateContentTranslation|gemini|thin-gemini|media-plp-materializer|GEMINI_API_KEY/,
      );
    }

    const country = readFileSync(
      join(webSrc, "features/country-experience/components/CountryExperienceDynamicPage.tsx"),
      "utf8",
    );
    assert.match(country, /initialPlpTrustedById != null/);
    assert.doesNotMatch(
      country,
      /isMediaPlpWebEnabled\(\) && initialPlpTrustedById/,
    );
    assert.match(country, /disabled:\s*true/);
  });

  it("legacy path preserved when flag OFF (media page still has legacy branch)", () => {
    const mediaRoute = readFileSync(join(webSrc, "app/media/page.tsx"), "utf8");
    assert.match(mediaRoute, /CivicMediaCenterPageContent/);
    assert.match(mediaRoute, /loadCivicMediaEditorialSeed/);
    assert.match(mediaRoute, /isMediaPlpWebEnabled/);
  });

  it("ledger marks consumer ready pending live acceptance; ACTIVE count unchanged", () => {
    const ledger = readFileSync(
      join(
        repoRoot,
        "project/architecture/core/PUBLISHED_LOCALIZATION_LEGACY_REMOVAL_LEDGER_v1.0.md",
      ),
      "utf8",
    );
    assert.match(ledger, /CONSUMER_READY_PENDING_LIVE_ACCEPTANCE/);
    assert.match(ledger, /LEGACY_ACTIVE_RUNTIME_DEFAULT` \| \*\*30\*\*/);
  });
});
