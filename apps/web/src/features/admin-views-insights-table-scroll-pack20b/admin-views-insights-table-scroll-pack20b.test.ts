/**
 * Pack 20B — Admin Views → Insights scrollable data table.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const webSrc = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function read(relativePath: string): string {
  return readFileSync(path.resolve(webSrc, relativePath), "utf8");
}

describe("Pack 20B — Insights trend table scroll viewport", () => {
  const chart = read("features/administration/components/TrafficInsightsTrendChart.tsx");
  const css = read("features/administration/components/admin-insights.css");
  const insights = read("features/administration/components/AdminViewsInsightsSection.tsx");

  it("retains the semantic data table inside admin-insights-chart__table-wrap", () => {
    assert.match(chart, /admin-insights-chart__table-wrap/);
    assert.match(chart, /<table className="admin-traffic__table">/);
    assert.match(chart, /<thead>/);
    assert.match(chart, /<tbody>/);
    assert.match(chart, /points\.map/);
  });

  it("limits the table viewport with max-height ~350px (not a rigid fixed height)", () => {
    assert.match(css, /\.admin-insights-chart__table-wrap\s*\{[^}]*max-height:\s*350px/s);
    assert.doesNotMatch(
      css,
      /\.admin-insights-chart__table-wrap\s*\{[^}]*(?<![-\w])height:\s*350px/s,
    );
  });

  it("enables vertical overflow scrolling inside the wrapper", () => {
    assert.match(css, /\.admin-insights-chart__table-wrap\s*\{[^}]*overflow-y:\s*auto/s);
  });

  it("preserves horizontal overflow for narrow viewports", () => {
    assert.match(css, /\.admin-insights-chart__table-wrap\s*\{[^}]*overflow-x:\s*auto/s);
  });

  it("keeps short datasets naturally shorter via max-height rather than forced empty space", () => {
    assert.match(css, /max-height:\s*350px/);
    assert.doesNotMatch(css, /\.admin-insights-chart__table-wrap\s*\{[^}]*min-height:\s*350px/s);
  });

  it("uses the same chart/wrapper for all Insights reporting periods", () => {
    assert.match(insights, /TrafficInsightsTrendChart/);
    assert.match(insights, /id: "30d"/);
    assert.match(insights, /id: "90d"/);
    assert.match(insights, /id: "12m"/);
    assert.match(insights, /id: "all"/);
    assert.match(insights, /fetchAdminTrafficInsights\(period\)/);
    assert.match(insights, /hasTrendData[\s\S]*<TrafficInsightsTrendChart/);
    assert.doesNotMatch(insights, /period === "30d"[\s\S]*TrafficInsightsTrendChart/);
  });

  it("does not paginate or hide trend rows in presentation CSS/TSX", () => {
    assert.doesNotMatch(chart, /slice\(|pagination|pageSize|hiddenRows/i);
    assert.doesNotMatch(css, /display:\s*none|visibility:\s*hidden/);
  });

  it("implements sticky table headers within the scroll wrapper", () => {
    assert.match(
      css,
      /\.admin-insights-chart__table-wrap\s+\.admin-traffic__table\s+th\s*\{[^}]*position:\s*sticky/s,
    );
    assert.match(
      css,
      /\.admin-insights-chart__table-wrap\s+\.admin-traffic__table\s+th\s*\{[^}]*top:\s*0/s,
    );
  });

  it("does not alter analytics fetch or period calculation in Insights", () => {
    assert.match(insights, /fetchAdminTrafficInsights\(period\)/);
    assert.doesNotMatch(insights, /pageSize|limitTrend|truncateTrend/i);
  });

  it("preserves existing Views/Insights Pack 11D expectations", () => {
    const pack11d = read("features/traffic-analytics-pack11d/traffic-analytics-pack11d.test.ts");
    assert.match(pack11d, /TrafficInsightsTrendChart/);
    assert.match(pack11d, /AdminViewsInsightsSection/);
  });
});
