import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  clearObsoleteInstallPreferenceKeys,
  dismissInstallPromotion,
  wasInstallPromotionDismissedRecently,
} from "./install-preference.js";
import {
  resolvePwaInstallUxState,
  type BeforeInstallPromptLike,
} from "./install-state.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const webSrc = path.resolve(here, "../..");
const webRoot = path.resolve(webSrc, "..");

function readWeb(relativeFromWebSrc: string): string {
  return readFileSync(path.join(webSrc, relativeFromWebSrc), "utf8");
}

function readPublic(relativeFromPublic: string): string {
  return readFileSync(path.join(webRoot, "public", relativeFromPublic), "utf8");
}

describe("PWA UX Correction Pack 02", () => {
  it("1–4 — guest language does not call preferences/me or refresh", () => {
    const lang = readWeb("features/language/components/DocumentLanguageAttributes.tsx");
    assert.match(lang, /useClientAuthStatus/);
    assert.match(lang, /authStatus !== "authenticated"/);
    assert.match(lang, /DEFAULT_PLATFORM_LANGUAGE/);
    assert.match(lang, /applyDocumentLanguage\(DEFAULT_PLATFORM_LANGUAGE\)/);
    const effectBody = lang.slice(lang.indexOf("useEffect"));
    const guestGuard = effectBody.indexOf('authStatus !== "authenticated"');
    const prefsCall = effectBody.indexOf("void getMyPreferences");
    assert.ok(guestGuard >= 0, "guest auth guard present in effect");
    assert.ok(prefsCall > guestGuard, "getMyPreferences only after guest guard");
  });

  it("guest/pending do not fetch workspace/home or unread-count; authenticated may", () => {
    const feed = readWeb("features/pwa/components/PwaInitiativeFeed.tsx");
    const dashboard = readWeb("features/workspace-home/components/WorkspaceHomeDashboard.tsx");
    const unread = readWeb("features/notifications/use-unread-notification-count.ts");
    const tools = readWeb("design-system/components/AuthenticatedHeaderTools.tsx");
    const headerAuth = readWeb("design-system/components/HeaderAuthUtility.tsx");

    assert.match(feed, /useClientAuthStatus/);
    assert.match(feed, /authStatus === "authenticated"/);
    assert.match(feed, /getWorkspaceHome/);
    assert.match(feed, /loadNewestPublicInitiatives|fetchWorldInitiativesProjection/);
    assert.ok(
      feed.indexOf('authStatus === "authenticated"') < feed.indexOf("getWorkspaceHome()"),
      "workspace/home only after authenticated branch",
    );

    assert.match(dashboard, /useClientAuthStatus/);
    assert.match(dashboard, /authStatus !== "authenticated"/);
    assert.ok(
      dashboard.indexOf('authStatus !== "authenticated"') < dashboard.indexOf("getWorkspaceHome()"),
      "dashboard skips private fetch until authenticated",
    );

    assert.match(unread, /authStatus !== "authenticated"/);
    assert.match(unread, /fetchUnreadNotificationCount/);
    const refreshBody = unread.slice(unread.indexOf("const refresh = useCallback"));
    assert.ok(
      refreshBody.indexOf('authStatus !== "authenticated"') >= 0 &&
        refreshBody.indexOf('authStatus !== "authenticated"') <
          refreshBody.indexOf("fetchUnreadNotificationCount"),
      "unread count gated on authenticated inside refresh",
    );

    assert.match(headerAuth, /authStatus === "unauthenticated"/);
    assert.match(headerAuth, /AuthenticatedHeaderTools/);
    assert.match(tools, /useUnreadNotificationCount/);
  });

  it("5 — burger glyph visual size ~28px with retained touch target", () => {
    const css = readWeb("features/pwa/pwa.css");
    assert.match(css, /\.hu-pwa-app-header__menu-glyph/);
    assert.match(css, /font-size:\s*1\.75rem/);
    assert.match(css, /\.hu-pwa-app-header__menu[\s\S]*width:\s*var\(--hu-touch-target\)/);
  });

  it("6–7 — Initiative feed horizontal carousel links to public Initiative", () => {
    const feed = readWeb("features/pwa/components/PwaInitiativeFeed.tsx");
    const css = readWeb("features/pwa/pwa.css");
    assert.match(feed, /hu-pwa-initiative-feed__card/);
    assert.match(feed, /publicInitiativeHref|\/initiatives\//);
    assert.match(css, /scroll-snap-type:\s*x proximity/);
    assert.match(css, /grid-auto-flow:\s*column/);
    assert.match(css, /\.hu-pwa-initiative-feed__list/);
  });

  it("8 — statistics render compact horizontal row", () => {
    const css = readWeb("features/personal-statistics/personal-statistics.css");
    assert.match(css, /grid-template-columns:\s*repeat\(3,/);
    assert.match(css, /min-height:\s*5\.5rem|min-height:\s*4\.75rem/);
    assert.doesNotMatch(
      css,
      /@media \(max-width: 480px\) \{\s*\.personal-statistics__grid \{\s*grid-template-columns: 1fr/,
    );
  });

  it("9–10 — App Header Back uses arrow asset with safe fallback", () => {
    const header = readWeb("features/pwa/components/PwaAppHeader.tsx");
    assert.match(header, /\/icons\/workspace\/arrow\.png/);
    assert.match(header, /Go back/);
    assert.match(header, /router\.back/);
    assert.match(header, /\/workspace/);
    assert.ok(existsSync(path.join(webRoot, "public/icons/workspace/arrow.png")));
  });

  it("11–12 — Workspace Drawer explicit close restores focus", () => {
    const drawer = readWeb("features/pwa/components/PwaWorkspaceDrawer.tsx");
    assert.match(drawer, /\/icons\/workspace\/cross\.svg/);
    assert.match(drawer, /Close Workspace menu/);
    assert.match(drawer, /returnFocusRef/);
    assert.match(drawer, /Escape/);
    assert.ok(existsSync(path.join(webRoot, "public/icons/workspace/cross.svg")));
  });

  it("13 — Lifecycle carousel has warm amber background container", () => {
    const css = readWeb("features/public-initiative-experience/public-initiative-experience.css");
    assert.match(css, /pie-lifecycle__list[\s\S]*--hu-color-accent|#df9815/);
    assert.match(css, /color-mix\(in srgb, var\(--hu-color-accent/);
  });

  it("14–15 — profile identity centered; statistics stay compact row", () => {
    const css = readWeb("features/member-profile/components/participant-profile-surface.css");
    assert.match(css, /public-member-page__identity-body[\s\S]*align-items:\s*center/);
    assert.match(css, /text-align:\s*center/);
    const stats = readWeb("features/personal-statistics/personal-statistics.css");
    assert.match(stats, /repeat\(3,/);
  });

  it("16–17 — authenticated App Header avatar from workspace-identity; brand paths same-origin", () => {
    const header = readWeb("features/pwa/components/PwaAppHeader.tsx");
    const media = readWeb("features/media-upload/media-url.ts");
    assert.match(header, /useClientAuthStatus/);
    assert.match(header, /getWorkspaceMemberIdentity/);
    assert.match(header, /MEMBER_PROFILE_UPDATED_EVENT/);
    assert.match(header, /HumanityAvatar/);
    assert.match(media, /\/brand\//);
    assert.match(media, /isSameOriginStaticAssetPath|same-origin/);
  });

  it("18–19 — manifest name Humanity Union; short_name Humanity", () => {
    const manifest = readWeb("app/manifest.ts");
    assert.match(manifest, /name:\s*"Humanity Union"/);
    assert.match(manifest, /short_name:\s*"Humanity"/);
  });

  it("install promotion never actionless; Later ≠ installed; SW ≠ installed", () => {
    const promo = readWeb("features/pwa/components/PwaInstallPromotion.tsx");
    const preference = readWeb("features/pwa/install-preference.ts");
    const guidance = readWeb("features/pwa/components/PwaInstallGuidance.tsx");
    const installState = readWeb("features/pwa/install-state.ts");
    const sw = readPublic("sw.js");

    assert.match(promo, /Humanity Union App/);
    assert.doesNotMatch(promo, /if \(uxState === "already_installed"\) \{\s*return null/);
    assert.match(promo, /Installed/);
    assert.match(promo, /Show install options/);
    assert.match(promo, /Install App/);
    assert.match(promo, /Add to Home Screen/);
    assert.match(promo, /How to install/);
    assert.match(promo, /handleDismiss[\s\S]*Later/);
    assert.match(promo, /clearObsoleteInstallPreferenceKeys/);
    assert.match(guidance, /How to install Humanity|Add to Home Screen/);
    assert.match(guidance, /Add Humanity Union from Safari.?s Share menu|Home Screen from the Share menu/);
    assert.match(preference, /dismissal ≠ installed|not OS install proof/i);
    assert.match(preference, /OBSOLETE_KEYS|pwaInstalled/);
    assert.doesNotMatch(preference, /localStorage\.setItem/);
    assert.doesNotMatch(installState, /serviceWorker/);
    assert.doesNotMatch(sw, /pwaInstalled/);

    const prompt = { prompt: async () => undefined } as BeforeInstallPromptLike;
    assert.equal(
      resolvePwaInstallUxState({ standalone: false, deferredPrompt: prompt }),
      "install_available",
    );
    assert.equal(
      resolvePwaInstallUxState({ standalone: true, deferredPrompt: prompt }),
      "already_installed",
    );
    const noPrompt = resolvePwaInstallUxState({ standalone: false, deferredPrompt: null });
    assert.ok(
      noPrompt === "unsupported" || noPrompt === "browser_mode" || noPrompt === "ios_add_to_home",
      `expected non-installable browser state, got ${noPrompt}`,
    );
  });

  it("22 — dismissal state is temporary session preference only", () => {
    if (typeof globalThis.sessionStorage === "undefined") {
      const memory = new Map<string, string>();
      Object.defineProperty(globalThis, "sessionStorage", {
        value: {
          getItem: (key: string) => memory.get(key) ?? null,
          setItem: (key: string, value: string) => {
            memory.set(key, value);
          },
          removeItem: (key: string) => {
            memory.delete(key);
          },
        },
        configurable: true,
      });
      Object.defineProperty(globalThis, "window", {
        value: globalThis,
        configurable: true,
      });
    }

    if (typeof globalThis.localStorage === "undefined") {
      const memory = new Map<string, string>();
      Object.defineProperty(globalThis, "localStorage", {
        value: {
          getItem: (key: string) => memory.get(key) ?? null,
          setItem: (key: string, value: string) => {
            memory.set(key, value);
          },
          removeItem: (key: string) => {
            memory.delete(key);
          },
        },
        configurable: true,
      });
    }

    globalThis.localStorage.setItem("pwaInstalled", "true");
    clearObsoleteInstallPreferenceKeys();
    assert.equal(globalThis.localStorage.getItem("pwaInstalled"), null);

    assert.equal(wasInstallPromotionDismissedRecently(), false);
    dismissInstallPromotion();
    assert.equal(wasInstallPromotionDismissedRecently(), true);
  });

  it("14 — no invalid /initiative.webp reference; Assistant FAB avoids early preload pressure", () => {
    const mini = readWeb("features/public-initiative-mini-card/PublicInitiativeMiniCard.tsx");
    const archive = readWeb(
      "features/public-civic-archive/components/PublicArchiveInitiativeMiniCard.tsx",
    );
    const fab = readWeb(
      "features/humanity-union-assistant/components/HumanityUnionAssistantFloatingButton.tsx",
    );
    assert.doesNotMatch(mini, /["']\/initiative\.webp["']/);
    assert.doesNotMatch(archive, /["']\/initiative\.webp["']/);
    assert.match(mini, /\/images\/initiatives\/initiative-default\.webp/);
    assert.match(archive, /\/images\/initiatives\/initiative-default\.webp/);
    assert.ok(existsSync(path.join(webRoot, "public/images/initiatives/initiative-default.webp")));
    assert.match(fab, /fetchPriority=["']low["']/);
    assert.match(fab, /loading=["']lazy["']/);
  });

  it("26–27 — no private SW cache / auth localStorage regression", () => {
    const sw = readPublic("sw.js");
    assert.match(sw, /PRIVATE_API_PREFIXES|isPrivateApiRequest/);
    assert.match(sw, /\/api\/v1\/preferences/);
    assert.match(sw, /hu-pwa-v2/);
    assert.doesNotMatch(sw, /pwaInstalled/);
    const store = readWeb("features/auth/auth-token-store.ts");
    assert.doesNotMatch(store, /localStorage\.setItem/);
  });
});
