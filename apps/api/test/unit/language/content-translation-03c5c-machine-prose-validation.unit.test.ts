/**
 * Localization Closure 03C.5C — validate CA machine prose before lifecycle reassembly.
 *
 * CA CURRENT completeness is structural: every eligible machine segment must be
 * present and non-empty. Equality with source is not a reject reason for prose.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, it } from "node:test";

process.env.TRANSLATION_PROVIDER = "deterministic";

import { lifecycleStageToken } from "@hu/types";

import {
  assertCivicTitleFieldsTranslatedFromSource,
  assertCollaborativeAnalysisMachineCivicTitleTranslated,
  assertCollaborativeAnalysisMachineProseTranslated,
  assertTranslatedProseChangedFromSource,
  ContentTranslationValidationError,
  DeterministicTranslationProvider,
  ensureLanguageRegistrySeeded,
  ensureTerminologyGlossarySeeded,
  resetContentTranslationMemoryStoreForTests,
  resetLanguageRegistryStoreForTests,
  resetTerminologyGlossaryStoreForTests,
  resetTranslationProviderForTests,
  setLanguageRegistryForceMemoryForTests,
  setTerminologyGlossaryForceMemoryForTests,
  setTranslationProviderForTests,
  translateCollaborativeAnalysisFieldsWithLifecycleSlots,
  updateLanguageRegistryRecord,
  updateTerminologyConcept,
} from "../../../src/modules/language/index.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../..");
const ANALYSIS = lifecycleStageToken("analysis");
const DISCUSSION = lifecycleStageToken("discussion");

const CA_FIELDS = {
  title: `${ANALYSIS}: Climate Safety`,
  summary: `Review ${DISCUSSION} signals carefully.`,
  supportingEvidence: "Evidence line.",
  risks: "Risk line.",
  openQuestions: "Question line.",
  suggestedImprovements: "Improvement line.",
  references: `See ${DISCUSSION}.`,
} as const;

describe("Localization Closure 03C.5C — CA machine prose before reassembly", () => {
  beforeEach(async () => {
    setLanguageRegistryForceMemoryForTests(true);
    setTerminologyGlossaryForceMemoryForTests(true);
    resetLanguageRegistryStoreForTests();
    resetTerminologyGlossaryStoreForTests();
    resetContentTranslationMemoryStoreForTests();
    resetTranslationProviderForTests();
    await ensureLanguageRegistrySeeded();
    await ensureTerminologyGlossarySeeded();
    await updateLanguageRegistryRecord("lang-uk", {
      enabled: true,
      contentTranslationEnabled: true,
    });
    await updateTerminologyConcept("collaborative_analysis", {
      translations: {
        uk: { preferredTerm: "Спільний аналіз", aliases: [] },
      },
    });
    await updateTerminologyConcept("discussion", {
      translations: {
        uk: { preferredTerm: "Обговорення", aliases: [] },
      },
    });
    setTranslationProviderForTests(new DeterministicTranslationProvider());
  });

  afterEach(() => {
    resetTranslationProviderForTests();
    resetContentTranslationMemoryStoreForTests();
    resetTerminologyGlossaryStoreForTests();
    resetLanguageRegistryStoreForTests();
    setTerminologyGlossaryForceMemoryForTests(false);
    setLanguageRegistryForceMemoryForTests(false);
  });

  it("A. one required eligible field missing → reject", () => {
    assert.throws(
      () =>
        assertCollaborativeAnalysisMachineProseTranslated({
          sourceLanguage: "en",
          targetLanguage: "xx-TEST",
          machinePayload: {
            "summary#m0": "Review signals carefully.",
            "risks#m0": "Flood risk remains.",
          },
          translatedSegments: {
            "summary#m0": "[xx] Review signals carefully.",
          },
        }),
      (error: unknown) =>
        error instanceof ContentTranslationValidationError &&
        error.reasonCode === "MISSING_REQUIRED_PATH",
    );
  });

  it("B. malformed/empty required localized field → reject", () => {
    assert.throws(
      () =>
        assertCollaborativeAnalysisMachineProseTranslated({
          sourceLanguage: "en",
          targetLanguage: "xx-TEST",
          machinePayload: {
            "summary#m0": "Review signals carefully.",
            "risks#m0": "Flood risk remains.",
          },
          translatedSegments: {
            "summary#m0": "[xx] Review signals carefully.",
            "risks#m0": "   ",
          },
        }),
      (error: unknown) =>
        error instanceof ContentTranslationValidationError &&
        error.reasonCode === "MISSING_REQUIRED_PATH",
    );
  });

  it("C. all required fields structurally represented → accept", () => {
    assert.doesNotThrow(() =>
      assertCollaborativeAnalysisMachineProseTranslated({
        sourceLanguage: "en",
        targetLanguage: "xx-TEST",
        machinePayload: {
          "summary#m0": "Review signals carefully.",
          "risks#m0": "Flood risk remains.",
          "references#m0": "https://example.org/report",
        },
        translatedSegments: {
          "summary#m0": "[xx] Review signals carefully.",
          "risks#m0": "[xx] Flood risk remains.",
          "references#m0": "https://example.org/report",
        },
      }),
    );
  });

  it("D. legitimate identical localized value does not fail solely due to equality", () => {
    assert.doesNotThrow(() =>
      assertCollaborativeAnalysisMachineProseTranslated({
        sourceLanguage: "en",
        targetLanguage: "xx-TEST",
        machinePayload: {
          "summary#m0": "Review signals carefully.",
          "risks#m0": "Flood risk remains.",
          "openQuestions#m0": "What timeline fits?",
        },
        translatedSegments: {
          "summary#m0": "Review signals carefully.",
          "risks#m0": "Flood risk remains.",
          "openQuestions#m0": "What timeline fits?",
        },
      }),
    );
  });

  it("E. quoted/source-preserved content remains allowed", () => {
    const quoted = `"The river breached at midnight," the mayor said.`;
    assert.doesNotThrow(() =>
      assertCollaborativeAnalysisMachineProseTranslated({
        sourceLanguage: "en",
        targetLanguage: "xx-TEST",
        machinePayload: {
          "summary#m0": "Community impact remains elevated.",
          "supportingEvidence#m0": quoted,
          "references#m0": "https://example.org/a",
        },
        translatedSegments: {
          "summary#m0": "[xx] Community impact remains elevated.",
          "supportingEvidence#m0": quoted,
          "references#m0": "https://example.org/a",
        },
      }),
    );
  });

  it("F. arbitrary Registry locale works without locale branching", () => {
    assert.doesNotThrow(() =>
      assertCollaborativeAnalysisMachineProseTranslated({
        sourceLanguage: "en",
        targetLanguage: "zz-Future",
        machinePayload: {
          "summary#m0": "Review signals carefully.",
          "risks#m0": "Flood risk remains.",
        },
        translatedSegments: {
          "summary#m0": "Review signals carefully.",
          "risks#m0": "[zz] Flood risk remains.",
        },
      }),
    );

    const lifecycle = readFileSync(
      path.join(
        repoRoot,
        "apps/api/src/modules/language/content-translation-lifecycle-slots.ts",
      ),
      "utf8",
    );
    const assertFn = lifecycle.slice(
      lifecycle.indexOf("export function assertCollaborativeAnalysisMachineProseTranslated"),
      lifecycle.indexOf(
        "export function assertCollaborativeAnalysisMachineCivicTitleTranslated",
      ),
    );
    assert.doesNotMatch(assertFn, /targetLanguage\s*===\s*["'](uk|ar|zh)/);
    assert.doesNotMatch(assertFn, /\b(uk|ar|zh-Hant)\b/);
    assert.doesNotMatch(assertFn, /UNCHANGED_SOURCE_PROSE/);
    assert.doesNotMatch(assertFn, /isAllowedIdentical/);
  });

  it("G. civic-title machine prose unchanged still fails (existing title gate)", async () => {
    await assert.rejects(
      () =>
        translateCollaborativeAnalysisFieldsWithLifecycleSlots({
          sanitizedFields: {
            ...CA_FIELDS,
            summary: `Review ${DISCUSSION} signals carefully.`,
          },
          sourceLanguage: "en",
          targetLanguage: "uk",
          translatePayload: async (payload) => {
            const out: Record<string, string> = {};
            for (const [key, value] of Object.entries(payload)) {
              out[key] =
                key === "title" || key.startsWith("title#m")
                  ? value
                  : `[uk] ${value}`;
            }
            return out;
          },
        }),
      (error: unknown) =>
        error instanceof ContentTranslationValidationError &&
        error.reasonCode === "UNCHANGED_CIVIC_TITLE",
    );

    assert.throws(
      () =>
        assertCollaborativeAnalysisMachineCivicTitleTranslated({
          sourceLanguage: "en",
          targetLanguage: "uk",
          machinePayload: { "title#m0": ": Climate Safety" },
          translatedSegments: { "title#m0": ": Climate Safety" },
        }),
      (error: unknown) =>
        error instanceof ContentTranslationValidationError &&
        error.reasonCode === "UNCHANGED_CIVIC_TITLE",
    );
  });

  it("H. title machine prose translated + glossary slot → success", async () => {
    const translated = await translateCollaborativeAnalysisFieldsWithLifecycleSlots({
      sanitizedFields: { ...CA_FIELDS },
      sourceLanguage: "en",
      targetLanguage: "uk",
      translatePayload: async (payload) => {
        const out: Record<string, string> = {};
        for (const [key, value] of Object.entries(payload)) {
          out[key] = `[uk] ${value}`;
        }
        return out;
      },
    });
    assert.match(translated.title, /Спільний аналіз/);
    assert.match(translated.title, /Climate Safety/);
    assert.match(translated.summary, /Обговорення/);
    assert.doesNotMatch(translated.title, /\{lifecycleStage:/);
  });

  it("I. structurally complete identical prose passes; unchanged title still gated separately", () => {
    assert.doesNotThrow(() =>
      assertCollaborativeAnalysisMachineProseTranslated({
        sourceLanguage: "en",
        targetLanguage: "uk",
        machinePayload: {
          "title#m0": ": Climate Safety",
          "summary#m0": "Review ",
          "summary#m1": " signals carefully.",
        },
        translatedSegments: {
          "title#m0": ": Climate Safety",
          "summary#m0": "Review ",
          "summary#m1": " signals carefully.",
        },
      }),
    );
  });

  it("J. non-CA sourceKind civic/prose validators remain unchanged", () => {
    assert.throws(
      () =>
        assertTranslatedProseChangedFromSource({
          sourceKind: "initiative",
          sourceLanguage: "en",
          targetLanguage: "uk",
          sourceFields: { title: "Hello", description: "World" },
          translatedFields: { title: "Hello", description: "World" },
        }),
      (error: unknown) =>
        error instanceof ContentTranslationValidationError &&
        error.reasonCode === "UNCHANGED_SOURCE_PROSE",
    );

    assert.throws(
      () =>
        assertCivicTitleFieldsTranslatedFromSource({
          sourceKind: "initiative",
          sourceLanguage: "en",
          targetLanguage: "uk",
          sourceFields: { title: "Hello", description: "World changed" },
          translatedFields: { title: "Hello", description: "World changed" },
        }),
      (error: unknown) =>
        error instanceof ContentTranslationValidationError &&
        error.reasonCode === "UNCHANGED_CIVIC_TITLE",
    );

    assert.doesNotThrow(() =>
      assertTranslatedProseChangedFromSource({
        sourceKind: "initiative",
        sourceLanguage: "en",
        targetLanguage: "uk",
        sourceFields: { title: "Hello", description: "World" },
        translatedFields: { title: "Привіт", description: "Світ" },
      }),
    );
  });

  it("K. CA service path validates machine payload before reassembly comments/guards", () => {
    const lifecycle = readFileSync(
      path.join(
        repoRoot,
        "apps/api/src/modules/language/content-translation-lifecycle-slots.ts",
      ),
      "utf8",
    );
    const service = readFileSync(
      path.join(repoRoot, "apps/api/src/modules/language/content-translation.service.ts"),
      "utf8",
    );
    assert.match(lifecycle, /validateCollaborativeAnalysisMachineTranslation/);
    assert.match(lifecycle, /BEFORE glossary reassembly|before glossary reassembly/i);
    assert.match(service, /sourceLanguage: source\.sourceLanguage/);
    const caBranch = service.slice(
      service.indexOf('source.sourceKind === "collaborative_analysis"'),
      service.indexOf("} else {", service.indexOf('source.sourceKind === "collaborative_analysis"')),
    );
    assert.doesNotMatch(caBranch, /assertTranslatedProseChangedFromSource/);
    assert.doesNotMatch(caBranch, /assertCivicTitleFieldsTranslatedFromSource/);
  });
});
