/**
 * Materializer machine-path filter — structural IDs must not enter provider payload.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { MEDIA_PLP_ENTITY_TYPE } from "@hu/types";

import { CIVIC_MEDIA_FAQ, CIVIC_MEDIA_OVERVIEW } from "../../../src/modules/civic-media-center/content/sections.js";
import { resolveMediaPlpMaterializerSource } from "../../../src/modules/language/media-plp-materializer/source-resolve.js";
import {
  asMediaPlpPresentationNode,
  buildCanonicalEditorialPresentation,
  collectAutoPaths,
  inventoryPresentationPathAuthority,
  isCollectedPathMachineEligible,
  isTechnicalIdentityPath,
} from "../../../src/modules/language/published-localized-presentation/index.js";
import {
  MEDIA_PLP_EDITORIAL_FIELD_POLICY,
  resolveMediaPlpFieldPolicy,
} from "../../../src/modules/language/published-localized-presentation/universal/adapters/media-plp-field-policies.js";
import { validateMediaPlpProviderLocalizationValues } from "../../../src/modules/language/media-plp-materializer/provider-boundary.js";

describe("Media PLP materializer machine-path eligibility", () => {
  it("1. editorial materializer autoPaths exclude structural *.id (18 MACHINE prose only)", async () => {
    const source = await resolveMediaPlpMaterializerSource({
      entityType: MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_EDITORIAL,
      entityId: "civic-media-center",
      locale: "zh-Hant",
    });
    assert.equal(source.SOURCE_FOUND, true);
    assert.equal(source.autoPaths.length, 18);
    assert.equal(
      source.autoPaths.every((node) => !isTechnicalIdentityPath(node.path)),
      true,
    );
    assert.ok(source.autoPaths.some((n) => n.path === "faq[3].question"));
    assert.ok(source.autoPaths.some((n) => n.path === "faq[4].answer"));

    const tree = asMediaPlpPresentationNode(
      buildCanonicalEditorialPresentation({
        overview: CIVIC_MEDIA_OVERVIEW,
        faq: [...CIVIC_MEDIA_FAQ],
      }),
    );
    const inventory = inventoryPresentationPathAuthority({
      leaves: collectAutoPaths(tree),
      fieldPolicy: MEDIA_PLP_EDITORIAL_FIELD_POLICY,
    });
    assert.equal(inventory.TOTAL_SEMANTIC_LEAVES, 26);
    assert.equal(inventory.MACHINE_CONTENT_PATHS.length, 18);
    assert.equal(inventory.PROTECTED_PATHS.length, 8);
    assert.deepEqual(
      [...source.autoPaths.map((n) => n.path)].sort(),
      [...inventory.MACHINE_CONTENT_PATHS].sort(),
    );
  });

  it("2. field policy marks FAQ/overview IDs non-machine for any future locale", () => {
    const policy = resolveMediaPlpFieldPolicy(
      MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_EDITORIAL,
    );
    assert.equal(isCollectedPathMachineEligible("faq[3].id", policy), false);
    assert.equal(isCollectedPathMachineEligible("faq[4].id", policy), false);
    assert.equal(
      isCollectedPathMachineEligible("overviewPoints[0].id", policy),
      false,
    );
    assert.equal(isCollectedPathMachineEligible("faq[3].question", policy), true);
    assert.equal(isCollectedPathMachineEligible("faq[4].answer", policy), true);
    // Generic script/region locale does not change ownership.
    assert.equal(
      resolveMediaPlpFieldPolicy(MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_EDITORIAL),
      MEDIA_PLP_EDITORIAL_FIELD_POLICY,
    );
  });

  it("3. integrity still rejects English-identical FAQ prose (not weakened)", () => {
    const faq3 = CIVIC_MEDIA_FAQ[3]!;
    const faq4 = CIVIC_MEDIA_FAQ[4]!;
    const autoValues = {
      "faq[3].question": faq3.question,
      "faq[4].question": faq4.question,
      "faq[4].answer": faq4.answer,
    };
    const result = validateMediaPlpProviderLocalizationValues({
      locale: "sr-Latn",
      autoValues,
      translated: {
        "faq[3].question": "Da li {siteName} verifikuje svaki članak?",
        // Remaining FAQ prose left English-identical → CONTENT_INTEGRITY_FAILURE
        "faq[4].question": faq4.question,
        "faq[4].answer": faq4.answer,
      },
    });
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.reason, "LOCALIZATION_CONTENT_INTEGRITY_FAILED");
    assert.match(result.message, /CONTENT_INTEGRITY_FAILURE/);
  });
});
