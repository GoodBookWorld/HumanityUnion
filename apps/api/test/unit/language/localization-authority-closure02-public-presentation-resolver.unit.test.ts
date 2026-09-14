/**
 * Localization Authority Closure 02 — executable public presentation resolver.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  COLLABORATIVE_ANALYSIS_CONTROLLED_CONCEPT_IDS,
  LOCALIZATION_RESOLUTION_PRIORITY,
  PUBLIC_PRESENTATION_AUTHORITY,
  applyControlledPublicVocabularyToProse,
  lifecycleStageToken,
  resolveControlledLifecycleLabel,
  resolveProtectedPublicNewsField,
  resolvePublicPresentationField,
} from "@hu/types";

const here = path.dirname(fileURLToPath(import.meta.url));
const typesDomain = path.resolve(
  here,
  "../../../../../packages/types/src/domain",
);

function readTypesDomain(file: string): string {
  return readFileSync(path.join(typesDomain, file), "utf8");
}

describe("Localization Authority Closure 02 — resolvePublicPresentationField", () => {
  it("A. Legal localized value beats Brand and machine translation", () => {
    const result = resolvePublicPresentationField({
      legal: "Counsel text",
      brand: "Brand text",
      persistedTranslation: "Machine text",
      persistedTranslationMechanism: "content_translation",
    });
    assert.equal(result?.authority, "LEGAL");
    assert.equal(result?.value, "Counsel text");
    assert.equal(result?.presence, "localized_higher_authority");
  });

  it("B. Brand beats persisted machine translation", () => {
    const result = resolvePublicPresentationField({
      brand: "Published Brand",
      persistedTranslation: "MT Brand",
      persistedTranslationMechanism: "published_localized_presentation",
    });
    assert.equal(result?.authority, "BRAND");
    assert.equal(result?.value, "Published Brand");
  });

  it("C. Manual/author localized value beats machine translation", () => {
    const result = resolvePublicPresentationField({
      manualAuthor: "Author copy",
      persistedTranslation: "MT copy",
    });
    assert.equal(result?.authority, "MANUAL_AUTHOR");
  });

  it("D. Terminology preferredTerm beats WEB_UI lifecycle label", () => {
    const result = resolvePublicPresentationField({
      controlledLifecycle: {
        terminologyPreferredTerm: "Спільний аналіз",
        webUiControlledLabel: "WEB_UI label",
        registryCanonicalEnglishLabel: "Collaborative Analysis",
        stageId: "analysis",
      },
    });
    assert.equal(result?.authority, "CONTROLLED_VOCABULARY");
    assert.equal(result?.value, "Спільний аналіз");
    assert.equal(result?.controlledLifecycleSource, "terminology_preferred_term");
  });

  it("E. Missing Terminology + existing WEB_UI lifecycle label returns WEB_UI not English", () => {
    const result = resolvePublicPresentationField({
      controlledLifecycle: {
        terminologyPreferredTerm: null,
        webUiControlledLabel: "التحليل التعاوني",
        registryCanonicalEnglishLabel: "Collaborative Analysis",
        stageId: "analysis",
      },
    });
    assert.equal(result?.value, "التحليل التعاوني");
    assert.equal(result?.controlledLifecycleSource, "web_ui_controlled_label");
    assert.notEqual(result?.value, "Collaborative Analysis");
  });

  it("F. Geography beats persisted machine translation", () => {
    const result = resolvePublicPresentationField({
      geography: "Україна",
      persistedTranslation: "Ukraine (MT)",
    });
    assert.equal(result?.authority, "GEOGRAPHY");
    assert.equal(result?.value, "Україна");
  });

  it("G. Persisted CT/PLP value beats canonical English fallback", () => {
    const ct = resolvePublicPresentationField({
      persistedTranslation: "CT title",
      persistedTranslationMechanism: "content_translation",
      canonicalEnglishFallback: "English title",
    });
    assert.equal(ct?.authority, "PERSISTED_TRANSLATION");
    assert.equal(ct?.persistedTranslationMechanism, "content_translation");

    const plp = resolvePublicPresentationField({
      persistedTranslation: "PLP title",
      persistedTranslationMechanism: "published_localized_presentation",
      canonicalEnglishFallback: "English title",
    });
    assert.equal(plp?.authority, "PERSISTED_TRANSLATION");
    assert.equal(plp?.persistedTranslationMechanism, "published_localized_presentation");
  });

  it("H. Protected canonical remains unchanged even when machine translation exists", () => {
    const result = resolvePublicPresentationField({
      protectedCanonical: "Original RSS headline",
      persistedTranslation: "Translated headline",
    });
    assert.equal(result?.authority, "PROTECTED_CANONICAL");
    assert.equal(result?.value, "Original RSS headline");
    assert.equal(result?.presence, "intentional_protected_canonical");
  });

  it("I. public_news original content remains protected", () => {
    const result = resolveProtectedPublicNewsField({
      originalTitleOrSummary: "Source-language RSS title",
      persistedTranslation: "Should never win",
    });
    assert.equal(result?.authority, "PROTECTED_CANONICAL");
    assert.equal(result?.presence, "intentional_protected_canonical");
    assert.equal(result?.value, "Source-language RSS title");
  });

  it("J. Blank high-authority candidate falls through correctly", () => {
    const result = resolvePublicPresentationField({
      legal: "   ",
      brand: "",
      persistedTranslation: "Localized body",
      canonicalEnglishFallback: "English body",
    });
    assert.equal(result?.authority, "PERSISTED_TRANSLATION");
    assert.equal(result?.value, "Localized body");
  });

  it("K. Resolver reports winning authority/provenance correctly", () => {
    const result = resolvePublicPresentationField({
      controlledLifecycle: {
        terminologyPreferredTerm: null,
        webUiControlledLabel: "協作分析",
        stageId: "analysis",
      },
      persistedTranslation: "ignored",
    });
    assert.equal(result?.authority, "CONTROLLED_VOCABULARY");
    assert.equal(result?.controlledLifecycleSource, "web_ui_controlled_label");
    assert.equal(result?.presence, "localized_higher_authority");
  });

  it("L. uk/ar/zh-Hant produce identical authority behavior", () => {
    const locales = [
      { webUi: "Спільний аналіз", locale: "uk" },
      { webUi: "التحليل التعاوني", locale: "ar" },
      { webUi: "協作分析", locale: "zh-Hant" },
    ] as const;
    for (const row of locales) {
      const result = resolvePublicPresentationField({
        controlledLifecycle: {
          terminologyPreferredTerm: null,
          webUiControlledLabel: row.webUi,
          registryCanonicalEnglishLabel: "Collaborative Analysis",
        },
        persistedTranslation: "MT",
      });
      assert.equal(result?.authority, "CONTROLLED_VOCABULARY", row.locale);
      assert.equal(result?.value, row.webUi, row.locale);
      assert.equal(
        PUBLIC_PRESENTATION_AUTHORITY.indexOf("LEGAL") <
          PUBLIC_PRESENTATION_AUTHORITY.indexOf("BRAND"),
        true,
        row.locale,
      );
    }
  });

  it("N. Canonical English controlled label only when Terminology and WEB_UI absent", () => {
    const result = resolvePublicPresentationField({
      controlledLifecycle: {
        terminologyPreferredTerm: null,
        webUiControlledLabel: null,
        stageId: "discussion",
      },
    });
    assert.equal(result?.value, "Discussion");
    assert.equal(result?.authority, "CANONICAL_ENGLISH_FALLBACK");
    assert.equal(result?.controlledLifecycleSource, "registry_canonical_english");
    assert.equal(result?.presence, "canonical_english_fallback_only");
  });

  it("O. resolver modules do not depend on legacy Brand>Legal ordering", () => {
    const resolver = readTypesDomain("resolve-public-presentation-field.ts");
    const vocab = readTypesDomain("controlled-public-vocabulary.ts");
    for (const src of [resolver, vocab]) {
      // Executable imports must not pull the legacy Pack 08I.15 ladder.
      assert.doesNotMatch(
        src,
        /from ["'].*localization-ownership["']/,
      );
      assert.doesNotMatch(
        src,
        /\bimport\b[\s\S]*\bLOCALIZATION_RESOLUTION_PRIORITY\b/,
      );
    }
    // Legacy constant still Brand > Legal; normative ladder is Legal > Brand.
    assert.ok(
      LOCALIZATION_RESOLUTION_PRIORITY.indexOf("BRAND_LOCALIZATION") <
        LOCALIZATION_RESOLUTION_PRIORITY.indexOf("LEGAL_LOCALIZATION"),
    );
    assert.ok(
      PUBLIC_PRESENTATION_AUTHORITY.indexOf("LEGAL") <
        PUBLIC_PRESENTATION_AUTHORITY.indexOf("BRAND"),
    );
  });

  it("side-effect guarantee: resolver sources never invoke providers or writes", () => {
    const resolver = readTypesDomain("resolve-public-presentation-field.ts");
    const vocab = readTypesDomain("controlled-public-vocabulary.ts");
    for (const src of [resolver, vocab]) {
      assert.doesNotMatch(src, /\bTranslationProvider\b/);
      assert.doesNotMatch(src, /\bgenerateContent\b/);
      assert.doesNotMatch(src, /\bgemini\./i);
      assert.doesNotMatch(src, /\/translations\/generate/);
      assert.doesNotMatch(src, /\binsertOne\b|\bupdateOne\b|\benqueue\b|\bMongoClient\b/);
      assert.doesNotMatch(src, /\bpublishAtomic\b|\bmaterialize\b/);
    }
  });
});

describe("Localization Authority Closure 02 — controlled vocabulary safety", () => {
  it("M. Known controlled semantic terms localize without provider calls", () => {
    const analysisToken = lifecycleStageToken("analysis");
    const prose = `${analysisToken} of the Initiative during Discussion. Ready to Collaborate. Improvement Proposals follow.`;
    const applied = applyControlledPublicVocabularyToProse({
      prose,
      labelLookup: {
        analysis: {
          terminologyPreferredTerm: null,
          webUiControlledLabel: "Спільний аналіз",
          stageId: "analysis",
        },
        initiative: {
          terminologyPreferredTerm: null,
          webUiControlledLabel: "Ініціатива",
          stageId: "initiative",
        },
        discussion: {
          terminologyPreferredTerm: "Обговорення",
          webUiControlledLabel: "Discussion WEB_UI",
          stageId: "discussion",
        },
        proposal: {
          terminologyPreferredTerm: null,
          webUiControlledLabel: "Пропозиції покращення",
          stageId: "proposal",
        },
        ready_to_collaborate: {
          terminologyPreferredTerm: null,
          webUiControlledLabel: "Готовий до співпраці",
          registryCanonicalEnglishLabel: "Ready to Collaborate",
        },
      },
    });

    assert.match(applied.text, /Спільний аналіз/);
    assert.match(applied.text, /Ініціатива/);
    assert.match(applied.text, /Обговорення/);
    assert.match(applied.text, /Готовий до співпраці/);
    assert.match(applied.text, /Пропозиції покращення/);
    assert.doesNotMatch(applied.text, /Collaborative Analysis/);
    assert.doesNotMatch(applied.text, /\{lifecycleStage:/);
    assert.ok(applied.substitutions.length >= 4);

    for (const conceptId of COLLABORATIVE_ANALYSIS_CONTROLLED_CONCEPT_IDS) {
      assert.ok(
        applied.substitutions.some((row) => row.conceptId === conceptId),
        `expected substitution for ${conceptId}`,
      );
    }
  });

  it("Terminology preferredTerm wins inside prose substitution over WEB_UI", () => {
    const applied = applyControlledPublicVocabularyToProse({
      prose: "Collaborative Analysis draft",
      labelLookup: {
        analysis: {
          terminologyPreferredTerm: "Term CA",
          webUiControlledLabel: "UI CA",
          stageId: "analysis",
        },
      },
    });
    assert.equal(applied.text, "Term CA draft");
    assert.equal(applied.substitutions[0]?.source, "terminology_preferred_term");
  });

  it("missing Terminology uses WEB_UI in prose, not Registry English", () => {
    const applied = applyControlledPublicVocabularyToProse({
      prose: "See Collaborative Analysis",
      labelLookup: {
        analysis: {
          terminologyPreferredTerm: null,
          webUiControlledLabel: "التحليل التعاوني",
          stageId: "analysis",
        },
      },
    });
    assert.equal(applied.text, "See التحليل التعاوني");
    assert.equal(applied.substitutions[0]?.source, "web_ui_controlled_label");
  });

  it("does not invent substitutions for unregistered free text", () => {
    const applied = applyControlledPublicVocabularyToProse({
      prose: "Completely custom sentence about civic work.",
      labelLookup: {
        analysis: {
          webUiControlledLabel: "Спільний аналіз",
          stageId: "analysis",
        },
      },
    });
    assert.equal(applied.text, "Completely custom sentence about civic work.");
    assert.equal(applied.substitutions.length, 0);
  });
});

describe("Localization Authority Closure 02 — legacy consumer inventory", () => {
  it("LOCALIZATION_RESOLUTION_PRIORITY has no production selection consumers beyond re-export/tests", () => {
    // Closure 02 audit: production selection must use resolvePublicPresentationField.
    // This file and Closure 01 tests may reference the legacy constant for conflict documentation only.
    const apiOwnership = readFileSync(
      path.resolve(here, "../../../src/modules/language/localization-ownership.ts"),
      "utf8",
    );
    assert.match(apiOwnership, /LOCALIZATION_RESOLUTION_PRIORITY/);
    // Re-export only — no selection helper.
    assert.doesNotMatch(apiOwnership, /selectWinning|resolvePublic|Brand.*Legal.*indexOf/);
  });

  it("controlled lifecycle helper remains Terminology → WEB_UI → Registry", () => {
    const resolved = resolveControlledLifecycleLabel({
      terminologyPreferredTerm: "",
      webUiControlledLabel: "مقترحات التحسين",
      stageId: "proposal",
    });
    assert.equal(resolved.source, "web_ui_controlled_label");
    assert.equal(resolved.label, "مقترحات التحسين");
  });
});
