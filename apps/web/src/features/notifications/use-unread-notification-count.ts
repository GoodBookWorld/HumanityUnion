"use client";

import { useCallback, useEffect, useState } from "react";

import { AUTH_STATE_CHANGED_EVENT } from "../auth/auth-events";
import { useClientAuthStatus } from "../auth/use-client-auth-status";
import { isAuthenticationRequiredError } from "../../lib/api-client";
import { syncPwaAppBadgeFromUnreadCount } from "../pwa/pwa-app-badge";

import { fetchUnreadNotificationCount } from "./api";
import { NOTIFICATIONS_CHANGED_EVENT } from "./notification-events";

/** Pack 22H — light canonical unread refresh while foreground (not a badge-only loop). */
export const UNREAD_COUNT_FOREGROUND_POLL_MS = 30_000;

export interface UnreadNotificationCountState {
  unreadCount: number | null;
  hasError: boolean;
  refresh: () => void;
}

/**
 * Canonical unread notifications count for:
 * - website header badge
 * - PWA bottom-nav badge
 * - Pack 22B.1 / 22H OS/App icon badge (standalone + Badging API)
 *
 * Error semantics: failed fetch sets unreadCount=null and hasError=true;
 * App Badge preserves the previous OS value (does not fabricate or clear).
 * Unauthenticated / logout clears the App Badge.
 */
export function useUnreadNotificationCount(): UnreadNotificationCountState {
  const authStatus = useClientAuthStatus();
  const [unreadCount, setUnreadCount] = useState<number | null>(null);
  const [hasError, setHasError] = useState(false);

  const refresh = useCallback(() => {
    if (authStatus !== "authenticated") {
      setUnreadCount(null);
      setHasError(false);
      return;
    }

    setHasError(false);

    void fetchUnreadNotificationCount()
      .then((count) => {
        setUnreadCount(count);
      })
      .catch((error) => {
        if (isAuthenticationRequiredError(error)) {
          setUnreadCount(null);
          setHasError(false);
          return;
        }

        setHasError(true);
        setUnreadCount(null);
      });
  }, [authStatus]);

  useEffect(() => {
    if (authStatus !== "authenticated") {
      setUnreadCount(null);
      setHasError(false);
      return;
    }

    refresh();
  }, [authStatus, refresh]);

  useEffect(() => {
    if (authStatus !== "authenticated") {
      return;
    }

    function handleNotificationsChanged() {
      refresh();
    }

    function handleAuthStateChanged() {
      refresh();
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        refresh();
      }
    }

    /** Pack 22H — bfcache / resume when returning to the installed PWA. */
    function handlePageShow() {
      refresh();
    }

    window.addEventListener(NOTIFICATIONS_CHANGED_EVENT, handleNotificationsChanged);
    window.addEventListener(AUTH_STATE_CHANGED_EVENT, handleAuthStateChanged);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pageshow", handlePageShow);

    return () => {
      window.removeEventListener(NOTIFICATIONS_CHANGED_EVENT, handleNotificationsChanged);
      window.removeEventListener(AUTH_STATE_CHANGED_EVENT, handleAuthStateChanged);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pageshow", handlePageShow);
    };
  }, [authStatus, refresh]);

  // Pack 22H — while the app is foregrounded, refresh the canonical unread
  // count so Direct Message → member_notifications updates reach App Badge
  // without a separate DM unread counter or badge-only poll loop.
  useEffect(() => {
    if (authStatus !== "authenticated") {
      return;
    }

    function tick() {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") {
        return;
      }
      refresh();
    }

    const intervalId = window.setInterval(tick, UNREAD_COUNT_FOREGROUND_POLL_MS);
    return () => {
      window.clearInterval(intervalId);
    };
  }, [authStatus, refresh]);

  // Pack 22B.1 / 22H — keep OS/App badge aligned with the same canonical count.
  useEffect(() => {
    void syncPwaAppBadgeFromUnreadCount({
      unreadCount,
      authenticated: authStatus === "authenticated",
      hasError,
      standaloneOnly: true,
    });
  }, [authStatus, unreadCount, hasError]);

  return { unreadCount, hasError, refresh };
}
