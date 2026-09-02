"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
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
  const tNav = useTranslations("navigation");
  const tWorkspace = useTranslations("workspace");
  const tPwa = useTranslations("pwa");
  const tAssistant = useTranslations("initiativeExperience");
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
    <nav className="hu-pwa-bottom-nav" aria-label={tPwa("appNavAria")}>
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
        {tNav("workspace")}
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
        {tNav("initiatives")}
      </Link>

      <Link
        href="/initiatives/create"
        className="hu-pwa-bottom-nav__item"
        aria-label={tPwa("createInitiativeAria")}
      >
        <img
          className="hu-pwa-bottom-nav__icon"
          src="/icons/messenger/add-mob.svg"
          alt=""
          width={36}
          height={36}
          aria-hidden="true"
        />
        <span className="hu-pwa-bottom-nav__label">{tPwa("create")}</span>
      </Link>

      <Link
        href="/notifications"
        className="hu-pwa-bottom-nav__item"
        aria-current={notificationsCurrent ? "page" : undefined}
        aria-label={
          unreadCount > 0
            ? tWorkspace("notificationsUnreadAria", { count: formatBadge(unreadCount) })
            : tWorkspace("notificationsAria")
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
        {tWorkspace("notifications")}
      </Link>

      <button
        ref={assistantButtonRef}
        type="button"
        className="hu-pwa-bottom-nav__item"
        aria-label={tAssistant("assistant.entry.openAria")}
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
        {tAssistant("assistant.entry.shortLabel")}
      </button>
    </nav>
  );
}
