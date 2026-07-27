"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { getStoredAccessToken } from "../../features/auth/auth-token-store";
import { fetchUnreadNotificationCount } from "../../features/notifications/api";
import { isAuthenticationRequiredError } from "../../lib/api-client";

export function NotificationHeaderLink() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [unreadCount, setUnreadCount] = useState<number | null>(null);

  useEffect(() => {
    const hasToken = Boolean(getStoredAccessToken());
    setIsAuthenticated(hasToken);

    if (!hasToken) {
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
          setIsAuthenticated(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (!isAuthenticated) {
    return null;
  }

  return (
    <Link
      href="/notifications"
      className="humanity-header__utility-link humanity-header__notification-link"
      aria-label={
        unreadCount && unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"
      }
    >
      Notifications
      {unreadCount && unreadCount > 0 ? (
        <span className="humanity-header__notification-badge" aria-hidden="true">
          {unreadCount > 99 ? "99+" : unreadCount}
        </span>
      ) : null}
    </Link>
  );
}
