/**
 * Mobile Runtime Polish Pack 10A —
 * Header composition (one burger) + avatar Workspace drawer + Knowledge overlay.
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

describe("Mobile Runtime Polish Pack 10A — header + Knowledge overlay", () => {
  it("mobile header order is platform burger → brand → avatar; one burger only", () => {
    const header = readWeb("design-system/components/HumanityHeader.tsx");
    const controls = readWeb("design-system/components/BrowserWorkspaceHeaderControls.tsx");
    const brandStart = header.indexOf('className="humanity-header__brand"');
    const brandEnd = header.indexOf("</div>", header.indexOf("humanity-header__tagline"));
    const brandBlock = header.slice(brandStart, brandEnd);
    const endZone = header.slice(header.indexOf("humanity-header__end"));

    assert.match(brandBlock, /HumanityHeaderMenuButton/);
    assert.match(brandBlock, /humanity-header__logo-link/);
    assert.match(brandBlock, /Humanity Union/);
    assert.doesNotMatch(brandBlock, /BrowserWorkspaceHeaderControls/);
    assert.match(endZone, /BrowserWorkspaceHeaderControls/);

    assert.match(controls, /Open Workspace menu/);
    assert.doesNotMatch(controls, /humanity-header__workspace-trigger/);
    assert.doesNotMatch(controls, /☰/);
    assert.doesNotMatch(controls, /href="\/workspace"/);
  });

  it("avatar opens canonical Workspace drawer; visitor has no avatar", () => {
    const controls = readWeb("design-system/components/BrowserWorkspaceHeaderControls.tsx");
    const drawer = readWeb("features/pwa/components/PwaWorkspaceDrawer.tsx");
    const nav = readWeb("features/initiatives/components/WorkspaceNavigation.tsx");

    assert.match(controls, /PwaWorkspaceDrawer/);
    assert.match(controls, /setDrawerOpen\(\(open\) => !open\)/);
    assert.match(controls, /authStatus !== "authenticated"/);
    assert.match(controls, /return null/);
    assert.match(controls, /HumanityAvatar/);
    assert.match(drawer, /WorkspaceNavigation onNavigate=\{handleNavigate\}/);
    assert.match(nav, /workspace-navigation__groups/);
    assert.match(nav, /isAdminAccountRole/);
    assert.match(drawer, /Escape/);
    assert.match(drawer, /hu-pwa-drawer__backdrop/);
    assert.match(drawer, /document\.body\.style\.overflow = "hidden"/);
  });

  it("Knowledge drawer overlays header via shared --hu-z-overlay layer", () => {
    const tokens = readWeb("design-system/tokens.css");
    const knowledgeCss = readWeb("features/knowledge-center/knowledge-center.css");
    const layoutCss = readWeb("design-system/layout.css");
    const pwaCss = readWeb("features/pwa/pwa.css");

    assert.match(tokens, /--hu-z-header:\s*100/);
    assert.match(tokens, /--hu-z-overlay:\s*140/);
    assert.match(tokens, /--hu-z-modal:\s*200/);
    assert.match(layoutCss, /z-index:\s*var\(--hu-z-header\)/);
    assert.match(knowledgeCss, /z-index:\s*var\(--hu-z-overlay\)/);
    assert.doesNotMatch(knowledgeCss, /\.knowledge-center__drawer\s*\{[^}]*z-index:\s*50/s);
    assert.match(pwaCss, /z-index:\s*var\(--hu-z-overlay\)/);
  });

  it("narrow header rules keep brand between controls without second menu", () => {
    const layoutCss = readWeb("design-system/layout.css");
    assert.match(layoutCss, /@media \(max-width:\s*430px\)/);
    assert.match(layoutCss, /@media \(max-width:\s*360px\)/);
    assert.match(layoutCss, /humanity-header__end/);
    assert.doesNotMatch(layoutCss, /humanity-header__workspace-trigger/);
  });

  it("iOS guidance lists Share → Add to Home Screen → Open as Web App → Add", () => {
    const guidance = readWeb("features/pwa/components/PwaInstallGuidance.tsx");
    assert.match(guidance, /Share menu/);
    assert.match(guidance, /Add to Home Screen/);
    assert.match(guidance, /Open as Web App/);
    assert.match(guidance, /Tap Add/);
    assert.doesNotMatch(guidance, /force an OS icon onto your Home Screen without your confirmation/);
  });

  it("desktop header still uses capsule nav; standalone PWA avatar drawer unchanged", () => {
    const header = readWeb("design-system/components/HumanityHeader.tsx");
    const layoutCss = readWeb("design-system/layout.css");
    const pwaHeader = readWeb("features/pwa/components/PwaAppHeader.tsx");

    assert.match(header, /humanity-header__nav--desktop/);
    assert.match(layoutCss, /humanity-header__nav--desktop/);
    assert.match(pwaHeader, /Open Workspace menu/);
    assert.match(pwaHeader, /PwaWorkspaceDrawer/);
    assert.match(pwaHeader, /hu-pwa-app-header__avatar/);
  });
});
