/**
 * Production Completion Pack 02G Task 07C — Gemini target-language enforcement.
 * No live Gemini calls.
 */
import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";

process.env.INITIATIVE_PERSISTENCE = "memory";
process.env.CONTENT_TRANSLATION_PERSISTENCE = "memory";
process.env.TRANSLATION_PROVIDER = "deterministic";

import type { Initiative } from "@hu/types";

import {
  CONTENT_TRANSLATION_FIELD_ALLOWLIST,
  CONTENT_TRANSLATION_PRIVACY_EXCLUSIONS,
  DeterministicTranslationProvider,
  TranslationProviderError,
  assertTranslatedProseChangedFromSource,
  buildGeminiTranslationSystemInstruction,
  ensureLanguageRegistrySeeded,
  filterTranslatedFieldsToSourceAllowlist,
  getOrCreateContentTranslation,
  loadTranslatableSource,
  resetContentTranslationMemoryStoreForTests,
  resetLanguageRegistryStoreForTests,
  resetTranslationProviderForTests,
  resolveTranslationLanguageEnglishName,
  setLanguageRegistryForceMemoryForTests,
  setTranslationProviderForTests,
  updateLanguageRegistryRecord,
  type TranslationProvider,
  type TranslationProviderRequest,
  type TranslationProviderResult,
} from "../../../src/modules/language/index.js";
import { findContentTranslation } from "../../../src/modules/language/persistence/content-translation.repository.js";
import {
  createInitiative,
  deleteInitiative,
} from "../../../src/modules/initiatives/initiative.store.js";

function sampleInitiative(): Initiative {
  const now = new Date().toISOString();
  return {
    initiativeId: `initiative-pack02g-t07c-${Date.now()}`,
    stewardId: "member-pack02g-t07c",
    createdAt: now,
    updatedAt: now,
    title: "Clean River Initiative",
    description: "Participants restore a local river with evidence-based steps.",
    status: "proposal",
    lifecyclePhase: "published",
    visibility: { policy: "public" },
    metadata: {
      category: "Community",
      tags: [],
      region: "Test",
      language: "en",
      communitySlug: "test",
      activityArea: "Environment",
    },
    revisions: [],
    contributions: [],
    timeline: [],
  };
}

/** Returns caller-controlled structured JSON — never calls Gemini. */
class ScriptedStructuredTranslationProvider implements TranslationProvider {
  readonly providerId = "deterministic" as const;
  private readonly script: (request: TranslationProviderRequest) => Record<string, string>;

  constructor(script: (request: TranslationProviderRequest) => Record<string, string>) {
    this.script = script;
  }

  async translate(request: TranslationProviderRequest): Promise<TranslationProviderResult> {
    if (!request.safetyCleared) {
      throw new TranslationProviderError(
        "safety_rejected",
        "Translation refused: content was not marked safety-cleared.",
      );
    }
    if (request.sourceLanguage === request.targetLanguage) {
      return {
        translatedText: request.text,
        providerId: this.providerId,
        isPlaceholder: false,
      };
    }
    return {
      translatedText: JSON.stringify(this.script(request)),
      providerId: this.providerId,
      isPlaceholder: false,
    };
  }
}

describe("Production Completion Pack 02G Task 07C — target-language enforcement", () => {
  let initiative: Initiative;

  beforeEach(async () => {
    resetTranslationProviderForTests();
    resetContentTranslationMemoryStoreForTests();
    setTranslationProviderForTests(new DeterministicTranslationProvider());
    setLanguageRegistryForceMemoryForTests(true);
    resetLanguageRegistryStoreForTests();
    await ensureLanguageRegistrySeeded();
    await updateLanguageRegistryRecord("lang-uk", {
      enabled: true,
      contentTranslationEnabled: true,
    });
    initiative = sampleInitiative();
    createInitiative(initiative);
  });

  afterEach(() => {
    try {
      deleteInitiative(initiative.initiativeId);
    } catch {
      // Ignore persistence races when the file adapter is active under parallel runs.
    }
    resetTranslationProviderForTests();
    resetContentTranslationMemoryStoreForTests();
    resetLanguageRegistryStoreForTests();
  });

  describe("A. Prompt language names + glossary scope", () => {
    it("resolves uk englishName to Ukrainian and names English (en) -> Ukrainian (uk)", async () => {
      const ukName = await resolveTranslationLanguageEnglishName("uk");
      const enName = await resolveTranslationLanguageEnglishName("en");
      assert.equal(ukName, "Ukrainian");
      assert.equal(enName, "English");

      const prompt = buildGeminiTranslationSystemInstruction({
        sourceLanguage: "en",
        targetLanguage: "uk",
        sourceLanguageName: enName,
        targetLanguageName: ukName,
        terminologyContext: "Participant (participant) => Учасник",
        contentType: "structured_json",
      });

      assert.match(prompt, /Translate from English \(en\) into Ukrainian \(uk\)\./);
      assert.match(
        prompt,
        /Glossary fallback-to-English applies only to the specific canonical terminology concept or preferred term\/token/,
      );
      assert.match(
        prompt,
        /A missing target glossary term must never be interpreted as permission to leave the whole title, heading, sentence, or field in the source language/,
      );
      assert.match(prompt, /Translate every human-readable translatable string value into the target language/);
      assert.match(prompt, /Keep Participant, Member, and Membership semantically distinct/);
      assert.match(prompt, /Civic content titles and human-readable headings/);
      assert.match(
        prompt,
        /Do not preserve a civic artifact title merely because it resembles a proper name, campaign name, alliance name/,
      );
    });

    it("falls back to locale code when Registry metadata is missing", async () => {
      const label = await resolveTranslationLanguageEnglishName("xx-unknown-locale");
      assert.equal(label, "xx-unknown-locale");
      const prompt = buildGeminiTranslationSystemInstruction({
        sourceLanguage: "en",
        targetLanguage: "xx-unknown-locale",
        sourceLanguageName: "en",
        targetLanguageName: "xx-unknown-locale",
        contentType: "structured_json",
      });
      assert.match(prompt, /Translate from en \(en\) into xx-unknown-locale \(xx-unknown-locale\)\./);
    });
  });

  describe("B. Post-provider unchanged-prose validation", () => {
    it("rejects en->uk when all eligible prose fields are identical and does not persist", async () => {
      setTranslationProviderForTests(
        new ScriptedStructuredTranslationProvider(() => ({
          title: initiative.title,
          description: initiative.description,
        })),
      );

      await assert.rejects(
        () =>
          getOrCreateContentTranslation({
            sourceKind: "initiative",
            sourceRecordId: initiative.initiativeId,
            targetLanguage: "uk",
            generateIfMissing: true,
          }),
        (error: unknown) => {
          assert.ok(error instanceof TranslationProviderError);
          assert.equal(error.code, "malformed_response");
          return true;
        },
      );

      const source = await loadTranslatableSource({
        sourceKind: "initiative",
        sourceRecordId: initiative.initiativeId,
      });
      assert.ok(source);
      const stored = await findContentTranslation({
        sourceKind: "initiative",
        sourceRecordId: initiative.initiativeId,
        sourceVersion: source.sourceVersion,
        targetLanguage: "uk",
      });
      assert.equal(stored, null);

      const lookup = await getOrCreateContentTranslation({
        sourceKind: "initiative",
        sourceRecordId: initiative.initiativeId,
        targetLanguage: "uk",
        generateIfMissing: false,
      });
      assert.equal(lookup.translation, null);
      assert.equal(lookup.generated, false);
    });

    it("accepts when one field is invariant but description is translated", async () => {
      setTranslationProviderForTests(
        new ScriptedStructuredTranslationProvider(() => ({
          title: initiative.title,
          description: "Учасники відновлюють місцеву річку з доказовими кроками.",
        })),
      );

      const result = await getOrCreateContentTranslation({
        sourceKind: "initiative",
        sourceRecordId: initiative.initiativeId,
        targetLanguage: "uk",
        generateIfMissing: true,
      });
      assert.equal(result.generated, true);
      assert.equal(result.translation?.translatedContent.title, initiative.title);
      assert.equal(
        result.translation?.translatedContent.description,
        "Учасники відновлюють місцеву річку з доказовими кроками.",
      );
      assert.notEqual(result.translation?.translatedContent.description, initiative.description);
    });

    it("accepts when all eligible prose is translated", async () => {
      setTranslationProviderForTests(
        new ScriptedStructuredTranslationProvider(() => ({
          title: "Ініціатива Чистої Річки",
          description: "Учасники відновлюють місцеву річку з доказовими кроками.",
        })),
      );

      const result = await getOrCreateContentTranslation({
        sourceKind: "initiative",
        sourceRecordId: initiative.initiativeId,
        targetLanguage: "uk",
        generateIfMissing: true,
      });
      assert.equal(result.generated, true);
      assert.equal(result.translation?.translatedContent.title, "Ініціатива Чистої Річки");
    });

    it("sourceLanguage === targetLanguage keeps safe no-op (no persist of identity translation)", async () => {
      const result = await getOrCreateContentTranslation({
        sourceKind: "initiative",
        sourceRecordId: initiative.initiativeId,
        targetLanguage: "en",
        generateIfMissing: true,
      });
      assert.equal(result.translation, null);
      assert.equal(result.generated, false);
    });

    it("assertTranslatedProseChangedFromSource skips when languages match", () => {
      assert.doesNotThrow(() =>
        assertTranslatedProseChangedFromSource({
          sourceKind: "initiative",
          sourceLanguage: "en",
          targetLanguage: "en",
          sourceFields: { title: "A", description: "B" },
          translatedFields: { title: "A", description: "B" },
        }),
      );
    });

    it("drops invented keys before persistence", async () => {
      setTranslationProviderForTests(
        new ScriptedStructuredTranslationProvider(() => ({
          title: "Ініціатива",
          description: "Опис",
          stewardId: "should-not-persist",
          secretNote: "nope",
        })),
      );

      const result = await getOrCreateContentTranslation({
        sourceKind: "initiative",
        sourceRecordId: initiative.initiativeId,
        targetLanguage: "uk",
        generateIfMissing: true,
      });
      assert.deepEqual(Object.keys(result.translation!.translatedContent).sort(), [
        "description",
        "title",
      ]);
      assert.equal(
        filterTranslatedFieldsToSourceAllowlist({
          sourceKind: "initiative",
          sourceFields: { title: "a", description: "b" },
          translatedFields: { title: "a", description: "b", invented: "x" },
        }).invented,
        undefined,
      );
    });
  });

  describe("C. Regression — deterministic, cache, privacy", () => {
    it("deterministic provider flow remains valid and idempotent", async () => {
      setTranslationProviderForTests(new DeterministicTranslationProvider());
      const first = await getOrCreateContentTranslation({
        sourceKind: "initiative",
        sourceRecordId: initiative.initiativeId,
        targetLanguage: "uk",
        generateIfMissing: true,
      });
      assert.equal(first.generated, true);
      assert.match(first.translation!.translatedContent.title, /^\[uk\] /);

      const second = await getOrCreateContentTranslation({
        sourceKind: "initiative",
        sourceRecordId: initiative.initiativeId,
        targetLanguage: "uk",
        generateIfMissing: true,
      });
      assert.equal(second.generated, false);
      assert.equal(second.translation?.translationId, first.translation?.translationId);
      assert.equal(
        second.translation?.translatedContent.title,
        first.translation?.translatedContent.title,
      );
    });

    it("initiative allowlist stays public-only; privacy exclusions remain distinct", () => {
      assert.deepEqual(CONTENT_TRANSLATION_FIELD_ALLOWLIST.initiative, [
        "title",
        "description",
      ]);
      assert.ok(CONTENT_TRANSLATION_PRIVACY_EXCLUSIONS.length > 0);
      assert.ok(
        CONTENT_TRANSLATION_PRIVACY_EXCLUSIONS.some((item) =>
          /dm|pii|auth|shipping|admin|moderation|draft|secret/i.test(item),
        ),
      );
    });
  });
});
