/**
 * Pack 22E.2 — Admin Notification header widget & inline panel.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  formatAdminNotificationDate,
  resolveAdminNotificationTypeLabel,
} from "../administration/admin-notification-labels.js";

const dir = path.dirname(fileURLToPath(import.meta.url));
const webSrc = path.resolve(dir, "../..");

function readWeb(relativePath: string): string {
  return readFileSync(path.join(webSrc, relativePath), "utf8");
}

describe("Pack 22E.2 — Admin Notification widget & panel", () => {
  it("1–2. Admin layout uses headerBar with AdminWorkspaceHeader only", () => {
    const layout = readWeb("app/admin/layout.tsx");
    assert.match(layout, /headerBar=/);
    assert.match(layout, /AdminWorkspaceHeader/);
    assert.doesNotMatch(layout, /useUnreadNotificationCount|HeaderNotificationsLink/);

    const workspaceHome = readWeb("app/workspace/WorkspaceHomePage.tsx");
    assert.doesNotMatch(workspaceHome, /AdminWorkspaceHeader|admin-workspace-header/);
    const memberWorkspace = readWeb("components/member/MemberWorkspace.tsx");
    assert.doesNotMatch(memberWorkspace, /AdminWorkspaceHeader|attention\.png/);
  });

  it("3–6. widget uses attention icon, Notification label, conditional count", () => {
    const header = readWeb("features/administration/components/AdminWorkspaceHeader.tsx");
    assert.match(header, /\/icons\/messenger\/attention\.png/);
    assert.match(header, />Notification</);
    assert.match(header, /count > 0/);
    assert.match(header, /admin-workspace-header__count/);
    assert.doesNotMatch(header, /99\+/);
  });

  it("7–8. click toggles panel; aria-expanded and aria-controls wired", () => {
    const header = readWeb("features/administration/components/AdminWorkspaceHeader.tsx");
    assert.match(header, /aria-expanded=\{open\}/);
    assert.match(header, /aria-controls=\{panelId\}/);
    assert.match(header, /handleToggle|setOpen/);
    assert.match(header, /const next = !open/);
  });

  it("9–12. panel loads Admin API; labels; targetHref navigation", () => {
    const header = readWeb("features/administration/components/AdminWorkspaceHeader.tsx");
    const api = readWeb("features/administration/admin-notification-api.ts");
    assert.match(api, /\/api\/v1\/admin\/notifications/);
    assert.match(api, /\/api\/v1\/admin\/notifications\/count/);
    assert.match(api, /method:\s*"DELETE"/);
    assert.doesNotMatch(api, /\/api\/v1\/notifications/);
    assert.match(header, /fetchAdminNotifications/);
    assert.match(header, /fetchAdminNotificationCount/);
    assert.match(header, /notification\.targetHref/);
    assert.match(header, /<Link href=\{href\}/);
    assert.match(header, /notification\.actorLabel/);
    assert.match(header, /notification\.targetLabel/);

    assert.equal(
      resolveAdminNotificationTypeLabel({
        type: "blog_post_published",
        title: "New Blog publication",
      }),
      "New Blog publication",
    );
    assert.equal(
      resolveAdminNotificationTypeLabel({
        type: "public_choice_published",
        title: "x",
      }),
      "New Public Choice",
    );
    assert.ok(formatAdminNotificationDate("2026-08-01T12:00:00.000Z").length > 0);
  });

  it("13–17. clear uses cross.svg; stopPropagation; delete updates; failure preserves", () => {
    const header = readWeb("features/administration/components/AdminWorkspaceHeader.tsx");
    assert.match(header, /\/icons\/workspace\/cross\.svg/);
    assert.match(header, /event\.stopPropagation\(\)/);
    assert.match(header, /event\.preventDefault\(\)/);
    assert.match(header, /deleteAdminNotification/);
    assert.match(header, /filter\(\(row\) => row\.adminNotificationId !==/);
    assert.match(header, /await refreshCount\(\)/);
    // Failure path keeps row (no optimistic remove before await)
    const clearFn = header.slice(header.indexOf("async function handleClear"));
    const awaitDelete = clearFn.indexOf("await deleteAdminNotification");
    const filterIdx = clearFn.indexOf("setNotifications");
    assert.ok(awaitDelete > 0 && filterIdx > awaitDelete);
    assert.match(clearFn, /setClearError/);
  });

  it("18–20. empty state, bounded scroll, responsive CSS", () => {
    const header = readWeb("features/administration/components/AdminWorkspaceHeader.tsx");
    const css = readWeb("features/administration/components/admin-workspace-header.css");
    assert.match(header, /No notifications/);
    assert.match(css, /max-height:\s*45vh/);
    assert.match(css, /overflow-y:\s*auto/);
    assert.match(css, /@media \(max-width:\s*768px\)/);
  });

  it("21–24. no Participant notification / PWA / ops coupling in widget UI", () => {
    const header = readWeb("features/administration/components/AdminWorkspaceHeader.tsx");
    const labels = readWeb("features/administration/admin-notification-labels.ts");
    for (const src of [header, labels]) {
      assert.doesNotMatch(src, /useUnreadNotificationCount/);
      assert.doesNotMatch(src, /\/api\/v1\/notifications/);
      assert.doesNotMatch(src, /member_notifications/);
      assert.doesNotMatch(src, /dispatchNotificationsChanged/);
      assert.doesNotMatch(src, /syncPwaAppBadgeFromUnreadCount|pwa-app-badge/);
    }
    // Widget does not evaluate health itself (Pack 22E.3 Diagnostics does).
    assert.doesNotMatch(header, /evaluateAdminOperationalAlerts|fetchApiHealth/);
    const api = readWeb("features/administration/admin-notification-api.ts");
    assert.doesNotMatch(api, /useUnreadNotificationCount|pwa-app-badge|member_notifications/);
    assert.doesNotMatch(api, /\/api\/v1\/notifications[^/]/);
  });

  it("presentation mapping covers Pack 22E.1 types", () => {
    assert.equal(
      resolveAdminNotificationTypeLabel({ type: "participant_registered", title: "" }),
      "New Participant",
    );
    assert.equal(
      resolveAdminNotificationTypeLabel({ type: "blog_subscriber_confirmed", title: "" }),
      "New Blog subscriber",
    );
    assert.equal(
      resolveAdminNotificationTypeLabel({ type: "initiative_published", title: "" }),
      "New Initiative",
    );
  });
});
