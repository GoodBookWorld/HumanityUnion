import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";

import type { TranslatedContentRecord } from "@hu/types";
import { DEFAULT_PLATFORM_LANGUAGE } from "@hu/types";

import {
  buildTranslationCacheKey,
  markTranslationStaleIfSourceChanged,
  resolveNotificationTemplate,
  resolveTranslatedDisplay,
  resetTranslationProviderForTests,
  setTranslationProviderForTests,
  translateDraft,
  DeterministicTranslationProvider,
} from "../../../src/modules/language/index.js";
import {
  DeterministicLifecycleAiProvider,
  buildLifecycleAiPrompt,
  getHumanityUnionAssistantSessionContext,
  resetLifecycleAiProviderForTests,
  setLifecycleAiProviderForTests,
} from "../../../src/modules/lifecycle-ai/index.js";

function sampleTranslation(
  overrides: Partial<TranslatedContentRecord> = {},
): TranslatedContentRecord {
  return {
    translationId: "translation-1",
    sourceKind: "initiative",
    sourceRecordId: "initiative-1",
    sourceVersion: "v1",
    sourceLanguage: "uk",
    targetLanguage: "en",
    translatedContent: "Translated initiative title",
    translationProvider: "deterministic",
    translationKind: "machine",
    createdAt: new Date().toISOString(),
    stale: false,
    freshness: "current",
    ...overrides,
  };
}

describe("Language Architecture Pack 01", () => {
  beforeEach(() => {
    resetTranslationProviderForTests();
    setTranslationProviderForTests(new DeterministicTranslationProvider());
    resetLifecycleAiProviderForTests();
    setLifecycleAiProviderForTests(new DeterministicLifecycleAiProvider());
  });

  afterEach(() => {
    resetTranslationProviderForTests();
    resetLifecycleAiProviderForTests();
  });

  it("preserves original content when resolving a preferred translation", () => {
    const original = "Оригінальний текст";
    const resolved = resolveTranslatedDisplay({
      originalContent: original,
      originalLanguage: "uk",
      preferredReadingLanguage: "en",
      translations: [sampleTranslation()],
    });

    assert.equal(resolved.presentationMode, "preferred_translation");
    assert.equal(resolved.content, "Translated initiative title");
    assert.equal(resolved.originalContent, original);
    assert.equal(resolved.canViewOriginal, true);
    assert.equal(resolved.isMachineTranslated, true);
  });

  it("does not overwrite original when translation is missing — falls back to original", () => {
    const original = "Original civic text";
    const resolved = resolveTranslatedDisplay({
      originalContent: original,
      originalLanguage: "en",
      preferredReadingLanguage: "fr",
      translations: [],
    });

    assert.equal(resolved.presentationMode, "original");
    assert.equal(resolved.content, original);
    assert.equal(resolved.canViewOriginal, false);
  });

  it("detects stale translation and refuses to present it as current", () => {
    const original = "Live original v2";
    const stale = markTranslationStaleIfSourceChanged({
      translation: sampleTranslation({
        sourceLanguage: "en",
        targetLanguage: "fr",
        translatedContent: "Old French",
        sourceVersion: "v1",
      }),
      liveSourceVersion: "v2",
    });

    assert.equal(stale.stale, true);
    assert.equal(stale.freshness, "stale");

    const resolved = resolveTranslatedDisplay({
      originalContent: original,
      originalLanguage: "en",
      preferredReadingLanguage: "fr",
      translations: [stale],
    });

    assert.equal(resolved.presentationMode, "original");
    assert.equal(resolved.content, original);
    assert.equal(resolved.isStale, true);
  });

  it("translateDraft creates a working translation without mutating the original draft", async () => {
    const draft = { title: "Draft title", summary: "Draft summary" };
    const result = await translateDraft({
      sourceRecordId: "draft-1",
      sourceVersion: "draft-v1",
      sourceLanguage: "en",
      targetLanguage: "uk",
      draftContent: draft,
    });

    assert.deepEqual(result.originalDraftContent, draft);
    assert.equal(result.originalLanguage, "en");
    assert.equal(result.workingTranslation.targetLanguage, "uk");
    const translated = result.workingTranslation.translatedContent;
    assert.ok(translated && typeof translated === "object");
    assert.match(String((translated as { title?: string }).title), /\[uk\]/);
    assert.equal(draft.title, "Draft title");
  });

  it("builds version-aware translation cache keys", () => {
    assert.equal(
      buildTranslationCacheKey({
        sourceRecordId: "rec-1",
        sourceVersion: "v3",
        targetLanguage: "fr",
      }),
      "rec-1::v3::fr",
    );
  });

  it("resolves notification templates in preferred language with English fallback", () => {
    const uk = resolveNotificationTemplate({
      templateKey: "lifecycle.stage_published",
      preferredLanguage: "uk",
    });
    assert.match(uk.title, /життєвого циклу/i);

    const missingLocale = resolveNotificationTemplate({
      templateKey: "lifecycle.stage_published",
      preferredLanguage: "hi",
    });
    assert.match(missingLocale.title, /Lifecycle stage published/i);
  });

  it("Assistant session exposes language context (defaults to platform language)", async () => {
    const context = await getHumanityUnionAssistantSessionContext(
      { participantId: "member-lang-pack01", displayName: "Vlad" },
      { surfaceId: "workspace" },
    );

    assert.equal(context.interfaceLanguage, DEFAULT_PLATFORM_LANGUAGE);
    assert.equal(context.preferredResponseLanguage, DEFAULT_PLATFORM_LANGUAGE);
    assert.equal(context.sourceContentLanguage, null);
  });

  it("Assistant prompt includes preferred response language guidance", () => {
    const prompt = buildLifecycleAiPrompt({
      initiativeId: "platform",
      stageId: "initiative",
      stageLabel: "Workspace",
      operation: "answer_question",
      participantDisplayName: "Vlad",
      initiativeTitle: "Humanity Union",
      presentationMode: "public",
      availableSourceLabels: [],
      sourceContextSummary: "Workspace",
      surfaceId: "workspace",
      featureLabel: "Workspace",
      instructions: "What is an Initiative?",
      interfaceLanguage: "en",
      preferredResponseLanguage: "uk",
      sourceContentLanguage: "en",
      platformKnowledgePrompt: "### Platform Identity\nHumanity Union.",
    });

    assert.match(prompt.userPrompt, /Respond in uk/i);
    assert.match(prompt.userPrompt, /Interface language: en/i);
    assert.match(prompt.userPrompt, /Source content language: en/i);
  });

  it("deterministic translation provider refuses content not marked safety-cleared", async () => {
    const provider = new DeterministicTranslationProvider();
    await assert.rejects(
      () =>
        provider.translate({
          sourceLanguage: "en",
          targetLanguage: "fr",
          text: "Hello",
          safetyCleared: false,
        }),
      /safety-cleared/i,
    );
  });
});
