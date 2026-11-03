/**
 * SEO-12B.1 — bounded sync, null-versus-zero handling, lease fencing and the
 * disabled-by-default scheduler (in-memory store, fake provider clients).
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { BingWebmasterClient } from "../../../src/modules/seo-search-performance/bing-webmaster.client.js";
import type {
  GoogleSearchAnalyticsRequest,
  GoogleSearchConsoleClient,
} from "../../../src/modules/seo-search-performance/google-search-console.client.js";
import { resolveSearchPerformanceConfig } from "../../../src/modules/seo-search-performance/search-performance.config.js";
import { SearchProviderError } from "../../../src/modules/seo-search-performance/search-performance.http.js";
import {
  runSearchPerformanceTick,
  startSearchPerformanceScheduler,
  stopSearchPerformanceScheduler,
} from "../../../src/modules/seo-search-performance/search-performance.scheduler.js";
import { createMemorySearchPerformanceStore } from "../../../src/modules/seo-search-performance/search-performance.store.js";
import {
  isSearchSyncDue,
  runSearchProviderSync,
  SEARCH_SYNC_LEASE_TTL_MS,
} from "../../../src/modules/seo-search-performance/search-performance.sync.js";

const PEM =
  "-----BEGIN PRIVATE KEY-----\nMIIBVQIBADANBgkqhkiG9w0BAQEFAASC\n-----END PRIVATE KEY-----";
const ENV = {
  SEO_SEARCH_SYNC_ENABLED: "true",
  SEO_GSC_SITE_URL: "sc-domain:huws.org",
  SEO_GSC_SERVICE_ACCOUNT_EMAIL: "search-reader@hu-project.iam.gserviceaccount.com",
  SEO_GSC_SERVICE_ACCOUNT_PRIVATE_KEY: PEM,
  SEO_BING_SITE_URL: "https://huws.org/",
  SEO_BING_CLIENT_ID: "bing-client-id",
  SEO_BING_CLIENT_SECRET: "bing-client-secret-value",
  SEO_BING_REFRESH_TOKEN: "bing-refresh-token-value",
};
// 2026-11-03 12:00 Pacific.
const NOW = new Date("2026-11-03T20:00:00.000Z");

function googleClient(overrides: Partial<GoogleSearchConsoleClient> = {}) {
  const requests: GoogleSearchAnalyticsRequest[] = [];
  const client: GoogleSearchConsoleClient = {
    async querySearchAnalytics(request) {
      requests.push(request);
      if (request.dimensions[0] === "date") {
        // 10-25 and 10-27 reported, 10-26 omitted (no data), nothing after 10-31.
        return {
          rows: [
            { keys: ["2026-10-25"], clicks: 2, impressions: 50, ctr: 0.04, position: 9 },
            { keys: ["2026-10-27"], clicks: 0, impressions: 10, ctr: 0, position: 12 },
            { keys: ["2026-10-31"], clicks: 1, impressions: 20, ctr: 0.05, position: 7 },
          ],
          firstIncompleteDate: "2026-10-31",
        };
      }
      if (request.dimensions.length === 0) {
        return {
          rows: [{ keys: [], clicks: 3, impressions: 80, ctr: 0.0375, position: 9.5 }],
          firstIncompleteDate: null,
        };
      }
      return {
        rows: [
          {
            keys: [request.dimensions[0] === "query" ? "humanity union" : "https://huws.org/"],
            clicks: 2,
            impressions: 40,
            ctr: 0.05,
            position: 4,
          },
        ],
        firstIncompleteDate: null,
      };
    },
    async listSitemaps() {
      return [];
    },
    ...overrides,
  };
  return { client, requests };
}

function bingClient(overrides: Partial<BingWebmasterClient> = {}): BingWebmasterClient {
  return {
    async getRankAndTrafficStats() {
      return [
        { day: "2026-10-28", clicks: 5, impressions: 90 },
        { day: "2026-10-30", clicks: 0, impressions: 0 },
      ];
    },
    async getQueryStats() {
      return [
        {
          key: "hu",
          day: "2026-10-20",
          clicks: 1,
          impressions: 10,
          avgImpressionPosition: 2,
          avgClickPosition: 1,
        },
        {
          key: "hu",
          day: "2026-10-27",
          clicks: 3,
          impressions: 30,
          avgImpressionPosition: 6,
          avgClickPosition: 2,
        },
        {
          key: "old",
          day: "2026-08-01",
          clicks: 9,
          impressions: 99,
          avgImpressionPosition: 1,
          avgClickPosition: 1,
        },
      ];
    },
    async getPageStats() {
      return [];
    },
    async getCrawlStats() {
      return [
        {
          day: "2026-10-30",
          inIndex: 640,
          crawledPages: 120,
          crawlErrors: 1,
          blockedByRobotsTxt: 0,
          code4xx: 1,
          code5xx: 0,
        },
      ];
    },
    ...overrides,
  };
}

describe("SEO-12B.1 — sync stays off without configuration", () => {
  it("does nothing when disabled, even if credentials exist", async () => {
    const store = createMemorySearchPerformanceStore();
    let called = false;
    const outcome = await runSearchProviderSync("google", {
      store,
      config: resolveSearchPerformanceConfig({ ...ENV, SEO_SEARCH_SYNC_ENABLED: "" }),
      holder: "a",
      now: () => NOW,
      fetchImpl: async () => {
        called = true;
        return new Response("{}");
      },
    });
    assert.equal(outcome, "skipped_disabled");
    assert.equal(called, false);
    assert.equal(await store.getSyncState("google"), null);
  });

  it("skips unconfigured providers without touching the network", async () => {
    let called = false;
    const outcome = await runSearchProviderSync("bing", {
      store: createMemorySearchPerformanceStore(),
      config: resolveSearchPerformanceConfig({ SEO_SEARCH_SYNC_ENABLED: "true" }),
      holder: "a",
      fetchImpl: async () => {
        called = true;
        return new Response("{}");
      },
    });
    assert.equal(outcome, "skipped_not_configured");
    assert.equal(called, false);
  });

  it("starts no scheduler timers when disabled or when no provider is configured", () => {
    const timers: string[] = [];
    const deps = {
      setTimeoutFn: ((..._args: unknown[]) => {
        timers.push("timeout");
        return { unref() {} };
      }) as unknown as typeof setTimeout,
      setIntervalFn: ((..._args: unknown[]) => {
        timers.push("interval");
        return { unref() {} };
      }) as unknown as typeof setInterval,
      log: () => undefined,
    };
    assert.equal(
      startSearchPerformanceScheduler({ ...deps, config: resolveSearchPerformanceConfig({}) }),
      false,
    );
    assert.equal(
      startSearchPerformanceScheduler({
        ...deps,
        config: resolveSearchPerformanceConfig({ SEO_SEARCH_SYNC_ENABLED: "true" }),
      }),
      false,
    );
    assert.deepEqual(timers, []);
    assert.equal(
      startSearchPerformanceScheduler({ ...deps, config: resolveSearchPerformanceConfig(ENV) }),
      true,
    );
    assert.deepEqual(timers, ["timeout", "interval"]);
    stopSearchPerformanceScheduler();
  });

  it("a disabled tick makes no provider calls", async () => {
    const google = googleClient();
    const outcomes = await runSearchPerformanceTick({
      config: resolveSearchPerformanceConfig({}),
      store: createMemorySearchPerformanceStore(),
      sync: { googleClient: google.client, bingClient: bingClient() },
    });
    assert.deepEqual(outcomes, { google: "skipped_disabled", bing: "skipped_disabled" });
    assert.equal(google.requests.length, 0);
  });
});

describe("SEO-12B.1 — Google sync", () => {
  it("backfills 16 months, fills only interior gaps with zero, and leaves later days unavailable", async () => {
    const store = createMemorySearchPerformanceStore();
    const google = googleClient();
    const outcome = await runSearchProviderSync("google", {
      store,
      config: resolveSearchPerformanceConfig(ENV),
      holder: "a",
      now: () => NOW,
      googleClient: google.client,
    });
    assert.equal(outcome, "succeeded");

    const series = google.requests[0]!;
    assert.deepEqual(series.dimensions, ["date"]);
    assert.equal(series.startDate, "2025-07-04");
    assert.equal(series.endDate, "2026-11-03");
    assert.equal(series.dataState, "all");
    assert.equal(
      google.requests.length,
      6,
      "date series, three period totals, top queries, top pages",
    );
    for (const request of google.requests.slice(1)) {
      assert.equal(request.endDate, "2026-10-30", "totals and top rows use finalized data only");
      assert.equal(request.dataState, "final");
    }

    const rows = await store.listDailyMetrics({
      provider: "google",
      siteUrl: "sc-domain:huws.org",
      fromDay: "2026-10-01",
      toDay: "2026-11-03",
    });
    assert.deepEqual(
      rows.map((row) => [row.day, row.clicks, row.impressions, row.ctr, row.dataState]),
      [
        ["2026-10-25", 2, 50, 0.04, "final"],
        ["2026-10-26", 0, 0, null, "final"],
        ["2026-10-27", 0, 10, 0, "final"],
        ["2026-10-28", 0, 0, null, "final"],
        ["2026-10-29", 0, 0, null, "final"],
        ["2026-10-30", 0, 0, null, "final"],
        ["2026-10-31", 1, 20, 0.05, "fresh"],
      ],
    );
    assert.equal(
      rows.some((row) => row.day > "2026-10-31" || row.day < "2026-10-25"),
      false,
    );
    assert.equal(rows[0]!.expiresAt.toISOString(), "2028-02-25T00:00:00.000Z");

    const state = await store.getSyncState("google");
    assert.equal(state?.lastDataDay, "2026-10-31");
    assert.equal(state?.lastSuccessAt, NOW.toISOString());
    assert.equal(state?.lease, null, "lease released");
    assert.deepEqual(
      state?.snapshot?.googlePeriodTotals?.map((total) => total.periodDays),
      [7, 28, 90],
    );
    assert.equal(state?.snapshot?.topQueries?.rows[0]?.key, "humanity union");
    assert.equal(
      state?.snapshot?.expiresAt,
      new Date(NOW.getTime() + 90 * 86_400_000).toISOString(),
    );
  });

  it("stores nothing when Google reports no rows (unavailable, not zero)", async () => {
    const store = createMemorySearchPerformanceStore();
    const google = googleClient({
      async querySearchAnalytics() {
        return { rows: [], firstIncompleteDate: null };
      },
    });
    assert.equal(
      await runSearchProviderSync("google", {
        store,
        config: resolveSearchPerformanceConfig(ENV),
        holder: "a",
        now: () => NOW,
        googleClient: google.client,
      }),
      "succeeded",
    );
    const rows = await store.listDailyMetrics({
      provider: "google",
      siteUrl: "sc-domain:huws.org",
      fromDay: "2000-01-01",
      toDay: "2100-01-01",
    });
    assert.equal(rows.length, 0);
    const state = await store.getSyncState("google");
    assert.equal(state?.lastDataDay, null);
    assert.equal(state?.snapshot?.googlePeriodTotals, null);
  });

  it("uses a 10-day window after the first success", async () => {
    const store = createMemorySearchPerformanceStore();
    const first = googleClient();
    const config = resolveSearchPerformanceConfig(ENV);
    await runSearchProviderSync("google", {
      store,
      config,
      holder: "a",
      now: () => NOW,
      googleClient: first.client,
    });
    const later = new Date(NOW.getTime() + 25 * 3_600_000);
    const second = googleClient();
    assert.equal(
      await runSearchProviderSync("google", {
        store,
        config,
        holder: "a",
        now: () => later,
        googleClient: second.client,
      }),
      "succeeded",
    );
    assert.equal(second.requests[0]!.startDate, "2026-10-26");
    assert.equal(second.requests[0]!.endDate, "2026-11-04");
  });

  it("records a redacted failure and keeps previously stored data", async () => {
    const store = createMemorySearchPerformanceStore();
    const config = resolveSearchPerformanceConfig(ENV);
    await runSearchProviderSync("google", {
      store,
      config,
      holder: "a",
      now: () => NOW,
      googleClient: googleClient().client,
    });
    const later = new Date(NOW.getTime() + 25 * 3_600_000);
    const failing = googleClient({
      async listSitemaps() {
        throw new SearchProviderError(
          "permission_denied",
          `Denied for ${ENV.SEO_GSC_SERVICE_ACCOUNT_PRIVATE_KEY} Bearer abc.def`,
        );
      },
    });
    assert.equal(
      await runSearchProviderSync("google", {
        store,
        config,
        holder: "a",
        now: () => later,
        googleClient: failing.client,
      }),
      "failed",
    );
    const state = await store.getSyncState("google");
    assert.equal(state?.lastError?.code, "permission_denied");
    assert.equal(state?.lastError?.message.includes("MIIBVQ"), false);
    assert.equal(state?.lastError?.message.includes("abc.def"), false);
    assert.equal(state?.consecutiveFailures, 1);
    assert.equal(state?.lastSuccessAt, NOW.toISOString(), "previous success kept");
    assert.equal(state?.lastDataDay, "2026-10-31");
    assert.ok(state?.snapshot, "previous snapshot kept");
    assert.equal(state?.lease, null);
  });

  it("wraps unexpected errors in a generic message", async () => {
    const store = createMemorySearchPerformanceStore();
    const broken = googleClient({
      async listSitemaps() {
        throw new Error("raw internal detail refresh_token=xyz");
      },
    });
    await runSearchProviderSync("google", {
      store,
      config: resolveSearchPerformanceConfig(ENV),
      holder: "a",
      now: () => NOW,
      googleClient: broken.client,
    });
    const state = await store.getSyncState("google");
    assert.equal(state?.lastError?.message, "Search performance sync failed unexpectedly.");
  });
});

describe("SEO-12B.1 — Bing sync", () => {
  it("stores only reported days, without CTR or position, and combines rows for top queries", async () => {
    const store = createMemorySearchPerformanceStore();
    assert.equal(
      await runSearchProviderSync("bing", {
        store,
        config: resolveSearchPerformanceConfig(ENV),
        holder: "a",
        now: () => NOW,
        bingClient: bingClient(),
      }),
      "succeeded",
    );
    const rows = await store.listDailyMetrics({
      provider: "bing",
      siteUrl: "https://huws.org/",
      fromDay: "2026-10-01",
      toDay: "2026-11-03",
    });
    assert.deepEqual(
      rows.map((row) => [
        row.day,
        row.clicks,
        row.impressions,
        row.ctr,
        row.position,
        row.dataState,
      ]),
      [
        ["2026-10-28", 5, 90, null, null, "reported"],
        ["2026-10-30", 0, 0, null, null, "reported"],
      ],
    );
    const state = await store.getSyncState("bing");
    assert.equal(state?.lastDataDay, "2026-10-30");
    const top = state?.snapshot?.topQueries;
    assert.equal(top?.metricsSource, "impression_weighted_from_provider_rows");
    assert.equal(top?.endDay, "2026-10-27");
    assert.deepEqual(top?.rows, [{ key: "hu", clicks: 4, impressions: 40, ctr: 0.1, position: 5 }]);
    assert.equal(state?.snapshot?.topPages, null);
    assert.equal(state?.snapshot?.bingCrawl?.[0]?.inIndex, 640);
  });
});

describe("SEO-12B.1 — lease and cadence", () => {
  it("skips while another instance holds the lease and takes over after it expires", async () => {
    const store = createMemorySearchPerformanceStore();
    const config = resolveSearchPerformanceConfig(ENV);
    assert.equal(
      await store.acquireLease("google", "other-instance", NOW, SEARCH_SYNC_LEASE_TTL_MS),
      true,
    );
    const google = googleClient();
    assert.equal(
      await runSearchProviderSync("google", {
        store,
        config,
        holder: "me",
        now: () => NOW,
        googleClient: google.client,
      }),
      "skipped_lease_held",
    );
    assert.equal(google.requests.length, 0);

    const afterExpiry = new Date(NOW.getTime() + SEARCH_SYNC_LEASE_TTL_MS + 1);
    assert.equal(
      await runSearchProviderSync("google", {
        store,
        config,
        holder: "me",
        now: () => afterExpiry,
        googleClient: google.client,
      }),
      "succeeded",
    );
  });

  it("a holder whose lease was taken over cannot write results", async () => {
    const store = createMemorySearchPerformanceStore();
    const config = resolveSearchPerformanceConfig(ENV);
    let current = NOW;
    const slow = googleClient({
      async listSitemaps() {
        current = new Date(NOW.getTime() + SEARCH_SYNC_LEASE_TTL_MS + 1);
        assert.equal(
          await store.acquireLease("google", "newer-instance", current, SEARCH_SYNC_LEASE_TTL_MS),
          true,
        );
        return [];
      },
    });
    const outcome = await runSearchProviderSync("google", {
      store,
      config,
      holder: "slow",
      now: () => current,
      googleClient: slow.client,
    });
    assert.equal(outcome, "skipped_lease_held");
    const state = await store.getSyncState("google");
    assert.equal(state?.lastSuccessAt, null);
    assert.equal(state?.lease?.holder, "newer-instance", "the new holder's lease is untouched");
    const rows = await store.listDailyMetrics({
      provider: "google",
      siteUrl: "sc-domain:huws.org",
      fromDay: "2000-01-01",
      toDay: "2100-01-01",
    });
    assert.equal(rows.length, 0);
  });

  it("syncs at most daily and backs off six hours after a failure", () => {
    const at = (hours: number) => new Date(NOW.getTime() + hours * 3_600_000).toISOString();
    const base = { lastAttemptAt: null, lastError: null, consecutiveFailures: 0 };
    const state = (lastSuccessAt: string | null, lastFailureAt: string | null) =>
      ({
        ...base,
        provider: "google",
        siteUrl: null,
        lastSuccessAt,
        lastFailureAt,
        lastDataDay: null,
        lastRunId: null,
        snapshot: null,
        lease: null,
        updatedAt: NOW.toISOString(),
      }) as const;
    assert.equal(isSearchSyncDue(null, NOW), true);
    assert.equal(isSearchSyncDue(state(at(-23), null), NOW), false);
    assert.equal(isSearchSyncDue(state(at(-25), null), NOW), true);
    assert.equal(isSearchSyncDue(state(at(-48), at(-5)), NOW), false);
    assert.equal(isSearchSyncDue(state(at(-48), at(-7)), NOW), true);
    assert.equal(isSearchSyncDue(state(null, at(-1)), NOW), false);
  });

  it("clears query/page snapshots after 90 days", async () => {
    const store = createMemorySearchPerformanceStore();
    await runSearchProviderSync("bing", {
      store,
      config: resolveSearchPerformanceConfig(ENV),
      holder: "a",
      now: () => NOW,
      bingClient: bingClient(),
    });
    assert.equal(await store.clearExpiredSnapshots(new Date(NOW.getTime() + 89 * 86_400_000)), 0);
    assert.equal(await store.clearExpiredSnapshots(new Date(NOW.getTime() + 90 * 86_400_000)), 1);
    assert.equal((await store.getSyncState("bing"))?.snapshot, null);
    assert.equal(
      (await store.getSyncState("bing"))?.lastDataDay,
      "2026-10-30",
      "daily metrics state remains",
    );
  });
});
