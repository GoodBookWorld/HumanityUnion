"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { useClientAuthStatus } from "../../features/auth/use-client-auth-status";
import { fetchUnreadNotificationCount } from "../../features/notifications/api";
import { isAuthenticationRequiredError } from "../../lib/api-client";

/** Legacy — prefer HeaderNotificationsLink. Pack 07: session-based. */
export function NotificationHeaderLink() {
  const authStatus = useClientAuthStatus();
  const [unreadCount, setUnreadCount] = useState<number | null>(null);

  useEffect(() => {
    if (authStatus !== "authenticated") {
      setUnreadCount(null);
      return;
    }

    let cancelled = false;

    void fetchUnreadNotificationCount()
      .then((count) => {
        if (!cancelled) {
          setUnreadCount(count);
        }
      })
      .catch((error) => {
        if (!cancelled && !isAuthenticationRequiredError(error)) {
          setUnreadCount(0);
        }

        if (!cancelled && isAuthenticationRequiredError(error)) {
          setUnreadCount(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [authStatus]);

  if (authStatus !== "authenticated") {
    return null;
  }

  const label =
    unreadCount && unreadCount > 0
      ? `Notifications, ${unreadCount} unread`
      : "Notifications";

  return (
    <Link href="/notifications" className="humanity-header__utility-link" aria-label={label}>
      Notifications
      {unreadCount && unreadCount > 0 ? (
        <span className="humanity-header__badge" aria-hidden="true">
          {unreadCount > 99 ? "99+" : unreadCount}
        </span>
      ) : null}
    </Link>
  );
}
