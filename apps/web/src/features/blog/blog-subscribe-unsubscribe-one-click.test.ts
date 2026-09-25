/**
 * EMAIL DELIVERABILITY 03A.1 — RFC 8058 one-click unsubscribe Web adapter tests.
 * Mocks fetch to the canonical API. Never prints tokens or full unsubscribe URLs.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  handleRfc8058BlogUnsubscribe,
  isRfc8058FormContentType,
  RFC8058_BAD_REQUEST_BODY,
  RFC8058_SUCCESS_BODY,
  RFC8058_UNAVAILABLE_BODY,
  type FetchLike,
} from "./blog-subscribe-unsubscribe-one-click";

const webSrc = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const SYNTHETIC_TOKEN = "03a1-synthetic-unsubscribe-token-aabb";

function searchWithToken(token: string | null): URLSearchParams {
  const params = new URLSearchParams();
  if (token !== null) {
    params.set("token", token);
  }
  return params;
}

function mockFetch(status: number): FetchLike {
  return async () => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => ({ success: status < 300 }),
  });
}

describe("EMAIL DELIVERABILITY 03A.1 — RFC 8058 one-click unsubscribe", () => {
  it("accepts form content-type with charset variants", () => {
    assert.equal(isRfc8058FormContentType("application/x-www-form-urlencoded"), true);
    assert.equal(
      isRfc8058FormContentType("application/x-www-form-urlencoded; charset=UTF-8"),
      true,
    );
    assert.equal(isRfc8058FormContentType("application/json"), false);
    assert.equal(isRfc8058FormContentType(null), false);
  });

  it("1. correct form POST + valid token succeeds without cookies", async () => {
    const result = await handleRfc8058BlogUnsubscribe({
      contentType: "application/x-www-form-urlencoded",
      rawBody: "List-Unsubscribe=One-Click",
      searchParams: searchWithToken(SYNTHETIC_TOKEN),
      fetchImpl: mockFetch(200),
      apiBaseUrl: "http://api.test",
    });
    assert.equal(result.status, 200);
    assert.equal(result.body, RFC8058_SUCCESS_BODY);
    assert.match(result.contentType, /^text\/plain/);
    assert.doesNotMatch(result.body, new RegExp(SYNTHETIC_TOKEN));
  });

  it("2. repeated success POST is idempotent (already-unsubscribed)", async () => {
    const fetchImpl = mockFetch(200);
    const first = await handleRfc8058BlogUnsubscribe({
      contentType: "application/x-www-form-urlencoded; charset=utf-8",
      rawBody: "List-Unsubscribe=One-Click",
      searchParams: searchWithToken(SYNTHETIC_TOKEN),
      fetchImpl,
      apiBaseUrl: "http://api.test",
    });
    const second = await handleRfc8058BlogUnsubscribe({
      contentType: "application/x-www-form-urlencoded",
      rawBody: "List-Unsubscribe=One-Click",
      searchParams: searchWithToken(SYNTHETIC_TOKEN),
      fetchImpl,
      apiBaseUrl: "http://api.test",
    });
    assert.equal(first.status, 200);
    assert.equal(second.status, 200);
    assert.equal(first.body, second.body);
  });

  it("3. missing token fails safely", async () => {
    const result = await handleRfc8058BlogUnsubscribe({
      contentType: "application/x-www-form-urlencoded",
      rawBody: "List-Unsubscribe=One-Click",
      searchParams: searchWithToken(null),
      fetchImpl: mockFetch(200),
      apiBaseUrl: "http://api.test",
    });
    assert.equal(result.status, 400);
    assert.equal(result.body, RFC8058_BAD_REQUEST_BODY);
  });

  it("4. invalid token (API 400) fails safely without echoing token", async () => {
    const result = await handleRfc8058BlogUnsubscribe({
      contentType: "application/x-www-form-urlencoded",
      rawBody: "List-Unsubscribe=One-Click",
      searchParams: searchWithToken(SYNTHETIC_TOKEN),
      fetchImpl: mockFetch(400),
      apiBaseUrl: "http://api.test",
    });
    assert.equal(result.status, 400);
    assert.equal(result.body, RFC8058_BAD_REQUEST_BODY);
    assert.equal(result.body.includes(SYNTHETIC_TOKEN), false);
  });

  it("5. missing List-Unsubscribe field fails", async () => {
    const result = await handleRfc8058BlogUnsubscribe({
      contentType: "application/x-www-form-urlencoded",
      rawBody: "other=1",
      searchParams: searchWithToken(SYNTHETIC_TOKEN),
      fetchImpl: mockFetch(200),
      apiBaseUrl: "http://api.test",
    });
    assert.equal(result.status, 400);
  });

  it("6. incorrect One-Click value fails", async () => {
    const result = await handleRfc8058BlogUnsubscribe({
      contentType: "application/x-www-form-urlencoded",
      rawBody: "List-Unsubscribe=Two-Click",
      searchParams: searchWithToken(SYNTHETIC_TOKEN),
      fetchImpl: mockFetch(200),
      apiBaseUrl: "http://api.test",
    });
    assert.equal(result.status, 400);
  });

  it("7. wrong content-type fails", async () => {
    const result = await handleRfc8058BlogUnsubscribe({
      contentType: "application/json",
      rawBody: JSON.stringify({ "List-Unsubscribe": "One-Click" }),
      searchParams: searchWithToken(SYNTHETIC_TOKEN),
      fetchImpl: mockFetch(200),
      apiBaseUrl: "http://api.test",
    });
    assert.equal(result.status, 400);
  });

  it("8. API unavailable returns safe 5xx without token", async () => {
    const result = await handleRfc8058BlogUnsubscribe({
      contentType: "application/x-www-form-urlencoded",
      rawBody: "List-Unsubscribe=One-Click",
      searchParams: searchWithToken(SYNTHETIC_TOKEN),
      fetchImpl: mockFetch(503),
      apiBaseUrl: "http://api.test",
    });
    assert.equal(result.status, 503);
    assert.equal(result.body, RFC8058_UNAVAILABLE_BODY);
    assert.equal(result.body.includes(SYNTHETIC_TOKEN), false);
  });

  it("9. fetch throw returns safe 5xx without token", async () => {
    const result = await handleRfc8058BlogUnsubscribe({
      contentType: "application/x-www-form-urlencoded",
      rawBody: "List-Unsubscribe=One-Click",
      searchParams: searchWithToken(SYNTHETIC_TOKEN),
      fetchImpl: async () => {
        throw new Error(`network boom token=${SYNTHETIC_TOKEN}`);
      },
      apiBaseUrl: "http://api.test",
    });
    assert.equal(result.status, 503);
    assert.equal(result.body.includes(SYNTHETIC_TOKEN), false);
  });

  it("10. forwards JSON token to canonical API path (no cookies)", async () => {
    let seenUrl = "";
    let seenInit: { method?: string; headers?: Record<string, string>; body?: string } | undefined;
    const result = await handleRfc8058BlogUnsubscribe({
      contentType: "application/x-www-form-urlencoded",
      rawBody: "List-Unsubscribe=One-Click",
      searchParams: searchWithToken(SYNTHETIC_TOKEN),
      apiBaseUrl: "http://api.test",
      fetchImpl: async (url, init) => {
        seenUrl = url;
        seenInit = init;
        return mockFetch(200)(url, init);
      },
    });
    assert.equal(result.status, 200);
    assert.equal(seenUrl, "http://api.test/api/v1/public/blog/subscriptions/unsubscribe");
    assert.equal(seenInit?.method, "POST");
    assert.equal(seenInit?.headers?.["Content-Type"], "application/json");
    assert.equal(seenInit?.body, JSON.stringify({ token: SYNTHETIC_TOKEN }));
    assert.equal("credentials" in (seenInit ?? {}), false);
  });

  it("11. GET human unsubscribe page still exists unchanged", () => {
    const pagePath = path.join(webSrc, "app/blog/subscribe/unsubscribe/page.tsx");
    assert.equal(existsSync(pagePath), true);
    const page = readFileSync(pagePath, "utf8");
    assert.match(page, /BlogSubscriptionUnsubscribePageContent/);
    assert.doesNotMatch(page, /export async function POST/);
  });

  it("12. proxy rewrites POST unsubscribe; middleware.ts remains absent", () => {
    assert.equal(existsSync(path.join(webSrc, "middleware.ts")), false);
    assert.equal(existsSync(path.join(webSrc, "proxy.ts")), true);
    const proxy = readFileSync(path.join(webSrc, "proxy.ts"), "utf8");
    assert.match(proxy, /blog\/subscribe\/unsubscribe/);
    assert.match(proxy, /api\/internal\/blog-subscribe-unsubscribe/);
    assert.match(proxy, /method === ["']POST["']/);
    assert.match(proxy, /NextResponse\.rewrite/);

    const routePath = path.join(
      webSrc,
      "app/api/internal/blog-subscribe-unsubscribe/route.ts",
    );
    assert.equal(existsSync(routePath), true);
    const route = readFileSync(routePath, "utf8");
    assert.match(route, /handleRfc8058BlogUnsubscribe/);
    assert.doesNotMatch(route, /upsertBlogSubscriber|Mongo|unsubscribeTokenHash/);
  });
});
