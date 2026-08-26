/**
 * Pack 22H — Mobile PWA App Badge live diagnostic & hardening.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  clearPwaAppBadge,
  isAppBadgeSupported,
  setPwaAppBadge,
  syncPwaAppBadgeFromUnreadCount,
  type PwaAppBadgeSyncResult,
} from "../pwa/pwa-app-badge.js";
import {
  isIosStandaloneNavigator,
  isStandaloneDisplayMode,
  matchesInstalledDisplayMode,
} from "../pwa/presentation-mode.js";

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

function matchMediaFor(modes: readonly string[]) {
  const active = new Set(modes);
  return (query: string) => ({ matches: active.has(query) });
}

describe("Pack 22H — Mobile PWA App Badge diagnostic & hardening", () => {
  it("standalone + Badging API supported → setAppBadge called (applied)", async () => {
    const { nav, calls } = createMockBadgeNavigator();
    const result = await syncPwaAppBadgeFromUnreadCount({
      unreadCount: 3,
      authenticated: true,
      isStandalone: true,
      navigator: nav,
    });
    assert.equal(result, "applied");
    assert.deepEqual(calls.set, [3]);
  });

  it("unreadCount > 0 → correct numeric badge; unreadCount = 0 → clearAppBadge", async () => {
    const { nav, calls } = createMockBadgeNavigator();
    assert.equal(
      await syncPwaAppBadgeFromUnreadCount({
        unreadCount: 12,
        authenticated: true,
        isStandalone: true,
        navigator: nav,
      }),
      "applied",
    );
    assert.deepEqual(calls.set, [12]);

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
  });

  it("non-standalone returns not_standalone and does not touch OS badge", async () => {
    const { nav, calls } = createMockBadgeNavigator();
    const result = await syncPwaAppBadgeFromUnreadCount({
      unreadCount: 5,
      authenticated: true,
      standaloneOnly: true,
      isStandalone: false,
      navigator: nav,
    });
    assert.equal(result, "not_standalone");
    assert.deepEqual(calls.set, []);
    assert.equal(calls.clear, 0);
  });

  it("unsupported API returns unsupported", async () => {
    assert.equal(isAppBadgeSupported({} as Navigator), false);
    const result = await syncPwaAppBadgeFromUnreadCount({
      unreadCount: 2,
      authenticated: true,
      isStandalone: true,
      navigator: {} as Navigator,
    });
    assert.equal(result, "unsupported");
    assert.equal(await setPwaAppBadge(1, {} as Navigator), "unsupported");
    assert.equal(await clearPwaAppBadge({} as Navigator), "unsupported");
  });

  it("api_error is returned when Badging API rejects", async () => {
    const { nav } = createMockBadgeNavigator({ setReject: true });
    const result = await syncPwaAppBadgeFromUnreadCount({
      unreadCount: 4,
      authenticated: true,
      isStandalone: true,
      navigator: nav,
    });
    assert.equal(result, "api_error");
  });

  it("Android/Chromium-style standalone detection via display-mode media", () => {
    assert.equal(
      matchesInstalledDisplayMode(matchMediaFor(["(display-mode: standalone)"])),
      true,
    );
    assert.equal(
      isStandaloneDisplayMode({
        matchMedia: matchMediaFor(["(display-mode: standalone)"]),
        navigator: {} as Navigator,
      }),
      true,
    );
    assert.equal(
      isStandaloneDisplayMode({
        matchMedia: matchMediaFor(["(display-mode: minimal-ui)"]),
        navigator: {} as Navigator,
      }),
      true,
    );
    assert.equal(
      isStandaloneDisplayMode({
        matchMedia: matchMediaFor([]),
        navigator: {} as Navigator,
      }),
      false,
    );
  });

  it("iOS-style standalone detection via navigator.standalone", () => {
    const iosNav = { standalone: true } as Navigator & { standalone: boolean };
    assert.equal(isIosStandaloneNavigator(iosNav), true);
    assert.equal(
      isStandaloneDisplayMode({
        matchMedia: matchMediaFor([]),
        navigator: iosNav,
      }),
      true,
    );
    assert.equal(isIosStandaloneNavigator({} as Navigator), false);
  });

  it("DM creates member notification; no second DM unread counter; no Web Push", () => {
    const dmNotify = readFileSync(
      path.resolve(
        webRoot,
        "../../api/src/modules/direct-messaging/direct-messaging-notifications.ts",
      ),
      "utf8",
    );
    assert.match(dmNotify, /direct_message_received/);
    assert.match(dmNotify, /createNotification/);
    assert.doesNotMatch(dmNotify, /setAppBadge|dmUnreadBadge|PushManager/);

    const hook = readWeb("features/notifications/use-unread-notification-count.ts");
    assert.match(hook, /fetchUnreadNotificationCount/);
    assert.match(hook, /syncPwaAppBadgeFromUnreadCount/);
    assert.match(hook, /UNREAD_COUNT_FOREGROUND_POLL_MS|30_000/);
    assert.match(hook, /pageshow/);
    assert.match(hook, /visibilitychange/);
    assert.doesNotMatch(hook, /fetchDmUnread|directMessageUnreadCount|PushManager|VAPID/);

    const sw = readFileSync(path.resolve(webRoot, "../public/sw.js"), "utf8");
    assert.doesNotMatch(sw, /pushmanager|PushSubscription|showNotification|setAppBadge|VAPID/i);
  });

  it("DM conversation path refreshes canonical notifications (mark-read + poll)", () => {
    const view = readWeb("features/direct-messaging/components/DirectConversationView.tsx");
    assert.match(view, /dispatchNotificationsChanged/);
    assert.match(view, /markDirectConversationRead/);
    assert.ok(
      (view.match(/dispatchNotificationsChanged/g) ?? []).length >= 2,
      "mark-read and incoming poll should both refresh notifications",
    );
  });

  it("mark-read / mark-all-read and logout clear/sync paths remain wired", () => {
    const center = readWeb(
      "features/notifications/components/NotificationCenterPageContent.tsx",
    );
    assert.match(center, /dispatchNotificationsChanged/);
    assert.match(center, /markAllNotificationsRead|read-all|markAll/i);

    const authApi = readWeb("features/auth/auth-api.ts");
    const logoutFn = authApi.slice(authApi.indexOf("export async function logout"));
    assert.match(logoutFn.slice(0, 900), /clearPwaAppBadge/);
  });

  it("fetch error preserves badge (does not invent zero)", async () => {
    const { nav, calls } = createMockBadgeNavigator();
    const result: PwaAppBadgeSyncResult = await syncPwaAppBadgeFromUnreadCount({
      unreadCount: null,
      authenticated: true,
      hasError: true,
      isStandalone: true,
      navigator: nav,
    });
    assert.equal(result, "preserved");
    assert.equal(calls.set.length, 0);
    assert.equal(calls.clear, 0);
  });

  it("account transition: logout clears; new auth does not keep prior count via helper", async () => {
    const { nav, calls } = createMockBadgeNavigator();
    await syncPwaAppBadgeFromUnreadCount({
      unreadCount: 9,
      authenticated: true,
      isStandalone: true,
      navigator: nav,
    });
    assert.deepEqual(calls.set, [9]);

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

  it("diagnostic helper documents closed-app Push limitation without implementing Push", () => {
    const badge = readWeb("features/pwa/pwa-app-badge.ts");
    assert.match(badge, /Web Push|closed-app/i);
    assert.doesNotMatch(badge, /PushManager|VAPID|showNotification/);
    assert.match(badge, /PwaAppBadgeSyncResult|applied|not_standalone|unsupported/);
    assert.match(badge, /NUMBER|number only|Number-only/i);
  });
});
