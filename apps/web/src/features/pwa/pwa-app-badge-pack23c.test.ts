/**
 * Pack 23C — PWA App Icon Badge runtime diagnostic & minimal hardening.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  clearPwaAppBadge,
  getLastPwaAppBadgeDiagnostic,
  inspectPwaAppBadgeCapability,
  isAppBadgeSupported,
  resetLastPwaAppBadgeDiagnostic,
  setPwaAppBadge,
  syncPwaAppBadgeFromUnreadCount,
} from "../pwa/pwa-app-badge.js";

const dir = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(dir, "../..");

function readWeb(relativePath: string): string {
  return readFileSync(path.join(webRoot, relativePath), "utf8");
}

function createMockBadgeNavigator(input?: {
  setReject?: boolean;
  clearReject?: boolean;
  omitSet?: boolean;
  omitClear?: boolean;
}) {
  const calls: { set: number[]; clear: number } = { set: [], clear: 0 };
  const nav: {
    setAppBadge?: (n?: number) => Promise<void>;
    clearAppBadge?: () => Promise<void>;
  } = {};

  if (!input?.omitSet) {
    nav.setAppBadge = async (n?: number) => {
      if (input?.setReject) {
        throw new Error("setAppBadge denied");
      }
      calls.set.push(typeof n === "number" ? n : -1);
    };
  }
  if (!input?.omitClear) {
    nav.clearAppBadge = async () => {
      if (input?.clearReject) {
        throw new Error("clearAppBadge denied");
      }
      calls.clear += 1;
    };
  }

  return { nav: nav as Navigator, calls };
}

describe("Pack 23C — PWA App Icon Badge runtime diagnostic", () => {
  it("1 — standalone + supported API → setAppBadge called", async () => {
    resetLastPwaAppBadgeDiagnostic();
    const { nav, calls } = createMockBadgeNavigator();
    const result = await syncPwaAppBadgeFromUnreadCount({
      unreadCount: 4,
      authenticated: true,
      isStandalone: true,
      navigator: nav,
      notificationPermission: "granted",
    });
    assert.equal(result, "applied");
    assert.deepEqual(calls.set, [4]);
    const diag = getLastPwaAppBadgeDiagnostic();
    assert.ok(diag);
    assert.equal(diag!.setAppBadgeReached, true);
    assert.equal(diag!.apiOutcome, "resolved");
  });

  it("2 — unread > 0 → correct count", async () => {
    const { nav, calls } = createMockBadgeNavigator();
    await syncPwaAppBadgeFromUnreadCount({
      unreadCount: 17,
      authenticated: true,
      isStandalone: true,
      navigator: nav,
    });
    assert.deepEqual(calls.set, [17]);
  });

  it("3 — unread = 0 → clearAppBadge", async () => {
    const { nav, calls } = createMockBadgeNavigator();
    assert.equal(
      await syncPwaAppBadgeFromUnreadCount({
        unreadCount: 0,
        authenticated: true,
        isStandalone: true,
        navigator: nav,
      }),
      "cleared",
    );
    assert.equal(calls.clear, 1);
    assert.equal(getLastPwaAppBadgeDiagnostic()?.clearAppBadgeReached, true);
  });

  it("4 — browser mode → no OS badge call", async () => {
    const { nav, calls } = createMockBadgeNavigator();
    assert.equal(
      await syncPwaAppBadgeFromUnreadCount({
        unreadCount: 8,
        authenticated: true,
        standaloneOnly: true,
        isStandalone: false,
        navigator: nav,
      }),
      "not_standalone",
    );
    assert.deepEqual(calls.set, []);
    assert.equal(calls.clear, 0);
  });

  it("5 — unsupported API → unsupported result (installed ≠ supported)", async () => {
    const capability = inspectPwaAppBadgeCapability({
      navigator: {} as Navigator,
      isStandalone: true,
    });
    assert.equal(capability.standalone, true);
    assert.equal(capability.badgeApiSupported, false);
    assert.equal(capability.setAppBadgePresent, false);

    const result = await syncPwaAppBadgeFromUnreadCount({
      unreadCount: 2,
      authenticated: true,
      isStandalone: true,
      navigator: {} as Navigator,
    });
    assert.equal(result, "unsupported");
    assert.equal(getLastPwaAppBadgeDiagnostic()?.apiOutcome, "unsupported");
    assert.equal(getLastPwaAppBadgeDiagnostic()?.setAppBadgeReached, false);
  });

  it("6 — API rejection → safe diagnostic result", async () => {
    const { nav } = createMockBadgeNavigator({ setReject: true });
    assert.equal(
      await syncPwaAppBadgeFromUnreadCount({
        unreadCount: 3,
        authenticated: true,
        isStandalone: true,
        navigator: nav,
      }),
      "api_error",
    );
    assert.equal(getLastPwaAppBadgeDiagnostic()?.apiOutcome, "rejected");
  });

  it("7 — login sync (authenticated + count → applied)", async () => {
    const { nav, calls } = createMockBadgeNavigator();
    await syncPwaAppBadgeFromUnreadCount({
      unreadCount: null,
      authenticated: true,
      isStandalone: true,
      navigator: nav,
    });
    assert.equal(getLastPwaAppBadgeDiagnostic()?.result, "preserved");

    await syncPwaAppBadgeFromUnreadCount({
      unreadCount: 1,
      authenticated: true,
      isStandalone: true,
      navigator: nav,
    });
    assert.deepEqual(calls.set, [1]);
  });

  it("8 — logout clear", async () => {
    const { nav, calls } = createMockBadgeNavigator();
    await syncPwaAppBadgeFromUnreadCount({
      unreadCount: 5,
      authenticated: true,
      isStandalone: true,
      navigator: nav,
    });
    assert.equal(
      await syncPwaAppBadgeFromUnreadCount({
        unreadCount: null,
        authenticated: false,
        isStandalone: true,
        navigator: nav,
      }),
      "cleared",
    );
    assert.equal(calls.clear, 1);
  });

  it("9 — pageshow sync wired in canonical hook", () => {
    const hook = readWeb("features/notifications/use-unread-notification-count.ts");
    assert.match(hook, /pageshow/);
    assert.match(hook, /handlePageShow/);
    assert.match(hook, /syncPwaAppBadgeFromUnreadCount/);
  });

  it("10 — visibility sync wired", () => {
    const hook = readWeb("features/notifications/use-unread-notification-count.ts");
    assert.match(hook, /visibilitychange/);
    assert.match(hook, /document\.visibilityState === "visible"/);
  });

  it("11 — polling sync wired (single 30s loop)", () => {
    const hook = readWeb("features/notifications/use-unread-notification-count.ts");
    assert.match(hook, /UNREAD_COUNT_FOREGROUND_POLL_MS\s*=\s*30_000/);
    assert.match(hook, /setInterval\(tick,\s*UNREAD_COUNT_FOREGROUND_POLL_MS\)/);
    assert.equal((hook.match(/setInterval/g) ?? []).length, 1);
  });

  it("12 — DM/member-notification path remains canonical", () => {
    const dmNotify = readFileSync(
      path.resolve(
        webRoot,
        "../../api/src/modules/direct-messaging/direct-messaging-notifications.ts",
      ),
      "utf8",
    );
    assert.match(dmNotify, /direct_message_received/);
    assert.match(dmNotify, /createNotification/);
    assert.doesNotMatch(dmNotify, /setAppBadge|PushManager|VAPID/);
  });

  it("13 — no second unread counter", () => {
    const hook = readWeb("features/notifications/use-unread-notification-count.ts");
    assert.doesNotMatch(hook, /fetchDmUnread|directMessageUnreadCount|dmUnread/);
    assert.match(hook, /fetchUnreadNotificationCount/);
  });

  it("14 — manifest/install path unchanged unless required", () => {
    const manifest = readWeb("app/manifest.ts");
    assert.match(manifest, /display:\s*"standalone"/);
    assert.match(manifest, /start_url:\s*"\/workspace"/);
    assert.doesNotMatch(manifest, /setAppBadge|badging/i);
  });

  it("15 — no Web Push added", () => {
    const badge = readWeb("features/pwa/pwa-app-badge.ts");
    assert.doesNotMatch(badge, /PushManager|VAPID|showNotification|pushmanager/i);
    const sw = readFileSync(path.resolve(webRoot, "../public/sw.js"), "utf8");
    assert.doesNotMatch(sw, /PushManager|VAPID|showNotification/i);
  });

  it("16 — Pack 22B.1 regression smoke", async () => {
    assert.equal(isAppBadgeSupported({} as Navigator), false);
    await assert.doesNotReject(() => setPwaAppBadge(2, {} as Navigator));
    await assert.doesNotReject(() => clearPwaAppBadge({} as Navigator));
  });

  it("17 — Pack 22H regression smoke (permission-aware diagnostic)", async () => {
    const { nav } = createMockBadgeNavigator();
    await syncPwaAppBadgeFromUnreadCount({
      unreadCount: 2,
      authenticated: true,
      isStandalone: true,
      navigator: nav,
      notificationPermission: "denied",
    });
    const diag = getLastPwaAppBadgeDiagnostic();
    assert.equal(diag?.result, "applied");
    assert.equal(diag?.badgeMayBeHiddenByOsOrPermission, true);
    assert.equal(diag?.capability.notificationPermission, "denied");
  });

  it("18 — Pack 23B footer-badge regression", () => {
    const css = readWeb("features/pwa/pwa.css");
    assert.match(css, /\.hu-pwa-bottom-nav__badge\s*\{[^}]*--hu-color-notification-badge/s);
    const nav = readWeb("features/pwa/components/PwaBottomNav.tsx");
    assert.match(nav, /hu-pwa-bottom-nav__badge/);
    assert.match(nav, /useUnreadNotificationCount/);
  });

  it("capability helper never treats standalone alone as Badging support", () => {
    const snap = inspectPwaAppBadgeCapability({
      isStandalone: true,
      navigator: {} as Navigator,
      notificationPermission: "default",
    });
    assert.equal(snap.standalone, true);
    assert.equal(snap.badgeApiSupported, false);
  });
});
