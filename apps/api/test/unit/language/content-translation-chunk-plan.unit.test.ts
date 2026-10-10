/**
 * Generic chunked content translation.
 * Deterministic only — no live Gemini and no Mongo writes.
 */
import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";

process.env.INITIATIVE_PERSISTENCE = "memory";
process.env.CONTENT_TRANSLATION_PERSISTENCE = "memory";
process.env.TRANSLATION_PROVIDER = "deterministic";
process.env.CONTENT_TRANSLATION_WORKER_CONCURRENCY = "1";
process.env.LANGUAGE_REGISTRY_PERSISTENCE = "memory";

import type { Initiative } from "@hu/types";

import { buildProviderOwnedLifecycleMachinePayload } from "@hu/types";

import { sanitizeBlogHtml } from "../../../src/modules/blog/blog-content-sanitize.js";
import {
  contentTranslationUsableOutputTokens,
  estimateContentTranslationRequestOutputTokens,
  planContentTranslationRequests,
  resolveContentTranslationExecutableFields,
  translateContentTranslationFieldMap,
} from "../../../src/modules/language/content-translation-chunk-plan.js";
import { assessRequiredTerminologyProtection } from "../../../src/modules/language/terminology-protection-contract.js";
import { SEMANTIC_RESIDUAL_DEFER_STREAK_CAP } from "../../../src/modules/language/content-translation-failure-metadata.js";
import { assertCivicTitleFieldsTranslatedFromSource } from "../../../src/modules/language/content-translation-output-validation.js";
import {
  contentTranslationUsesUnsplitSingleResponse,
  selectInvalidProviderPayloadRetry,
  shouldHoldAutomaticRetryForUnsplitTruncation,
  type InvalidProviderPayloadRetryAttempt,
} from "../../../src/modules/language/content-translation-provider-payload-retry.js";
import { loadTranslatableSource } from "../../../src/modules/language/content-translation.service.js";
import { findContentTranslation } from "../../../src/modules/language/persistence/content-translation.repository.js";
import {
  buildPublicLocalizationRetryPreflight,
  enqueueContentTranslationWarmRequested,
  ensureLanguageRegistrySeeded,
  getOrCreateContentTranslation,
  listContentTranslationWarmAttempts,
  processContentTranslationWarmMemoryQueueForTests,
  resetContentTranslationMemoryStoreForTests,
  resetContentTranslationWarmMemoryForTests,
  resetLanguageRegistryStoreForTests,
  resetTranslationProviderForTests,
  setContentTranslationWarmForceMemoryForTests,
  setLanguageRegistryForceMemoryForTests,
  setTranslationProviderForTests,
  updateLanguageRegistryRecord,
} from "../../../src/modules/language/index.js";
import {
  runLocalizationProviderRequest,
  setLocalizationProviderClockForTests,
  setLocalizationProviderPacingIntervalMsForTests,
  setLocalizationProviderSleepForTests,
} from "../../../src/modules/language/localization-provider-governor.js";
import {
  resetThinGeminiProviderStateForTests,
  setThinGeminiProviderStateForceMemoryForTests,
} from "../../../src/modules/language/media-plp-materializer/thin-gemini-provider-state.js";
import { TranslationProviderError } from "../../../src/modules/language/translation.config.js";
import {
  resetTerminologyGlossaryStoreForTests,
  setTerminologyGlossaryForceMemoryForTests,
} from "../../../src/modules/language/terminology-glossary/terminology-glossary.repository.js";
import { upsertTerminologyGlossaryMemory } from "../../../src/modules/language/terminology-glossary/terminology-glossary.memory.store.js";
import type { TranslationProviderRequest } from "../../../src/modules/language/translation-provider.js";
import {
  createInitiative,
  deleteInitiative,
  updateInitiative,
} from "../../../src/modules/initiatives/initiative.store.js";

const TOKENS = 4096;

function longProse(label: string, words = 1200): string {
  return Array.from({ length: words }, (_, index) => `${label}${index}`).join(" ");
}

function longHtml(): string {
  const paragraphs = Array.from({ length: 12 }, (_, index) => {
    const words = Array.from({ length: 40 }, (__, word) => `para${index}word${word}`).join(" ");
    return `<p>${words}</p>`;
  });
  paragraphs.push(
    `<p>Visit <a href="https://example.com/marine?x=1&amp;y=2">the report</a> now.</p>`,
  );
  return paragraphs.join("");
}

class PrefixProvider {
  readonly providerId = "gemini" as const;
  callCount = 0;
  failAt: number | null = null;
  mode: "ok" | "omit" | "truncated" = "ok";

  async translate(request: TranslationProviderRequest) {
    this.callCount += 1;
    if (this.failAt === this.callCount && this.mode === "truncated") {
      return {
        translatedText: '{"chunk0":"partial',
        providerId: this.providerId,
        isPlaceholder: false as const,
        envelope: {
          finishReason: "MAX_TOKENS",
          candidateCount: 1,
          textPartCount: 1,
          extractedLength: 16,
          failureSubtype: "truncated" as const,
        },
      };
    }
    const parsed = JSON.parse(request.text) as Record<string, string>;
    const translated: Record<string, string> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (this.failAt === this.callCount && this.mode === "omit") {
        continue;
      }
      translated[key] = key === "title" ? value : `Localized prose ${value}`;
    }
    return {
      translatedText: JSON.stringify(translated),
      providerId: this.providerId,
      isPlaceholder: false as const,
    };
  }
}

function truncatedAttempt(sourceVersion: string): InvalidProviderPayloadRetryAttempt {
  return {
    status: "failed",
    architectureRetryBasis: null,
    sourceVersion,
    targetLocales: ["uk"],
    attemptAt: "2020-01-01T00:00:00.000Z",
    failureReasonCode: "INVALID_PROVIDER_PAYLOAD",
    failureTargetLocale: "uk",
    retryabilityHint: "retryable",
    structuredOutputContract: "schema_v1",
    providerPayloadKind: "truncated",
  };
}

describe("content translation chunk plan", () => {
  it("keeps a short document on one request for every locale", () => {
    const fields = {
      title: "Harbor Council",
      excerpt: "A short civic summary.",
    };
    const first = planContentTranslationRequests(fields, TOKENS);
    const second = planContentTranslationRequests(fields, TOKENS);
    assert.equal(first.mode, "single");
    assert.equal(first.requests.length, 1);
    assert.deepEqual(first, second);
    assert.equal(contentTranslationUsesUnsplitSingleResponse(), true);
  });

  it("splits a long blog body and preserves HTML, entities, and URLs", async () => {
    const html = longHtml();
    const fields = { title: "Harbor Council", content: html };
    const plan = planContentTranslationRequests(fields, TOKENS);
    assert.equal(plan.mode, "chunked");
    assert.ok(plan.requests.length > 1);
    assert.ok(plan.requests.length <= 24);
    let calls = 0;
    const translated = await translateContentTranslationFieldMap({
      fields,
      maxOutputTokens: TOKENS,
      translate: async (payload) => {
        calls += 1;
        const out: Record<string, string> = {};
        for (const [key, value] of Object.entries(payload)) {
          assert.equal(value.includes("https://example.com/marine?x=1"), false);
          assert.equal(/<[^>]*$/.test(value), false);
          assert.equal(/^[^<]*>/.test(value), false);
          out[key] = key === "title" ? value : `Localized prose ${value}`;
        }
        return out;
      },
    });
    assert.ok(calls > 1);
    assert.equal(calls, plan.requests.length);
    const sanitized = sanitizeBlogHtml(translated.content ?? "");
    assert.match(sanitized, /href="https:\/\/example\.com\/marine\?x=1&amp;y=2"/);
    assert.match(sanitized, /<p>/);
    assert.match(sanitized, /<\/p>/);
    assert.match(sanitized, /Localized prose para0word0/);
    assert.equal(sanitized.includes("<a"), true);
    assertCivicTitleFieldsTranslatedFromSource({
      sourceKind: "blog_post",
      sourceLanguage: "en",
      targetLanguage: "uk",
      sourceFields: fields,
      translatedFields: translated,
    });
  });

  it("supports another long content kind with the same plan", () => {
    const fields = {
      title: "Archive title",
      implementationStory: longProse("story"),
    };
    const ukPlan = planContentTranslationRequests(fields, TOKENS);
    const dePlan = planContentTranslationRequests(fields, TOKENS);
    assert.equal(ukPlan.mode, "chunked");
    assert.deepEqual(ukPlan.requests, dePlan.requests);
    assert.ok(ukPlan.requests.length > 1);
  });

  it("fails the whole map when a middle chunk is missing or truncated", async () => {
    const fields = { title: "Harbor Council", description: longProse("body") };
    await assert.rejects(
      () =>
        translateContentTranslationFieldMap({
          fields,
          maxOutputTokens: TOKENS,
          translate: async (payload) => {
            const keys = Object.keys(payload);
            const out: Record<string, string> = {};
            for (const key of keys.slice(0, Math.max(0, keys.length - 1))) {
              out[key] = `Localized prose ${payload[key]}`;
            }
            return out;
          },
        }),
      /omitted a content chunk/,
    );

    let calls = 0;
    await assert.rejects(
      () =>
        translateContentTranslationFieldMap({
          fields,
          maxOutputTokens: TOKENS,
          translate: async (payload) => {
            calls += 1;
            if (calls === 2) {
              throw new TranslationProviderError(
                "malformed_response",
                "Gemini returned truncated translation",
                "truncated",
              );
            }
            return Object.fromEntries(
              Object.entries(payload).map(([key, value]) => [key, `Localized prose ${value}`]),
            );
          },
        }),
      /truncated translation/,
    );
    assert.equal(calls, 2);
  });

  it("keeps the truncation hold when a chunk plan is capable", () => {
    assert.equal(SEMANTIC_RESIDUAL_DEFER_STREAK_CAP, 8);
    const attempt = truncatedAttempt("v-source");
    const identity = {
      sourceVersion: "v-source",
      targetLocale: "uk",
      attempts: [attempt],
      retryOutcome: "due" as const,
    };
    assert.equal(
      shouldHoldAutomaticRetryForUnsplitTruncation({
        ...identity,
      }),
      true,
    );
    assert.equal(
      shouldHoldAutomaticRetryForUnsplitTruncation({
        ...identity,
      }),
      true,
    );
    const decision = selectInvalidProviderPayloadRetry({
      sourceKind: "civic_archive",
      sourceRecordId: "archive-1",
      targetLocale: "uk",
      sourceVersion: "v-source",
      attempts: [attempt],
      nowMs: Date.UTC(2026, 11, 1),
    });
    assert.equal(decision.countedFailures, 1);
    assert.equal(decision.outcome, "due");
  });

  it("continues later segments across the production pacing interval", async () => {
    setThinGeminiProviderStateForceMemoryForTests(true);
    resetThinGeminiProviderStateForTests();
    setLocalizationProviderPacingIntervalMsForTests(10_000);
    let now = 1_700_000_000_000;
    setLocalizationProviderClockForTests(() => now);
    setLocalizationProviderSleepForTests(async (ms) => {
      now += ms;
    });
    try {
      const fields = { title: "Harbor Council", content: longHtml() };
      const plan = planContentTranslationRequests(fields, TOKENS);
      assert.equal(plan.mode, "chunked");
      assert.ok(plan.requests.length > 1);
      const starts: number[] = [];
      let providerCalls = 0;
      const translated = await translateContentTranslationFieldMap({
        fields,
        maxOutputTokens: TOKENS,
        translate: (payload) =>
          runLocalizationProviderRequest(async () => {
            providerCalls += 1;
            starts.push(now);
            return Object.fromEntries(
              Object.entries(payload).map(([key, value]) => [
                key,
                key === "title" ? value : `Localized prose ${value}`,
              ]),
            );
          }),
      });
      assert.equal(providerCalls, plan.requests.length);
      assert.ok(starts[1]! - starts[0]! >= 10_000);
      assert.match(translated.content ?? "", /Localized prose para0word0/);
      assert.equal(translated.content?.includes("https://example.com/marine?x=1"), true);
    } finally {
      setLocalizationProviderSleepForTests(null);
      setLocalizationProviderClockForTests(null);
      setLocalizationProviderPacingIntervalMsForTests(null);
      resetThinGeminiProviderStateForTests();
      setThinGeminiProviderStateForceMemoryForTests(false);
    }
  });

  it("budgets dense script, JSON escapes, and request boundaries", () => {
    const usable = contentTranslationUsableOutputTokens(TOKENS);
    const dense = Array.from({ length: 900 }, () => "שלום").join(" ");
    const densePlan = planContentTranslationRequests({ body: dense }, TOKENS);
    assert.equal(densePlan.mode, "chunked");
    for (const request of densePlan.requests) {
      assert.ok(estimateContentTranslationRequestOutputTokens(request) <= usable);
    }

    const quoted = Array.from({ length: 350 }, () => `"ab"`).join(" ");
    const plain = "x".repeat(quoted.length);
    assert.ok(
      estimateContentTranslationRequestOutputTokens({ body: quoted }) >
        estimateContentTranslationRequestOutputTokens({ body: plain }),
    );

    const below = planContentTranslationRequests(
      { title: "Harbor", excerpt: "A short civic summary." },
      TOKENS,
    );
    assert.equal(below.mode, "single");
    assert.ok(estimateContentTranslationRequestOutputTokens(below.requests[0]!) <= usable);
  });

  it("preserves nested links, entities, unicode, and whitespace", async () => {
    const nested = [
      `<p>Opening <em>nested <a href="https://example.com/reef?a=1&amp;b=2">reef report</a> end</em>.</p>`,
      `<p>שלום   עולם</p>`,
      `<p>Keep&nbsp;this</p>`,
    ].join("\n\n");
    const filler = Array.from({ length: 8 }, (_, index) => {
      const words = Array.from({ length: 40 }, (__, word) => `nest${index}w${word}`).join(" ");
      return `<p>${words}</p>`;
    }).join("");
    const content = `${nested}${filler}`;
    const translated = await translateContentTranslationFieldMap({
      fields: { title: "Harbor Council", content },
      maxOutputTokens: TOKENS,
      translate: async (payload) =>
        Object.fromEntries(
          Object.entries(payload).map(([key, value]) => [
            key,
            key === "title" ? value : `Localized prose ${value}`,
          ]),
        ),
    });
    const raw = translated.content ?? "";
    assert.match(raw, /&nbsp;/);
    assert.match(raw, /<\/p>\n\n<p>/);
    const html = sanitizeBlogHtml(raw);
    assert.match(html, /<em>/);
    assert.match(html, /href="https:\/\/example\.com\/reef\?a=1&amp;b=2"/);
    assert.match(html, /שלום\s+עולם/);
  });

  it("holds unsplittable tokens and plans beyond 24 requests", async () => {
    const token = "a".repeat(8_000);
    const unsplittable = planContentTranslationRequests({ body: `intro ${token}` }, TOKENS);
    assert.equal(unsplittable.mode, "unsplittable");
    assert.equal(unsplittable.capable, false);
    let calls = 0;
    await assert.rejects(
      () =>
        translateContentTranslationFieldMap({
          fields: { body: token },
          maxOutputTokens: TOKENS,
          translate: async () => {
            calls += 1;
            return { body: "translated" };
          },
        }),
      /cannot be split/,
    );
    assert.equal(calls, 0);
    assert.equal(
      shouldHoldAutomaticRetryForUnsplitTruncation({
        sourceVersion: "v-source",
        targetLocale: "uk",
        attempts: [truncatedAttempt("v-source")],
        retryOutcome: "due",
      }),
      true,
    );

    const words = Array.from({ length: 12_000 }, (_, index) => `w${index}`).join(" ");
    const tooMany = planContentTranslationRequests({ body: words }, TOKENS);
    assert.equal(tooMany.mode, "unsplittable");
    assert.ok(tooMany.requests.length === 0);
  });

  it("plans the same payload preflight and execution will translate", () => {
    const summary = `{lifecycleStage:analysis} ${longProse("analysis", 400)}`;
    const sanitized = { title: "Council findings", summary };
    const executable = resolveContentTranslationExecutableFields({
      sourceKind: "collaborative_analysis",
      intent: "automatic_warm",
      sanitizedFields: sanitized,
    });
    const payload = {
      ...buildProviderOwnedLifecycleMachinePayload(sanitized).payload,
    };
    assert.deepEqual(executable, payload);
    assert.equal(JSON.stringify(executable).includes("{lifecycleStage:"), false);
    assert.deepEqual(
      planContentTranslationRequests(executable!, TOKENS).requests,
      planContentTranslationRequests(payload, TOKENS).requests,
    );

    const search = resolveContentTranslationExecutableFields({
      sourceKind: "blog_post",
      intent: "search_discovery",
      sanitizedFields: {
        title: "Harbor",
        excerpt: "Short",
        content: longHtml(),
      },
    });
    assert.deepEqual(search, { title: "Harbor", excerpt: "Short" });
    assert.equal(planContentTranslationRequests(search!, TOKENS).mode, "single");
    assert.equal(
      shouldHoldAutomaticRetryForUnsplitTruncation({
        sourceVersion: "v-source",
        targetLocale: "uk",
        attempts: [truncatedAttempt("v-source")],
        retryOutcome: "due",
      }),
      true,
    );

    assert.equal(
      resolveContentTranslationExecutableFields({
        sourceKind: "collaborative_analysis",
        intent: "automatic_warm",
        sanitizedFields: { title: "T", summary: "{lifecycleStage:not_real} hello" },
      }),
      null,
    );
  });

  it("stops releasing a chunked identity once the payload cap is exhausted", () => {
    const attempts = Array.from({ length: 8 }, () => truncatedAttempt("v-source"));
    const decision = selectInvalidProviderPayloadRetry({
      sourceKind: "blog_post",
      sourceRecordId: "blog-1",
      targetLocale: "uk",
      sourceVersion: "v-source",
      attempts,
      nowMs: Date.UTC(2026, 11, 1),
    });
    assert.equal(SEMANTIC_RESIDUAL_DEFER_STREAK_CAP, 8);
    assert.equal(decision.countedFailures, 8);
    assert.equal(decision.outcome, "exhausted");
    assert.equal(
      shouldHoldAutomaticRetryForUnsplitTruncation({
        sourceVersion: "v-source",
        targetLocale: "uk",
        attempts,
        retryOutcome: decision.outcome,
      }),
      false,
    );
  });
});

describe("chunked content translation persistence", () => {
  const createdIds: string[] = [];
  let provider: PrefixProvider;

  beforeEach(async () => {
    resetContentTranslationMemoryStoreForTests();
    resetContentTranslationWarmMemoryForTests();
    resetLanguageRegistryStoreForTests();
    resetTranslationProviderForTests();
    setLanguageRegistryForceMemoryForTests(true);
    setContentTranslationWarmForceMemoryForTests(true);
    provider = new PrefixProvider();
    setTranslationProviderForTests(provider);
    await ensureLanguageRegistrySeeded();
    await updateLanguageRegistryRecord("lang-uk", {
      enabled: true,
      contentTranslationEnabled: true,
    });
    await updateLanguageRegistryRecord("lang-ar", {
      enabled: true,
      contentTranslationEnabled: true,
    });
  });

  afterEach(() => {
    for (const id of createdIds.splice(0)) {
      deleteInitiative(id);
    }
    resetContentTranslationMemoryStoreForTests();
    resetContentTranslationWarmMemoryForTests();
    resetTranslationProviderForTests();
    setContentTranslationWarmForceMemoryForTests(false);
    setLanguageRegistryForceMemoryForTests(false);
    setLocalizationProviderSleepForTests(null);
    setLocalizationProviderClockForTests(null);
    setLocalizationProviderPacingIntervalMsForTests(null);
    resetTerminologyGlossaryStoreForTests();
    setTerminologyGlossaryForceMemoryForTests(false);
  });

  it("uses one provider request for a short document and several for a long one", async () => {
    const short = createInitiative(sampleInitiative("short", "A brief description of the harbor."));
    createdIds.push(short.initiativeId);
    const shortResult = await getOrCreateContentTranslation({
      sourceKind: "initiative",
      sourceRecordId: short.initiativeId,
      targetLanguage: "ar",
      generateIfMissing: true,
      intent: "automatic_warm",
    });
    assert.equal(shortResult.generated, true);
    assert.equal(provider.callCount, 1);

    const long = createInitiative(sampleInitiative("long", longProse("harbor")));
    createdIds.push(long.initiativeId);
    const before = provider.callCount;
    const longResult = await getOrCreateContentTranslation({
      sourceKind: "initiative",
      sourceRecordId: long.initiativeId,
      targetLanguage: "uk",
      generateIfMissing: true,
      intent: "automatic_warm",
    });
    assert.equal(longResult.generated, true);
    assert.ok(provider.callCount - before > 1);
    assert.match(longResult.translation?.translatedContent.description ?? "", /Localized prose harbor0/);
    assert.equal(
      longResult.translation?.translatedContent.title,
      long.title,
    );
  });

  it("does not persist a row when a later chunk fails", async () => {
    const initiative = createInitiative(sampleInitiative("atomic", longProse("atomic")));
    createdIds.push(initiative.initiativeId);
    provider.failAt = 2;
    provider.mode = "truncated";
    await assert.rejects(() =>
      getOrCreateContentTranslation({
        sourceKind: "initiative",
        sourceRecordId: initiative.initiativeId,
        targetLanguage: "uk",
        generateIfMissing: true,
        intent: "automatic_warm",
      }),
    );
    const source = await loadTranslatableSource({
      sourceKind: "initiative",
      sourceRecordId: initiative.initiativeId,
    });
    assert.ok(source);
    const row = await findContentTranslation({
      sourceKind: "initiative",
      sourceRecordId: initiative.initiativeId,
      sourceVersion: source.sourceVersion,
      targetLanguage: "uk",
    });
    assert.equal(row, null);
    assert.equal(provider.callCount, 2);
  });

  it("counts one warm attempt when several chunk calls fail", async () => {
    const initiative = createInitiative(sampleInitiative("budget", longProse("budget")));
    createdIds.push(initiative.initiativeId);
    const source = await loadTranslatableSource({
      sourceKind: "initiative",
      sourceRecordId: initiative.initiativeId,
    });
    assert.ok(source);
    provider.failAt = 2;
    provider.mode = "omit";
    const enqueued = await enqueueContentTranslationWarmRequested({
      sourceKind: "initiative",
      sourceRecordId: initiative.initiativeId,
      reason: "operator_residual_retry",
      targetLocales: ["uk"],
      sourceVersion: source.sourceVersion,
    });
    assert.equal(enqueued.enqueued, true);
    await assert.rejects(() => processContentTranslationWarmMemoryQueueForTests());
    const attempts = await listContentTranslationWarmAttempts({
      sourceKind: "initiative",
      sourceRecordId: initiative.initiativeId,
      limit: 50,
    });
    assert.equal(attempts.length, 1);
    assert.equal(attempts[0]?.status, "failed");
    const decision = selectInvalidProviderPayloadRetry({
      sourceKind: "initiative",
      sourceRecordId: initiative.initiativeId,
      targetLocale: "uk",
      sourceVersion: source.sourceVersion,
      attempts: attempts.map((row) => ({
        status: row.status,
        architectureRetryBasis: row.architectureRetryBasis,
        sourceVersion: row.sourceVersion,
        targetLocales: row.targetLocales,
        attemptAt: row.attemptAt,
        failureReasonCode: row.failureMetadata?.failureReasonCode ?? null,
        failureTargetLocale:
          typeof row.failureMetadata?.targetLocale === "string"
            ? row.failureMetadata.targetLocale
            : null,
        retryabilityHint: row.failureMetadata?.retryabilityHint ?? null,
        localeFailures: row.failureMetadata?.localeFailures ?? null,
        structuredOutputContract: row.failureMetadata?.structuredOutputContract ?? null,
        providerPayloadKind: row.failureMetadata?.providerPayloadKind ?? null,
      })),
      nowMs: Date.UTC(2026, 11, 1),
    });
    assert.equal(decision.countedFailures, 1);
    assert.ok(provider.callCount > 1);
    assert.equal(SEMANTIC_RESIDUAL_DEFER_STREAK_CAP, 8);
  });

  it("keeps a due truncated identity deferred when its fields can chunk", async () => {
    const initiative = createInitiative(sampleInitiative("release", longProse("release")));
    createdIds.push(initiative.initiativeId);
    const source = await loadTranslatableSource({
      sourceKind: "initiative",
      sourceRecordId: initiative.initiativeId,
    });
    assert.ok(source);
    const enqueued = await enqueueContentTranslationWarmRequested({
      sourceKind: "initiative",
      sourceRecordId: initiative.initiativeId,
      reason: "operator_residual_retry",
      targetLocales: ["uk"],
      sourceVersion: source.sourceVersion,
    });
    assert.ok(enqueued.eventId);
    const { markContentTranslationWarmMemoryFailedForTests } = await import(
      "../../../src/modules/language/content-translation-warm-enqueue.js"
    );
    markContentTranslationWarmMemoryFailedForTests(
      enqueued.eventId,
      `CT_FAIL_META_V1:${JSON.stringify({
        schema: "content_translation_failure_meta_v1",
        validationContractVersion: "v1",
        failureClass: "VALIDATION_FAILED",
        failureReasonCode: "INVALID_PROVIDER_PAYLOAD",
        sourceKind: "initiative",
        sourceRecordId: initiative.initiativeId,
        sourceVersion: source.sourceVersion,
        targetLocale: "uk",
        failedAt: "2020-01-01T00:00:00.000Z",
        retryabilityHint: "retryable",
        structuredOutputContract: "schema_v1",
        providerPayloadKind: "truncated",
      })}`,
      "2020-01-01T00:00:00.000Z",
    );
    const preflight = await buildPublicLocalizationRetryPreflight({
      workItem: {
        sourceKind: "initiative",
        sourceRecordId: initiative.initiativeId,
        sourceVersion: source.sourceVersion,
        targetLanguage: "uk",
        state: "MISSING",
        autoNodeCount: 1,
        missingOrStaleNodeCount: 1,
        fallbackPaths: ["title"],
      },
    });
    assert.equal(preflight.ready, true);
    assert.equal(preflight.readyState, "MISSING_READY_FOR_WARM");
    assert.equal(preflight.currentTranslationAbsent, true);
    assert.equal(preflight.semanticRetryDeferred, true);
    assert.equal(preflight.terminalFailureForCurrentVersion, false);
    const attempts = await listContentTranslationWarmAttempts({
      sourceKind: "initiative",
      sourceRecordId: initiative.initiativeId,
      limit: 50,
    });
    assert.equal(attempts.length, 1);
  });

  it("does not persist when the source version changes during chunking", async () => {
    const initiative = createInitiative(sampleInitiative("version", longProse("version")));
    createdIds.push(initiative.initiativeId);
    let shifted = false;
    setTranslationProviderForTests({
      providerId: "deterministic",
      async translate(request) {
        if (!shifted) {
          shifted = true;
          updateInitiative(initiative.initiativeId, {
            description: longProse("version-shifted"),
          });
        }
        const parsed = JSON.parse(request.text) as Record<string, string>;
        return {
          translatedText: JSON.stringify(
            Object.fromEntries(
              Object.entries(parsed).map(([key, value]) => [key, `Localized prose ${value}`]),
            ),
          ),
          providerId: "deterministic",
          isPlaceholder: false as const,
        };
      },
    });
    await assert.rejects(
      () =>
        getOrCreateContentTranslation({
          sourceKind: "initiative",
          sourceRecordId: initiative.initiativeId,
          targetLanguage: "uk",
          generateIfMissing: true,
          intent: "automatic_warm",
        }),
      /source version changed/,
    );
    const source = await loadTranslatableSource({
      sourceKind: "initiative",
      sourceRecordId: initiative.initiativeId,
    });
    assert.ok(source);
    const row = await findContentTranslation({
      sourceKind: "initiative",
      sourceRecordId: initiative.initiativeId,
      sourceVersion: source.sourceVersion,
      targetLanguage: "uk",
    });
    assert.equal(row, null);
  });

  it("rejects an unchanged sole civic title and keeps a protected term in the reassembled body", async () => {
    assert.throws(
      () =>
        assertCivicTitleFieldsTranslatedFromSource({
          sourceKind: "blog_post",
          sourceLanguage: "en",
          targetLanguage: "uk",
          sourceFields: { title: "Harbor Council" },
          translatedFields: { title: "Harbor Council" },
        }),
      /civic title/,
    );
    assert.doesNotThrow(() =>
      assertCivicTitleFieldsTranslatedFromSource({
        sourceKind: "blog_post",
        sourceLanguage: "en",
        targetLanguage: "uk",
        sourceFields: { title: "Harbor Council", excerpt: "A short note." },
        translatedFields: {
          title: "Harbor Council",
          excerpt: "Локалізована примітка",
        },
      }),
    );
    const titleOnly = createInitiative(sampleInitiative("civic", ""));
    createdIds.push(titleOnly.initiativeId);
    await assert.rejects(
      () =>
        getOrCreateContentTranslation({
          sourceKind: "initiative",
          sourceRecordId: titleOnly.initiativeId,
          targetLanguage: "uk",
          generateIfMissing: true,
          intent: "automatic_warm",
        }),
      /unchanged source text/,
    );
    const titleSource = await loadTranslatableSource({
      sourceKind: "initiative",
      sourceRecordId: titleOnly.initiativeId,
    });
    assert.ok(titleSource);
    assert.equal(
      await findContentTranslation({
        sourceKind: "initiative",
        sourceRecordId: titleOnly.initiativeId,
        sourceVersion: titleSource.sourceVersion,
        targetLanguage: "uk",
      }),
      null,
    );

    setTerminologyGlossaryForceMemoryForTests(true);
    upsertTerminologyGlossaryMemory({
      conceptId: "humanity_union",
      canonicalEnglishTerm: "Humanity Union",
      category: "brand",
      status: "published",
      translations: {
        uk: { preferredTerm: "Союз Людства", aliases: [] },
      },
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      updatedByParticipantId: null,
    });
    const described = createInitiative(
      sampleInitiative("term", `${longProse("term")} Humanity Union`),
    );
    createdIds.push(described.initiativeId);
    setTranslationProviderForTests({
      providerId: "deterministic",
      async translate(request) {
        const parsed = JSON.parse(request.text) as Record<string, string>;
        return {
          translatedText: JSON.stringify(
            Object.fromEntries(
              Object.entries(parsed).map(([key, value]) => [
                key,
                `Localized prose ${value.replaceAll("Humanity Union", "Союз Людства")}`,
              ]),
            ),
          ),
          providerId: "deterministic",
          isPlaceholder: false as const,
        };
      },
    });
    const created = await getOrCreateContentTranslation({
      sourceKind: "initiative",
      sourceRecordId: described.initiativeId,
      targetLanguage: "uk",
      generateIfMissing: true,
      intent: "automatic_warm",
    });
    const body = created.translation?.translatedContent.description ?? "";
    assert.match(body, /Союз Людства/);
    assert.equal(body.includes("Humanity Union"), false);
    const assessment = assessRequiredTerminologyProtection({
      concepts: [
        {
          conceptId: "humanity_union",
          canonicalEnglishTerm: "Humanity Union",
          category: "brand",
          status: "published",
          translations: { uk: { preferredTerm: "Союз Людства", aliases: [] } },
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
          updatedByParticipantId: null,
        },
      ],
      targetLocale: "uk",
      sourceText: `${longProse("term")} Humanity Union`,
      translatedText: body,
    });
    assert.equal(assessment.ok, true);
  });
});

function sampleInitiative(suffix: string, description: string): Initiative {
  const now = new Date().toISOString();
  return {
    initiativeId: `initiative-chunk-${suffix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    stewardId: "member-chunk",
    createdAt: now,
    updatedAt: now,
    title: `Harbor Council ${suffix}`,
    description,
    status: "proposal",
    lifecyclePhase: "projected",
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
