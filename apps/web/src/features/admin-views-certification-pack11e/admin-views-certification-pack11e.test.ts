/**
 * Pack 11E — Admin Views final certification (source + behavioral contracts).
 * Certification-only; no product features beyond semantic labeling fixes.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));
const webSrc = path.resolve(dir, "../..");
const repoRoot = path.resolve(webSrc, "../../..");

function readWeb(relativePath: string): string {
  return readFileSync(path.join(webSrc, relativePath), "utf8");
}

function readRepo(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

describe("Pack 11E — Overview / search / Editor certification", () => {
  it("11A Administrator display name binds to Member Profile + refresh event", () => {
    const overview = readWeb("features/administration/components/AdminOverviewSection.tsx");
    assert.match(overview, /getMyMemberProfile/);
    assert.match(overview, /resolveDisplayName/);
    assert.match(overview, /MEMBER_PROFILE_UPDATED_EVENT/);
    assert.doesNotMatch(overview, /label:\s*"Display name",\s*value:\s*user\.displayName/);
  });

  it("11B Editor widget is World-only authority summary without new role", () => {
    const authority = readWeb("features/administration/admin-editor-authority.ts");
    const overview = readWeb("features/administration/components/AdminOverviewSection.tsx");
    assert.match(overview, /title="Editor"/);
    assert.match(authority, /level:\s*"WORLD"/);
    assert.match(authority, /All countries, regions and cities/);
    assert.doesNotMatch(authority, /role === "editor"|AuthUserAccountRole.*editor/);
  });

  it("11A /search filters reuse warm accent surface; Search stays primary", () => {
    const css = readWeb("features/global-search/global-search-page.css");
    const page = readWeb("features/global-search/components/GlobalSearchPageContent.tsx");
    assert.match(css, /\.global-search-page__filters[\s\S]*--hu-color-accent/);
    assert.match(page, /variant="primary"/);
    assert.doesNotMatch(css, /\.global-search-page__filters button\s*\{/);
  });
});

describe("Pack 11E — Traffic / Insights / privacy certification", () => {
  it("collector + cookies are first-party and distinct from Public Choice visitorKey", () => {
    const collector = readWeb("features/traffic-analytics/TrafficPageviewCollector.tsx");
    const constants = readRepo(
      "apps/api/src/modules/traffic-analytics/traffic-analytics.constants.ts",
    );
    const support = readRepo(
      "apps/api/src/modules/initiative-support/initiative-support.routes.ts",
    );
    assert.match(collector, /\/api\/v1\/public\/analytics\/pageview/);
    assert.match(collector, /credentials:\s*"include"/);
    assert.match(constants, /hu_traffic_vid/);
    assert.match(constants, /hu_traffic_sid/);
    assert.match(constants, /TRAFFIC_SESSION_INACTIVITY_MS = 30 \* 60 \* 1000/);
    assert.match(constants, /TRAFFIC_EVENT_RETENTION_DAYS = 90/);
    assert.match(support, /hu_initiative_visitor/);
    assert.doesNotMatch(collector, /hu_initiative_visitor|visitorKey/);
    assert.doesNotMatch(constants, /hu_initiative_visitor/);
  });

  it("stable analytics collections only (+ indexes / 90d TTL on raw)", () => {
    const collections = readRepo("apps/api/src/infrastructure/mongodb/mongo-collections.ts");
    const indexes = readRepo("apps/api/src/infrastructure/mongodb/mongo-indexes.ts");
    assert.match(collections, /traffic_events/);
    assert.match(collections, /traffic_sessions/);
    assert.match(collections, /traffic_daily_aggregates/);
    assert.match(collections, /traffic_visitor_registry/);
    assert.doesNotMatch(collections, /traffic_\d{4}_\d{2}/);
    assert.doesNotMatch(collections, /"session_[a-z0-9]+"/);
    assert.match(indexes, /traffic_events_expire_at_ttl/);
    assert.match(indexes, /traffic_sessions_expire_at_ttl/);
    assert.doesNotMatch(indexes, /traffic_daily_aggregates[\s\S]*expireAfterSeconds/);
  });

  it("Traffic + Insights UI distinguish loading / zero / unavailable", () => {
    const traffic = readWeb("features/administration/components/AdminViewsTrafficSection.tsx");
    const insights = readWeb("features/administration/components/AdminViewsInsightsSection.tsx");
    for (const source of [traffic, insights]) {
      assert.match(source, /Analytics unavailable/);
      assert.match(source, /No analytics collected for this period|No traffic analytics have been collected/);
      assert.match(source, /Loading/);
      assert.doesNotMatch(source, /fakeViews|sampleTraffic|AdminCapabilityGap/);
    }
  });

  it("Insights visitor chart semantics are daily unique; all-time is exact", () => {
    const insights = readWeb("features/administration/components/AdminViewsInsightsSection.tsx");
    const chart = readWeb("features/administration/components/TrafficInsightsTrendChart.tsx");
    assert.match(insights, /All-time Visitors/);
    assert.match(insights, /daily unique visitors \(not exact multi-day/);
    assert.match(chart, /Daily unique visitors/);
    assert.match(chart, /role="img"/);
    assert.match(chart, /Historical trend data table/);
  });

  it("Admin responses and aggregates reject privacy-sensitive fields", () => {
    const admin = readRepo(
      "apps/api/src/modules/traffic-analytics/traffic-analytics.admin.service.ts",
    );
    const insights = readRepo(
      "apps/api/src/modules/traffic-analytics/traffic-insights.admin.service.ts",
    );
    const ingest = readRepo(
      "apps/api/src/modules/traffic-analytics/traffic-analytics.ingest.ts",
    );
    const aggregate = readRepo(
      "apps/api/src/modules/traffic-analytics/traffic-aggregate.repository.ts",
    );
    for (const source of [admin, insights]) {
      assert.doesNotMatch(source, /visitorId:|sessionId:|ipAddress|passwordHash/);
    }
    assert.match(ingest, /"visitorId" in body|"countryCode" in body|"ip" in body/);
    assert.match(ingest, /recordAcceptedTrafficAggregates/);
    assert.match(aggregate, /touchTrafficVisitorDay/);
    assert.doesNotMatch(aggregate, /\bipAddress\b|\bfingerprint\b/);
  });

  it("session duration is omitted when not trustworthy", () => {
    const insightsUi = readWeb("features/administration/components/AdminViewsInsightsSection.tsx");
    const service = readRepo(
      "apps/api/src/modules/traffic-analytics/traffic-insights.admin.service.ts",
    );
    assert.match(service, /averageDurationSeconds:\s*null/);
    assert.match(insightsUi, /Average duration is not shown/);
    assert.doesNotMatch(insightsUi, /Average duration[\s\S]*\{report\.sessions\.averageDurationSeconds\}/);
  });

  it("Admin navigation Views → Traffic / Insights unchanged", () => {
    const sections = readWeb("features/administration/admin-panel-sections.ts");
    assert.match(sections, /href: "\/admin\/views"/);
    assert.match(sections, /href: "\/admin\/views\/insights"/);
  });
});
