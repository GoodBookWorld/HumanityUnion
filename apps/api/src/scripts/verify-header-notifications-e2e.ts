/**
 * Header notification icons and truthful unread count verification.
 * Run: npm run verify:header-notifications
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(SCRIPT_PATH), "../../../..");

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function readRepoFile(relativePath: string): string {
  return fs.readFileSync(path.join(REPO_ROOT, relativePath), "utf-8");
}

function fileExists(relativePath: string): boolean {
  return fs.existsSync(path.join(REPO_ROOT, relativePath));
}

function verifyHeaderIcons(): void {
  console.log("1. Authenticated header icon links");

  const utility = readRepoFile("apps/web/src/design-system/components/HeaderAuthUtility.tsx");
  const tools = readRepoFile("apps/web/src/design-system/components/AuthenticatedHeaderTools.tsx");
  const layoutCss = readRepoFile("apps/web/src/design-system/layout.css");
  const mobileMenu = readRepoFile(
    "apps/web/src/design-system/components/HumanityHeaderMobileMenu.tsx",
  );

  assert(utility.includes("AuthenticatedHeaderTools"), "Header auth utility must render icon tools");
  assert(!utility.includes("Workspace"), "Desktop header utility must not render Workspace text");
  assert(!utility.includes("Notifications"), "Desktop header utility must not render Notifications text");
  assert(tools.includes("HeaderWorkspaceLink"), "Authenticated tools must include workspace icon");
  assert(
    tools.includes("HeaderNotificationsLink"),
    "Authenticated tools must include notifications icon",
  );
  assert(
    tools.includes("/icons/workspace/work.svg"),
    "Workspace icon must use local work.svg asset",
  );
  assert(
    tools.includes("/icons/workspace/icons8-notification.svg"),
    "Notifications icon must use local notification asset",
  );
  assert(tools.includes('href="/workspace"'), "Workspace icon must link to /workspace");
  assert(tools.includes('href="/notifications"'), "Notifications icon must link to /notifications");
  assert(tools.includes('aria-label="Workspace"'), "Workspace icon must expose aria-label");
  assert(tools.includes('title="Workspace"'), "Workspace icon must expose tooltip title");
  const workspaceSection = tools.split("export function HeaderNotificationsLink")[0] ?? "";
  assert(
    !workspaceSection.includes("humanity-header__notification-badge"),
    "Workspace link must not include notification badge markup",
  );
  assert(
    layoutCss.includes(".humanity-header__icon-link"),
    "Header icon link styles must exist",
  );
  assert(
    layoutCss.includes(".humanity-header__notification-status-dot"),
    "Zero-state green dot styles must exist",
  );
  assert(
    layoutCss.includes(".humanity-header__notification-badge"),
    "Unread badge styles must exist",
  );
  assert(mobileMenu.includes("Workspace"), "Mobile menu must keep Workspace text label");
  assert(mobileMenu.includes("Notifications"), "Mobile menu must keep Notifications text label");
  assert(
    mobileMenu.includes("/icons/workspace/work.svg"),
    "Mobile menu may show workspace icon beside label",
  );
  assert(
    mobileMenu.includes("/icons/workspace/icons8-notification.svg"),
    "Mobile menu may show notifications icon beside label",
  );
  assert(fileExists("apps/web/public/icons/workspace/work.svg"), "work.svg asset must exist");
  assert(
    fileExists("apps/web/public/icons/workspace/icons8-notification.svg"),
    "icons8-notification.svg asset must exist",
  );
}

function verifyUnreadCountBehavior(): void {
  console.log("2. Truthful unread count hook");

  const hook = readRepoFile("apps/web/src/features/notifications/use-unread-notification-count.ts");
  const tools = readRepoFile("apps/web/src/design-system/components/AuthenticatedHeaderTools.tsx");
  const events = readRepoFile("apps/web/src/features/notifications/notification-events.ts");
  const center = readRepoFile(
    "apps/web/src/features/notifications/components/NotificationCenterPageContent.tsx",
  );

  assert(
    hook.includes("fetchUnreadNotificationCount"),
    "Unread count hook must call dedicated unread-count endpoint",
  );
  assert(hook.includes("NOTIFICATIONS_CHANGED_EVENT"), "Unread count hook must listen for refresh event");
  assert(hook.includes("setHasError(true)"), "Unread count hook must hide indicator on API failure");
  assert(
    !hook.includes("setUnreadCount(0)") || hook.includes("setUnreadCount(null)"),
    "Unread count hook must not invent zero on failure",
  );
  assert(
    tools.includes("Notifications, no unread notifications"),
    "Zero unread must use accessible label without announcing zero",
  );
  assert(tools.includes("99+"), "Unread badge must cap display at 99+");
  assert(
    tools.includes("humanity-header__notification-status-dot"),
    "Zero unread must render green dot indicator",
  );
  assert(events.includes("dispatchNotificationsChanged"), "Notification refresh event must exist");
  assert(
    center.includes("dispatchNotificationsChanged"),
    "Notification center must invalidate header count after read actions",
  );
}

function verifyNotificationApi(): void {
  console.log("3. Notification API reuse");

  const routes = readRepoFile("apps/api/src/modules/notifications/notification.routes.ts");
  const webApi = readRepoFile("apps/web/src/features/notifications/api.ts");

  assert(routes.includes('"/unread-count"'), "API must expose unread-count endpoint");
  assert(routes.includes('"/read-all"'), "API must expose mark-all-read endpoint");
  assert(routes.includes('"/:notificationId/read"'), "API must expose mark-one-read endpoint");
  assert(routes.includes("requireJwtAuthenticationMiddleware"), "Notification routes must require JWT");
  assert(webApi.includes("/api/v1/notifications/unread-count"), "Web client must use unread-count endpoint");
}

function verifyCommentProducers(): void {
  console.log("4. Comment notification producers");

  const servicePath = "apps/api/src/modules/initiative-comments/initiative-comment.service.ts";
  const routesPath = "apps/api/src/modules/initiative-comments/initiative-comment.routes.ts";
  const producerPath =
    "apps/api/src/modules/notifications/initiative-comment-notifications.service.ts";
  const types = readRepoFile("packages/types/src/domain/capability02-integration.ts");

  const commentServiceContent = readRepoFile(servicePath);
  const routes = readRepoFile(routesPath);
  const producer = readRepoFile(producerPath);

  assert(
    commentServiceContent.includes("emitInitiativeCommentNotifications"),
    "Comment service must emit notifications after create",
  );
  assert(routes.includes("createInitiativeCommentWithNotifications"), "Comment route must create notifications");
  assert(routes.includes("parentCommentId"), "Comment route must accept parentCommentId for replies");
  assert(producer.includes("initiative_comment_posted"), "Comment producer must handle new comments");
  assert(producer.includes("initiative_comment_reply"), "Comment producer must handle replies");
  assert(producer.includes("actorMemberId"), "Comment producer must skip self-actions");
  assert(types.includes("initiative_comment_posted"), "Types must register comment posted event");
  assert(types.includes("initiative_comment_reply"), "Types must register comment reply event");
}

function main(): void {
  verifyHeaderIcons();
  verifyUnreadCountBehavior();
  verifyNotificationApi();
  verifyCommentProducers();

  console.log("\nverify:header-notifications PASS");
}

void main();
