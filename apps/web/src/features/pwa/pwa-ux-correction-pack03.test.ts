import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { WORLD_MAP_ZOOM_BOUNDS } from "../world-map/world-map-zoom.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const webSrc = path.resolve(here, "../..");
const webRoot = path.resolve(webSrc, "..");

function readWeb(relativeFromWebSrc: string): string {
  return readFileSync(path.join(webSrc, relativeFromWebSrc), "utf8");
}

function readPublic(relativeFromPublic: string): string {
  return readFileSync(path.join(webRoot, "public", relativeFromPublic), "utf8");
}

describe("PWA UX Correction Pack 03 — Profile, Knowledge drawer, Map zoom", () => {
  it("biography is left-aligned/full width; avatar/name remain centered on mobile", () => {
    const css = readWeb("features/member-profile/components/participant-profile-surface.css");
    const mobile = css.slice(css.indexOf("@media (max-width: 480px)"));
    assert.match(mobile, /public-member-page__identity-body[\s\S]*align-items:\s*center/);
    assert.match(mobile, /public-member-page__identity-text[\s\S]*text-align:\s*center/);
    assert.match(mobile, /public-member-page__identity-info[\s\S]*text-align:\s*start/);
    assert.match(mobile, /public-member-page__biography-text[\s\S]*text-align:\s*start/);
    assert.match(mobile, /public-member-page__organization-text[\s\S]*text-align:\s*start/);
    assert.match(mobile, /width:\s*100%/);
  });

  it("Knowledge section selection uses URL routes and renders article content", () => {
    const sidebar = readWeb("features/knowledge-center/components/KnowledgeSidebar.tsx");
    const article = readWeb("features/knowledge-center/components/KnowledgeArticlePageContent.tsx");
    const shell = readWeb("features/knowledge-center/components/KnowledgeShell.tsx");
    assert.match(sidebar, /\/knowledge\/\$\{article\.slug\}/);
    assert.match(sidebar, /aria-current=\{isCurrent \? "page" : undefined\}/);
    assert.match(article, /KnowledgeShell/);
    assert.match(article, /fetchKnowledgeArticle\(slug\)/);
    assert.match(article, /knowledge-article/);
    assert.match(shell, /knowledge-center__main/);
  });

  it("Knowledge drawer closes on selection; explicit close + backdrop; launcher reopens", () => {
    const drawer = readWeb("features/knowledge-center/components/KnowledgeNavDrawer.tsx");
    const shell = readWeb("features/knowledge-center/components/KnowledgeShell.tsx");
    const sidebar = readWeb("features/knowledge-center/components/KnowledgeSidebar.tsx");
    const css = readWeb("features/knowledge-center/knowledge-center.css");

    assert.match(drawer, /Close Knowledge menu/);
    assert.match(drawer, /\/icons\/workspace\/cross\.svg/);
    assert.match(drawer, /Escape/);
    assert.match(drawer, /returnFocusRef/);
    assert.match(drawer, /knowledge-center__drawer-backdrop/);
    assert.match(shell, /Open Knowledge menu/);
    assert.match(shell, /Knowledge menu/);
    assert.match(shell, /KnowledgeNavDrawer/);
    assert.match(sidebar, /onNavigate/);
    assert.match(css, /width:\s*min\(80vw/);
    assert.match(css, /backdrop-filter:\s*blur/);
    assert.match(css, /z-index:\s*var\(--hu-z-overlay\)/);
    assert.ok(existsSync(path.join(webRoot, "public/icons/workspace/cross.svg")));
  });

  it("direct Knowledge load keeps content column (no blank shell)", () => {
    const hub = readWeb("features/knowledge-center/components/KnowledgeCenterPageContent.tsx");
    const article = readWeb("features/knowledge-center/components/KnowledgeArticlePageContent.tsx");
    assert.match(hub, /KnowledgeShell/);
    assert.match(hub, /Loading Knowledge Center/);
    assert.match(article, /Loading article/);
    assert.doesNotMatch(
      article,
      /if \(!listing \|\| !article\) \{\s*return \(\s*<main className="knowledge-center">/,
    );
  });

  it("mobile hides stacked desktop sidebar so content is not buried", () => {
    const css = readWeb("features/knowledge-center/knowledge-center.css");
    assert.match(css, /@media \(max-width: 900px\)/);
    assert.match(css, /sidebar--desktop[\s\S]*display:\s*none/);
    assert.match(css, /knowledge-center__mobile-bar[\s\S]*display:\s*block/);
  });

  it("Zoom In/Out/Reset controls and bounds; country navigation preserved", () => {
    const map = readWeb("features/world-map/components/InteractiveWorldMap.tsx");
    const css = readWeb("features/world-map/components/interactive-world-map.css");
    const interact = readPublic("wdcr-js-map/map-interact.js");

    assert.match(map, /aria-label="Zoom in"/);
    assert.match(map, /aria-label="Zoom out"/);
    assert.match(map, /aria-label="Reset map view"/);
    assert.match(map, /WORLD_MAP_ZOOM_BOUNDS|MAX_SCALE/);
    assert.match(map, /\/countries\//);
    assert.match(map, /wdcr-js-map\/index\.html/);
    assert.match(css, /min-width:\s*var\(--hu-touch-target/);
    assert.match(interact, /MAX_SCALE = 2\.5/);
    assert.match(interact, /MIN_SCALE = 1/);
    assert.match(interact, /function zoomIn/);
    assert.match(interact, /function zoomOut/);
    assert.match(interact, /function resetView/);
    assert.match(interact, /clampPan/);
    assert.match(interact, /window\.open\(wdcrjsconfig\[id\]\.url/);

    assert.equal(WORLD_MAP_ZOOM_BOUNDS.min, 1);
    assert.equal(WORLD_MAP_ZOOM_BOUNDS.max, 2.5);
    assert.ok(WORLD_MAP_ZOOM_BOUNDS.step > 0);
  });

  it("no horizontal page overflow utilities introduced for Knowledge/map shells", () => {
    const knowledgeCss = readWeb("features/knowledge-center/knowledge-center.css");
    const mapCss = readWeb("features/world-map/components/interactive-world-map.css");
    assert.match(knowledgeCss, /max-width:\s*var\(--hu-page-max-width\)/);
    assert.match(mapCss, /overflow:\s*hidden/);
    assert.doesNotMatch(knowledgeCss, /width:\s*100vw/);
  });

  it("Workspace Drawer auto-closes on navigation selection (Pack 03 addendum)", () => {
    const drawer = readWeb("features/pwa/components/PwaWorkspaceDrawer.tsx");
    const nav = readWeb("features/initiatives/components/WorkspaceNavigation.tsx");
    const groups = readWeb("features/initiatives/components/build-workspace-nav-groups.ts");

    assert.match(drawer, /WorkspaceNavigation onNavigate=\{handleNavigate\}/);
    assert.match(drawer, /skipFocusRestoreRef/);
    assert.match(drawer, /tWorkspace\("closeMenu"\)/);
    assert.match(drawer, /hu-pwa-drawer__backdrop/);
    assert.match(drawer, /Escape/);
    assert.match(drawer, /\/icons\/workspace\/cross\.svg/);

    assert.match(nav, /onNavigate\?:/);
    assert.match(nav, /onClick=\{onNavigate\}/);
    assert.match(groups, /Workspace Home/);
    assert.match(groups, /Initiatives/);
    assert.match(groups, /Messages/);
    assert.match(groups, /Profile/);
    assert.match(groups, /Preferences/);
    assert.match(nav, /Become an Author|Publishing/);
    assert.match(nav, /Editorial Review/);

    // Desktop callers keep using WorkspaceNavigation without onNavigate — no second nav.
    assert.match(nav, /export function WorkspaceNavigation/);
    assert.doesNotMatch(drawer, /PwaWorkspaceNav|MobileWorkspaceNav/);
  });

  it("desktop Workspace pages still mount WorkspaceNavigation without drawer wiring", () => {
    const home = readWeb("app/workspace/WorkspaceHomePage.tsx");
    assert.match(home, /workspaceNavigation=\{<WorkspaceNavigation\s*\/>\}/);
    assert.doesNotMatch(home, /onNavigate=/);
  });
});
