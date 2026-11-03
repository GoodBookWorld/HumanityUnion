/**
 * SEO-12B.1 — Admin-only search performance read model and HTTP route.
 */
import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { after, afterEach, before, describe, it } from "node:test";

import express from "express";

import {
  AdministrationForbiddenError,
  AdministrationUnauthorizedError,
  AdministrationValidationError,
} from "../../../src/modules/administration/administration.errors.js";
import { setFindAuthUserByIdForTests } from "../../../src/modules/auth/auth-user.repository.js";
import type { AuthUserRecord } from "../../../src/modules/auth/auth-user.types.js";
import { createAccessToken } from "../../../src/modules/auth/auth-tokens.js";
import { adminSearchPerformanceRouter } from "../../../src/modules/seo-search-performance/admin-search-performance.routes.js";
import { resolveSearchPerformanceConfig } from "../../../src/modules/seo-search-performance/search-performance.config.js";
import { getAdminSearchPerformance } from "../../../src/modules/seo-search-performance/search-performance.service.js";
import {
  createMemorySearchPerformanceStore,
  setSearchPerformanceStoreForTests,
} from "../../../src/modules/seo-search-performance/search-performance.store.js";
import type { SearchDailyMetricRecord } from "../../../src/modules/seo-search-performance/search-performance.types.js";

const PEM =
  "-----BEGIN PRIVATE KEY-----\nMIIBVQIBADANBgkqhkiG9w0BAQEFAASC\n-----END PRIVATE KEY-----";
const ENV = {
  SEO_GSC_SITE_URL: "sc-domain:huws.org",
  SEO_GSC_SERVICE_ACCOUNT_EMAIL: "search-reader@hu-project.iam.gserviceaccount.com",
  SEO_GSC_SERVICE_ACCOUNT_PRIVATE_KEY: PEM,
  SEO_BING_SITE_URL: "https://huws.org/",
  SEO_BING_CLIENT_ID: "bing-client-id",
  SEO_BING_CLIENT_SECRET: "bing-client-secret-value",
  SEO_BING_REFRESH_TOKEN: "bing-refresh-token-value",
};
const NOW = new Date("2026-11-03T20:00:00.000Z");

function user(
  userId: string,
  role: "admin" | "member",
  status: "active" | "disabled" = "active",
): AuthUserRecord {
  return {
    userId,
    email: `${userId}@example.test`,
    passwordHash: "x",
    displayName: userId,
    role,
    status,
    memberId: `member-${userId}`,
    emailVerificationStatus: "verified",
    createdAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
  } as AuthUserRecord;
}

const USERS = new Map([
  ["admin-1", user("admin-1", "admin")],
  ["member-1", user("member-1", "member")],
  ["disabled-admin", user("disabled-admin", "admin", "disabled")],
]);

function daily(day: string, clicks: number, impressions: number): SearchDailyMetricRecord {
  return {
    provider: "google",
    siteUrl: "sc-domain:huws.org",
    day,
    clicks,
    impressions,
    ctr: impressions > 0 ? clicks / impressions : null,
    position: impressions > 0 ? 8 : null,
    dataState: "final",
    collectedAt: NOW.toISOString(),
    syncRunId: "run-1",
    expiresAt: new Date("2028-01-01T00:00:00.000Z"),
  };
}

describe("SEO-12B.1 — admin search performance read model", () => {
  before(() => {
    setFindAuthUserByIdForTests(async (userId) => USERS.get(userId) ?? null);
  });
  after(() => {
    setFindAuthUserByIdForTests(null);
  });

  it("requires an active administrator", async () => {
    const config = resolveSearchPerformanceConfig({});
    const store = createMemorySearchPerformanceStore();
    await assert.rejects(
      getAdminSearchPerformance({ actorUserId: "", config, store }),
      AdministrationUnauthorizedError,
    );
    await assert.rejects(
      getAdminSearchPerformance({ actorUserId: "missing", config, store }),
      AdministrationUnauthorizedError,
    );
    await assert.rejects(
      getAdminSearchPerformance({ actorUserId: "disabled-admin", config, store }),
      AdministrationUnauthorizedError,
    );
    await assert.rejects(
      getAdminSearchPerformance({ actorUserId: "member-1", config, store }),
      AdministrationForbiddenError,
    );
  });

  it("validates the period", async () => {
    const args = {
      actorUserId: "admin-1",
      config: resolveSearchPerformanceConfig({}),
      store: createMemorySearchPerformanceStore(),
    };
    assert.equal((await getAdminSearchPerformance(args)).period, "28d");
    assert.equal((await getAdminSearchPerformance({ ...args, period: "7d" })).period, "7d");
    await assert.rejects(
      getAdminSearchPerformance({ ...args, period: "365d" }),
      AdministrationValidationError,
    );
    await assert.rejects(
      getAdminSearchPerformance({ ...args, period: ["7d"] }),
      AdministrationValidationError,
    );
  });

  it("reports not configured providers with variable names only and no data", async () => {
    const result = await getAdminSearchPerformance({
      actorUserId: "admin-1",
      config: resolveSearchPerformanceConfig({}),
      store: createMemorySearchPerformanceStore(),
      now: NOW,
    });
    assert.equal(result.syncEnabled, false);
    for (const provider of ["google", "bing"] as const) {
      const view = result.providers[provider];
      assert.equal(view.status, "not_configured");
      assert.equal(view.current, null);
      assert.deepEqual(view.series, []);
      assert.ok(view.configurationIssues.length > 0);
    }
  });

  it("separates reported zeros from unavailable days and never returns secrets", async () => {
    const store = createMemorySearchPerformanceStore();
    const config = resolveSearchPerformanceConfig(ENV);
    await store.upsertDailyMetrics([daily("2026-10-29", 4, 100), daily("2026-10-30", 0, 0)]);
    await store.acquireLease("google", "h", NOW, 60_000);
    await store.recordSyncSuccess("google", "h", {
      siteUrl: "sc-domain:huws.org",
      at: NOW,
      runId: "run-1",
      lastDataDay: "2026-10-31",
      snapshot: {
        collectedAt: NOW.toISOString(),
        expiresAt: new Date(NOW.getTime() + 90 * 86_400_000).toISOString(),
        topQueries: null,
        topPages: null,
        googlePeriodTotals: [
          {
            periodDays: 7,
            startDay: "2026-10-25",
            endDay: "2026-10-31",
            clicks: 4,
            impressions: 100,
            ctr: 0.04,
            position: 8,
          },
        ],
        googleSitemaps: [],
        bingCrawl: null,
      },
    });
    await store.releaseLease("google", "h");

    const result = await getAdminSearchPerformance({
      actorUserId: "admin-1",
      period: "7d",
      config,
      store,
      now: NOW,
    });
    const google = result.providers.google;
    assert.equal(google.status, "fresh");
    assert.equal(google.dataThrough, "2026-10-31");
    assert.deepEqual(
      google.series.map((point) => [point.day, point.clicks, point.impressions]),
      [
        ["2026-10-25", null, null],
        ["2026-10-26", null, null],
        ["2026-10-27", null, null],
        ["2026-10-28", null, null],
        ["2026-10-29", 4, 100],
        ["2026-10-30", 0, 0],
        ["2026-10-31", null, null],
      ],
    );
    assert.deepEqual(google.current, {
      startDay: "2026-10-25",
      endDay: "2026-10-31",
      expectedDays: 7,
      availableDays: 2,
      clicks: 4,
      impressions: 100,
      ctr: 0.04,
    });
    assert.equal(google.previous?.availableDays, 0);
    assert.equal(google.previous?.clicks, null, "no data is null, not zero");
    assert.equal(google.providerPeriodTotals?.position, 8);
    assert.equal(result.providers.bing.status, "never_synced");
    assert.ok(result.providers.bing.unavailableMetrics.includes("site_average_position"));
    assert.ok(google.unavailableMetrics.includes("site_indexed_page_count"));

    const serialized = JSON.stringify(result);
    for (const secret of [
      PEM,
      "MIIBVQ",
      ENV.SEO_BING_CLIENT_SECRET,
      ENV.SEO_BING_REFRESH_TOKEN,
      ENV.SEO_GSC_SERVICE_ACCOUNT_EMAIL,
      "lease",
    ]) {
      assert.equal(serialized.includes(secret), false, `response must not contain ${secret}`);
    }
  });

  it("hides data collected for a different property", async () => {
    const store = createMemorySearchPerformanceStore();
    await store.acquireLease("google", "h", NOW, 60_000);
    await store.recordSyncSuccess("google", "h", {
      siteUrl: "https://old.example/",
      at: NOW,
      runId: "r",
      lastDataDay: "2026-10-31",
      snapshot: {
        collectedAt: NOW.toISOString(),
        expiresAt: new Date(NOW.getTime() + 86_400_000).toISOString(),
        topQueries: null,
        topPages: null,
        googlePeriodTotals: null,
        googleSitemaps: null,
        bingCrawl: null,
      },
    });
    const result = await getAdminSearchPerformance({
      actorUserId: "admin-1",
      config: resolveSearchPerformanceConfig(ENV),
      store,
      now: NOW,
    });
    assert.equal(result.providers.google.status, "never_synced");
    assert.equal(result.providers.google.dataThrough, null);
  });

  it("marks stale data and errors after a failure", async () => {
    const store = createMemorySearchPerformanceStore();
    const config = resolveSearchPerformanceConfig(ENV);
    const old = new Date(NOW.getTime() - 40 * 3_600_000);
    await store.acquireLease("bing", "h", old, 60_000);
    await store.recordSyncSuccess("bing", "h", {
      siteUrl: "https://huws.org/",
      at: old,
      runId: "r",
      lastDataDay: "2026-10-30",
      snapshot: {
        collectedAt: old.toISOString(),
        expiresAt: new Date(old.getTime() + 86_400_000 * 90).toISOString(),
        topQueries: null,
        topPages: null,
        googlePeriodTotals: null,
        googleSitemaps: null,
        bingCrawl: [],
      },
    });
    assert.equal(
      (await getAdminSearchPerformance({ actorUserId: "admin-1", config, store, now: NOW }))
        .providers.bing.status,
      "stale",
    );
    await store.recordSyncFailure("bing", "h", {
      siteUrl: "https://huws.org/",
      at: NOW,
      runId: "r2",
      error: {
        code: "auth_failed",
        message: "Bing Webmaster token refresh was rejected (HTTP 400).",
      },
    });
    const view = (
      await getAdminSearchPerformance({ actorUserId: "admin-1", config, store, now: NOW })
    ).providers.bing;
    assert.equal(view.status, "error");
    assert.equal(view.lastError?.code, "auth_failed");
    assert.equal(view.dataThrough, "2026-10-30", "last good data still shown");
  });
});

describe("SEO-12B.1 — GET /api/v1/admin/seo/search-performance", () => {
  let server: Server;
  let baseUrl = "";

  before(async () => {
    setFindAuthUserByIdForTests(async (userId) => USERS.get(userId) ?? null);
    setSearchPerformanceStoreForTests(createMemorySearchPerformanceStore());
    const app = express();
    app.use("/api/v1/admin/seo/search-performance", adminSearchPerformanceRouter);
    server = createServer(app);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    baseUrl = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}/api/v1/admin/seo/search-performance`;
  });

  afterEach(() => undefined);

  after(async () => {
    setFindAuthUserByIdForTests(null);
    setSearchPerformanceStoreForTests(null);
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  function tokenFor(id: string): string {
    const record = USERS.get(id)!;
    return createAccessToken({
      sub: id,
      memberId: record.memberId,
      role: record.role,
      displayName: id,
      email: record.email,
    });
  }

  it("rejects unauthenticated requests", async () => {
    const response = await fetch(baseUrl);
    assert.equal(response.status, 401);
  });

  it("forbids non-admin members", async () => {
    const response = await fetch(baseUrl, {
      headers: { Authorization: `Bearer ${tokenFor("member-1")}` },
    });
    assert.equal(response.status, 403);
  });

  it("returns a private, uncached admin response", async () => {
    const response = await fetch(`${baseUrl}?period=90d`, {
      headers: { Authorization: `Bearer ${tokenFor("admin-1")}` },
    });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "private, no-store");
    const body = (await response.json()) as {
      success: boolean;
      data: { period: string; providers: Record<string, { status: string }> };
    };
    assert.equal(body.success, true);
    assert.equal(body.data.period, "90d");
    assert.ok(body.data.providers.google);
    assert.ok(body.data.providers.bing);
  });

  it("returns 400 for an invalid period", async () => {
    const response = await fetch(`${baseUrl}?period=1y`, {
      headers: { Authorization: `Bearer ${tokenFor("admin-1")}` },
    });
    assert.equal(response.status, 400);
  });
});
