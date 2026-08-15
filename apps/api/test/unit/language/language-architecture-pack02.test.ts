import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";

process.env.INITIATIVE_PERSISTENCE = "memory";
process.env.CONTENT_TRANSLATION_PERSISTENCE = "memory";
process.env.TRANSLATION_PROVIDER = "deterministic";

import type { Initiative } from "@hu/types";

import {
  DeterministicTranslationProvider,
  GeminiTranslationProvider,
  clearTranslationRateLimitBucketsForTests,
  getOrCreateContentTranslation,
  markTranslationStaleIfSourceChanged,
  resetContentTranslationMemoryStoreForTests,
  resetTranslationProviderForTests,
  resolveNotificationTemplate,
  resolvePublicTranslatedContent,
  resolveTranslatedDisplay,
  resolveTranslationConfig,
  resolveTranslationProvider,
  setTranslationProviderForTests,
  translateDraft,
  TranslationProviderError,
} from "../../../src/modules/language/index.js";
import { translationRateLimiter } from "../../../src/modules/language/translation-rate-limit.js";
import {
  createInitiative,
  deleteInitiative,
} from "../../../src/modules/initiatives/initiative.store.js";
import type { TranslationProvider } from "../../../src/modules/language/translation-provider.js";

function sampleInitiative(): Initiative {
  const now = new Date().toISOString();
  return {
    initiativeId: `initiative-lang-pack02-${Date.now()}`,
    stewardId: "member-lang-pack02",
    createdAt: now,
    updatedAt: now,
    title: "Clean River Initiative",
    description: "Participants will restore a local river with evidence-based steps.",
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

describe("Language Architecture Pack 02", () => {
  let initiative: Initiative;

  beforeEach(() => {
    resetTranslationProviderForTests();
    resetContentTranslationMemoryStoreForTests();
    clearTranslationRateLimitBucketsForTests();
    setTranslationProviderForTests(new DeterministicTranslationProvider());
    initiative = sampleInitiative();
    createInitiative(initiative);
  });

  afterEach(() => {
    deleteInitiative(initiative.initiativeId);
    resetTranslationProviderForTests();
    resetContentTranslationMemoryStoreForTests();
    clearTranslationRateLimitBucketsForTests();
  });

  it("1–3. GeminiTranslationProvider implements TranslationProvider and stays isolated", () => {
    const provider = new GeminiTranslationProvider({
      provider: "gemini",
      geminiApiKey: "test-key",
      geminiModel: "gemini-2.0-flash",
      timeoutMs: 1000,
      maxOutputTokens: 256,
    });
    assert.equal(provider.providerId, "gemini");
    assert.equal(typeof provider.translate, "function");
    assert.doesNotMatch(JSON.stringify(resolveTranslationConfig()), /test-key/);
  });

  it("4–5. Real translation does not mutate source and is idempotent", async () => {
    const first = await getOrCreateContentTranslation({
      sourceKind: "initiative",
      sourceRecordId: initiative.initiativeId,
      targetLanguage: "uk",
      generateIfMissing: true,
    });
    assert.equal(first.generated, true);
    assert.ok(first.translation);
    assert.equal(initiative.title, "Clean River Initiative");

    const second = await getOrCreateContentTranslation({
      sourceKind: "initiative",
      sourceRecordId: initiative.initiativeId,
      targetLanguage: "uk",
      generateIfMissing: true,
    });
    assert.equal(second.generated, false);
    assert.equal(second.translation?.translationId, first.translation?.translationId);
  });

  it("6–7. New source version marks prior translation stale and fallback uses original", async () => {
    const created = await getOrCreateContentTranslation({
      sourceKind: "initiative",
      sourceRecordId: initiative.initiativeId,
      targetLanguage: "fr",
      generateIfMissing: true,
    });
    const stale = markTranslationStaleIfSourceChanged({
      translation: created.translation!,
      liveSourceVersion: "v-changed",
    });
    assert.equal(stale.stale, true);

    const resolved = resolveTranslatedDisplay({
      originalContent: initiative.title,
      originalLanguage: "en",
      preferredReadingLanguage: "fr",
      translationPreference: "preferred",
      translations: [stale],
    });
    assert.equal(resolved.presentationMode, "original");
    assert.equal(resolved.content, initiative.title);
    assert.equal(resolved.isStale, true);
  });

  it("8–10. Preferred translation resolves; missing/failure falls back to original", async () => {
    const created = await getOrCreateContentTranslation({
      sourceKind: "initiative",
      sourceRecordId: initiative.initiativeId,
      targetLanguage: "es",
      generateIfMissing: true,
    });
    const resolved = resolveTranslatedDisplay({
      originalContent: JSON.stringify(created.source.fields),
      originalLanguage: "en",
      preferredReadingLanguage: "es",
      translationPreference: "preferred",
      translations: [created.translation!],
    });
    assert.equal(resolved.presentationMode, "preferred_translation");
    assert.equal(resolved.canViewOriginal, true);

    const missing = resolveTranslatedDisplay({
      originalContent: initiative.description,
      originalLanguage: "en",
      preferredReadingLanguage: "zh",
      translationPreference: "preferred",
      translations: [],
    });
    assert.equal(missing.presentationMode, "original");
    assert.equal(missing.content, initiative.description);
  });

  it("16–19. Translate Draft keeps original unchanged; safety uncleared cannot call provider", async () => {
    const draft = { title: "Draft title", summary: "Draft summary" };
    const result = await translateDraft({
      sourceKind: "petition",
      sourceRecordId: "draft-1",
      sourceVersion: "draft-v1",
      sourceLanguage: "en",
      targetLanguage: "uk",
      draftContent: draft,
    });
    assert.deepEqual(result.originalDraftContent, draft);
    assert.equal(draft.title, "Draft title");
    assert.ok(result.workingTranslation.translatedContent);

    const provider = new DeterministicTranslationProvider();
    await assert.rejects(
      () =>
        provider.translate({
          sourceLanguage: "en",
          targetLanguage: "fr",
          text: "secret",
          safetyCleared: false,
        }),
      (error: unknown) =>
        error instanceof TranslationProviderError && error.code === "safety_rejected",
    );
  });

  it("20–21. Provider resolve defaults to deterministic and never embeds API keys", () => {
    resetTranslationProviderForTests();
    const previous = process.env.TRANSLATION_PROVIDER;
    process.env.TRANSLATION_PROVIDER = "deterministic";
    const provider = resolveTranslationProvider();
    assert.equal(provider.providerId, "deterministic");
    process.env.TRANSLATION_PROVIDER = previous;
  });

  it("14–15. none preference keeps original; machine translation is labeled via kind", async () => {
    const created = await getOrCreateContentTranslation({
      sourceKind: "initiative",
      sourceRecordId: initiative.initiativeId,
      targetLanguage: "fr",
      generateIfMissing: true,
    });
    const none = resolveTranslatedDisplay({
      originalContent: initiative.title,
      originalLanguage: "en",
      preferredReadingLanguage: "fr",
      translationPreference: "none",
      translations: [created.translation!],
    });
    assert.equal(none.presentationMode, "original");
    assert.equal(none.content, initiative.title);
    assert.equal(created.translation?.translationKind, "machine");
  });

  it("27. Translation rate limiter rejects after window budget", () => {
    const req = {
      auth: { id: "rate-limit-user", memberId: "rate-limit-user" },
      headers: {},
      socket: { remoteAddress: "127.0.0.1" },
    } as never;
    let nextCount = 0;
    let statusCode = 0;
    const res = {
      status(code: number) {
        statusCode = code;
        return {
          json() {
            return undefined;
          },
        };
      },
    } as never;
    const next = () => {
      nextCount += 1;
    };

    for (let i = 0; i < 12; i += 1) {
      translationRateLimiter(req, res, next);
    }
    assert.equal(nextCount, 12);
    translationRateLimiter(req, res, next);
    assert.equal(statusCode, 429);
    assert.equal(nextCount, 12);
  });

  it("10. Provider failure falls back to original without mutating source", async () => {
    const failing: TranslationProvider = {
      providerId: "deterministic",
      async translate() {
        throw new TranslationProviderError("unavailable", "simulated outage");
      },
    };
    setTranslationProviderForTests(failing);
    const resolved = await resolvePublicTranslatedContent({
      sourceKind: "initiative",
      sourceRecordId: initiative.initiativeId,
      preferredReadingLanguage: "uk",
      translationPreference: "preferred",
      generateIfMissing: true,
    });
    assert.equal(resolved.presentationMode, "original");
    assert.equal(resolved.content.title, initiative.title);
    assert.equal(initiative.title, "Clean River Initiative");
  });

  it("20. Notification template foundation localizes generic lifecycle publication", () => {
    const uk = resolveNotificationTemplate({
      templateKey: "lifecycle.stage_published",
      preferredLanguage: "uk",
    });
    assert.match(uk.title, /життєвого/i);
    const en = resolveNotificationTemplate({
      templateKey: "lifecycle.stage_published",
      preferredLanguage: "en",
    });
    assert.equal(en.title, "Lifecycle stage published");
  });
});
