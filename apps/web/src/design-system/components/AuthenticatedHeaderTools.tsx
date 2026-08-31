"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";

import { useUnreadNotificationCount } from "../../features/notifications/use-unread-notification-count";

const WORKSPACE_ICON = "/icons/workspace/work.svg";
const NOTIFICATIONS_ICON = "/icons/workspace/icons8-notification.svg";

function formatUnreadBadgeCount(unreadCount: number): string {
  return unreadCount > 99 ? "99+" : String(unreadCount);
}

export function HeaderWorkspaceLink() {
  const pathname = usePathname();
  const tNav = useTranslations("navigation");
  const workspaceLabel = tNav("workspace");
  const isActive = pathname === "/workspace" || pathname.startsWith("/workspace/");

  return (
    <Link
      href="/workspace"
      className={[
        "humanity-header__icon-link",
        isActive ? "humanity-header__icon-link--active" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      aria-label={workspaceLabel}
      title={workspaceLabel}
      aria-current={isActive ? "page" : undefined}
    >
      <Image
        src={WORKSPACE_ICON}
        alt=""
        width={22}
        height={22}
        className="humanity-header__icon-link-image"
        aria-hidden="true"
      />
    </Link>
  );
}

export function HeaderNotificationsLink() {
  const pathname = usePathname();
  const tWorkspace = useTranslations("workspace");
  const { unreadCount, hasError } = useUnreadNotificationCount();
  const isActive = pathname === "/notifications" || pathname.startsWith("/notifications/");
  const showZeroState = unreadCount === 0 && !hasError;
  const showUnreadBadge = unreadCount !== null && unreadCount > 0 && !hasError;

  function resolveNotificationsAriaLabel(): string {
    if (unreadCount === null || hasError) {
      return tWorkspace("notificationsAria");
    }

    if (unreadCount === 0) {
      return tWorkspace("notificationsNoneAria");
    }

    return tWorkspace("notificationsUnreadAria", {
      count: formatUnreadBadgeCount(unreadCount),
    });
  }

  return (
    <Link
      href="/notifications"
      className={[
        "humanity-header__icon-link",
        "humanity-header__icon-link--notifications",
        isActive ? "humanity-header__icon-link--active" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      aria-label={resolveNotificationsAriaLabel()}
      title={tWorkspace("notifications")}
      aria-current={isActive ? "page" : undefined}
    >
      <Image
        src={NOTIFICATIONS_ICON}
        alt=""
        width={22}
        height={22}
        className="humanity-header__icon-link-image"
        aria-hidden="true"
      />
      {showZeroState ? (
        <span className="humanity-header__notification-status-dot" aria-hidden="true">
          <span className="humanity-header__visually-hidden">
            {tWorkspace("noUnreadNotifications")}
          </span>
        </span>
      ) : null}
      {showUnreadBadge ? (
        <span className="humanity-header__notification-badge" aria-hidden="true">
          {formatUnreadBadgeCount(unreadCount)}
        </span>
      ) : null}
    </Link>
  );
}

/**
 * Communication UX Pack 03.3.1 Part 7 — the standalone Messages icon was
 * removed from the global header. The Notification Center is now the
 * universal communication entry point (every Direct Message notification
 * already links straight to `/workspace/messages/{conversationId}`, Part
 * 8); Messages otherwise remains reachable via Workspace → Messages. The
 * Notification Bell itself is untouched.
 */
export function AuthenticatedHeaderTools() {
  return (
    <div className="humanity-header__auth-tools">
      <HeaderWorkspaceLink />
      <HeaderNotificationsLink />
    </div>
  );
}
