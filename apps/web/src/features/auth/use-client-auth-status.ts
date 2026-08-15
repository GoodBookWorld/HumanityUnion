"use client";

import { useEffect, useState } from "react";

import {
  getClientAuthStatusSnapshot,
  resolveClientAuthStatus,
  subscribeClientAuthStatus,
} from "./client-auth-status-resolver";

export type ClientAuthStatus = "pending" | "authenticated" | "unauthenticated";

/**
 * Launch Readiness Pack 07 — auth status from server session (HttpOnly cookies),
 * not from localStorage token presence.
 *
 * Auth Recovery Hotfix — all mounts share one single-flight resolver:
 * - session probe guest → unauthenticated (stop);
 * - auth-state events after guest settle do not restart /me+refresh;
 * - login/logout/successful refresh invalidate and re-resolve once.
 */
export function useClientAuthStatus(): ClientAuthStatus {
  const [status, setStatus] = useState<ClientAuthStatus>(() => getClientAuthStatusSnapshot());

  useEffect(() => {
    const unsubscribe = subscribeClientAuthStatus((next) => {
      setStatus(next);
    });

    void resolveClientAuthStatus().then((next) => {
      setStatus(next);
    });

    return unsubscribe;
  }, []);

  return status;
}

/** @deprecated Pack 07 — use `useClientAuthStatus()`; never infer auth from storage. */
export function hasStoredAccessToken(): boolean {
  return false;
}
