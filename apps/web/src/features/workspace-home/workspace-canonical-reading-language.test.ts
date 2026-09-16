/**
 * Workspace ordinary canonical English reading declares source-language islands
 * under Preferred Reading <html lang> (same contract as public Blog/PIE).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const webSrc = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function readWeb(rel: string): string {
  return readFileSync(path.join(webSrc, rel), "utf8");
}

const CANONICAL_ISLAND = [
  /lang=\{DEFAULT_PLATFORM_LANGUAGE\}/,
  /data-hu-content-lang=\{DEFAULT_PLATFORM_LANGUAGE\}/,
  /data-hu-reading-owner="browser-native"/,
] as const;

describe("Workspace canonical reading language islands", () => {
  it("WorkspaceHomeDashboard marks unavailableReason and activity detail as browser-native English", () => {
    const dashboard = readWeb(
      "features/workspace-home/components/WorkspaceHomeDashboard.tsx",
    );
    assert.match(dashboard, /DEFAULT_PLATFORM_LANGUAGE/);
    assert.match(
      dashboard,
      /unavailableReason[\s\S]*?lang=\{DEFAULT_PLATFORM_LANGUAGE\}[\s\S]*?data-hu-reading-owner="browser-native"/,
    );
    assert.match(
      dashboard,
      /lang=\{DEFAULT_PLATFORM_LANGUAGE\}[\s\S]*?data-hu-reading-owner="browser-native"[\s\S]*?\{entry\.detail\}/,
    );
    for (const pattern of CANONICAL_ISLAND) {
      assert.match(dashboard, pattern);
    }

    // Catalog chrome stays Preferred Reading (no English force on section titles).
    assert.match(dashboard, /t\("home\.quickActionsTitle"\)/);
    assert.match(dashboard, /t\("home\.recentActivityTitle"\)/);
    assert.match(dashboard, /resolveWorkspaceQuickActionLabel/);
    assert.match(dashboard, /resolveWorkspaceActivityEventLabel/);
    assert.doesNotMatch(
      dashboard,
      /quickActionsTitle[\s\S]{0,80}lang=\{DEFAULT_PLATFORM_LANGUAGE\}/,
    );
  });

  it("CollaborationOpportunitiesWidget islands title/summary only", () => {
    const widget = readWeb(
      "features/community-intelligence/components/CollaborationOpportunitiesWidget.tsx",
    );
    for (const pattern of CANONICAL_ISLAND) {
      assert.match(widget, pattern);
    }
    assert.match(widget, /ci-collab__canonical-reading/);
    assert.match(
      widget,
      /ci-collab__canonical-reading[\s\S]*?presentation\.title[\s\S]*?presentation\.summary/,
    );

    // HU catalog chrome and CI reason resolution stay outside the English island.
    assert.match(widget, /t\("home\.collaborationOpportunitiesTitle"\)/);
    assert.match(widget, /t\("home\.ciWhyRelevant"\)/);
    assert.match(widget, /t\("home\.ciView"\)/);
    assert.match(widget, /resolveWorkspaceCiReasonLabel/);
    const whyIdx = widget.indexOf('t("home.ciWhyRelevant")');
    const islandClose = widget.indexOf("</div>", widget.indexOf("ci-collab__canonical-reading"));
    assert.ok(whyIdx > islandClose, "why/catalog chrome must follow the English island close");
  });

  it("PwaInitiativeFeed marks canonical feed prose as browser-native English", () => {
    const feed = readWeb("features/pwa/components/PwaInitiativeFeed.tsx");
    for (const pattern of CANONICAL_ISLAND) {
      assert.match(feed, pattern);
    }
    assert.match(feed, /hu-pwa-initiative-feed__canonical-reading/);
    assert.match(
      feed,
      /hu-pwa-initiative-feed__canonical-reading[\s\S]*?presentation\.title/,
    );

    // Feed chrome remains Preferred Reading catalog.
    assert.match(feed, /t\("feed\.title"\)/);
    assert.match(feed, /t\("feed\.viewAll"\)/);
    assert.doesNotMatch(
      feed,
      /t\("feed\.title"\)[\s\S]{0,40}lang=\{DEFAULT_PLATFORM_LANGUAGE\}/,
    );
  });

  it("Allies / participant displayName is not blanket-marked English", () => {
    const allies = readWeb("features/workspace-home/components/AlliesWidget.tsx");
    assert.doesNotMatch(allies, /lang=\{DEFAULT_PLATFORM_LANGUAGE\}/);
    assert.doesNotMatch(allies, /data-hu-reading-owner="browser-native"/);
    assert.match(allies, /displayName/);
  });

  it("document Preferred Reading contract and hard Workspace entry remain unchanged", () => {
    const layout = readWeb("app/layout.tsx");
    assert.match(layout, /lang=\{documentLocale\.locale\}/);
    assert.match(layout, /resolveDocumentHtmlLocale/);
    assert.doesNotMatch(layout, /lang=["']en["']/);

    const tools = readWeb("design-system/components/AuthenticatedHeaderTools.tsx");
    const workspace = tools.slice(
      tools.indexOf("export function HeaderWorkspaceLink"),
      tools.indexOf("export function HeaderNotificationsLink"),
    );
    assert.match(workspace, /<a\b/);
    assert.match(workspace, /href="\/workspace"/);
    assert.doesNotMatch(workspace, /<Link\b/);
  });
});
