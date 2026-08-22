"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef } from "react";

import { useOptionalHumanityUnionAssistant } from "../../humanity-union-assistant/assistant-context";
import { resolveAssistantLaunchContext } from "../../humanity-union-assistant/resolve-assistant-surface";
import { useUnreadNotificationCount } from "../../notifications/use-unread-notification-count";

function formatBadge(count: number): string {
  if (count > 99) {
    return "99+";
  }
  return String(count);
}

export function PwaBottomNav() {
  const pathname = usePathname() ?? "/";
  const assistant = useOptionalHumanityUnionAssistant();
  const assistantButtonRef = useRef<HTMLButtonElement>(null);
  const { unreadCount: unreadCountRaw } = useUnreadNotificationCount();
  const unreadCount = unreadCountRaw ?? 0;

  const workspaceCurrent = pathname === "/workspace";
  const initiativesCurrent =
    pathname === "/initiatives" || pathname.startsWith("/initiatives/");
  const notificationsCurrent =
    pathname === "/notifications" || pathname.startsWith("/notifications/");

  return (
    <nav className="hu-pwa-bottom-nav" aria-label="App">
      <Link
        href="/workspace"
        className="hu-pwa-bottom-nav__item"
        aria-current={workspaceCurrent ? "page" : undefined}
      >
        <img
          className="hu-pwa-bottom-nav__icon"
          src="/icons/messenger/work-mob.svg"
          alt=""
          width={36}
          height={36}
          aria-hidden="true"
        />
        Workspace
      </Link>

      <Link
        href="/initiatives"
        className="hu-pwa-bottom-nav__item"
        aria-current={initiativesCurrent ? "page" : undefined}
      >
        <img
          className="hu-pwa-bottom-nav__icon"
          src="/icons/messenger/init-mob.svg"
          alt=""
          width={36}
          height={36}
          aria-hidden="true"
        />
        Initiatives
      </Link>

      <Link
        href="/initiatives/create"
        className="hu-pwa-bottom-nav__item"
        aria-label="Create Initiative"
      >
        <img
          className="hu-pwa-bottom-nav__icon"
          src="/icons/messenger/add-mob.svg"
          alt=""
          width={36}
          height={36}
          aria-hidden="true"
        />
        Create
      </Link>

      <Link
        href="/notifications"
        className="hu-pwa-bottom-nav__item"
        aria-current={notificationsCurrent ? "page" : undefined}
        aria-label={
          unreadCount > 0
            ? `Notifications, ${unreadCount} unread`
            : "Notifications"
        }
      >
        <img
          className="hu-pwa-bottom-nav__icon"
          src="/icons/messenger/not-mob.svg"
          alt=""
          width={36}
          height={36}
          aria-hidden="true"
        />
        {unreadCount > 0 ? (
          <span className="hu-pwa-bottom-nav__badge" aria-hidden="true">
            {formatBadge(unreadCount)}
          </span>
        ) : null}
        Notifications
      </Link>

      <button
        ref={assistantButtonRef}
        type="button"
        className="hu-pwa-bottom-nav__item"
        aria-label="Open Humanity Union Assistant"
        aria-haspopup="dialog"
        aria-expanded={assistant?.isOpen ?? false}
        onClick={() => {
          if (!assistant) {
            return;
          }
          const launch = resolveAssistantLaunchContext(pathname, "");
          assistant.openAssistant({
            ...launch,
            returnFocusRef: assistantButtonRef,
          });
        }}
      >
        <img
          className="hu-pwa-bottom-nav__icon"
          src="/icons/messenger/ai-mob.svg"
          alt=""
          width={36}
          height={36}
          aria-hidden="true"
        />
        Assistant
      </button>
    </nav>
  );
}
