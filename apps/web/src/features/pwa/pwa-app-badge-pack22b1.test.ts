/**
 * Pack 22B.1 — PWA App Badge from canonical unread notifications.
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

describe("Pack 22B.1 — PWA App Badge from canonical unread", () => {
  it("canonical unread count drives App Badge via useUnreadNotificationCount", () => {
    const hook = readWeb("features/notifications/use-unread-notification-count.ts");
    assert.match(hook, /fetchUnreadNotificationCount/);
    assert.match(hook, /syncPwaAppBadgeFromUnreadCount/);
    assert.match(hook, /NOTIFICATIONS_CHANGED_EVENT/);
    assert.match(hook, /visibilitychange/);
    assert.match(hook, /AUTH_STATE_CHANGED_EVENT/);
  });

  it("unreadCount > 0 calls setAppBadge with the numeric count", async () => {
    const { nav, calls } = createMockBadgeNavigator();
    await syncPwaAppBadgeFromUnreadCount({
      unreadCount: 7,
      authenticated: true,
      hasError: false,
      standaloneOnly: true,
      isStandalone: true,
      navigator: nav,
    });
    assert.deepEqual(calls.set, [7]);
    assert.equal(calls.clear, 0);
  });

  it("unreadCount === 0 calls clearAppBadge", async () => {
    const { nav, calls } = createMockBadgeNavigator();
    await syncPwaAppBadgeFromUnreadCount({
      unreadCount: 0,
      authenticated: true,
      hasError: false,
      standaloneOnly: true,
      isStandalone: true,
      navigator: nav,
    });
    assert.deepEqual(calls.set, []);
    assert.equal(calls.clear, 1);
  });

  it("unsupported Badging API fails safely", async () => {
    assert.equal(isAppBadgeSupported({} as Navigator), false);
    await assert.doesNotReject(() => setPwaAppBadge(3, {} as Navigator));
    await assert.doesNotReject(() => clearPwaAppBadge({} as Navigator));

    const { nav, calls } = createMockBadgeNavigator({ setReject: true, clearReject: true });
    await assert.doesNotReject(() =>
      syncPwaAppBadgeFromUnreadCount({
        unreadCount: 2,
        authenticated: true,
        isStandalone: true,
        navigator: nav,
      }),
    );
    await assert.doesNotReject(() =>
      syncPwaAppBadgeFromUnreadCount({
        unreadCount: 0,
        authenticated: true,
        isStandalone: true,
        navigator: nav,
      }),
    );
    // Rejecting implementations still attempted once each path; no throw escaped.
    assert.equal(calls.set.length + calls.clear, 0);
  });

  it("web notification count source remains GET /unread-count", () => {
    const api = readWeb("features/notifications/api.ts");
    const tools = readWeb("design-system/components/AuthenticatedHeaderTools.tsx");
    const nav = readWeb("features/pwa/components/PwaBottomNav.tsx");
    assert.match(api, /\/api\/v1\/notifications\/unread-count/);
    assert.match(tools, /useUnreadNotificationCount/);
    assert.match(nav, /useUnreadNotificationCount/);
    assert.doesNotMatch(api, /direct-messages\/.*unread-count|dmUnreadCount/);
  });

  it("Direct Messages remain represented through member_notifications", () => {
    const dmNotify = readFileSync(
      path.resolve(
        webRoot,
        "../../api/src/modules/direct-messaging/direct-messaging-notifications.ts",
      ),
      "utf8",
    );
    assert.match(dmNotify, /direct_message_received/);
    assert.match(dmNotify, /createNotification/);
    assert.match(dmNotify, /markNotificationsReadByRelatedEntity/);
    assert.doesNotMatch(dmNotify, /setAppBadge|dmUnreadBadge/);
  });

  it("DM read path causes canonical notification refresh", () => {
    const view = readWeb("features/direct-messaging/components/DirectConversationView.tsx");
    assert.match(view, /markDirectConversationRead/);
    assert.match(view, /dispatchNotificationsChanged/);
    const markBlocks = view.match(/markDirectConversationRead[\s\S]{0,220}dispatchNotificationsChanged/g);
    assert.ok(markBlocks && markBlocks.length >= 2);
  });

  it("notification read / mark-all-read refresh App Badge via shared event", () => {
    const center = readWeb(
      "features/notifications/components/NotificationCenterPageContent.tsx",
    );
    assert.match(center, /dispatchNotificationsChanged/);
    assert.match(center, /markAllNotificationsRead|read-all|markAll/i);
    const hook = readWeb("features/notifications/use-unread-notification-count.ts");
    assert.match(hook, /NOTIFICATIONS_CHANGED_EVENT[\s\S]*refresh/s);
    assert.match(hook, /syncPwaAppBadgeFromUnreadCount/);
  });

  it("logout clears App Badge", () => {
    const authApi = readWeb("features/auth/auth-api.ts");
    assert.match(authApi, /clearPwaAppBadge/);
    assert.match(authApi, /async function logout/);
    const logoutFn = authApi.slice(authApi.indexOf("export async function logout"));
    assert.match(logoutFn.slice(0, 900), /clearPwaAppBadge/);
  });

  it("error / null unread preserves badge; unauthenticated clears", async () => {
    const { nav, calls } = createMockBadgeNavigator();
    await syncPwaAppBadgeFromUnreadCount({
      unreadCount: null,
      authenticated: true,
      hasError: true,
      isStandalone: true,
      navigator: nav,
    });
    assert.equal(calls.set.length, 0);
    assert.equal(calls.clear, 0);

    await syncPwaAppBadgeFromUnreadCount({
      unreadCount: null,
      authenticated: false,
      isStandalone: true,
      navigator: nav,
    });
    assert.equal(calls.clear, 1);
  });

  it("standalone-only: browser tab does not set OS badge", async () => {
    const { nav, calls } = createMockBadgeNavigator();
    await syncPwaAppBadgeFromUnreadCount({
      unreadCount: 4,
      authenticated: true,
      standaloneOnly: true,
      isStandalone: false,
      navigator: nav,
    });
    assert.deepEqual(calls.set, []);
    assert.equal(calls.clear, 0);
  });

  it("no second DM unread-count API/model and no Web Push", () => {
    const sw = readFileSync(path.resolve(webRoot, "../public/sw.js"), "utf8");
    assert.doesNotMatch(sw, /pushmanager|PushSubscription|showNotification|setAppBadge/i);
    const badge = readWeb("features/pwa/pwa-app-badge.ts");
    assert.doesNotMatch(badge, /PushManager|VAPID|showNotification/);
    assert.match(badge, /NUMBER|number only|Number-only/i);
    const hook = readWeb("features/notifications/use-unread-notification-count.ts");
    assert.doesNotMatch(hook, /fetchDmUnread|directMessageUnreadCount/);
  });

  it("full unread count is used (99+ is presentation-only)", async () => {
    const { nav, calls } = createMockBadgeNavigator();
    await setPwaAppBadge(142, nav);
    assert.deepEqual(calls.set, [142]);
    const tools = readWeb("design-system/components/AuthenticatedHeaderTools.tsx");
    assert.match(tools, /99\+/);
  });
});
