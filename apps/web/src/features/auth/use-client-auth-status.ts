"use client";

import { useCallback, useEffect, useState } from "react";

import { isAuthenticationRequiredError } from "../../lib/api-client";
import { getMe } from "./auth-api";
import { AUTH_STATE_CHANGED_EVENT } from "./auth-events";
import { refreshAuthSessionOnce } from "./auth-token-refresh";
import {
  clearStoredAuthTokens,
  getStoredAccessToken,
  getStoredRefreshToken,
} from "./auth-token-store";

export type ClientAuthStatus = "pending" | "authenticated" | "unauthenticated";

export function useClientAuthStatus(): ClientAuthStatus {
  const [status, setStatus] = useState<ClientAuthStatus>("pending");

  const resolveStatus = useCallback(async () => {
    const token = getStoredAccessToken();
    const refreshToken = getStoredRefreshToken();

    if (!token && !refreshToken) {
      setStatus("unauthenticated");
      return;
    }

    try {
      await getMe();
      setStatus("authenticated");
      return;
    } catch (error) {
      if (!isAuthenticationRequiredError(error)) {
        setStatus("authenticated");
        return;
      }
    }

    try {
      const refreshed = await refreshAuthSessionOnce();

      if (refreshed) {
        await getMe();
        setStatus("authenticated");
        return;
      }

      clearStoredAuthTokens();
      setStatus("unauthenticated");
    } catch {
      clearStoredAuthTokens();
      setStatus("unauthenticated");
    }
  }, []);

  useEffect(() => {
    void resolveStatus();

    function handleAuthStateChanged() {
      void resolveStatus();
    }

    window.addEventListener(AUTH_STATE_CHANGED_EVENT, handleAuthStateChanged);

    return () => {
      window.removeEventListener(AUTH_STATE_CHANGED_EVENT, handleAuthStateChanged);
    };
  }, [resolveStatus]);

  return status;
}

export function hasStoredAccessToken(): boolean {
  return Boolean(getStoredAccessToken());
}
