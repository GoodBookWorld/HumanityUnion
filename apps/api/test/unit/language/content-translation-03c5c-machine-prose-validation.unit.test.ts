/**
 * Localization Closure 03C.5C — validate CA machine prose before lifecycle reassembly.
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

  it("A. unchanged machine prose + different glossary labels → validation fails", async () => {
    await assert.rejects(
      () =>
        translateCollaborativeAnalysisFieldsWithLifecycleSlots({
          sanitizedFields: { ...CA_FIELDS },
          sourceLanguage: "en",
          targetLanguage: "uk",
          translatePayload: async (payload) => ({ ...payload }),
        }),
      (error: unknown) =>
        error instanceof ContentTranslationValidationError &&
        (error.reasonCode === "UNCHANGED_SOURCE_PROSE" ||
          error.reasonCode === "UNCHANGED_CIVIC_TITLE"),
    );
  });

  it("B. title machine prose unchanged while glossary resolves analysis → UNCHANGED_CIVIC_TITLE", async () => {
    await assert.rejects(
      () =>
        translateCollaborativeAnalysisFieldsWithLifecycleSlots({
          sanitizedFields: {
            ...CA_FIELDS,
            // Keep non-title machine prose changing so title is the failing civic check.
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
  });

  it("C. title machine prose translated + glossary slot → success", async () => {
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

  it("D. all eligible machine prose unchanged fails even when slots would localize", () => {
    assert.throws(
      () =>
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
      (error: unknown) =>
        error instanceof ContentTranslationValidationError &&
        error.reasonCode === "UNCHANGED_SOURCE_PROSE",
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

  it("E. non-CA sourceKind civic/prose validators remain unchanged", () => {
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

  it("F. CA service path validates machine payload before reassembly comments/guards", () => {
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
    // CA branch must not run generic reassembled-vs-tokenized prose/title asserts.
    const caBranch = service.slice(
      service.indexOf('source.sourceKind === "collaborative_analysis"'),
      service.indexOf("} else {", service.indexOf('source.sourceKind === "collaborative_analysis"')),
    );
    assert.doesNotMatch(caBranch, /assertTranslatedProseChangedFromSource/);
    assert.doesNotMatch(caBranch, /assertCivicTitleFieldsTranslatedFromSource/);
  });
});
