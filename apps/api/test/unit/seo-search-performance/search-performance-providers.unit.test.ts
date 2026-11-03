/**
 * SEO-12B.1 — Google Search Console and Bing Webmaster clients against a fake fetch.
 * No request leaves the process.
 */
import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { describe, it } from "node:test";

import jwt from "jsonwebtoken";

import {
  BING_OAUTH_TOKEN_URL,
  BING_READ_METHODS,
  createBingWebmasterClient,
} from "../../../src/modules/seo-search-performance/bing-webmaster.client.js";
import {
  createGoogleSearchConsoleClient,
  GOOGLE_OAUTH_TOKEN_URL,
  GOOGLE_SEARCH_CONSOLE_SCOPE,
} from "../../../src/modules/seo-search-performance/google-search-console.client.js";
import { SearchProviderError } from "../../../src/modules/seo-search-performance/search-performance.http.js";

const { privateKey, publicKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
  publicKeyEncoding: { type: "spki", format: "pem" },
});

const GOOGLE_CONFIG = {
  siteUrl: "sc-domain:huws.org",
  clientEmail: "search-reader@hu-project.iam.gserviceaccount.com",
  privateKey,
};
const BING_CONFIG = {
  siteUrl: "https://huws.org/",
  clientId: "bing-client-id",
  clientSecret: "bing-client-secret-value",
  refreshToken: "bing-refresh-token-value",
};

interface Call {
  url: string;
  init: RequestInit;
}

function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

function fakeFetch(handler: (call: Call, index: number) => Response) {
  const calls: Call[] = [];
  const fetchImpl = async (url: string, init: RequestInit = {}) => {
    const call = { url, init };
    calls.push(call);
    return handler(call, calls.length - 1);
  };
  return { calls, fetchImpl };
}

const noSleep = { sleep: async () => undefined, random: () => 0.5 };
const baseDeps = { timeoutMs: 1_000, maxBytes: 1_000_000, retry: noSleep };

describe("SEO-12B.1 — Google Search Console client", () => {
  it("exchanges a read-only RS256 service-account assertion and queries Search Analytics", async () => {
    const { calls, fetchImpl } = fakeFetch((call) => {
      if (call.url === GOOGLE_OAUTH_TOKEN_URL) {
        return json({
          access_token: "google-access-token",
          expires_in: 3600,
          token_type: "Bearer",
        });
      }
      return json({
        rows: [
          { keys: ["2026-10-30"], clicks: 3, impressions: 120, ctr: 0.025, position: 8.4 },
          { keys: ["2026-10-31"], clicks: 0, impressions: 40, ctr: 0, position: 11 },
          { keys: ["bad"], clicks: -1, impressions: 2, ctr: 0, position: 1 },
          { keys: ["2026-11-01"], clicks: "x", impressions: 2 },
        ],
        metadata: { first_incomplete_date: "2026-10-31" },
      });
    });
    const client = createGoogleSearchConsoleClient(GOOGLE_CONFIG, { ...baseDeps, fetchImpl });
    const result = await client.querySearchAnalytics({
      startDate: "2026-10-24",
      endDate: "2026-11-02",
      dimensions: ["date"],
      rowLimit: 1000,
      dataState: "all",
    });

    assert.equal(calls.length, 2);
    const form = new URLSearchParams(String(calls[0]!.init.body));
    assert.equal(form.get("grant_type"), "urn:ietf:params:oauth:grant-type:jwt-bearer");
    const claims = jwt.verify(form.get("assertion")!, publicKey, {
      algorithms: ["RS256"],
    }) as jwt.JwtPayload;
    assert.equal(claims.iss, GOOGLE_CONFIG.clientEmail);
    assert.equal(claims.scope, GOOGLE_SEARCH_CONSOLE_SCOPE);
    assert.equal(claims.scope, "https://www.googleapis.com/auth/webmasters.readonly");
    assert.equal(claims.aud, GOOGLE_OAUTH_TOKEN_URL);

    assert.equal(
      calls[1]!.url,
      "https://www.googleapis.com/webmasters/v3/sites/sc-domain%3Ahuws.org/searchAnalytics/query",
    );
    assert.equal(calls[1]!.init.method, "POST");
    assert.equal(
      (calls[1]!.init.headers as Record<string, string>).Authorization,
      "Bearer google-access-token",
    );
    const body = JSON.parse(String(calls[1]!.init.body));
    assert.deepEqual(body, {
      startDate: "2026-10-24",
      endDate: "2026-11-02",
      dimensions: ["date"],
      type: "web",
      rowLimit: 1000,
      dataState: "all",
    });

    assert.equal(result.rows.length, 2, "invalid rows are dropped");
    assert.deepEqual(result.rows[1], {
      keys: ["2026-10-31"],
      clicks: 0,
      impressions: 40,
      ctr: 0,
      position: 11,
    });
    assert.equal(result.firstIncompleteDate, "2026-10-31");
  });

  it("reuses the in-memory token and drops it after a 401", async () => {
    let apiCalls = 0;
    const { calls, fetchImpl } = fakeFetch((call) => {
      if (call.url === GOOGLE_OAUTH_TOKEN_URL) {
        return json({ access_token: `token-${calls.length}`, expires_in: 3600 });
      }
      apiCalls += 1;
      return apiCalls === 3 ? json({ error: { message: "expired" } }, 401) : json({ rows: [] });
    });
    const client = createGoogleSearchConsoleClient(GOOGLE_CONFIG, { ...baseDeps, fetchImpl });
    const request = {
      startDate: "2026-10-01",
      endDate: "2026-10-28",
      dimensions: [] as [],
      rowLimit: 1,
      dataState: "final" as const,
    };
    await client.querySearchAnalytics(request);
    await client.querySearchAnalytics(request);
    assert.equal(calls.filter((call) => call.url === GOOGLE_OAUTH_TOKEN_URL).length, 1);
    await assert.rejects(
      client.querySearchAnalytics(request),
      (error: unknown) => error instanceof SearchProviderError && error.code === "auth_failed",
    );
    await client.querySearchAnalytics(request);
    assert.equal(calls.filter((call) => call.url === GOOGLE_OAUTH_TOKEN_URL).length, 2);
  });

  it("retries 429 and 5xx, then succeeds; does not retry 403", async () => {
    let apiCalls = 0;
    const { fetchImpl } = fakeFetch((call) => {
      if (call.url === GOOGLE_OAUTH_TOKEN_URL) {
        return json({ access_token: "t", expires_in: 3600 });
      }
      apiCalls += 1;
      if (apiCalls === 1) return json({}, 429, { "Retry-After": "1" });
      if (apiCalls === 2) return json({}, 503);
      return json({ rows: [{ clicks: 5, impressions: 50, ctr: 0.1, position: 3 }] });
    });
    const client = createGoogleSearchConsoleClient(GOOGLE_CONFIG, { ...baseDeps, fetchImpl });
    const totals = await client.querySearchAnalytics({
      startDate: "2026-10-01",
      endDate: "2026-10-28",
      dimensions: [],
      rowLimit: 1,
      dataState: "final",
    });
    assert.equal(apiCalls, 3);
    assert.equal(totals.rows[0]!.clicks, 5);

    let forbiddenCalls = 0;
    const forbidden = fakeFetch((call) => {
      if (call.url === GOOGLE_OAUTH_TOKEN_URL) return json({ access_token: "t", expires_in: 3600 });
      forbiddenCalls += 1;
      return json({ error: { message: "User does not have sufficient permission for site" } }, 403);
    });
    const denied = createGoogleSearchConsoleClient(GOOGLE_CONFIG, {
      ...baseDeps,
      fetchImpl: forbidden.fetchImpl,
    });
    await assert.rejects(
      denied.listSitemaps(),
      (error: unknown) =>
        error instanceof SearchProviderError &&
        error.code === "permission_denied" &&
        !error.message.includes("sufficient permission"),
    );
    assert.equal(forbiddenCalls, 1);
  });

  it("reports a rejected token exchange as an auth failure without provider text", async () => {
    const { fetchImpl } = fakeFetch(() =>
      json({ error: "invalid_grant", error_description: "Invalid JWT Signature." }, 400),
    );
    const client = createGoogleSearchConsoleClient(GOOGLE_CONFIG, { ...baseDeps, fetchImpl });
    await assert.rejects(
      client.listSitemaps(),
      (error: unknown) =>
        error instanceof SearchProviderError &&
        error.code === "auth_failed" &&
        !/invalid_grant|Signature/.test(error.message),
    );
  });

  it("lists sitemaps without reading the deprecated indexed count", async () => {
    const { fetchImpl } = fakeFetch((call) =>
      call.url === GOOGLE_OAUTH_TOKEN_URL
        ? json({ access_token: "t", expires_in: 3600 })
        : json({
            sitemap: [
              {
                path: "https://huws.org/sitemap.xml",
                lastSubmitted: "2026-10-01T10:00:00.000Z",
                lastDownloaded: "2026-11-01T08:00:00.000Z",
                isPending: false,
                isSitemapsIndex: false,
                type: "sitemap",
                warnings: "0",
                errors: "2",
                contents: [{ type: "web", submitted: "1450", indexed: "999" }],
              },
            ],
          }),
    );
    const client = createGoogleSearchConsoleClient(GOOGLE_CONFIG, { ...baseDeps, fetchImpl });
    const [sitemap] = await client.listSitemaps();
    assert.deepEqual(sitemap, {
      path: "https://huws.org/sitemap.xml",
      type: "sitemap",
      isSitemapsIndex: false,
      isPending: false,
      lastSubmitted: "2026-10-01T10:00:00.000Z",
      lastDownloaded: "2026-11-01T08:00:00.000Z",
      errors: 2,
      warnings: 0,
      submittedUrls: 1450,
    });
    assert.equal(JSON.stringify(sitemap).includes("999"), false);
  });

  it("rejects an unusable private key before any request", async () => {
    const { calls, fetchImpl } = fakeFetch(() => json({}));
    const client = createGoogleSearchConsoleClient(
      {
        ...GOOGLE_CONFIG,
        privateKey: "-----BEGIN PRIVATE KEY-----\nnot-a-key\n-----END PRIVATE KEY-----",
      },
      { ...baseDeps, fetchImpl },
    );
    await assert.rejects(
      client.listSitemaps(),
      (error: unknown) =>
        error instanceof SearchProviderError &&
        error.code === "auth_failed" &&
        !error.message.includes("not-a-key"),
    );
    assert.equal(calls.length, 0);
  });
});

describe("SEO-12B.1 — Bing Webmaster client", () => {
  function bingFetch(responses: Record<string, unknown>) {
    return fakeFetch((call) => {
      if (call.url === BING_OAUTH_TOKEN_URL) {
        return json({ access_token: "bing-access-token", expires_in: 3599, token_type: "Bearer" });
      }
      const method = new URL(call.url).pathname.split("/").pop()!;
      return json(responses[method] ?? { d: [] });
    });
  }

  it("refreshes an OAuth token and calls only read methods with Bearer auth", async () => {
    const { calls, fetchImpl } = bingFetch({
      GetRankAndTrafficStats: {
        d: [
          {
            __type: "RankAndTrafficStats",
            Clicks: 15,
            Date: "/Date(1316156400000-0700)/",
            Impressions: 100,
          },
          { Clicks: 0, Date: "/Date(1316242800000-0700)/", Impressions: 0 },
          { Clicks: 1, Date: "not-a-date", Impressions: 4 },
        ],
      },
    });
    const client = createBingWebmasterClient(BING_CONFIG, { ...baseDeps, fetchImpl });
    const traffic = await client.getRankAndTrafficStats();

    const form = new URLSearchParams(String(calls[0]!.init.body));
    assert.equal(form.get("grant_type"), "refresh_token");
    assert.equal(form.get("refresh_token"), BING_CONFIG.refreshToken);
    assert.equal(form.get("client_id"), BING_CONFIG.clientId);

    const apiUrl = new URL(calls[1]!.url);
    assert.equal(
      apiUrl.origin + apiUrl.pathname,
      "https://www.bing.com/webmaster/api.svc/json/GetRankAndTrafficStats",
    );
    assert.equal(apiUrl.searchParams.get("siteUrl"), "https://huws.org/");
    assert.equal(apiUrl.searchParams.has("apikey"), false);
    assert.equal(apiUrl.searchParams.has("access_token"), false);
    assert.equal(
      (calls[1]!.init.headers as Record<string, string>).Authorization,
      "Bearer bing-access-token",
    );
    assert.equal(calls[1]!.init.method, "GET");

    assert.deepEqual(traffic, [
      { day: "2011-09-16", clicks: 15, impressions: 100 },
      { day: "2011-09-17", clicks: 0, impressions: 0 },
    ]);
  });

  it("exposes no write methods", () => {
    const client = createBingWebmasterClient(BING_CONFIG, {
      ...baseDeps,
      fetchImpl: async () => json({}),
    });
    assert.deepEqual(Object.keys(client).sort(), [
      "getCrawlStats",
      "getPageStats",
      "getQueryStats",
      "getRankAndTrafficStats",
    ]);
    assert.deepEqual([...BING_READ_METHODS].sort(), [
      "GetCrawlStats",
      "GetPageStats",
      "GetQueryStats",
      "GetRankAndTrafficStats",
    ]);
  });

  it("parses query, page and crawl stats; keeps unreported values null", async () => {
    const { fetchImpl } = bingFetch({
      GetQueryStats: {
        d: [
          {
            Query: "humanity union",
            Date: "/Date(1316156400000-0700)/",
            Clicks: 4,
            Impressions: 80,
            AvgImpressionPosition: 3.5,
            AvgClickPosition: 2,
          },
          { Query: "", Date: "/Date(1316156400000-0700)/", Clicks: 1, Impressions: 2 },
        ],
      },
      GetPageStats: {
        d: [
          {
            Query: "https://huws.org/blog",
            Date: "/Date(1316156400000-0700)/",
            Clicks: 2,
            Impressions: 30,
            AvgImpressionPosition: -1,
            AvgClickPosition: 0,
          },
        ],
      },
      GetCrawlStats: {
        d: [
          {
            Date: "/Date(1316156400000-0700)/",
            InIndex: 1200,
            CrawledPages: 300,
            CrawlErrors: 4,
            BlockedByRobotsTxt: 2,
            Code4xx: 3,
            Code5xx: "x",
          },
        ],
      },
    });
    const client = createBingWebmasterClient(BING_CONFIG, { ...baseDeps, fetchImpl });
    assert.deepEqual(await client.getQueryStats(), [
      {
        key: "humanity union",
        day: "2011-09-16",
        clicks: 4,
        impressions: 80,
        avgImpressionPosition: 3.5,
        avgClickPosition: 2,
      },
    ]);
    assert.deepEqual(await client.getPageStats(), [
      {
        key: "https://huws.org/blog",
        day: "2011-09-16",
        clicks: 2,
        impressions: 30,
        avgImpressionPosition: null,
        avgClickPosition: null,
      },
    ]);
    assert.deepEqual(await client.getCrawlStats(), [
      {
        day: "2011-09-16",
        inIndex: 1200,
        crawledPages: 300,
        crawlErrors: 4,
        blockedByRobotsTxt: 2,
        code4xx: 3,
        code5xx: null,
      },
    ]);
  });

  it("maps Bing 400 error bodies without copying provider messages", async () => {
    const { fetchImpl } = fakeFetch((call) =>
      call.url === BING_OAUTH_TOKEN_URL
        ? json({ access_token: "t", expires_in: 3599 })
        : json({ ErrorCode: 14, Message: "NotAuthorized token=abc" }, 400),
    );
    const client = createBingWebmasterClient(BING_CONFIG, { ...baseDeps, fetchImpl });
    await assert.rejects(
      client.getCrawlStats(),
      (error: unknown) =>
        error instanceof SearchProviderError &&
        error.code === "auth_failed" &&
        error.message.includes("ErrorCode 14") &&
        !error.message.includes("token=abc"),
    );
  });

  it("treats a revoked refresh token as an auth failure", async () => {
    const { fetchImpl } = fakeFetch(() => json({ error: "invalid_grant" }, 400));
    const client = createBingWebmasterClient(BING_CONFIG, { ...baseDeps, fetchImpl });
    await assert.rejects(
      client.getRankAndTrafficStats(),
      (error: unknown) =>
        error instanceof SearchProviderError &&
        error.code === "auth_failed" &&
        !error.message.includes(BING_CONFIG.refreshToken),
    );
  });

  it("rejects malformed success bodies", async () => {
    const { fetchImpl } = fakeFetch((call) =>
      call.url === BING_OAUTH_TOKEN_URL
        ? json({ access_token: "t", expires_in: 3599 })
        : json({ rows: [] }),
    );
    const client = createBingWebmasterClient(BING_CONFIG, { ...baseDeps, fetchImpl });
    await assert.rejects(
      client.getQueryStats(),
      (error: unknown) => error instanceof SearchProviderError && error.code === "invalid_response",
    );
  });
});
