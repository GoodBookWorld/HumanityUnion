/**
 * Pack 11C — Web traffic collector + Admin Traffic UI contracts.
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

describe("Pack 11C — Web traffic collection & Admin Traffic UI", () => {
  it("collector mounts in HumanityLayout and uses credentialed pageview POST", () => {
    const layout = readWeb("design-system/components/HumanityLayout.tsx");
    const collector = readWeb("features/traffic-analytics/TrafficPageviewCollector.tsx");

    assert.match(layout, /TrafficPageviewCollector/);
    assert.match(collector, /usePathname/);
    assert.match(collector, /\/api\/v1\/public\/analytics\/pageview/);
    assert.match(collector, /credentials:\s*"include"/);
    assert.match(collector, /keepalive:\s*true/);
    assert.doesNotMatch(collector, /hu_initiative_visitor|visitorKey/);
  });

  it("Admin Traffic loads period-scoped report with real zero / unavailable states", () => {
    const traffic = readWeb("features/administration/components/AdminViewsTrafficSection.tsx");
    assert.match(traffic, /fetchAdminTrafficReport/);
    assert.match(traffic, /today|7d|30d/);
    assert.match(traffic, /Most viewed pages/);
    assert.match(traffic, /Referrers/);
    assert.match(traffic, /Geography/);
    assert.match(traffic, /Analytics unavailable/);
    assert.match(traffic, /No analytics collected for this period/);
    assert.doesNotMatch(traffic, /visitorId|sessionId|tv_/);
  });

  it("Pack 11A/11B Overview widgets remain present", () => {
    const overview = readWeb("features/administration/components/AdminOverviewSection.tsx");
    assert.match(overview, /getMyMemberProfile/);
    assert.match(overview, /resolveAdminEditorAuthority/);
    assert.match(overview, /title="Editor"/);
  });

  it("Initiative support view path remains separate from platform traffic", () => {
    const support = readFileSync(
      path.resolve(webSrc, "../../api/src/modules/initiative-support/initiative-support.routes.ts"),
      "utf8",
    );
    assert.match(support, /hu_initiative_visitor/);
    assert.match(support, /recordInitiativeView|support\/view/);
  });
});
