import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  resolvePwaInstallUxState,
  type BeforeInstallPromptLike,
} from "./install-state.js";
import { isStandaloneDisplayMode, resolvePresentationMode } from "./presentation-mode.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const webSrc = path.resolve(here, "../..");
const webRoot = path.resolve(webSrc, "..");
const repoRoot = path.resolve(webRoot, "../..");

function readWeb(relativeFromWebSrc: string): string {
  return readFileSync(path.join(webSrc, relativeFromWebSrc), "utf8");
}

function readPublic(relativeFromPublic: string): string {
  return readFileSync(path.join(webRoot, "public", relativeFromPublic), "utf8");
}

function readRepo(relativeFromRepo: string): string {
  return readFileSync(path.join(repoRoot, relativeFromRepo), "utf8");
}

describe("PWA Experience Pack 01 — installability & shell", () => {
  it("1–6 — manifest exists with start_url, standalone, colors, and icons", () => {
    const manifest = readWeb("app/manifest.ts");
    assert.match(manifest, /start_url:\s*"\/workspace"/);
    assert.match(manifest, /display:\s*"standalone"/);
    assert.match(manifest, /theme_color:\s*"#0174b0"/);
    assert.match(manifest, /background_color:\s*"#f4f7fa"/);
    assert.match(manifest, /\/brand\/app-192\.png/);
    assert.match(manifest, /\/brand\/app-512\.png/);
    assert.match(manifest, /purpose:\s*"any"/);
    assert.doesNotMatch(manifest, /purpose:\s*"maskable"/);
    assert.ok(existsSync(path.join(webRoot, "public/brand/app-192.png")));
    assert.ok(existsSync(path.join(webRoot, "public/brand/app-512.png")));
    assert.ok(existsSync(path.join(webRoot, "public/brand/favicon.ico")));
    assert.ok(existsSync(path.join(webRoot, "public/brand/apple-touch-icon.png")));
  });

  it("7 — Chromium install_available when deferred prompt exists", () => {
    const prompt = { prompt: async () => undefined } as BeforeInstallPromptLike;
    assert.equal(
      resolvePwaInstallUxState({ standalone: false, deferredPrompt: prompt }),
      "install_available",
    );
  });

  it("8 — iOS instructional state when no Chromium prompt", () => {
    // Force non-standalone; isIosLikeDevice is UA-based — assert resolver branch via source + unsupported path.
    const installState = readWeb("features/pwa/install-state.ts");
    assert.match(installState, /ios_add_to_home/);
    assert.match(installState, /isIosLikeDevice/);
    const help = readWeb("features/pwa/components/PwaInstallGuidance.tsx");
    assert.match(help, /Add to Home Screen/);
    assert.match(help, /Share button|Share menu/);
    const promo = readWeb("features/pwa/components/PwaInstallPromotion.tsx");
    assert.match(promo, /Add to Home Screen/);
  });

  it("9 — standalone does not show actionable install CTA", () => {
    assert.equal(
      resolvePwaInstallUxState({ standalone: true, deferredPrompt: null }),
      "already_installed",
    );
    const promo = readWeb("features/pwa/components/PwaInstallPromotion.tsx");
    assert.match(promo, /runningStandalone/);
    assert.match(promo, /already installed on this device|Installed/);
    assert.match(promo, /Open Workspace/);
    assert.match(promo, /showInstallAction = uxState === "install_available" && !dismissed/);
    assert.match(promo, /How to install/);
    assert.match(promo, /handleDismiss[\s\S]*Later/);
  });

  it("10 — no automatic install prompt", () => {
    const register = readWeb("features/pwa/components/ServiceWorkerRegister.tsx");
    assert.match(register, /beforeinstallprompt/);
    assert.match(register, /preventDefault/);
    assert.doesNotMatch(register, /\.prompt\(\)/);
    const promo = readWeb("features/pwa/components/PwaInstallPromotion.tsx");
    assert.match(promo, /prompt\.prompt\(\)/);
  });

  it("11–13 — standalone App Header; browser keeps Website header; avatar opens drawer", () => {
    const shell = readWeb("features/pwa/components/PwaShell.tsx");
    const header = readWeb("features/pwa/components/PwaAppHeader.tsx");
    const layout = readWeb("design-system/components/HumanityLayout.tsx");
    assert.match(shell, /PwaAppHeader/);
    assert.match(shell, /standalone/);
    assert.match(layout, /HumanityHeader/);
    assert.match(header, /Open Workspace menu/);
    assert.match(header, /PwaWorkspaceDrawer/);
  });

  it("14 — Drawer reuses capability-aware WorkspaceNavigation", () => {
    const drawer = readWeb("features/pwa/components/PwaWorkspaceDrawer.tsx");
    assert.match(drawer, /WorkspaceNavigation/);
    assert.match(drawer, /trapTabKey/);
    assert.match(drawer, /Escape/);
  });

  it("15 — Search routes to canonical /search", () => {
    const header = readWeb("features/pwa/components/PwaAppHeader.tsx");
    assert.match(header, /\/search\?q=/);
    assert.match(header, /Search Humanity Union/);
  });

  it("16 — hamburger Global Menu contains approved public links", () => {
    const menu = readWeb("features/pwa/components/PwaGlobalMenu.tsx");
    for (const label of [
      "Home",
      "Institutions",
      "Knowledge",
      "Blog",
      "Civic Media",
      "Support",
      "Search",
    ]) {
      assert.match(menu, new RegExp(label));
    }
  });

  it("17–21 — Bottom Navigation routes and Assistant reuse", () => {
    const nav = readWeb("features/pwa/components/PwaBottomNav.tsx");
    assert.match(nav, /href="\/workspace"/);
    assert.match(nav, /href="\/initiatives"/);
    assert.match(nav, /href="\/initiatives\/create"/);
    assert.match(nav, /Create Initiative/);
    assert.match(nav, /href="\/notifications"/);
    assert.match(nav, /openAssistant/);
    assert.match(nav, /useUnreadNotificationCount/);
    assert.doesNotMatch(nav, /href=["']\/assistant["']/);
    assert.ok(existsSync(path.join(webRoot, "public/icons/messenger/work-mob.svg")));
    assert.ok(existsSync(path.join(webRoot, "public/icons/messenger/init-mob.svg")));
    assert.ok(existsSync(path.join(webRoot, "public/icons/messenger/add-mob.svg")));
    assert.ok(existsSync(path.join(webRoot, "public/icons/messenger/not-mob.svg")));
    assert.ok(existsSync(path.join(webRoot, "public/icons/messenger/ai-mob.svg")));
  });

  it("22–23 — standalone hides Assistant FAB; browser FAB retained", () => {
    const css = readWeb("features/pwa/pwa-safe-area.css");
    assert.match(css, /\.humanity-app--pwa-standalone \.hu-assistant-fab/);
    assert.match(css, /display:\s*none/);
    const fab = readWeb(
      "features/humanity-union-assistant/components/HumanityUnionAssistantFloatingButton.tsx",
    );
    assert.match(fab, /hu-assistant-fab/);
  });

  it("24–29 — safe-area tokens, header/nav consumption, composers, no fake Home Indicator", () => {
    const css = readWeb("features/pwa/pwa-safe-area.css");
    assert.match(css, /--hu-safe-area-top:\s*env\(safe-area-inset-top/);
    assert.match(css, /--hu-safe-area-bottom:\s*env\(safe-area-inset-bottom/);
    assert.match(css, /--hu-pwa-bottom-nav-height/);
    assert.match(css, /\.hu-pwa-app-header|app-header-height/);
    assert.match(css, /direct-messaging__composer/);
    assert.match(css, /hu-assistant-modal__composer/);
    assert.doesNotMatch(css, /home-indicator|Home Indicator/i);
    const allCss = readWeb("features/pwa/pwa.css") + css;
    assert.doesNotMatch(allCss, /fake-home|ios-home-bar/i);
  });

  it("30–38 — service worker privacy denylist, static allowlist, offline fallback", () => {
    const sw = readPublic("sw.js");
    const offline = readPublic("offline.html");
    for (const prefix of [
      "/api/v1/direct-messages",
      "/api/v1/notifications",
      "/api/v1/preferences",
      "/api/v1/workspace",
      "/api/v1/assistant",
      "/api/v1/shared-documents",
      "/api/v1/blog",
      "/api/v1/initiatives",
    ]) {
      assert.match(sw, new RegExp(prefix.replace(/\//g, "\\/")));
    }
    assert.match(sw, /hu_access_token/);
    assert.match(sw, /Authorization/);
    assert.match(sw, /isPrivateApiRequest/);
    assert.match(sw, /\/brand\//);
    assert.match(sw, /OFFLINE_URL/);
    assert.doesNotMatch(sw, /\.skipWaiting\s*\(/);
    assert.match(offline, /You're offline/);
    assert.match(offline, /Try Again/);
  });

  it("39–45 — auth-only workspace, session policy, no localStorage auth regression", () => {
    const gate = readWeb("features/auth/components/WorkspaceAuthGate.tsx");
    assert.match(gate, /returnTo/);
    assert.match(gate, /\/login\?returnTo=/);
    const authConfig = readRepo("apps/api/src/config/auth.config.ts");
    assert.match(authConfig, /jwtRefreshExpiresIn[\s\S]*30d/);
    const cookies = readRepo("apps/api/src/modules/auth/auth-session.cookies.ts");
    assert.match(cookies, /30 \* 86_400_000/);
    const store = readWeb("features/auth/auth-token-store.ts");
    assert.doesNotMatch(store, /localStorage\.setItem/);
    assert.equal(isStandaloneDisplayMode(), false);
    assert.equal(resolvePresentationMode(), "browser");
  });

  it("Home 50/50 install promotion uses one section with App column", () => {
    const section = readWeb(
      "features/public-home-v2/components/PublicHomeEcosystemStatementSection.tsx",
    );
    assert.match(section, /public-home-v2__ecosystem-split/);
    assert.match(section, /PwaInstallPromotion/);
    assert.doesNotMatch(section, /public-home-v2__section public-home-v2__section/);
    const promo = readWeb("features/pwa/components/PwaInstallPromotion.tsx");
    assert.match(promo, /Humanity Union App/);
    assert.doesNotMatch(promo, /Progressive Web App|Hybrid App/);
  });

  it("Initiative Feed is a projection (no PwaInitiative domain)", () => {
    const feed = readWeb("features/pwa/components/PwaInitiativeFeed.tsx");
    assert.match(feed, /priority_match/);
    assert.match(feed, /fetchWorldInitiativesProjection/);
    assert.match(feed, /reasons\[0\]\?\.message/);
    assert.doesNotMatch(feed, /MobileInitiative|AppFeedInitiative/);
    assert.doesNotMatch(feed, /(?:interface|type|class)\s+PwaInitiative\b/);
  });

  it("theme / apple web-app metadata wired", () => {
    const layout = readWeb("app/layout.tsx");
    assert.match(layout, /themeColor:\s*"#0174b0"/);
    assert.match(layout, /appleWebApp/);
    assert.match(layout, /viewportFit:\s*"cover"/);
    assert.match(layout, /apple-touch-icon/);
  });

  it("architecture documentation exists", () => {
    assert.ok(
      existsSync(
        path.join(repoRoot, "project/architecture/pwa/PWA_MOBILE_EXPERIENCE_v1.0.md"),
      ),
    );
  });
});
