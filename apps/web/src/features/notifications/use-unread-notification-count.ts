"use client";

import { useCallback, useEffect, useState } from "react";

import { AUTH_STATE_CHANGED_EVENT } from "../auth/auth-events";
import { useClientAuthStatus } from "../auth/use-client-auth-status";
import { isAuthenticationRequiredError } from "../../lib/api-client";

import { fetchUnreadNotificationCount } from "./api";
import { NOTIFICATIONS_CHANGED_EVENT } from "./notification-events";

export interface UnreadNotificationCountState {
  unreadCount: number | null;
  hasError: boolean;
  refresh: () => void;
}

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

    window.addEventListener(NOTIFICATIONS_CHANGED_EVENT, handleNotificationsChanged);
    window.addEventListener(AUTH_STATE_CHANGED_EVENT, handleAuthStateChanged);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener(NOTIFICATIONS_CHANGED_EVENT, handleNotificationsChanged);
      window.removeEventListener(AUTH_STATE_CHANGED_EVENT, handleAuthStateChanged);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [authStatus, refresh]);

  return { unreadCount, hasError, refresh };
}
