/**
 * RESET 05E.3 — Gemini quota-aware publication control.
 */

import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";

import {
  MEDIA_PLP_ENTITY_TYPE,
  mediaPlpEditorialEntityId,
} from "@hu/types";

import {
  CIVIC_MEDIA_FAQ,
  CIVIC_MEDIA_OVERVIEW,
} from "../../../src/modules/civic-media-center/content/sections.js";
import {
  FakeLocalMediaPlpTransport,
  ThinGeminiMediaPlpTransport,
  activateThinGeminiProviderCooldown,
  callMediaPlpMaterializerProviderOnce,
  clearThinGeminiProviderCooldown,
  extractGeminiQuotaForensics,
  getThinGeminiCooldownSnapshot,
  getThinGeminiGovernorPeakConcurrencyForTests,
  parseGeminiRetryDelaySeconds,
  PLP_PROVIDER_QUOTA_CLASS,
  resetMediaPlpMaterializerCountersForTests,
  resetMediaPlpMaterializerProviderCallBudget,
  resetThinGeminiGovernorForTests,
  resetThinGeminiProviderStateForTests,
  resolveQuotaCooldownSeconds,
  setThinGeminiProviderStateForceMemoryForTests,
  withThinGeminiGovernor,
} from "../../../src/modules/language/media-plp-materializer/index.js";
import { resolveTranslationConfig, TranslationProviderError } from "../../../src/modules/language/translation.config.js";
import {
  asMediaPlpPresentationNode,
  buildCanonicalEditorialPresentation,
  claimNextPlpAutoBuildWork,
  ensureMediaPlpAdapterRegistered,
  isCollectedPathMachineEligible,
  listPlpAutoBuildWorkForTests,
  mapProviderBoundaryReasonToFailure,
  markPlpAutoBuildWorkFailed,
  resetMediaPlpAdapterRegistrationForTests,
  resetPlpAutoBuildWorkStoreForTests,
  resetPlpDomainAdapterRegistryForTests,
  resolveFieldPolicyForEntityType,
  resolvePlpProviderConcurrency,
  setPlpAutoBuildWorkForceMemoryForTests,
  structuredFailure,
  upsertPendingPlpAutoBuildWork,
} from "../../../src/modules/language/published-localized-presentation/index.js";
import { collectAutoPaths } from "../../../src/modules/language/published-localized-presentation/presentation-paths.js";
import { runInitiativePlpThinProvider } from "../../../src/modules/language/initiative-plp-operator/provider-boundary.js";

function geminiConfig() {
  return {
    ...resolveTranslationConfig(),
    provider: "gemini" as const,
    geminiApiKey: "test-key-not-real",
    geminiModel: "gemini-2.0-flash",
    timeoutMs: 5_000,
  };
}

function httpResponse(status: number, body: unknown, headers?: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

const resourceExhaustedBody = {
  error: {
    code: 429,
    status: "RESOURCE_EXHAUSTED",
    message: "quota exceeded — prose must never be persisted",
    details: [
      {
        "@type": "type.googleapis.com/google.rpc.QuotaFailure",
        violations: [
          {
            quotaMetric:
              "generativelanguage.googleapis.com/generate_content_free_tier_requests",
            quotaId: "GenerateRequestsPerMinutePerProjectPerModel-FreeTier",
            quotaDimensions: {
              location: "global",
              model: "gemini-2.0-flash",
              // Must never appear in forensics:
              project: "projects/secret-project-123",
            },
          },
        ],
      },
      {
        "@type": "type.googleapis.com/google.rpc.RetryInfo",
        retryDelay: "34.074824224s",
      },
      {
        "@type": "type.googleapis.com/google.rpc.ErrorInfo",
        reason: "RATE_LIMIT_EXCEEDED",
        domain: "googleapis.com",
      },
    ],
  },
};

beforeEach(() => {
  resetMediaPlpMaterializerCountersForTests();
  resetPlpDomainAdapterRegistryForTests();
  resetMediaPlpAdapterRegistrationForTests();
  ensureMediaPlpAdapterRegistered();
  setPlpAutoBuildWorkForceMemoryForTests(true);
  resetPlpAutoBuildWorkStoreForTests();
  process.env.HU_PLP_THIN_GEMINI_MIN_SPACING_MS = "0";
  process.env.HU_PLP_RETRY_BACKOFF_IN_MEMORY = "1";
  setThinGeminiProviderStateForceMemoryForTests(true);
  resetThinGeminiProviderStateForTests();
  resetThinGeminiGovernorForTests({ clearStartupGuard: true });
  delete process.env.HU_INITIATIVE_PLP_PROVIDER;
});

afterEach(() => {
  resetMediaPlpMaterializerCountersForTests();
  resetPlpAutoBuildWorkStoreForTests();
  setPlpAutoBuildWorkForceMemoryForTests(false);
  delete process.env.HU_PLP_THIN_GEMINI_MIN_SPACING_MS;
  delete process.env.HU_PLP_RETRY_BACKOFF_IN_MEMORY;
  delete process.env.HU_INITIATIVE_PLP_PROVIDER;
  resetThinGeminiProviderStateForTests();
  setThinGeminiProviderStateForceMemoryForTests(false);
  resetThinGeminiGovernorForTests({ clearStartupGuard: true });
});

describe("RESET 05E.3 — Gemini quota forensics", () => {
  it("1. parses RESOURCE_EXHAUSTED QuotaFailure + RetryInfo safely", () => {
    const quota = extractGeminiQuotaForensics({
      httpStatus: 429,
      error: resourceExhaustedBody.error,
      retryAfterHeaderSeconds: 10,
    });
    assert.ok(quota);
    assert.equal(quota!.quotaClass, PLP_PROVIDER_QUOTA_CLASS.RATE_WINDOW);
    assert.equal(
      quota!.quotaMetric,
      "generativelanguage.googleapis.com/generate_content_free_tier_requests",
    );
    assert.equal(
      quota!.quotaLimitId,
      "GenerateRequestsPerMinutePerProjectPerModel-FreeTier",
    );
    assert.equal(quota!.quotaRetryDelaySeconds, 35);
    assert.equal(quota!.geminiErrorReason, "RATE_LIMIT_EXCEEDED");
    assert.equal(parseGeminiRetryDelaySeconds("34s"), 34);
  });

  it("classifies daily quota distinctly from rate window", () => {
    const quota = extractGeminiQuotaForensics({
      httpStatus: 429,
      error: {
        status: "RESOURCE_EXHAUSTED",
        details: [
          {
            "@type": "type.googleapis.com/google.rpc.QuotaFailure",
            violations: [
              {
                quotaMetric: "generativelanguage.googleapis.com/generate_content_requests",
                quotaId: "GenerateRequestsPerDayPerProjectPerModel-FreeTier",
              },
            ],
          },
        ],
      },
    });
    assert.equal(quota?.quotaClass, PLP_PROVIDER_QUOTA_CLASS.DAILY_QUOTA);
    const seconds = resolveQuotaCooldownSeconds({
      quotaClass: PLP_PROVIDER_QUOTA_CLASS.DAILY_QUOTA,
      quotaRetryDelaySeconds: 30,
    });
    assert.ok(seconds >= 3600);
  });

  it("10. HTTP 400 is not quota classification", () => {
    const quota = extractGeminiQuotaForensics({
      httpStatus: 400,
      error: { status: "INVALID_ARGUMENT", details: [] },
    });
    assert.equal(quota, null);
  });

  it("15. never retains project ids or error.message prose", () => {
    const quota = extractGeminiQuotaForensics({
      httpStatus: 429,
      error: resourceExhaustedBody.error,
    });
    const blob = JSON.stringify(quota);
    assert.equal(blob.includes("secret-project"), false);
    assert.equal(blob.includes("quota exceeded"), false);
    assert.equal(blob.includes("prose"), false);
  });
});

describe("RESET 05E.3 — durable cooldown + governor", () => {
  it("2+3. RetryInfo delay activates shared cooldown; subsequent calls blocked", async () => {
    let fetchCount = 0;
    const transport = new ThinGeminiMediaPlpTransport(geminiConfig(), async () => {
      fetchCount += 1;
      return httpResponse(429, resourceExhaustedBody, { "Retry-After": "10" });
    });

    await assert.rejects(
      () =>
        transport.translate({
          sourceLanguage: "en",
          targetLanguage: "uk",
          text: JSON.stringify({ translations: [{ key: "a", value: "A" }] }),
          contentType: "structured_json",
          safetyCleared: true,
        }),
      (err: unknown) =>
        err instanceof TranslationProviderError &&
        err.code === "rate_limited" &&
        err.transport?.quotaClass === PLP_PROVIDER_QUOTA_CLASS.RATE_WINDOW,
    );

    assert.equal(fetchCount, 1);
    const snap = await getThinGeminiCooldownSnapshot();
    assert.equal(snap.active, true);
    assert.ok((snap.remainingSeconds ?? 0) >= 30);

    await assert.rejects(
      () =>
        transport.translate({
          sourceLanguage: "en",
          targetLanguage: "uk",
          text: JSON.stringify({ translations: [{ key: "b", value: "B" }] }),
          contentType: "structured_json",
          safetyCleared: true,
        }),
      (err: unknown) =>
        err instanceof TranslationProviderError &&
        err.transport?.errorClass === "PROVIDER_COOLDOWN",
    );
    assert.equal(fetchCount, 1);
  });

  it("4+5. Editorial + News respect same cooldown (no Gemini during cooldown)", async () => {
    await activateThinGeminiProviderCooldown({
      quotaClass: PLP_PROVIDER_QUOTA_CLASS.RATE_WINDOW,
      quotaRetryDelaySeconds: 120,
      reason: "RESOURCE_EXHAUSTED",
    });
    let fetchCount = 0;
    const transport = new ThinGeminiMediaPlpTransport(geminiConfig(), async () => {
      fetchCount += 1;
      return httpResponse(200, {
        candidates: [
          {
            finishReason: "STOP",
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    translations: [
                      { key: "title", value: "T" },
                      { key: "summary", value: "S" },
                    ],
                  }),
                },
              ],
            },
          },
        ],
      });
    });

    const news = await callMediaPlpMaterializerProviderOnce({
      provider: transport,
      locale: "uk",
      autoValues: { title: "Hello", summary: "World" },
      sourceRecordId: "news-1",
      sourceVersion: "v1",
      PROVIDER_TRANSPORT: "gemini_generativelanguage_http",
    });
    assert.equal(news.ok, false);
    assert.match(news.message, /PROVIDER_ERROR_CLASS=PROVIDER_COOLDOWN/);
    assert.equal(fetchCount, 0);

    const editorialTree = asMediaPlpPresentationNode(
      buildCanonicalEditorialPresentation({
        overview: CIVIC_MEDIA_OVERVIEW,
        faq: CIVIC_MEDIA_FAQ,
      }),
    );
    const policy = resolveFieldPolicyForEntityType(MEDIA_PLP_ENTITY_TYPE.EDITORIAL);
    const editorialAuto: Record<string, string> = {};
    for (const { path, value } of collectAutoPaths(editorialTree)) {
      if (
        typeof value === "string" &&
        isCollectedPathMachineEligible(path, policy)
      ) {
        editorialAuto[path] = value;
      }
    }
    const editorial = await callMediaPlpMaterializerProviderOnce({
      provider: transport,
      locale: "uk",
      autoValues: Object.fromEntries(Object.entries(editorialAuto).slice(0, 2)),
      sourceRecordId: mediaPlpEditorialEntityId(),
      sourceVersion: "v1",
      PROVIDER_TRANSPORT: "gemini_generativelanguage_http",
    });
    assert.equal(editorial.ok, false);
    assert.equal(fetchCount, 0);
  });

  it("6. Initiative thin_gemini path cannot bypass governor", async () => {
    process.env.HU_INITIATIVE_PLP_PROVIDER = "thin_gemini";
    await activateThinGeminiProviderCooldown({
      quotaClass: PLP_PROVIDER_QUOTA_CLASS.RATE_WINDOW,
      quotaRetryDelaySeconds: 60,
    });
    const prevKey = process.env.GEMINI_API_KEY;
    const prevProvider = process.env.TRANSLATION_PROVIDER;
    process.env.GEMINI_API_KEY = "test-key-not-real";
    process.env.TRANSLATION_PROVIDER = "gemini";
    try {
      const result = await runInitiativePlpThinProvider({
        locale: "uk",
        autoValues: { title: "Hello" },
        sourceRecordId: "init-1",
        sourceVersion: "v1",
      });
      assert.equal(result.ok, false);
      assert.match(result.message, /PROVIDER_COOLDOWN|PROVIDER_FAILURE|rate|cooldown/i);
    } finally {
      if (prevKey === undefined) delete process.env.GEMINI_API_KEY;
      else process.env.GEMINI_API_KEY = prevKey;
      if (prevProvider === undefined) delete process.env.TRANSLATION_PROVIDER;
      else process.env.TRANSLATION_PROVIDER = prevProvider;
    }
  });

  it("7. cooldown survives simulated process restart (durable memory/mongo state)", async () => {
    await activateThinGeminiProviderCooldown({
      quotaClass: PLP_PROVIDER_QUOTA_CLASS.RATE_WINDOW,
      quotaRetryDelaySeconds: 90,
      reason: "HTTP_429",
    });
    // Simulate process restart of in-memory governor only — durable state retained.
    resetThinGeminiGovernorForTests({ clearStartupGuard: true });
    const snap = await getThinGeminiCooldownSnapshot();
    assert.equal(snap.active, true);
    assert.equal(snap.cooldownReason, "HTTP_429");
  });

  it("13+14. no startup burst; concurrency remains 1", async () => {
    process.env.HU_PLP_THIN_GEMINI_MIN_SPACING_MS = "40";
    resetThinGeminiGovernorForTests(); // keep startup guard
    const started = Date.now();
    await withThinGeminiGovernor(async () => "ok");
    assert.ok(Date.now() - started >= 35);
    assert.equal(resolvePlpProviderConcurrency(), 1);
    assert.ok(getThinGeminiGovernorPeakConcurrencyForTests() <= 1);
  });
});

describe("RESET 05E.3 — queue attempt budget", () => {
  it("8+12. 429 does not burn attempts; pending stays deferred", async () => {
    const upsert = await upsertPendingPlpAutoBuildWork({
      entityType: MEDIA_PLP_ENTITY_TYPE.PUBLIC_NEWS,
      entityId: "news-quota-1",
      locale: "uk",
      canonicalVersion: "cv1",
      contentRevision: 1,
      trigger: "SYSTEM_RECOVERY",
      maxAttempts: 5,
    });
    const claimed = await claimNextPlpAutoBuildWork();
    assert.ok(claimed);
    assert.equal(claimed!.attempts, 1);

    const failure = mapProviderBoundaryReasonToFailure({
      reason: "PROVIDER_FAILURE",
      message:
        "PROVIDER_FAILURE;PROVIDER_FAILURE_SUBTYPE=HTTP_FAILURE;PROVIDER_ERROR_CLASS=HTTP_429;PROVIDER_HTTP_STATUS=429;PROVIDER_GEMINI_ERROR_STATUS=RESOURCE_EXHAUSTED;PROVIDER_QUOTA_CLASS=RATE_WINDOW;PROVIDER_QUOTA_RETRY_DELAY_SECONDS=35;PROVIDER_RETRY_AFTER=35",
    });
    assert.equal(failure.quotaDefer, true);

    const marked = await markPlpAutoBuildWorkFailed({
      workKey: claimed!.workKey,
      attempts: claimed!.attempts,
      maxAttempts: claimed!.maxAttempts,
      failure,
    });
    assert.equal(marked.requeued, true);
    assert.equal(marked.quotaDeferred, true);

    const row = listPlpAutoBuildWorkForTests().find(
      (r) => r.workKey === upsert.record.workKey,
    );
    assert.ok(row);
    assert.equal(row!.status, "pending");
    assert.equal(row!.attempts, 0);
    assert.ok(row!.nextAttemptAt);
    assert.ok(Date.parse(row!.nextAttemptAt!) > Date.now());
  });

  it("claim returns null while durable cooldown active", async () => {
    await activateThinGeminiProviderCooldown({
      quotaClass: PLP_PROVIDER_QUOTA_CLASS.RATE_WINDOW,
      quotaRetryDelaySeconds: 120,
    });
    await upsertPendingPlpAutoBuildWork({
      entityType: MEDIA_PLP_ENTITY_TYPE.PUBLIC_NEWS,
      entityId: "news-cooldown-claim",
      locale: "uk",
      canonicalVersion: "cv1",
      contentRevision: 1,
      trigger: "SYSTEM_RECOVERY",
      maxAttempts: 5,
    });
    const claimed = await claimNextPlpAutoBuildWork();
    assert.equal(claimed, null);
  });

  it("9. ordinary HTTP 500 retains ordinary retry semantics (burns attempt)", async () => {
    await clearThinGeminiProviderCooldown();
    const upsert = await upsertPendingPlpAutoBuildWork({
      entityType: MEDIA_PLP_ENTITY_TYPE.PUBLIC_NEWS,
      entityId: "news-500",
      locale: "uk",
      canonicalVersion: "cv1",
      contentRevision: 1,
      trigger: "SYSTEM_RECOVERY",
      maxAttempts: 5,
    });
    const claimed = await claimNextPlpAutoBuildWork();
    assert.ok(claimed);
    const failure = structuredFailure({
      failureCode: "PROVIDER_FAILURE",
      retryable: true,
      stage: "provider",
      safeReason:
        "PROVIDER_FAILURE;PROVIDER_FAILURE_SUBTYPE=HTTP_FAILURE;PROVIDER_ERROR_CLASS=HTTP_5XX;PROVIDER_HTTP_STATUS=503",
    });
    const marked = await markPlpAutoBuildWorkFailed({
      workKey: claimed!.workKey,
      attempts: claimed!.attempts,
      maxAttempts: claimed!.maxAttempts,
      failure,
    });
    assert.equal(marked.requeued, true);
    assert.equal(marked.quotaDeferred, undefined);
    const row = listPlpAutoBuildWorkForTests().find(
      (r) => r.workKey === upsert.record.workKey,
    );
    assert.equal(row!.attempts, 1);
    assert.equal(row!.status, "pending");
  });

  it("11. network failure remains transport classification (not quota defer)", () => {
    const failure = mapProviderBoundaryReasonToFailure({
      reason: "PROVIDER_FAILURE",
      message:
        "PROVIDER_FAILURE;PROVIDER_FAILURE_SUBTYPE=HTTP_FAILURE;PROVIDER_ERROR_CLASS=NETWORK",
    });
    assert.equal(failure.quotaDefer ?? false, false);
  });
});

describe("RESET 05E.3 — structured publish still works", () => {
  it("14+15. valid structured News + Editorial still publish through boundary", async () => {
    await clearThinGeminiProviderCooldown();
    resetMediaPlpMaterializerProviderCallBudget();

    const makeOk = (keys: string[]) => {
      const transport = new ThinGeminiMediaPlpTransport(geminiConfig(), async () =>
        httpResponse(200, {
          candidates: [
            {
              finishReason: "STOP",
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      translations: keys.map((key) => ({
                        key,
                        value: `[uk] ${key}`,
                      })),
                    }),
                  },
                ],
              },
            },
          ],
        }),
      );
      transport.setMaxRequestsForBatching(4);
      return transport;
    };

    const news = await callMediaPlpMaterializerProviderOnce({
      provider: makeOk(["title", "summary"]),
      locale: "uk",
      autoValues: { title: "Hello", summary: "World" },
      sourceRecordId: "news-ok",
      sourceVersion: "v1",
      PROVIDER_TRANSPORT: "gemini_generativelanguage_http",
    });
    assert.equal(news.ok, true);

    resetMediaPlpMaterializerProviderCallBudget();
    const editorial = await callMediaPlpMaterializerProviderOnce({
      provider: makeOk(["headline", "body"]),
      locale: "uk",
      autoValues: {
        headline: "Editorial headline",
        body: "Editorial body without brand slots",
      },
      sourceRecordId: mediaPlpEditorialEntityId(),
      sourceVersion: "v1",
      PROVIDER_TRANSPORT: "gemini_generativelanguage_http",
    });
    assert.equal(editorial.ok, true);
  });

  it("fake_local still bypasses Gemini governor HTTP", async () => {
    await activateThinGeminiProviderCooldown({
      quotaClass: PLP_PROVIDER_QUOTA_CLASS.RATE_WINDOW,
      quotaRetryDelaySeconds: 60,
    });
    const fake = new FakeLocalMediaPlpTransport();
    const result = await callMediaPlpMaterializerProviderOnce({
      provider: fake,
      locale: "uk",
      autoValues: { title: "Hello", summary: "World" },
      sourceRecordId: "news-fake",
      sourceVersion: "v1",
      PROVIDER_TRANSPORT: "fake_local",
    });
    assert.equal(result.ok, true);
  });
});
