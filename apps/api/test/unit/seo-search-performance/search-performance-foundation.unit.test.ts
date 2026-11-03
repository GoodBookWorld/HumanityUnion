/**
 * SEO-12B.1 — configuration, redaction, reporting days, bounded HTTP and retry policy.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolveSearchPerformanceConfig } from "../../../src/modules/seo-search-performance/search-performance.config.js";
import {
  addMonthsToDay,
  isDayKey,
  listDays,
  pacificDayKey,
  parseBingDateToDay,
} from "../../../src/modules/seo-search-performance/search-performance.dates.js";
import {
  classifyHttpFailure,
  parseRetryAfterMs,
  requestBoundedJson,
  SearchProviderError,
  withSearchProviderRetry,
} from "../../../src/modules/seo-search-performance/search-performance.http.js";
import { redactSearchPerformanceText } from "../../../src/modules/seo-search-performance/search-performance.redaction.js";

const PEM =
  "-----BEGIN PRIVATE KEY-----\nMIIBVQIBADANBgkqhkiG9w0BAQEFAASC\n-----END PRIVATE KEY-----\n";

const FULL_ENV = {
  SEO_SEARCH_SYNC_ENABLED: "true",
  SEO_GSC_SITE_URL: "sc-domain:huws.org",
  SEO_GSC_SERVICE_ACCOUNT_EMAIL: "search-reader@hu-project.iam.gserviceaccount.com",
  SEO_GSC_SERVICE_ACCOUNT_PRIVATE_KEY: PEM.replace(/\n/g, "\\n"),
  SEO_BING_SITE_URL: "https://huws.org/",
  SEO_BING_CLIENT_ID: "bing-client-id",
  SEO_BING_CLIENT_SECRET: "bing-client-secret-value",
  SEO_BING_REFRESH_TOKEN: "bing-refresh-token-value",
};

describe("SEO-12B.1 — provider configuration", () => {
  it("is disabled and unconfigured with an empty environment", () => {
    const config = resolveSearchPerformanceConfig({});
    assert.equal(config.syncEnabled, false);
    assert.equal(config.google.configured, false);
    assert.equal(config.bing.configured, false);
    assert.ok(config.google.issues.includes("SEO_GSC_SITE_URL is missing"));
    assert.ok(config.bing.issues.includes("SEO_BING_REFRESH_TOKEN is missing"));
  });

  it("only enables sync for the exact value 'true'", () => {
    for (const value of ["1", "TRUE", "yes", " false "]) {
      assert.equal(
        resolveSearchPerformanceConfig({ SEO_SEARCH_SYNC_ENABLED: value }).syncEnabled,
        false,
      );
    }
    assert.equal(
      resolveSearchPerformanceConfig({ SEO_SEARCH_SYNC_ENABLED: "true" }).syncEnabled,
      true,
    );
  });

  it("resolves complete configuration and restores escaped key newlines", () => {
    const config = resolveSearchPerformanceConfig(FULL_ENV);
    assert.equal(config.google.configured, true);
    assert.equal(config.bing.configured, true);
    if (config.google.configured) {
      assert.equal(config.google.config.privateKey, PEM);
    }
  });

  it("reports invalid values by variable name without echoing values", () => {
    const config = resolveSearchPerformanceConfig({
      ...FULL_ENV,
      SEO_GSC_SITE_URL: "http://huws.org",
      SEO_GSC_SERVICE_ACCOUNT_EMAIL: "person@gmail.com",
      SEO_GSC_SERVICE_ACCOUNT_PRIVATE_KEY: "not-a-key-secret-value",
      SEO_BING_SITE_URL: "huws.org",
    });
    assert.equal(config.google.configured, false);
    assert.equal(config.bing.configured, false);
    const issues = JSON.stringify([config.google.issues, config.bing.issues]);
    assert.match(issues, /SEO_GSC_SITE_URL/);
    assert.match(issues, /SEO_GSC_SERVICE_ACCOUNT_EMAIL/);
    assert.match(issues, /SEO_GSC_SERVICE_ACCOUNT_PRIVATE_KEY/);
    assert.match(issues, /SEO_BING_SITE_URL/);
    assert.doesNotMatch(issues, /not-a-key-secret-value|person@gmail\.com|bing-client-secret/);
  });

  it("keeps each provider independent", () => {
    const config = resolveSearchPerformanceConfig({ ...FULL_ENV, SEO_BING_CLIENT_SECRET: "" });
    assert.equal(config.google.configured, true);
    assert.equal(config.bing.configured, false);
  });
});

describe("SEO-12B.1 — credential redaction", () => {
  it("removes known secrets, bearer tokens, form secrets, JSON secrets and PEM blocks", () => {
    const text = [
      "token bing-refresh-token-value leaked",
      "Authorization: Bearer ya29.a0AfH6SMBx-secret",
      "client_secret=abc123&refresh_token=def456&apikey=ghi789",
      '{"access_token":"tok-1","private_key":"pem"}',
      PEM,
      "eyJhbGciOiJSUzI1NiJ9.eyJpc3MiOiJ4In0.signaturepart",
    ].join(" | ");
    const redacted = redactSearchPerformanceText(text, ["bing-refresh-token-value"]);
    for (const leaked of [
      "bing-refresh-token-value",
      "ya29.a0AfH6SMBx-secret",
      "abc123",
      "def456",
      "ghi789",
      "tok-1",
      "MIIBVQIBADANBgkqhkiG9w0BAQEFAASC",
      "eyJhbGciOiJSUzI1NiJ9",
    ]) {
      assert.equal(redacted.includes(leaked), false, `leaked ${leaked}`);
    }
  });

  it("bounds the stored message length", () => {
    assert.ok(redactSearchPerformanceText("x".repeat(5000)).length <= 301);
  });
});

describe("SEO-12B.1 — reporting days", () => {
  it("formats Pacific reporting days across the UTC date boundary", () => {
    assert.equal(pacificDayKey(new Date("2026-11-03T06:30:00.000Z")), "2026-11-02");
    assert.equal(pacificDayKey(new Date("2026-11-03T09:00:00.000Z")), "2026-11-03");
  });

  it("parses Bing /Date()/ values in the supplied offset", () => {
    assert.equal(parseBingDateToDay("/Date(1316156400000-0700)/"), "2011-09-16");
    assert.equal(parseBingDateToDay("/Date(1316156400000)/"), "2011-09-16");
    assert.equal(parseBingDateToDay("/Date(1316131200000+0200)/"), "2011-09-16");
    for (const invalid of ["2011-09-16", "/Date(abc)/", 1316156400000, null, "/Date()/"]) {
      assert.equal(parseBingDateToDay(invalid), null);
    }
  });

  it("validates days, lists inclusive ranges and adds months safely", () => {
    assert.equal(isDayKey("2026-02-29"), false);
    assert.equal(isDayKey("2028-02-29"), true);
    assert.deepEqual(listDays("2026-10-30", "2026-11-02"), [
      "2026-10-30",
      "2026-10-31",
      "2026-11-01",
      "2026-11-02",
    ]);
    assert.deepEqual(listDays("2026-11-02", "2026-11-01"), []);
    assert.equal(addMonthsToDay("2026-01-31", 1), "2026-02-28");
    assert.equal(addMonthsToDay("2026-11-03", 16), "2028-03-03");
    assert.equal(addMonthsToDay("2026-11-03", -16), "2025-07-03");
  });
});

describe("SEO-12B.1 — bounded HTTP and retries", () => {
  it("classifies provider HTTP failures", () => {
    assert.equal(classifyHttpFailure("X", 401, null).code, "auth_failed");
    assert.equal(classifyHttpFailure("X", 403, null).code, "permission_denied");
    const limited = classifyHttpFailure("X", 429, "12");
    assert.equal(limited.code, "rate_limited");
    assert.equal(limited.retryAfterMs, 12_000);
    assert.equal(limited.retryable, true);
    assert.equal(classifyHttpFailure("X", 503, null).retryable, true);
    assert.equal(classifyHttpFailure("X", 400, null).code, "request_rejected");
    assert.equal(classifyHttpFailure("X", 403, null).retryable, false);
  });

  it("parses Retry-After seconds and HTTP dates", () => {
    const now = new Date("2026-11-03T12:00:00.000Z");
    assert.equal(parseRetryAfterMs("30", now), 30_000);
    assert.equal(parseRetryAfterMs("Tue, 03 Nov 2026 12:00:10 GMT", now), 10_000);
    assert.equal(parseRetryAfterMs("soon", now), null);
  });

  it("rejects responses above the size limit, by header or by streamed bytes", async () => {
    const declared = async () =>
      new Response("{}", { status: 200, headers: { "content-length": "999999" } });
    await assert.rejects(
      requestBoundedJson({
        fetchImpl: declared,
        url: "https://x",
        init: {},
        label: "X",
        timeoutMs: 1000,
        maxBytes: 100,
      }),
      (error: unknown) =>
        error instanceof SearchProviderError && error.code === "response_too_large",
    );
    const streamed = async () =>
      new Response(JSON.stringify({ rows: "y".repeat(500) }), { status: 200 });
    await assert.rejects(
      requestBoundedJson({
        fetchImpl: streamed,
        url: "https://x",
        init: {},
        label: "X",
        timeoutMs: 1000,
        maxBytes: 100,
      }),
      (error: unknown) =>
        error instanceof SearchProviderError && error.code === "response_too_large",
    );
  });

  it("times out slow providers and reports network errors without provider text", async () => {
    const hanging = (_url: string, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          const error = new Error("aborted");
          error.name = "AbortError";
          reject(error);
        });
      });
    await assert.rejects(
      requestBoundedJson({
        fetchImpl: hanging,
        url: "https://x",
        init: {},
        label: "X",
        timeoutMs: 20,
        maxBytes: 100,
      }),
      (error: unknown) => error instanceof SearchProviderError && error.code === "timeout",
    );
    const broken = async () => {
      throw new Error("getaddrinfo ENOTFOUND secret-host?apikey=abc");
    };
    await assert.rejects(
      requestBoundedJson({
        fetchImpl: broken,
        url: "https://x",
        init: {},
        label: "X",
        timeoutMs: 1000,
        maxBytes: 100,
      }),
      (error: unknown) =>
        error instanceof SearchProviderError &&
        error.code === "network_error" &&
        !error.message.includes("apikey"),
    );
  });

  it("retries rate limits and outages with backoff, honouring Retry-After", async () => {
    const sleeps: number[] = [];
    let calls = 0;
    const result = await withSearchProviderRetry(
      async () => {
        calls += 1;
        if (calls === 1) {
          throw new SearchProviderError("rate_limited", "429", { retryAfterMs: 5_000 });
        }
        if (calls === 2) {
          throw new SearchProviderError("provider_unavailable", "503");
        }
        return "ok";
      },
      { sleep: async (ms) => void sleeps.push(ms), random: () => 0.5, baseDelayMs: 1_000 },
    );
    assert.equal(result, "ok");
    assert.equal(calls, 3);
    assert.equal(sleeps[0], 5_000);
    assert.equal(sleeps[1], 3_000);
  });

  it("does not retry auth or permission errors, long Retry-After, or past three attempts", async () => {
    for (const code of ["auth_failed", "permission_denied", "request_rejected"] as const) {
      let calls = 0;
      await assert.rejects(
        withSearchProviderRetry(
          async () => {
            calls += 1;
            throw new SearchProviderError(code, code);
          },
          { sleep: async () => undefined },
        ),
      );
      assert.equal(calls, 1);
    }
    let longCalls = 0;
    await assert.rejects(
      withSearchProviderRetry(
        async () => {
          longCalls += 1;
          throw new SearchProviderError("rate_limited", "429", { retryAfterMs: 3_600_000 });
        },
        { sleep: async () => undefined },
      ),
    );
    assert.equal(longCalls, 1);
    let outageCalls = 0;
    await assert.rejects(
      withSearchProviderRetry(
        async () => {
          outageCalls += 1;
          throw new SearchProviderError("provider_unavailable", "503");
        },
        { sleep: async () => undefined },
      ),
    );
    assert.equal(outageCalls, 3);
  });
});
