/**
 * Mobile Shell Pack 09C —
 * Workspace drawer (browser) + header avatar + mobile PWA install.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));
const webSrc = path.resolve(dir, "../..");
const webRoot = path.resolve(webSrc, "..");

function readWeb(relativePath: string): string {
  return readFileSync(path.join(webSrc, relativePath), "utf8");
}

describe("Mobile Shell Pack 09C", () => {
  it("browser header mounts Workspace drawer trigger + avatar → /workspace", () => {
    const header = readWeb("design-system/components/HumanityHeader.tsx");
    const controls = readWeb("design-system/components/BrowserWorkspaceHeaderControls.tsx");
    const layoutCss = readWeb("design-system/layout.css");

    assert.match(header, /BrowserWorkspaceHeaderControls/);
    assert.match(controls, /Open Workspace navigation/);
    assert.match(controls, /PwaWorkspaceDrawer/);
    assert.match(controls, /href="\/workspace"/);
    assert.match(controls, /HumanityAvatar/);
    assert.match(controls, /getWorkspaceMemberIdentity/);
    assert.match(controls, /authStatus !== "authenticated"/);
    assert.match(controls, /setDrawerOpen\(false\)/);
    assert.match(layoutCss, /humanity-header__workspace-shell/);
    assert.match(layoutCss, /@media \(max-width:\s*1024px\)[\s\S]*workspace-shell[\s\S]*display:\s*inline-flex/s);
  });

  it("drawer reuses WorkspaceNavigation groups; closes via X/backdrop/Escape/nav; body scroll lock", () => {
    const drawer = readWeb("features/pwa/components/PwaWorkspaceDrawer.tsx");
    const nav = readWeb("features/initiatives/components/WorkspaceNavigation.tsx");
    const css = readWeb("features/pwa/pwa.css");

    assert.match(drawer, /WorkspaceNavigation onNavigate=\{handleNavigate\}/);
    assert.match(drawer, /document\.body\.style\.overflow = "hidden"/);
    assert.match(drawer, /Escape/);
    assert.match(drawer, /hu-pwa-drawer__backdrop/);
    assert.match(drawer, /Close Workspace menu/);
    assert.match(nav, /workspace-navigation__groups/);
    assert.match(nav, /buildWorkspaceNavGroups/);
    assert.match(nav, /isAdminAccountRole/);
    assert.match(css, /width:\s*min\(22rem,\s*80vw\)/);
    assert.match(css, /backdrop-filter:\s*blur/);
    assert.match(css, /z-index:\s*140/);
  });

  it("tablet/mobile hide sidebar so drawer is the sole Workspace nav surface", () => {
    const workspaceCss = readWeb("components/member/member-workspace.css");
    assert.match(workspaceCss, /@media \(max-width:\s*1024px\)[\s\S]*\.member-workspace__nav[\s\S]*display:\s*none/s);
    assert.doesNotMatch(
      workspaceCss,
      /@media \(max-width:\s*768px\)[\s\S]*\.member-workspace__nav[\s\S]*display:\s*none/s,
    );
  });

  it("PWA install: Install App / Add to Home Screen / Installed; no auto prompt", () => {
    const promo = readWeb("features/pwa/components/PwaInstallPromotion.tsx");
    const guidance = readWeb("features/pwa/components/PwaInstallGuidance.tsx");
    const register = readWeb("features/pwa/components/ServiceWorkerRegister.tsx");
    const manifest = readWeb("app/manifest.ts");

    assert.match(promo, /Install App/);
    assert.match(promo, /Add to Home Screen/);
    assert.match(promo, /Installed/);
    assert.match(promo, /prompt\.prompt\(\)/);
    assert.doesNotMatch(register, /\.prompt\(\)/);
    assert.match(guidance, /Add Humanity Union to your Home Screen from the Share menu/);
    assert.match(manifest, /\/brand\/app-192\.png/);
    assert.match(manifest, /\/brand\/app-512\.png/);
    assert.ok(existsSync(path.join(webRoot, "public/brand/app-192.png")));
    assert.ok(existsSync(path.join(webRoot, "public/brand/app-512.png")));
  });

  it("Knowledge drawer architecture unchanged; Pack 09A/09B guards still hold", () => {
    const knowledge = readWeb("features/knowledge-center/components/KnowledgeNavDrawer.tsx");
    const pieCss = readWeb("features/public-initiative-experience/public-initiative-experience.css");
    const pack09b = readWeb(
      "features/media-responsive-ux-pack09b/media-responsive-ux-pack09b.test.ts",
    );

    assert.match(knowledge, /KnowledgeSidebar/);
    assert.match(knowledge, /Close Knowledge menu/);
    assert.doesNotMatch(
      pieCss,
      /\.pie-election-candidate-submit button\s*\{[^}]*background:\s*var\(--hu-color-surface\)/,
    );
    assert.match(pack09b, /trusted-media-category-tabs__list/);
  });
});
