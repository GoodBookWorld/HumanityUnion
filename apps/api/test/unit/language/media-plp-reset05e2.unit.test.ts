/**
 * RESET 05E.2 — Gemini HTTP transport root-cause forensics.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  MEDIA_PLP_ENTITY_TYPE,
  MEDIA_PLP_EDITORIAL_ENTITY_ID,
  mediaPlpEditorialEntityId,
} from "@hu/types";

import {
  CIVIC_MEDIA_FAQ,
  CIVIC_MEDIA_OVERVIEW,
} from "../../../src/modules/civic-media-center/content/sections.js";
import {
  FakeLocalMediaPlpTransport,
  MEDIA_PLP_FAKE_LOCAL_TRANSPORT_ID,
  ThinGeminiMediaPlpTransport,
  callMediaPlpMaterializerProviderOnce,
  classifyHttpTransportErrorClass,
  parseRetryAfterSeconds,
  PLP_PROVIDER_FAILURE_SUBTYPE,
  resetMediaPlpMaterializerCountersForTests,
  resetMediaPlpMaterializerProviderCallBudget,
} from "../../../src/modules/language/media-plp-materializer/index.js";
import { resolveTranslationConfig, TranslationProviderError } from "../../../src/modules/language/translation.config.js";
import {
  asMediaPlpPresentationNode,
  buildCanonicalEditorialPresentation,
  claimNextPlpAutoBuildWork,
  computePlpProviderRetryNextAttemptAt,
  ensureMediaPlpAdapterRegistered,
  isCollectedPathMachineEligible,
  listPlpAutoBuildWorkForTests,
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

const apiRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");

function geminiConfig() {
  return {
    ...resolveTranslationConfig(),
    provider: "gemini" as const,
    geminiApiKey: "test-key-not-real",
    geminiModel: "gemini-2.0-flash",
    timeoutMs: 5_000,
  };
}

function httpResponse(
  status: number,
  body: unknown,
  headers?: Record<string, string>,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

beforeEach(() => {
  resetMediaPlpMaterializerCountersForTests();
  resetPlpDomainAdapterRegistryForTests();
  resetMediaPlpAdapterRegistrationForTests();
  ensureMediaPlpAdapterRegistered();
  setPlpAutoBuildWorkForceMemoryForTests(true);
  resetPlpAutoBuildWorkStoreForTests();
  delete process.env.HU_PLP_RETRY_BACKOFF_IN_MEMORY;
});

afterEach(() => {
  resetMediaPlpMaterializerCountersForTests();
  resetPlpAutoBuildWorkStoreForTests();
  setPlpAutoBuildWorkForceMemoryForTests(false);
  delete process.env.HU_PLP_RETRY_BACKOFF_IN_MEMORY;
});

describe("RESET 05E.2 — Gemini HTTP transport forensics", () => {
  async function captureHttpError(
    status: number,
    body: unknown,
    headers?: Record<string, string>,
  ): Promise<TranslationProviderError> {
    const transport = new ThinGeminiMediaPlpTransport(geminiConfig(), async () =>
      httpResponse(status, body, headers),
    );
    try {
      await transport.translate({
        sourceLanguage: "en",
        targetLanguage: "uk",
        text: JSON.stringify({ translations: [{ key: "title", value: "Hello" }] }),
        contentType: "structured_json",
        safetyCleared: true,
      });
    } catch (err) {
      assert.ok(err instanceof TranslationProviderError);
      return err;
    }
    throw new Error("expected throw");
  }

  it("1: HTTP 400 → HTTP_400 + safe Gemini structural metadata", async () => {
    const err = await captureHttpError(400, {
      error: { code: 400, status: "INVALID_ARGUMENT", message: "secret schema detail" },
    });
    assert.equal(err.providerFailureSubtype, PLP_PROVIDER_FAILURE_SUBTYPE.HTTP_FAILURE);
    assert.equal(err.transport?.httpStatus, 400);
    assert.equal(err.transport?.httpClass, "4xx");
    assert.equal(err.transport?.errorClass, "HTTP_400");
    assert.equal(err.transport?.geminiErrorStatus, "INVALID_ARGUMENT");
    assert.equal(err.transport?.geminiErrorReason, "INVALID_ARGUMENT");
    assert.doesNotMatch(err.message, /secret schema/);
    assert.equal(classifyHttpTransportErrorClass(400), "HTTP_400");
  });

  it("2: 401 → HTTP_401", async () => {
    const err = await captureHttpError(401, { error: { status: "UNAUTHENTICATED" } });
    assert.equal(err.transport?.errorClass, "HTTP_401");
    assert.equal(err.transport?.httpStatus, 401);
  });

  it("3: 403 → HTTP_403", async () => {
    const err = await captureHttpError(403, { error: { status: "PERMISSION_DENIED" } });
    assert.equal(err.transport?.errorClass, "HTTP_403");
  });

  it("4: 404 → HTTP_404", async () => {
    const err = await captureHttpError(404, { error: { status: "NOT_FOUND" } });
    assert.equal(err.transport?.errorClass, "HTTP_404");
  });

  it("5: 429 → HTTP_429 + Retry-After", async () => {
    const err = await captureHttpError(
      429,
      { error: { status: "RESOURCE_EXHAUSTED" } },
      { "retry-after": "12" },
    );
    assert.equal(err.transport?.errorClass, "HTTP_429");
    assert.equal(err.transport?.retryAfterSeconds, 12);
    assert.equal(parseRetryAfterSeconds("12"), 12);
  });

  it("6: 5xx → HTTP_5XX", async () => {
    const err = await captureHttpError(503, { error: { status: "UNAVAILABLE" } });
    assert.equal(err.transport?.errorClass, "HTTP_5XX");
    assert.equal(err.transport?.httpClass, "5xx");
  });

  it("7: network exception → NETWORK", async () => {
    const transport = new ThinGeminiMediaPlpTransport(geminiConfig(), async () => {
      throw new TypeError("fetch failed");
    });
    try {
      await transport.translate({
        sourceLanguage: "en",
        targetLanguage: "uk",
        text: "{}",
        contentType: "structured_json",
        safetyCleared: true,
      });
    } catch (err) {
      assert.ok(err instanceof TranslationProviderError);
      assert.equal(err.providerFailureSubtype, PLP_PROVIDER_FAILURE_SUBTYPE.HTTP_FAILURE);
      assert.equal(err.transport?.errorClass, "NETWORK");
      assert.equal(err.transport?.httpStatus, null);
      assert.equal(err.transport?.httpClass, null);
      return;
    }
    assert.fail("expected throw");
  });

  it("8: AbortError → ABORT/TIMEOUT", async () => {
    const transport = new ThinGeminiMediaPlpTransport(geminiConfig(), async () => {
      const err = new Error("aborted");
      err.name = "AbortError";
      throw err;
    });
    try {
      await transport.translate({
        sourceLanguage: "en",
        targetLanguage: "uk",
        text: "{}",
        contentType: "structured_json",
        safetyCleared: true,
      });
    } catch (err) {
      assert.ok(err instanceof TranslationProviderError);
      assert.equal(err.providerFailureSubtype, PLP_PROVIDER_FAILURE_SUBTYPE.HTTP_TIMEOUT);
      assert.equal(err.transport?.errorClass, "ABORT");
      return;
    }
    assert.fail("expected throw");
  });

  it("9: no API key/URL/header/raw body leaks in durable forensics", async () => {
    resetMediaPlpMaterializerProviderCallBudget();
    const result = await callMediaPlpMaterializerProviderOnce({
      provider: new ThinGeminiMediaPlpTransport(geminiConfig(), async () =>
        httpResponse(400, {
          error: {
            status: "INVALID_ARGUMENT",
            message: "API key abc and https://evil.example leaked body",
          },
        }),
      ),
      locale: "uk",
      autoValues: { title: "Hello world title", summary: "Summary long enough here." },
      sourceRecordId: "news:x",
      sourceVersion: "v-test",
      PROVIDER_TRANSPORT: "gemini_generativelanguage_http",
    });
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.match(result.message, /PROVIDER_HTTP_STATUS=400/);
    assert.match(result.message, /PROVIDER_ERROR_CLASS=HTTP_400/);
    assert.match(result.message, /PROVIDER_GEMINI_ERROR_STATUS=INVALID_ARGUMENT/);
    assert.doesNotMatch(result.message, /API key|test-key|evil\.example|leaked body/i);
    assert.doesNotMatch(result.message, /x-goog-api-key|generativelanguage\.googleapis/i);
  });

  it("10–12: nextAttemptAt + Retry-After prevent early reclaim / tight loops", async () => {
    process.env.HU_PLP_RETRY_BACKOFF_IN_MEMORY = "1";
    const upsert = await upsertPendingPlpAutoBuildWork({
      entityType: MEDIA_PLP_ENTITY_TYPE.PUBLIC_NEWS,
      entityId: "news-backoff",
      locale: "uk",
      canonicalVersion: "v-test",
      contentRevision: 1,
      trigger: "ADMIN_REBUILD",
      maxAttempts: 5,
    });
    const claimed = await claimNextPlpAutoBuildWork();
    assert.ok(claimed);
    await markPlpAutoBuildWorkFailed({
      workKey: upsert.record.workKey,
      attempts: 1,
      maxAttempts: 5,
      failure: structuredFailure({
        failureCode: "PROVIDER_FAILURE",
        retryable: true,
        stage: "provider",
        safeReason:
          "PROVIDER_FAILURE;PROVIDER_FAILURE_SUBTYPE=HTTP_FAILURE;PROVIDER_ERROR_CLASS=HTTP_429;PROVIDER_RETRY_AFTER=30",
      }),
    });
    const pending = listPlpAutoBuildWorkForTests().find(
      (r) => r.workKey === upsert.record.workKey,
    )!;
    assert.equal(pending.status, "pending");
    assert.ok(pending.nextAttemptAt);
    const delay = Date.parse(pending.nextAttemptAt!) - Date.now();
    assert.ok(delay >= 25_000, `expected Retry-After floor, got ${delay}`);

    const early = await claimNextPlpAutoBuildWork();
    assert.equal(early, null);

    const t0 = Date.parse("2026-01-01T00:00:00.000Z");
    const withRetry = Date.parse(
      computePlpProviderRetryNextAttemptAt(1, t0, { retryAfterSeconds: 45 }),
    );
    assert.ok(withRetry - t0 >= 45_000);

    // Five exponential steps cannot be zero-delay.
    let cursor = t0;
    for (let a = 1; a <= 5; a += 1) {
      const next = Date.parse(computePlpProviderRetryNextAttemptAt(a, cursor));
      assert.ok(next - cursor >= 5_000);
      cursor = next;
    }
    assert.ok(cursor - t0 >= 5_000 * 5);
  });

  it("13: provider concurrency remains 1", () => {
    assert.equal(resolvePlpProviderConcurrency(), 1);
  });

  it("14: valid structured News response still publishes map", async () => {
    resetMediaPlpMaterializerProviderCallBudget();
    const result = await callMediaPlpMaterializerProviderOnce({
      provider: new FakeLocalMediaPlpTransport({}),
      locale: "uk",
      autoValues: {
        title: "Climate summit opens in Kyiv with partners",
        summary: "Delegates discussed verified reporting standards today.",
      },
      sourceRecordId: "news:ok",
      sourceVersion: "v-test",
      PROVIDER_TRANSPORT: MEDIA_PLP_FAKE_LOCAL_TRANSPORT_ID,
    });
    assert.equal(result.ok, true);
  });

  it("15: valid structured Editorial response still publishes map", async () => {
    const tree = asMediaPlpPresentationNode(
      buildCanonicalEditorialPresentation({
        overview: CIVIC_MEDIA_OVERVIEW,
        faq: [...CIVIC_MEDIA_FAQ],
      }),
    );
    const policy = resolveFieldPolicyForEntityType(
      MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_EDITORIAL,
    );
    const autoValues: Record<string, string> = {};
    for (const node of collectAutoPaths(tree)) {
      if (isCollectedPathMachineEligible(node.path, policy)) {
        autoValues[node.path] = node.value;
      }
    }
    resetMediaPlpMaterializerProviderCallBudget();
    const result = await callMediaPlpMaterializerProviderOnce({
      provider: new FakeLocalMediaPlpTransport({}),
      locale: "uk",
      autoValues,
      sourceRecordId: mediaPlpEditorialEntityId(MEDIA_PLP_EDITORIAL_ENTITY_ID),
      sourceVersion: "v-2dd8a2b73768d26f",
      PROVIDER_TRANSPORT: MEDIA_PLP_FAKE_LOCAL_TRANSPORT_ID,
    });
    assert.equal(result.ok, true);
  });

  it("16: diagnostic remains read-only and exposes HTTP forensic keys", () => {
    const diag = readFileSync(
      join(
        apiRoot,
        "src/modules/language/media-plp-carousel/media-live-closure-diagnostic.ts",
      ),
      "utf8",
    );
    assert.match(diag, /PROVIDER_HTTP_STATUS/);
    assert.match(diag, /PROVIDER_ERROR_CLASS/);
    assert.match(diag, /PROVIDER_RETRY_AFTER/);
    assert.match(diag, /PROVIDER_GEMINI_ERROR_STATUS/);
    assert.doesNotMatch(diag, /callMediaPlpMaterializerProviderOnce/);
  });

  it("HTTP_CLASS was null because thrown errors lacked transport httpStatus (regression guard)", async () => {
    resetMediaPlpMaterializerProviderCallBudget();
    const result = await callMediaPlpMaterializerProviderOnce({
      provider: new ThinGeminiMediaPlpTransport(geminiConfig(), async () =>
        httpResponse(429, { error: { status: "RESOURCE_EXHAUSTED" } }, { "retry-after": "8" }),
      ),
      locale: "uk",
      autoValues: { title: "Hello world title", summary: "Summary long enough here." },
      sourceRecordId: "news:x",
      sourceVersion: "v",
      PROVIDER_TRANSPORT: "gemini_generativelanguage_http",
    });
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.match(result.message, /PROVIDER_HTTP_CLASS=4xx/);
    assert.match(result.message, /PROVIDER_HTTP_STATUS=429/);
    assert.match(result.message, /PROVIDER_ERROR_CLASS=HTTP_429/);
    assert.match(result.message, /PROVIDER_RETRY_AFTER=8/);
    assert.equal(result.forensics?.PROVIDER_HTTP_CLASS, "4xx");
  });
});
