/**
 * SEO-12B.2 — Admin SEO Search performance interface: model, rendering,
 * accessibility and compatibility with the SEO-12B.1 API response.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import * as React from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import {
  buildSearchProviderKpis,
  buildSearchTrendPoints,
  describeSearchProviderStatus,
  describeUnsupportedMetric,
  formatSearchCount,
  formatSearchCtr,
  formatSearchPosition,
  hasSearchData,
  SEARCH_STATUS_LABELS,
  summarizeSearchVisibility,
  type AdminSearchPerformanceResponse,
  type AdminSearchProviderView,
  type SearchProviderStatus,
} from "../administration/admin-seo-search-performance-model.js";
import type { AdminSeoSearchProviderPanel as PanelFn } from "../administration/components/AdminSeoSearchProviderPanel.js";
import type { SearchVisibilityCardContent as CardFn } from "../administration/components/AdminSeoSearchVisibilityCard.js";
import type { SearchPerformanceTrendChart as ChartFn } from "../administration/components/SearchPerformanceTrendChart.js";

let AdminSeoSearchProviderPanel: typeof PanelFn;
let SearchVisibilityCardContent: typeof CardFn;
let SearchPerformanceTrendChart: typeof ChartFn;

before(async () => {
  (globalThis as { React?: typeof React }).React = React;
  ({ AdminSeoSearchProviderPanel } =
    await import("../administration/components/AdminSeoSearchProviderPanel.js"));
  ({ SearchVisibilityCardContent } =
    await import("../administration/components/AdminSeoSearchVisibilityCard.js"));
  ({ SearchPerformanceTrendChart } =
    await import("../administration/components/SearchPerformanceTrendChart.js"));
});

const webSrc = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = (relative: string) => readFileSync(path.join(webSrc, relative), "utf8");

/** Static markup without React's text-node separators. */
function render(element: React.ReactElement): string {
  return renderToStaticMarkup(element).replace(/<!-- -->/g, "");
}

function view(overrides: Partial<AdminSearchProviderView> = {}): AdminSearchProviderView {
  return {
    provider: "google",
    configured: true,
    configurationIssues: [],
    siteUrl: "sc-domain:huws.org",
    status: "fresh",
    lastAttemptAt: "2026-11-03T14:00:00.000Z",
    lastSuccessAt: "2026-11-03T14:00:00.000Z",
    lastError: null,
    dataThrough: "2026-10-31",
    current: {
      startDay: "2026-10-25",
      endDay: "2026-10-31",
      expectedDays: 7,
      availableDays: 5,
      clicks: 12,
      impressions: 480,
      ctr: 0.025,
    },
    previous: null,
    providerPeriodTotals: {
      periodDays: 7,
      startDay: "2026-10-24",
      endDay: "2026-10-30",
      clicks: 11,
      impressions: 460,
      ctr: 0.0239,
      position: 8.43,
    },
    series: [
      {
        day: "2026-10-29",
        clicks: 4,
        impressions: 100,
        ctr: 0.04,
        position: 8,
        dataState: "final",
      },
      {
        day: "2026-10-30",
        clicks: 0,
        impressions: 0,
        ctr: null,
        position: null,
        dataState: "final",
      },
      {
        day: "2026-10-31",
        clicks: null,
        impressions: null,
        ctr: null,
        position: null,
        dataState: null,
      },
    ],
    snapshotCollectedAt: "2026-11-03T14:00:00.000Z",
    topQueries: {
      dimension: "query",
      startDay: "2026-10-03",
      endDay: "2026-10-30",
      rows: [{ key: "humanity union", clicks: 6, impressions: 90, ctr: 0.0667, position: 3.2 }],
      metricsSource: "provider",
    },
    topPages: null,
    googleSitemaps: [
      {
        path: "https://huws.org/sitemap.xml",
        type: "sitemap",
        isSitemapsIndex: false,
        isPending: false,
        lastSubmitted: "2026-10-01T10:00:00.000Z",
        lastDownloaded: "2026-11-01T08:00:00.000Z",
        errors: 0,
        warnings: 2,
        submittedUrls: 1450,
      },
    ],
    bingCrawl: null,
    unavailableMetrics: ["site_indexed_page_count", "sitemap_indexed_url_count"],
    ...overrides,
  };
}

const bingView = (overrides: Partial<AdminSearchProviderView> = {}) =>
  view({
    provider: "bing",
    siteUrl: "https://huws.org/",
    providerPeriodTotals: null,
    googleSitemaps: null,
    bingCrawl: [
      {
        day: "2026-10-30",
        inIndex: 640,
        crawledPages: 120,
        crawlErrors: 1,
        blockedByRobotsTxt: 0,
        code4xx: 1,
        code5xx: null,
      },
    ],
    topQueries: {
      dimension: "query",
      startDay: "2026-10-03",
      endDay: "2026-10-30",
      rows: [{ key: "hu", clicks: 4, impressions: 40, ctr: 0.1, position: 5 }],
      metricsSource: "impression_weighted_from_provider_rows",
    },
    unavailableMetrics: ["daily_ctr", "daily_average_position", "site_average_position"],
    ...overrides,
  });

const notConfigured = (provider: "google" | "bing") =>
  view({
    provider,
    configured: false,
    configurationIssues: [
      provider === "google" ? "SEO_GSC_SITE_URL is missing" : "SEO_BING_REFRESH_TOKEN is missing",
    ],
    siteUrl: null,
    status: "not_configured",
    lastAttemptAt: null,
    lastSuccessAt: null,
    dataThrough: null,
    current: null,
    providerPeriodTotals: null,
    series: [],
    snapshotCollectedAt: null,
    topQueries: null,
    googleSitemaps: null,
  });

function response(
  google: AdminSearchProviderView,
  bing: AdminSearchProviderView,
): AdminSearchPerformanceResponse {
  return {
    period: "28d",
    generatedAt: "2026-11-03T20:00:00.000Z",
    syncEnabled: true,
    providers: { google, bing },
  };
}

describe("SEO-12B.2 — status model", () => {
  it("distinguishes all five provider states with distinct labels and badges", () => {
    const statuses: SearchProviderStatus[] = [
      "not_configured",
      "never_synced",
      "fresh",
      "stale",
      "error",
    ];
    const described = statuses.map((status) =>
      describeSearchProviderStatus(
        view({
          status,
          lastError:
            status === "error"
              ? {
                  code: "auth_failed",
                  message: "Bing Webmaster token refresh was rejected (HTTP 400).",
                  at: "x",
                }
              : null,
        }),
        true,
      ),
    );
    assert.deepEqual(
      described.map((entry) => entry.label),
      ["Not configured", "Never synced", "Fresh", "Stale", "Error"],
    );
    assert.equal(new Set(described.map((entry) => entry.badge)).size, 5);
    assert.deepEqual(Object.values(SEARCH_STATUS_LABELS), [
      "Not configured",
      "Never synced",
      "Fresh",
      "Stale",
      "Error",
    ]);
    assert.match(described[4]!.message, /token refresh was rejected/);
    assert.match(described[4]!.message, /Showing the last good data/);
  });

  it("explains a disabled sync for configured providers that never synced", () => {
    const message = describeSearchProviderStatus(view({ status: "never_synced" }), false).message;
    assert.match(message, /daily sync is turned off/);
  });

  it("describes unsupported metrics in plain language", () => {
    assert.match(describeUnsupportedMetric("site_average_position"), /per query and page only/);
    assert.match(describeUnsupportedMetric("site_indexed_page_count"), /no API/);
    assert.equal(describeUnsupportedMetric("new_metric_code"), "new metric code");
  });
});

describe("SEO-12B.2 — figures, null versus zero, provider separation", () => {
  it("uses Google's own period totals, including CTR and position", () => {
    const kpis = buildSearchProviderKpis(view())!;
    assert.equal(kpis.source, "provider");
    assert.equal(kpis.clicks, 11);
    assert.equal(kpis.ctrSource, "provider");
    assert.equal(kpis.position, 8.43);
    assert.equal(kpis.startDay, "2026-10-24");
  });

  it("falls back to daily sums for Google without inventing a position", () => {
    const kpis = buildSearchProviderKpis(view({ providerPeriodTotals: null }))!;
    assert.equal(kpis.source, "daily");
    assert.equal(kpis.clicks, 12);
    assert.equal(kpis.ctrSource, "calculated");
    assert.equal(kpis.position, null);
    assert.equal(kpis.availableDays, 5);
  });

  it("labels Bing CTR as calculated and never shows a Bing site position", () => {
    const kpis = buildSearchProviderKpis(bingView())!;
    assert.equal(kpis.ctrSource, "calculated");
    assert.equal(kpis.position, null);
    assert.match(kpis.positionNote ?? "", /Not provided by Bing/);
  });

  it("returns no figures when no day has data", () => {
    const empty = view({
      providerPeriodTotals: null,
      current: {
        startDay: "2026-10-25",
        endDay: "2026-10-31",
        expectedDays: 7,
        availableDays: 0,
        clicks: null,
        impressions: null,
        ctr: null,
      },
    });
    assert.equal(hasSearchData(empty), false);
    assert.equal(buildSearchProviderKpis(empty), null);
  });

  it("formats null as No data and zero as zero", () => {
    assert.equal(formatSearchCount(null), "No data");
    assert.equal(formatSearchCount(0), "0");
    assert.equal(formatSearchCount(12345), "12,345");
    assert.equal(formatSearchCtr(null), "No data");
    assert.equal(formatSearchCtr(0), "0%");
    assert.equal(formatSearchCtr(0.0375), "3.75%");
    assert.equal(formatSearchCtr(0.1), "10%");
    assert.equal(formatSearchPosition(null), "No data");
    assert.equal(formatSearchPosition(8.43), "8.4");
  });

  it("keeps null trend days as gaps", () => {
    assert.deepEqual(
      buildSearchTrendPoints(view().series, "clicks").map((point) => point.value),
      [4, 0, null],
    );
  });

  it("summarizes providers separately without combined totals", () => {
    const summary = summarizeSearchVisibility(response(view(), bingView()));
    assert.equal(summary.anyData, true);
    assert.deepEqual(
      summary.providers.map((provider) => provider.provider),
      ["google", "bing"],
    );
    assert.equal(summary.providers[0]!.kpis?.clicks, 11);
    assert.equal(summary.providers[1]!.kpis?.clicks, 12);
    assert.equal(Object.keys(summary).includes("total"), false);
    const none = summarizeSearchVisibility(
      response(notConfigured("google"), notConfigured("bing")),
    );
    assert.equal(none.anyData, false);
  });
});

describe("SEO-12B.2 — rendering and accessibility", () => {
  it("renders Google figures, top queries, sitemaps and unsupported metrics", () => {
    const html = render(
      createElement(AdminSeoSearchProviderPanel, { view: view(), syncEnabled: true }),
    );
    assert.match(html, /admin-seo-diagnostics__badge--healthy">Fresh</);
    assert.match(html, /aria-label="Google totals"/);
    assert.match(html, />11</);
    assert.match(html, />2\.39%</);
    assert.match(html, />8\.4</);
    assert.match(html, /Reported by Google/);
    assert.match(html, /humanity union/);
    assert.match(html, /<caption class="hu-visually-hidden">Google top queries<\/caption>/);
    assert.match(html, /https:\/\/huws\.org\/sitemap\.xml/);
    assert.match(html, /no site-wide indexed page count/);
    assert.match(html, /Not available from Google/);
    assert.doesNotMatch(html, /Bing/);
    assert.doesNotMatch(html, /<h4/);
  });

  it("renders Bing with calculated CTR, no site position and crawl statistics", () => {
    const html = render(
      createElement(AdminSeoSearchProviderPanel, { view: bingView(), syncEnabled: true }),
    );
    assert.match(html, /Calculated: clicks ÷ impressions/);
    assert.match(html, /Not provided by Bing for the whole site/);
    assert.match(html, /aria-label="Bing crawl statistics"/);
    assert.match(html, /Pages in index[\s\S]*640/);
    assert.match(html, /Combined from Bing rows/);
    assert.match(html, /Not available from Bing/);
    assert.doesNotMatch(html, /Google/);
  });

  it("renders not configured providers with variable names and No data", () => {
    const html = render(
      createElement(AdminSeoSearchProviderPanel, {
        view: notConfigured("bing"),
        syncEnabled: false,
      }),
    );
    assert.match(html, />Not configured</);
    assert.match(html, /<code>SEO_BING_REFRESH_TOKEN is missing<\/code>/);
    assert.match(html, /No data for this period/);
    assert.doesNotMatch(html, /admin-traffic__summary admin-seo-search__kpis/);
  });

  it("draws gaps instead of zeros and keeps a data table", () => {
    const html = render(
      createElement(SearchPerformanceTrendChart, {
        title: "Google clicks",
        color: "red",
        emptyMessage: "No data.",
        points: [
          { day: "2026-10-27", label: "Oct 27", value: 2 },
          { day: "2026-10-28", label: "Oct 28", value: 3 },
          { day: "2026-10-29", label: "Oct 29", value: null },
          { day: "2026-10-30", label: "Oct 30", value: 0 },
          { day: "2026-10-31", label: "Oct 31", value: 1 },
        ],
      }),
    );
    assert.equal((html.match(/<path /g) ?? []).length, 2, "the null day splits the line");
    assert.match(
      html,
      /role="img" aria-label="Google clicks by day, Oct 27 to Oct 31\. Gaps are days without data\."/,
    );
    assert.match(html, /<td>Oct 29<\/td><td>No data<\/td>/);
    assert.match(html, /<td>Oct 30<\/td><td>0<\/td>/);
    const empty = render(
      createElement(SearchPerformanceTrendChart, {
        title: "Bing clicks",
        color: "red",
        emptyMessage: "No data.",
        points: [{ day: "2026-10-31", label: "Oct 31", value: null }],
      }),
    );
    assert.equal(empty, '<p class="hu-caption">No data.</p>');
  });

  it("keeps the Overview ring at No data while loading, on error, and without provider data", () => {
    for (const state of [
      { kind: "loading" as const },
      { kind: "error" as const },
      {
        kind: "ready" as const,
        summary: summarizeSearchVisibility(
          response(notConfigured("google"), notConfigured("bing")),
        ),
      },
    ]) {
      const html = render(createElement(SearchVisibilityCardContent, { state }));
      assert.match(html, /aria-label="Search visibility: No data"/);
      assert.doesNotMatch(html, /admin-seo-radial__progress/);
      assert.doesNotMatch(html, /\d%/);
    }
    const ready = render(
      createElement(SearchVisibilityCardContent, {
        state: {
          kind: "ready",
          summary: summarizeSearchVisibility(
            response(
              notConfigured("google"),
              view({
                provider: "bing",
                status: "never_synced",
                current: null,
                providerPeriodTotals: null,
              }),
            ),
          ),
        },
        onNavigate: () => undefined,
      }),
    );
    assert.match(ready, /Not configured/);
    assert.match(ready, /Never synced/);
    assert.match(ready, /<button type="button"[^>]*>Open Search performance<\/button>/);
  });

  it("shows each provider's own figures on the Overview and no visibility percentage", () => {
    const html = render(
      createElement(SearchVisibilityCardContent, {
        state: { kind: "ready", summary: summarizeSearchVisibility(response(view(), bingView())) },
      }),
    );
    assert.doesNotMatch(html, /admin-seo-radial/);
    assert.match(html, /<strong>Google<\/strong>[\s\S]*11 clicks · 460 impressions · CTR 2\.39%/);
    assert.match(
      html,
      /<strong>Bing<\/strong>[\s\S]*12 clicks · 480 impressions · CTR 2\.5% \(calculated\) · Position No data/,
    );
    assert.doesNotMatch(html, /23 clicks|940 impressions/, "providers are never added together");
    assert.match(html, /admin-seo-visibility--figures/);
  });

  it("wires the fifth tab, period control and states in the view", () => {
    const viewSource = read("features/administration/components/AdminSeoSearchPerformanceView.tsx");
    assert.match(viewSource, /role="group" aria-label="Search performance period"/);
    assert.match(viewSource, /aria-pressed=\{period === option\.id\}/);
    assert.match(viewSource, /role="status"/);
    assert.match(viewSource, /role="alert"/);
    assert.match(viewSource, /Try again/);
    assert.match(viewSource, /fetchAdminSearchPerformance\(period\)/);
    const css = read("features/administration/components/admin-seo-search-performance.css");
    assert.match(
      css,
      /@media \(max-width: 760px\)[\s\S]*__charts \{\s*grid-template-columns: 1fr;/,
    );
    assert.match(css, /@media \(max-width: 420px\)[\s\S]*grid-template-columns: 1fr;/);
  });

  it("keeps the SEO health calculation and Action Center on the Overview", () => {
    const overview = read("features/administration/components/AdminSeoOverviewView.tsx");
    assert.match(overview, /computeSeoHealthScore\(diagnostics\.allChecks\)/);
    assert.match(overview, /<ActionCenter actions=\{actions\}/);
    assert.match(overview, /buildSeoOverviewCategories\(diagnostics\)/);
  });
});

describe("SEO-12B.2 — compatibility with the SEO-12B.1 API response", () => {
  const apiModule = (relative: string) =>
    pathToFileURL(path.resolve(webSrc, "../../api/src/modules", relative)).href;
  const savedNodeTestEnv = process.env.NODE_TEST_ENV;

  before(() => {
    process.env.NODE_TEST_ENV = "true";
  });
  after(() => {
    if (savedNodeTestEnv === undefined) {
      delete process.env.NODE_TEST_ENV;
    } else {
      process.env.NODE_TEST_ENV = savedNodeTestEnv;
    }
  });

  it("consumes the real service output with the web model", async () => {
    const service = await import(apiModule("seo-search-performance/search-performance.service.ts"));
    const storeModule = await import(
      apiModule("seo-search-performance/search-performance.store.ts")
    );
    const configModule = await import(
      apiModule("seo-search-performance/search-performance.config.ts")
    );
    const auth = await import(apiModule("auth/auth-user.repository.ts"));

    auth.setFindAuthUserByIdForTests(async () => ({
      userId: "admin",
      role: "admin",
      status: "active",
    }));
    try {
      const now = new Date("2026-11-03T20:00:00.000Z");
      const store = storeModule.createMemorySearchPerformanceStore();
      await store.upsertDailyMetrics([
        {
          provider: "google",
          siteUrl: "sc-domain:huws.org",
          day: "2026-10-30",
          clicks: 0,
          impressions: 0,
          ctr: null,
          position: null,
          dataState: "final",
          collectedAt: now.toISOString(),
          syncRunId: "r",
          expiresAt: new Date("2028-01-01"),
        },
        {
          provider: "google",
          siteUrl: "sc-domain:huws.org",
          day: "2026-10-31",
          clicks: 3,
          impressions: 60,
          ctr: 0.05,
          position: 7,
          dataState: "fresh",
          collectedAt: now.toISOString(),
          syncRunId: "r",
          expiresAt: new Date("2028-01-01"),
        },
      ]);
      await store.acquireLease("google", "h", now, 60_000);
      await store.recordSyncSuccess("google", "h", {
        siteUrl: "sc-domain:huws.org",
        at: now,
        runId: "r",
        lastDataDay: "2026-10-31",
        snapshot: {
          collectedAt: now.toISOString(),
          expiresAt: new Date(now.getTime() + 86_400_000).toISOString(),
          topQueries: null,
          topPages: null,
          googlePeriodTotals: [
            {
              periodDays: 28,
              startDay: "2026-10-03",
              endDay: "2026-10-30",
              clicks: 9,
              impressions: 300,
              ctr: 0.03,
              position: 6.5,
            },
          ],
          googleSitemaps: [],
          bingCrawl: null,
        },
      });
      const config = configModule.resolveSearchPerformanceConfig({
        SEO_GSC_SITE_URL: "sc-domain:huws.org",
        SEO_GSC_SERVICE_ACCOUNT_EMAIL: "reader@project.iam.gserviceaccount.com",
        SEO_GSC_SERVICE_ACCOUNT_PRIVATE_KEY:
          "-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----",
      });

      const result = (await service.getAdminSearchPerformance({
        actorUserId: "admin",
        period: "28d",
        config,
        store,
        now,
      })) as AdminSearchPerformanceResponse;

      const expectedKeys: (keyof AdminSearchProviderView)[] = [
        "provider",
        "configured",
        "configurationIssues",
        "siteUrl",
        "status",
        "lastAttemptAt",
        "lastSuccessAt",
        "lastError",
        "dataThrough",
        "current",
        "previous",
        "providerPeriodTotals",
        "series",
        "snapshotCollectedAt",
        "topQueries",
        "topPages",
        "googleSitemaps",
        "bingCrawl",
        "unavailableMetrics",
      ];
      for (const provider of ["google", "bing"] as const) {
        assert.deepEqual(Object.keys(result.providers[provider]).sort(), [...expectedKeys].sort());
      }
      assert.deepEqual(Object.keys(result).sort(), [
        "generatedAt",
        "period",
        "providers",
        "syncEnabled",
      ]);

      const google = result.providers.google;
      assert.equal(google.status, "fresh");
      assert.equal(describeSearchProviderStatus(google, result.syncEnabled).label, "Fresh");
      const kpis = buildSearchProviderKpis(google)!;
      assert.equal(kpis.source, "provider");
      assert.equal(kpis.position, 6.5);
      const points = buildSearchTrendPoints(google.series, "clicks");
      assert.equal(points.length, 28);
      assert.equal(points.find((point) => point.day === "2026-10-30")?.value, 0);
      assert.equal(points.find((point) => point.day === "2026-10-29")?.value, null);
      assert.equal(result.providers.bing.status, "not_configured");
      assert.ok(
        result.providers.bing.unavailableMetrics.every(
          (code) => !describeUnsupportedMetric(code).includes("_"),
        ),
      );

      const summary = summarizeSearchVisibility(result);
      assert.equal(summary.anyData, true);
      assert.equal(summary.providers[1]!.kpis, null);
      const html = render(
        createElement(AdminSeoSearchProviderPanel, {
          view: google,
          syncEnabled: result.syncEnabled,
        }),
      );
      assert.match(html, /6\.5/);
    } finally {
      auth.setFindAuthUserByIdForTests(null);
    }
  });
});
