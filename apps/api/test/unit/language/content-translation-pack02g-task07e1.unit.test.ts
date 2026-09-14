/**
 * Production Completion Pack 02G Task 07E.1 — civic title must-differ validation.
 * No live Gemini; no language detection.
 */
import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";

process.env.INITIATIVE_PERSISTENCE = "memory";
process.env.CONTENT_TRANSLATION_PERSISTENCE = "memory";
process.env.TRANSLATION_PROVIDER = "deterministic";

import type { ContentTranslationSourceKind, Initiative } from "@hu/types";

import {
  CONTENT_TRANSLATION_CIVIC_TITLE_FIELDS,
  CONTENT_TRANSLATION_FIELD_ALLOWLIST,
  DeterministicTranslationProvider,
  TranslationProviderError,
  assertCivicTitleFieldsTranslatedFromSource,
  assertTranslatedProseChangedFromSource,
  ensureLanguageRegistrySeeded,
  getOrCreateContentTranslation,
  loadTranslatableSource,
  resetContentTranslationMemoryStoreForTests,
  resetLanguageRegistryStoreForTests,
  resetTranslationProviderForTests,
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
    initiativeId: `initiative-pack02g-t07e1-${Date.now()}`,
    stewardId: "member-pack02g-t07e1",
    createdAt: now,
    updatedAt: now,
    title: "The Mind-Safe Alliance",
    description: "Participants restore civic trust. Testing Up 07E.1",
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

describe("Production Completion Pack 02G Task 07E.1 — civic title must-differ", () => {
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
      // Ignore persistence races under parallel runs.
    }
    resetTranslationProviderForTests();
    resetContentTranslationMemoryStoreForTests();
    resetLanguageRegistryStoreForTests();
  });

  it("contract: every civic title/heading key is on that kind's allowlist", () => {
    for (const sourceKind of Object.keys(
      CONTENT_TRANSLATION_CIVIC_TITLE_FIELDS,
    ) as ContentTranslationSourceKind[]) {
      const allowlist = new Set(
        CONTENT_TRANSLATION_FIELD_ALLOWLIST[sourceKind] as readonly string[],
      );
      for (const key of CONTENT_TRANSLATION_CIVIC_TITLE_FIELDS[sourceKind]) {
        assert.ok(
          allowlist.has(key),
          `${sourceKind}.${key} must be in CONTENT_TRANSLATION_FIELD_ALLOWLIST`,
        );
      }
    }
  });

  it("a. identical title + translated description => malformed_response, not persisted", async () => {
    setTranslationProviderForTests(
      new ScriptedStructuredTranslationProvider(() => ({
        title: initiative.title,
        description: "Учасники відновлюють громадянську довіру.",
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
        assert.match(error.message, /title/);
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
  });

  it("b. translated title + translated description => accepted", async () => {
    setTranslationProviderForTests(
      new ScriptedStructuredTranslationProvider(() => ({
        title: "Альянс Mind-Safe",
        description: "Учасники відновлюють громадянську довіру.",
      })),
    );

    const result = await getOrCreateContentTranslation({
      sourceKind: "initiative",
      sourceRecordId: initiative.initiativeId,
      targetLanguage: "uk",
      generateIfMissing: true,
    });
    assert.equal(result.generated, true);
    assert.equal(result.translation?.translatedContent.title, "Альянс Mind-Safe");
  });

  it("c. translated title + identical body field => accepted", async () => {
    setTranslationProviderForTests(
      new ScriptedStructuredTranslationProvider(() => ({
        title: "Альянс Mind-Safe",
        description: initiative.description,
      })),
    );

    const result = await getOrCreateContentTranslation({
      sourceKind: "initiative",
      sourceRecordId: initiative.initiativeId,
      targetLanguage: "uk",
      generateIfMissing: true,
    });
    assert.equal(result.generated, true);
    assert.equal(result.translation?.translatedContent.description, initiative.description);
  });

  it("d. organization/organizationName may remain identical when title/subject translates", () => {
    assert.doesNotThrow(() =>
      assertCivicTitleFieldsTranslatedFromSource({
        sourceKind: "implementation_commitment",
        sourceLanguage: "en",
        targetLanguage: "uk",
        sourceFields: {
          title: "Clean Water Commitment",
          summary: "Summary",
          organization: "Acme Corp",
        },
        translatedFields: {
          title: "Зобов'язання чистої води",
          summary: "Підсумок",
          organization: "Acme Corp",
        },
      }),
    );

    assert.doesNotThrow(() =>
      assertCivicTitleFieldsTranslatedFromSource({
        sourceKind: "official_response",
        sourceLanguage: "en",
        targetLanguage: "uk",
        sourceFields: {
          subject: "Response on river cleanup",
          summary: "Summary",
          organizationName: "City Council",
          responseReference: "OR-123",
        },
        translatedFields: {
          subject: "Відповідь щодо очищення річки",
          summary: "Підсумок",
          organizationName: "City Council",
          responseReference: "OR-123",
        },
      }),
    );
  });

  it("e. same source/target language skips title must-differ", () => {
    assert.doesNotThrow(() =>
      assertCivicTitleFieldsTranslatedFromSource({
        sourceKind: "initiative",
        sourceLanguage: "en",
        targetLanguage: "en",
        sourceFields: { title: "Same", description: "Same" },
        translatedFields: { title: "Same", description: "Same" },
      }),
    );
  });

  it("f. 07C all-fields-unchanged rejection remains", () => {
    assert.throws(
      () =>
        assertTranslatedProseChangedFromSource({
          sourceKind: "initiative",
          sourceLanguage: "en",
          targetLanguage: "uk",
          sourceFields: { title: "A", description: "B" },
          translatedFields: { title: "A", description: "B" },
        }),
      (error: unknown) => {
        assert.ok(error instanceof TranslationProviderError);
        assert.equal(error.code, "malformed_response");
        return true;
      },
    );
  });

  it("g. civic_media enforces each non-empty designated heading independently", () => {
    assert.throws(
      () =>
        assertCivicTitleFieldsTranslatedFromSource({
          sourceKind: "civic_media",
          sourceLanguage: "en",
          targetLanguage: "uk",
          sourceFields: {
            overviewTitle: "Overview",
            initiativeFlowTitle: "Flow",
            overviewSummary: "Summary",
          },
          translatedFields: {
            overviewTitle: "Огляд",
            initiativeFlowTitle: "Flow",
            overviewSummary: "Підсумок",
          },
        }),
      (error: unknown) => {
        assert.ok(error instanceof TranslationProviderError);
        assert.match(String(error), /initiativeFlowTitle/);
        return true;
      },
    );

    assert.throws(
      () =>
        assertCivicTitleFieldsTranslatedFromSource({
          sourceKind: "civic_media",
          sourceLanguage: "en",
          targetLanguage: "uk",
          sourceFields: {
            overviewTitle: "Overview",
            initiativeFlowTitle: "Flow",
          },
          translatedFields: {
            overviewTitle: "Overview",
            initiativeFlowTitle: "Потік",
          },
        }),
      (error: unknown) => {
        assert.ok(error instanceof TranslationProviderError);
        assert.match(String(error), /overviewTitle/);
        return true;
      },
    );

    assert.doesNotThrow(() =>
      assertCivicTitleFieldsTranslatedFromSource({
        sourceKind: "civic_media",
        sourceLanguage: "en",
        targetLanguage: "uk",
        sourceFields: {
          overviewTitle: "Overview",
          initiativeFlowTitle: "",
        },
        translatedFields: {
          overviewTitle: "Огляд",
          initiativeFlowTitle: "",
        },
      }),
    );
  });

  it("h. collective_decision.question and official_response.subject are designated", () => {
    assert.deepEqual(CONTENT_TRANSLATION_CIVIC_TITLE_FIELDS.collective_decision, [
      "question",
    ]);
    assert.deepEqual(CONTENT_TRANSLATION_CIVIC_TITLE_FIELDS.official_response, ["subject"]);

    assert.throws(
      () =>
        assertCivicTitleFieldsTranslatedFromSource({
          sourceKind: "collective_decision",
          sourceLanguage: "en",
          targetLanguage: "uk",
          sourceFields: { question: "Should we act?" },
          translatedFields: { question: "Should we act?" },
        }),
      (error: unknown) =>
        error instanceof TranslationProviderError && error.code === "malformed_response",
    );

    assert.throws(
      () =>
        assertCivicTitleFieldsTranslatedFromSource({
          sourceKind: "official_response",
          sourceLanguage: "en",
          targetLanguage: "uk",
          sourceFields: { subject: "Official reply" },
          translatedFields: { subject: "Official reply" },
        }),
      (error: unknown) =>
        error instanceof TranslationProviderError && error.code === "malformed_response",
    );
  });
});
