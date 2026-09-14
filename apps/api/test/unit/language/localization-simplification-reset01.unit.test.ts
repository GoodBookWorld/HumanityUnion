/**
 * Localization Simplification Reset 01 — product behavior regressions.
 * Visible content is the localization boundary (CA + Media).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  COLLABORATIVE_ANALYSIS_BROWSER_VISIBLE_PROSE_FIELDS,
  isCompleteLocalizedProseBag,
} from "@hu/types";

import { resolveStructuredTranslatedDisplay } from "../../../src/modules/language/resolve-translated-display.js";
import type { TranslatedContentRecord } from "@hu/types";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "../../../../..");
const webRoot = path.resolve(here, "../../../../web");

function translation(
  fields: Record<string, string>,
  targetLanguage = "uk",
): TranslatedContentRecord {
  return {
    translationId: "t1",
    sourceKind: "collaborative_analysis",
    sourceRecordId: "ca-1",
    sourceLanguage: "en",
    targetLanguage,
    sourceVersion: "v1",
    translatedContent: fields,
    translationProvider: "deterministic",
    translationKind: "machine",
    freshness: "current",
    stale: false,
    createdAt: "2020-01-01T00:00:00.000Z",
    updatedAt: "2020-01-01T00:00:00.000Z",
  };
}

describe("Reset 01 — visible content localization boundary", () => {
  it("1. CA partial localized bag cannot present (falls back to coherent original)", () => {
    const originalFields = {
      title: "T",
      summary: "S",
      supportingEvidence: "Supporting Arguments body",
      risks: "R",
      openQuestions: "Q",
      suggestedImprovements: "Rec",
      references: "Ref",
    };
    const resolved = resolveStructuredTranslatedDisplay({
      originalFields,
      originalLanguage: "en",
      preferredReadingLanguage: "uk",
      translations: [
        translation({
          title: "Заголовок",
          summary: "Підсумок",
          // supportingEvidence omitted — incomplete
          risks: "Ризики",
          openQuestions: "Питання",
          suggestedImprovements: "Рек",
          references: "Посилання",
        }),
      ],
    });
    assert.equal(resolved.presentationMode, "original");
    assert.equal(resolved.content.supportingEvidence, "Supporting Arguments body");
    assert.equal(resolved.content.summary, "S");
    assert.equal(resolved.isMachineTranslated, false);
  });

  it("2. All CA browser-visible prose fields are inside the localization boundary", () => {
    assert.deepEqual(
      [...COLLABORATIVE_ANALYSIS_BROWSER_VISIBLE_PROSE_FIELDS],
      [
        "title",
        "summary",
        "supportingEvidence",
        "risks",
        "openQuestions",
        "suggestedImprovements",
        "references",
      ],
    );

    const publicResult = readFileSync(
      path.join(
        webRoot,
        "src/features/initiative-collaborative-analysis/components/InitiativeCollaborativeAnalysisPublicResult.tsx",
      ),
      "utf8",
    );
    assert.match(publicResult, /COLLABORATIVE_ANALYSIS_BROWSER_VISIBLE_PROSE_FIELDS/);
    assert.doesNotMatch(publicResult, /presentCollaborativeAnalysisFieldsWithControlledVocabulary/);

    const publicFields = readFileSync(
      path.join(webRoot, "src/features/language/components/PublicTranslatedFields.tsx"),
      "utf8",
    );
    assert.match(publicFields, /isCompleteLocalizedProseBag/);
    assert.doesNotMatch(publicFields, /presentCollaborativeAnalysisFieldsWithControlledVocabulary/);
    assert.doesNotMatch(publicFields, /value \|\| original/);

    const eligibility = readFileSync(
      path.join(
        repoRoot,
        "apps/api/src/modules/language/content-translation-eligibility.ts",
      ),
      "utf8",
    );
    assert.match(eligibility, /COLLABORATIVE_ANALYSIS_BROWSER_VISIBLE_PROSE_FIELDS/);
  });

  it("3. Media HU-owned prose groups are PLP-owned including news carousel", () => {
    const inventory = readFileSync(
      path.join(webRoot, "src/features/language/media-plp/media-semantic-inventory.ts"),
      "utf8",
    );
    assert.match(inventory, /overview\.title[\s\S]*PLP_ENTITY/);
    assert.match(inventory, /principles\.description[\s\S]*PLP_ENTITY/);
    assert.match(inventory, /trusted\.explanation[\s\S]*PLP_ENTITY/);
    assert.match(inventory, /fact\.mission[\s\S]*PLP_ENTITY/);
    assert.match(inventory, /propaganda\.explanation[\s\S]*PLP_ENTITY/);
    assert.match(inventory, /faq[\s\S]*PLP_ENTITY/);
    assert.match(inventory, /news\.card\.title[\s\S]*PLP_ENTITY/);
    assert.match(inventory, /news\.card\.summary[\s\S]*PLP_ENTITY/);

    const groups = readFileSync(
      path.join(webRoot, "src/features/language/media-plp/media-browser-visible-prose.ts"),
      "utf8",
    );
    for (const group of [
      "overview",
      "faq",
      "selection-principles",
      "trusted-media",
      "fact-checking",
      "propaganda-analysis",
      "news-carousel",
    ]) {
      assert.match(groups, new RegExp(`"${group}"`));
    }
    assert.match(groups, /MEDIA_PUBLIC_PLP_ENTITY_TYPES[\s\S]*"public_news"/);
  });

  it("4. Media apply refuses hybrid field bags (whole-entity or canonical)", () => {
    const apply = readFileSync(
      path.join(webRoot, "src/features/language/media-plp/apply-media-plp-editorial.ts"),
      "utf8",
    );
    assert.doesNotMatch(apply, /heading \|\| point\.heading/);
    assert.doesNotMatch(apply, /question \|\| item\.question/);
    assert.match(apply, /Whole-entity/);
    assert.match(apply, /mission\.trim\(\) && coverage\.trim\(\)/);
    assert.match(apply, /focus\.trim\(\) && explanation\.trim\(\)/);
  });

  it("5. Public read paths make zero provider calls", () => {
    for (const rel of [
      "apps/web/src/features/language/components/PublicTranslatedFields.tsx",
      "apps/web/src/features/initiative-collaborative-analysis/components/InitiativeCollaborativeAnalysisPublicResult.tsx",
      "apps/web/src/features/language/media-plp/compose-media-page-localization.ts",
      "apps/web/src/features/language/media-plp/apply-media-plp-editorial.ts",
    ]) {
      const src = readFileSync(path.join(repoRoot, rel), "utf8");
      assert.doesNotMatch(src, /\bTranslationProvider\b/);
      assert.doesNotMatch(src, /generateContentTranslation/);
      assert.doesNotMatch(src, /\/translations\/generate/);
    }
  });

  it("6. Complete CA bag may present as localized", () => {
    const originalFields = Object.fromEntries(
      COLLABORATIVE_ANALYSIS_BROWSER_VISIBLE_PROSE_FIELDS.map((key) => [key, `en-${key}`]),
    );
    const localizedFields = Object.fromEntries(
      COLLABORATIVE_ANALYSIS_BROWSER_VISIBLE_PROSE_FIELDS.map((key) => [key, `uk-${key}`]),
    );
    assert.equal(
      isCompleteLocalizedProseBag({ originalFields, localizedFields }),
      true,
    );
    const resolved = resolveStructuredTranslatedDisplay({
      originalFields,
      originalLanguage: "en",
      preferredReadingLanguage: "uk",
      translations: [translation(localizedFields)],
    });
    assert.equal(resolved.presentationMode, "preferred_translation");
    assert.equal(resolved.content.supportingEvidence, "uk-supportingEvidence");
  });

  it("7. Media PLP is the default public owner (legacy CT bypassed unless forced)", () => {
    const webFlag = readFileSync(
      path.join(webRoot, "src/features/language/media-plp/feature-flag.ts"),
      "utf8",
    );
    assert.match(webFlag, /Default ON/);
    assert.match(webFlag, /sole public Media presentation owner/);

    const apiFlag = readFileSync(
      path.join(
        repoRoot,
        "apps/api/src/modules/language/published-localized-presentation/media/feature-flag.ts",
      ),
      "utf8",
    );
    assert.match(apiFlag, /sole public presentation owner by default/);

    const resolveBody = readFileSync(
      path.join(
        webRoot,
        "src/features/language/media-plp/resolve-media-public-hu-owned-body.ts",
      ),
      "utf8",
    );
    assert.match(resolveBody, /legacy_ct_only_when_plp_disabled/);
    assert.match(resolveBody, /Prefer PLP over legacy CT/);
  });
});
