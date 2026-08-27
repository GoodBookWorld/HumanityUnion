/**
 * Pack 23B — Mobile/PWA footer Notification unread badge color (presentation only).
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

describe("Pack 23B — Mobile footer Notification badge color", () => {
  it("1 — Notification footer unread badge exists when count > 0", () => {
    const nav = read("features/pwa/components/PwaBottomNav.tsx");
    assert.match(nav, /hu-pwa-bottom-nav__badge/);
    assert.match(nav, /unreadCount > 0 \? \(/);
    assert.match(nav, /formatBadge\(unreadCount\)/);
  });

  it("2 — badge uses red/danger semantic background", () => {
    const css = read("features/pwa/pwa.css");
    assert.match(
      css,
      /\.hu-pwa-bottom-nav__badge\s*\{[^}]*background:\s*var\(--hu-color-notification-badge/s,
    );
    assert.doesNotMatch(
      css,
      /\.hu-pwa-bottom-nav__badge\s*\{[^}]*background:\s*var\(--hu-color-primary/s,
    );
    const tokens = read("design-system/tokens.css");
    assert.match(tokens, /--hu-color-notification-badge:\s*#b42318/);
  });

  it("3 — unread number remains white", () => {
    const css = read("features/pwa/pwa.css");
    assert.match(css, /\.hu-pwa-bottom-nav__badge\s*\{[^}]*color:\s*#ffffff/s);
  });

  it("4 — zero count hides badge", () => {
    const nav = read("features/pwa/components/PwaBottomNav.tsx");
    assert.match(nav, /\{unreadCount > 0 \? \([\s\S]*hu-pwa-bottom-nav__badge[\s\S]*\) : null\}/);
  });

  it("5 — 99+ behavior unchanged", () => {
    const nav = read("features/pwa/components/PwaBottomNav.tsx");
    assert.match(nav, /count > 99/);
    assert.match(nav, /return "99\+"/);
  });

  it("6 — badge position/shape contract unchanged", () => {
    const css = read("features/pwa/pwa.css");
    assert.match(css, /\.hu-pwa-bottom-nav__badge\s*\{[^}]*position:\s*absolute/s);
    assert.match(css, /\.hu-pwa-bottom-nav__badge\s*\{[^}]*top:\s*0\.15rem/s);
    assert.match(css, /\.hu-pwa-bottom-nav__badge\s*\{[^}]*right:\s*calc\(50% - 1\.55rem\)/s);
    assert.match(css, /\.hu-pwa-bottom-nav__badge\s*\{[^}]*border-radius:\s*999px/s);
    assert.match(css, /\.hu-pwa-bottom-nav__badge\s*\{[^}]*min-width:\s*1\.1rem/s);
    assert.match(css, /\.hu-pwa-bottom-nav__badge\s*\{[^}]*font-size:\s*0\.65rem/s);
  });

  it("7 — canonical unread-count hook unchanged", () => {
    const nav = read("features/pwa/components/PwaBottomNav.tsx");
    assert.match(nav, /useUnreadNotificationCount/);
    const hook = read("features/notifications/use-unread-notification-count.ts");
    assert.match(hook, /UNREAD_COUNT_FOREGROUND_POLL_MS/);
    assert.match(hook, /fetchUnreadNotificationCount/);
    const api = read("features/notifications/api.ts");
    assert.match(api, /\/api\/v1\/notifications\/unread-count/);
  });

  it("8 — PWA App Badge logic untouched", () => {
    const hook = read("features/notifications/use-unread-notification-count.ts");
    assert.match(hook, /syncPwaAppBadgeFromUnreadCount/);
    assert.match(hook, /standaloneOnly:\s*true/);
    const badge = read("features/pwa/pwa-app-badge.ts");
    assert.match(badge, /setAppBadge|clearAppBadge|navigator\.setAppBadge/);
    const pack22b1 = read("features/pwa/pwa-app-badge-pack22b1.test.ts");
    assert.match(pack22b1, /Pack 22B\.1/);
  });

  it("9 — Admin Notification badge untouched", () => {
    const css = read("features/pwa/pwa.css");
    assert.doesNotMatch(css, /admin.*notification.*badge/i);
    const layout = read("design-system/layout.css");
    assert.match(layout, /\.humanity-header__notification-badge/);
    assert.doesNotMatch(
      layout,
      /\.humanity-header__notification-badge\s*\{[^}]*--hu-color-notification-badge/s,
    );
  });
});
