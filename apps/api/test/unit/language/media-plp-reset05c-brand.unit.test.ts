/**
 * RESET 05C — API-side Brand FAQ authority (canonical tokens + provenance).
 * Fingerprint: `{siteName}` in CIVIC_MEDIA_FAQ changes civic_media_editorial
 * canonicalVersion — editorial snapshot rebuild is deferred (no materialize here).
 *
 * RESET 05D.6/05E — Brand stays outside Gemini via slot extraction (not sentinel wrap).
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  BRAND_SITE_NAME_TOKEN,
  CANONICAL_ENGLISH_BRAND_FALLBACK,
  PUBLISHED_LOCALIZATION_PROVENANCE_PRIORITY,
  assertProviderPayloadHasNoBrandArtifacts,
  buildProviderOwnedMachinePayload,
  composeBrandTokens,
  reassembleBrandSlotPlans,
} from "@hu/types";

import { CIVIC_MEDIA_FAQ } from "../../../src/modules/civic-media-center/content/sections.js";
import { mayOverwriteProvenance } from "../../../src/modules/language/published-localized-presentation/provenance-priority.js";
import { buildCanonicalEditorialPresentation } from "../../../src/modules/language/published-localized-presentation/media/canonical-trees.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const apiRoot = path.resolve(here, "../../..");

function readApi(relative: string): string {
  return readFileSync(path.join(apiRoot, relative), "utf8");
}

describe("RESET 05C — API Media FAQ Brand tokens", () => {
  it("CIVIC_MEDIA_FAQ embeds {siteName}; English Brand fallback still composes Humanity Union", () => {
    const branded = CIVIC_MEDIA_FAQ.filter(
      (item) =>
        item.question.includes(BRAND_SITE_NAME_TOKEN) ||
        item.answer.includes(BRAND_SITE_NAME_TOKEN),
    );
    assert.ok(branded.length >= 3);
    for (const item of branded) {
      assert.doesNotMatch(item.question, /Humanity Union/);
      assert.doesNotMatch(item.answer, /Humanity Union/);
    }

    const verify = CIVIC_MEDIA_FAQ.find((i) => i.id === "verify-every-article");
    assert.ok(verify);
    const composed = composeBrandTokens(verify!.question, {
      siteName: CANONICAL_ENGLISH_BRAND_FALLBACK.siteName,
    });
    assert.equal(composed, "Does Humanity Union verify every article?");

    const uk = composeBrandTokens(verify!.answer, {
      siteName: "Союз Людяності",
    });
    assert.match(uk, /Союз Людяності/);
    assert.doesNotMatch(uk, /Humanity Union|\{siteName\}/);
  });

  it("editorial canonical tree carries tokens (fingerprint changes vs prior literals)", () => {
    const tree = buildCanonicalEditorialPresentation({
      overview: {
        title: "Why trustworthy information matters",
        summary: "Summary",
        points: [],
      },
      faq: [...CIVIC_MEDIA_FAQ],
    });
    const serialized = JSON.stringify(tree.faq);
    assert.match(serialized, /\{siteName\}/);
    assert.doesNotMatch(serialized, /Humanity Union/);
  });

  it("BRAND provenance beats MACHINE", () => {
    assert.equal(
      mayOverwriteProvenance({
        existing: "BRAND_LOCALIZATION",
        incoming: "MACHINE",
      }),
      false,
    );
    assert.equal(
      mayOverwriteProvenance({
        existing: "MACHINE",
        incoming: "BRAND_LOCALIZATION",
      }),
      true,
    );
    assert.ok(
      PUBLISHED_LOCALIZATION_PROVENANCE_PRIORITY.indexOf("BRAND_LOCALIZATION") <
        PUBLISHED_LOCALIZATION_PROVENANCE_PRIORITY.indexOf("MACHINE"),
    );
  });

  it("provider boundary keeps Brand outside Gemini via slot extraction (RESET 05D.6/05E)", () => {
    const source = "{siteName} curates sources.";
    const { payload, plans } = buildProviderOwnedMachinePayload({
      "faq[0].answer": source,
    });
    assert.equal(assertProviderPayloadHasNoBrandArtifacts(payload).length, 0);
    const translatedSegments: Record<string, string> = {};
    for (const [key, value] of Object.entries(payload)) {
      translatedSegments[key] = value.replace("curates", "відбирає");
    }
    const reassembled = reassembleBrandSlotPlans({
      plans,
      translatedSegments,
    });
    assert.equal(reassembled.values["faq[0].answer"], "{siteName} відбирає sources.");

    const boundary = readApi(
      "src/modules/language/media-plp-materializer/provider-boundary.ts",
    );
    assert.match(boundary, /buildProviderOwnedMachinePayload/);
    assert.match(boundary, /reassembleBrandSlotPlans/);
    assert.doesNotMatch(boundary, /replaceAll\(\s*["']Humanity Union["']/);
  });
});
