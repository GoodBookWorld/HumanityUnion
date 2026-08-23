/**
 * Pack 11D — Admin Insights UI contracts.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));
const webSrc = path.resolve(dir, "../..");

function readWeb(relativePath: string): string {
  return readFileSync(path.join(webSrc, relativePath), "utf8");
}

describe("Pack 11D — Admin Insights UI", () => {
  it("Insights loads shared period selector and real widgets", () => {
    const insights = readWeb("features/administration/components/AdminViewsInsightsSection.tsx");
    assert.match(insights, /fetchAdminTrafficInsights/);
    assert.match(insights, /30d|90d|12m|all/);
    assert.match(insights, /All-time Views|All-time Visitors|All-time Sessions/);
    assert.match(insights, /TrafficInsightsTrendChart/);
    assert.match(insights, /Traffic geography/);
    assert.match(insights, /Referrers/);
    assert.match(insights, /Total sessions/);
    assert.match(insights, /Analytics unavailable/);
    assert.match(insights, /No traffic analytics have been collected/);
    assert.doesNotMatch(insights, /AdminCapabilityGap|fakeViews|sampleTraffic/);
  });

  it("chart is accessible and does not rely on color alone", () => {
    const chart = readWeb("features/administration/components/TrafficInsightsTrendChart.tsx");
    assert.match(chart, /role="img"/);
    assert.match(chart, /Series legend/);
    assert.match(chart, /Daily unique visitors/);
    assert.match(chart, /Historical trend data table/);
    assert.match(chart, /strokeDasharray/);
  });

  it("Pack 11A/11B/11C anchors remain", () => {
    const overview = readWeb("features/administration/components/AdminOverviewSection.tsx");
    assert.match(overview, /getMyMemberProfile|resolveAdminEditorAuthority/);
    const traffic = readWeb("features/administration/components/AdminViewsTrafficSection.tsx");
    assert.match(traffic, /fetchAdminTrafficReport/);
    const collector = readWeb("features/traffic-analytics/TrafficPageviewCollector.tsx");
    assert.match(collector, /\/api\/v1\/public\/analytics\/pageview/);
  });
});
