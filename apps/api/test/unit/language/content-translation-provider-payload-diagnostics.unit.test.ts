/**
 * HE.13A — allowlisted provider payload diagnostics.
 * Deterministic and mocked Gemini only. No live provider. No Mongo writes.
 */
import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";

process.env.INITIATIVE_PERSISTENCE = "memory";
process.env.CONTENT_TRANSLATION_PERSISTENCE = "memory";
process.env.LANGUAGE_REGISTRY_PERSISTENCE = "memory";
process.env.TRANSLATION_PROVIDER = "deterministic";

import { CONTENT_TRANSLATION_WARM_REQUESTED, type Initiative } from "@hu/types";

import {
  isImmediateTerminalOutboxFailure,
  resolveOutboxFailureStatus,
} from "../../../src/infrastructure/outbox/outbox.repository.js";
import {
  ContentTranslationValidationError,
  SEMANTIC_RESIDUAL_DEFER_STREAK_CAP,
  parseContentTranslationFailureMetadata,
} from "../../../src/modules/language/content-translation-failure-metadata.js";
import { selectInvalidProviderPayloadRetry } from "../../../src/modules/language/content-translation-provider-payload-retry.js";
import { GeminiTranslationProvider } from "../../../src/modules/language/providers/gemini-translation-provider.js";
import { TranslationProviderError } from "../../../src/modules/language/translation.config.js";
import {
  ensureLanguageRegistrySeeded,
  getOrCreateContentTranslation,
  processContentTranslationWarmRequested,
  resetContentTranslationMemoryStoreForTests,
  resetLanguageRegistryStoreForTests,
  resetTranslationProviderForTests,
  setLanguageRegistryForceMemoryForTests,
  setTranslationProviderForTests,
  updateLanguageRegistryRecord,
} from "../../../src/modules/language/index.js";
import { findContentTranslation } from "../../../src/modules/language/persistence/content-translation.repository.js";
import {
  createInitiative,
  deleteInitiative,
} from "../../../src/modules/initiatives/initiative.store.js";
import type {
  TranslationProvider,
  TranslationProviderRequest,
  TranslationProviderResult,
} from "../../../src/modules/language/translation-provider.js";

const FAR_FUTURE = Date.UTC(2026, 11, 1);

class EnvelopeProvider implements TranslationProvider {
  readonly providerId = "deterministic" as const;
  callCount = 0;
  translatedText = "{";
  envelope: TranslationProviderResult["envelope"] | undefined;

  async translate(request: TranslationProviderRequest): Promise<TranslationProviderResult> {
    this.callCount += 1;
    if (!request.safetyCleared) {
      throw new TranslationProviderError(
        "safety_rejected",
        "Translation refused: content was not marked safety-cleared.",
      );
    }
    return {
      translatedText: this.translatedText,
      providerId: this.providerId,
      isPlaceholder: false,
      ...(this.envelope ? { envelope: this.envelope } : {}),
    };
  }
}

class ThrowingProvider implements TranslationProvider {
  readonly providerId = "deterministic" as const;
  callCount = 0;

  constructor(private readonly error: TranslationProviderError) {}

  async translate(): Promise<TranslationProviderResult> {
    this.callCount += 1;
    throw this.error;
  }
}

function sampleInitiative(): Initiative {
  const now = new Date().toISOString();
  return {
    initiativeId: `initiative-payload-kind-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    stewardId: "member-payload-kind",
    createdAt: now,
    updatedAt: now,
    title: "Harbor Teachers",
    description: "Marine life can teach a city how to listen.",
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

function geminiConfig() {
  return {
    provider: "gemini" as const,
    geminiApiKey: "unit-test-key",
    geminiModel: "gemini-test",
    timeoutMs: 1000,
    maxOutputTokens: 128,
  };
}

function geminiRequest(): TranslationProviderRequest {
  return {
    sourceLanguage: "en",
    targetLanguage: "uk",
    text: JSON.stringify({ title: "Harbor Teachers", description: "Marine life can teach." }),
    contentType: "structured_json",
    safetyCleared: true,
  };
}

function mockGeminiFetch(input: {
  readonly status?: number;
  readonly body: unknown;
}): { calls: number } {
  const state = { calls: 0 };
  globalThis.fetch = (async () => {
    state.calls += 1;
    return new Response(JSON.stringify(input.body), {
      status: input.status ?? 200,
      headers: { "Content-Type": "application/json" },
    });
  }) as typeof fetch;
  return state;
}

describe("HE.13A provider payload diagnostics", () => {
  const originalFetch = globalThis.fetch;
  let initiative: Initiative;

  beforeEach(async () => {
    resetTranslationProviderForTests();
    resetContentTranslationMemoryStoreForTests();
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
    globalThis.fetch = originalFetch;
    try {
      deleteInitiative(initiative.initiativeId);
    } catch {
      // Ignore persistence races under parallel runs.
    }
    resetTranslationProviderForTests();
    resetContentTranslationMemoryStoreForTests();
    resetLanguageRegistryStoreForTests();
    setLanguageRegistryForceMemoryForTests(false);
  });

  it("classifies an empty candidate without storing provider text", async () => {
    const fetchState = mockGeminiFetch({
      body: { candidates: [{ finishReason: "STOP", content: { parts: [{ text: "" }] } }] },
    });
    const provider = new GeminiTranslationProvider(geminiConfig());
    await assert.rejects(
      () => provider.translate(geminiRequest()),
      (error: unknown) => {
        assert.ok(error instanceof TranslationProviderError);
        assert.equal(error.code, "malformed_response");
        assert.equal(error.providerFailureSubtype, "empty_candidate");
        assert.equal(error.responseEnvelope?.finishReason, "STOP");
        assert.equal(error.responseEnvelope?.candidateCount, 1);
        assert.equal(error.responseEnvelope?.textPartCount, 0);
        assert.equal(error.responseEnvelope?.extractedLength, 0);
        assert.equal(error.responseEnvelope?.failureSubtype, "empty_candidate");
        const encoded = JSON.stringify(error.responseEnvelope);
        assert.doesNotMatch(encoded, /Marine life/);
        assert.doesNotMatch(encoded, /unit-test-key/);
        return true;
      },
    );
    assert.equal(fetchState.calls, 1);
  });

  it("classifies MAX_TOKENS with no candidate text as truncated", async () => {
    mockGeminiFetch({
      body: { candidates: [{ finishReason: "MAX_TOKENS", content: { parts: [] } }] },
    });
    const provider = new GeminiTranslationProvider(geminiConfig());
    await assert.rejects(
      () => provider.translate(geminiRequest()),
      (error: unknown) =>
        error instanceof TranslationProviderError &&
        error.providerFailureSubtype === "truncated" &&
        error.responseEnvelope?.finishReason === "MAX_TOKENS" &&
        error.responseEnvelope.failureSubtype === "truncated",
    );
  });

  it("returns complete JSON even when finishReason is MAX_TOKENS", async () => {
    const payload = {
      title: "Вчителі гавані",
      description: "Морське життя може навчити.",
    };
    mockGeminiFetch({
      body: {
        candidates: [
          {
            finishReason: "MAX_TOKENS",
            content: { parts: [{ text: JSON.stringify(payload) }] },
          },
        ],
      },
    });
    const provider = new GeminiTranslationProvider(geminiConfig());
    const result = await provider.translate(geminiRequest());
    assert.deepEqual(JSON.parse(result.translatedText), payload);
    assert.equal(result.envelope?.finishReason, "MAX_TOKENS");
    assert.equal(result.envelope?.failureSubtype, null);
    assert.equal(result.envelope?.candidateCount, 1);
    assert.equal(result.envelope?.textPartCount, 1);
    assert.ok((result.envelope?.extractedLength ?? 0) > 0);
  });

  it("keeps safety rejection and HTTP failures on their existing codes", async () => {
    const provider = new GeminiTranslationProvider(geminiConfig());
    const fetchState = mockGeminiFetch({
      body: { promptFeedback: { blockReason: "SAFETY" }, candidates: [] },
    });
    await assert.rejects(
      () => provider.translate(geminiRequest()),
      (error: unknown) =>
        error instanceof TranslationProviderError &&
        error.code === "safety_rejected" &&
        error.providerFailureSubtype == null,
    );

    await assert.rejects(
      () => provider.translate({ ...geminiRequest(), safetyCleared: false }),
      (error: unknown) =>
        error instanceof TranslationProviderError && error.code === "safety_rejected",
    );
    assert.equal(fetchState.calls, 1);

    for (const [status, code] of [
      [401, "not_configured"],
      [429, "rate_limited"],
      [500, "unavailable"],
    ] as const) {
      mockGeminiFetch({ status, body: { error: { message: "transport" } } });
      await assert.rejects(
        () => provider.translate(geminiRequest()),
        (error: unknown) =>
          error instanceof TranslationProviderError &&
          error.code === code &&
          error.providerFailureSubtype == null,
      );
    }
  });

  it("classifies malformed non-empty JSON and accepts complete JSON with MAX_TOKENS", async () => {
    const provider = new EnvelopeProvider();
    setTranslationProviderForTests(provider);

    provider.translatedText = "{\"title\":";
    provider.envelope = {
      finishReason: "STOP",
      candidateCount: 1,
      textPartCount: 1,
      extractedLength: provider.translatedText.length,
      failureSubtype: null,
    };
    await assert.rejects(
      () =>
        getOrCreateContentTranslation({
          sourceKind: "initiative",
          sourceRecordId: initiative.initiativeId,
          targetLanguage: "uk",
          generateIfMissing: true,
        }),
      (error: unknown) => {
        assert.ok(error instanceof ContentTranslationValidationError);
        assert.equal(error.reasonCode, "INVALID_PROVIDER_PAYLOAD");
        assert.equal(error.providerPayloadKind, "malformed_json");
        assert.doesNotMatch(error.message, /Harbor/);
        return true;
      },
    );

    provider.translatedText = "{\"title\":";
    provider.envelope = {
      finishReason: "MAX_TOKENS",
      candidateCount: 1,
      textPartCount: 1,
      extractedLength: 9,
      failureSubtype: null,
    };
    await assert.rejects(
      () =>
        getOrCreateContentTranslation({
          sourceKind: "initiative",
          sourceRecordId: initiative.initiativeId,
          targetLanguage: "uk",
          generateIfMissing: true,
        }),
      (error: unknown) =>
        error instanceof ContentTranslationValidationError &&
        error.providerPayloadKind === "truncated",
    );

    provider.translatedText = JSON.stringify({
      title: "Вчителі гавані",
      description: "Морське життя може навчити місто слухати.",
    });
    provider.envelope = {
      finishReason: "MAX_TOKENS",
      candidateCount: 1,
      textPartCount: 1,
      extractedLength: provider.translatedText.length,
      failureSubtype: null,
    };
    const created = await getOrCreateContentTranslation({
      sourceKind: "initiative",
      sourceRecordId: initiative.initiativeId,
      targetLanguage: "uk",
      generateIfMissing: true,
    });
    assert.equal(created.generated, true);
    assert.equal(created.translation?.translatedContent.title, "Вчителі гавані");
    assert.equal(initiative.title, "Harbor Teachers");
  });

  it("ends the current outbox row on the first empty or truncated failure", async () => {
    const emptyProvider = new ThrowingProvider(
      new TranslationProviderError(
        "malformed_response",
        "Gemini returned empty translation",
        "empty_candidate",
      ),
    );
    setTranslationProviderForTests(emptyProvider);
    await assert.rejects(
      () =>
        processContentTranslationWarmRequested({
          commandName: CONTENT_TRANSLATION_WARM_REQUESTED,
          sourceKind: "initiative",
          sourceRecordId: initiative.initiativeId,
          requestedAt: new Date().toISOString(),
          reason: "operator_residual_retry",
          targetLocales: ["uk"],
        }),
      (error: unknown) => {
        assert.equal(emptyProvider.callCount, 1);
        assert.equal(isImmediateTerminalOutboxFailure(error), true);
        assert.equal(
          resolveOutboxFailureStatus({
            attempts: 1,
            maxAttempts: 5,
            immediateTerminal: isImmediateTerminalOutboxFailure(error),
          }),
          "failed",
        );
        assert.ok(error instanceof Error);
        const meta = parseContentTranslationFailureMetadata(error.message);
        assert.equal(meta?.providerPayloadKind, "empty_candidate");
        assert.equal(meta?.failureReasonCode, "INVALID_PROVIDER_PAYLOAD");
        assert.equal(meta?.retryabilityHint, "retryable");
        assert.equal(JSON.stringify(meta).includes("finishReason"), false);
        assert.doesNotMatch(error.message, /Gemini returned empty translation/);
        assert.doesNotMatch(error.message, /Marine life/);
        return true;
      },
    );

    const truncated = new EnvelopeProvider();
    truncated.translatedText = "{\"title\":";
    truncated.envelope = { finishReason: "MAX_TOKENS", failureSubtype: null };
    setTranslationProviderForTests(truncated);
    await assert.rejects(
      () =>
        processContentTranslationWarmRequested({
          commandName: CONTENT_TRANSLATION_WARM_REQUESTED,
          sourceKind: "initiative",
          sourceRecordId: initiative.initiativeId,
          requestedAt: new Date().toISOString(),
          reason: "operator_residual_retry",
          targetLocales: ["uk"],
        }),
      (error: unknown) => {
        assert.equal(truncated.callCount, 1);
        assert.equal(isImmediateTerminalOutboxFailure(error), true);
        assert.ok(error instanceof Error);
        assert.equal(
          parseContentTranslationFailureMetadata(error.message)?.providerPayloadKind,
          "truncated",
        );
        return true;
      },
    );

    const malformed = new EnvelopeProvider();
    malformed.translatedText = "{\"title\":";
    malformed.envelope = { finishReason: "STOP", failureSubtype: null };
    setTranslationProviderForTests(malformed);
    await assert.rejects(
      () =>
        processContentTranslationWarmRequested({
          commandName: CONTENT_TRANSLATION_WARM_REQUESTED,
          sourceKind: "initiative",
          sourceRecordId: initiative.initiativeId,
          requestedAt: new Date().toISOString(),
          reason: "operator_residual_retry",
          targetLocales: ["uk"],
        }),
      (error: unknown) => {
        assert.equal(malformed.callCount, 1);
        assert.equal(isImmediateTerminalOutboxFailure(error), false);
        assert.equal(
          resolveOutboxFailureStatus({
            attempts: 1,
            maxAttempts: 5,
            immediateTerminal: false,
          }),
          "pending",
        );
        assert.ok(error instanceof Error);
        assert.equal(
          parseContentTranslationFailureMetadata(error.message)?.providerPayloadKind,
          "malformed_json",
        );
        return true;
      },
    );

    const source = await findContentTranslation({
      sourceKind: "initiative",
      sourceRecordId: initiative.initiativeId,
      sourceVersion: "unused",
      targetLanguage: "uk",
    });
    assert.equal(source, null);
  });

  it("keeps the shared same-version payload cap at 8", () => {
    assert.equal(SEMANTIC_RESIDUAL_DEFER_STREAK_CAP, 8);
    const attempts = Array.from({ length: 8 }, (_, index) => ({
      status: "failed" as const,
      architectureRetryBasis: null,
      sourceVersion: "v-payload",
      targetLocales: ["uk"],
      attemptAt: new Date(Date.UTC(2026, 9, 1, 0, index, 0)).toISOString(),
      failureReasonCode: "INVALID_PROVIDER_PAYLOAD",
      failureTargetLocale: "uk",
      retryabilityHint: "retryable",
      localeFailures: [{ targetLocale: "uk", failureReasonCode: "INVALID_PROVIDER_PAYLOAD" }],
      structuredOutputContract: "schema_v1",
    }));
    assert.equal(
      selectInvalidProviderPayloadRetry({
        sourceKind: "initiative",
        sourceRecordId: "initiative-payload-cap",
        targetLocale: "uk",
        sourceVersion: "v-payload",
        attempts: attempts.slice(0, 7),
        nowMs: FAR_FUTURE,
      }).outcome,
      "due",
    );
    const exhausted = selectInvalidProviderPayloadRetry({
      sourceKind: "initiative",
      sourceRecordId: "initiative-payload-cap",
      targetLocale: "uk",
      sourceVersion: "v-payload",
      attempts,
      nowMs: FAR_FUTURE,
    });
    assert.equal(exhausted.outcome, "exhausted");
    if (exhausted.outcome === "exhausted") {
      assert.equal(exhausted.countedFailures, 8);
    }
  });
});
