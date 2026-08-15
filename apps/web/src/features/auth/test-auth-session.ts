/**
 * Launch Readiness Pack 07 — reusable authenticated browser/session helpers
 * for later Browser/Device QA. Does not register real production accounts.
 *
 * Usage (future E2E):
 * 1. API test helper registers + confirms a Participant in an isolated DB.
 * 2. Browser context calls login via UI or POST /auth/login with credentials:include.
 * 3. Cookies are HttpOnly — assert via API /auth/session, not document.cookie.
 */

import { API_BASE_URL } from "../../lib/api-base-url";
import { clearLegacyAuthTokenStorage } from "./auth-token-store";

export interface BrowserAuthSessionProbe {
  authenticated: boolean;
  user: { id: string; email: string; displayName: string } | null;
}

export async function probeBrowserAuthSession(): Promise<BrowserAuthSessionProbe> {
  clearLegacyAuthTokenStorage();

  const response = await fetch(`${API_BASE_URL}/api/v1/auth/session`, {
    credentials: "include",
    cache: "no-store",
  });

  const body = (await response.json()) as {
    success: boolean;
    data: BrowserAuthSessionProbe;
  };

  if (!response.ok || !body.success) {
    return { authenticated: false, user: null };
  }

  return body.data;
}

export async function clearBrowserAuthSession(): Promise<void> {
  try {
    await fetch(`${API_BASE_URL}/api/v1/auth/logout`, {
      method: "POST",
      credentials: "include",
    });
  } finally {
    clearLegacyAuthTokenStorage();
  }
}

/** Assert Pack 07 invariant: auth JWTs are not in Web Storage. */
export function assertNoAuthCredentialsInWebStorage(): void {
  if (typeof window === "undefined") {
    return;
  }

  assertStorageKeyAbsent("hu_access_token");
  assertStorageKeyAbsent("hu_refresh_token");
  assertStorageKeyAbsent("hu_pending_confirmation_token");
  assertStorageKeyAbsent("hu_pending_login_two_step_token");
}

function assertStorageKeyAbsent(key: string): void {
  if (window.localStorage.getItem(key) || window.sessionStorage.getItem(key)) {
    throw new Error(`Unexpected auth credential storage key present: ${key}`);
  }
}
