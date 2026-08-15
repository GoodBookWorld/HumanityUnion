/**
 * Launch Readiness Pack 07 — browser auth credentials are HttpOnly cookies
 * managed by the API. These helpers no longer persist JWTs in Web Storage.
 *
 * Legacy localStorage keys are removed on initialization/logout so old
 * deployments cannot keep sending stolen/stale tokens.
 */

const LEGACY_ACCESS_TOKEN_KEY = "hu_access_token";
const LEGACY_REFRESH_TOKEN_KEY = "hu_refresh_token";

export function clearLegacyAuthTokenStorage(): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(LEGACY_ACCESS_TOKEN_KEY);
  window.localStorage.removeItem(LEGACY_REFRESH_TOKEN_KEY);
}

/** @deprecated Pack 07 — always null; identity comes from HttpOnly cookies. */
export function getStoredAccessToken(): string | null {
  clearLegacyAuthTokenStorage();
  return null;
}

/** @deprecated Pack 07 — always null; refresh uses HttpOnly cookie. */
export function getStoredRefreshToken(): string | null {
  clearLegacyAuthTokenStorage();
  return null;
}

/**
 * Pack 07 — browser must not persist auth tokens. Clears any legacy keys.
 * Token arguments are ignored (API may still return them for non-browser clients).
 */
export function storeAuthTokens(_accessToken?: string, _refreshToken?: string): void {
  clearLegacyAuthTokenStorage();
}

export function clearStoredAuthTokens(): void {
  clearLegacyAuthTokenStorage();
}

/** True only when legacy keys still exist (should be cleared immediately). */
export function hasLegacyAuthTokenStorage(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  return Boolean(
    window.localStorage.getItem(LEGACY_ACCESS_TOKEN_KEY) ||
      window.localStorage.getItem(LEGACY_REFRESH_TOKEN_KEY),
  );
}
