import { API_BASE_URL } from "../../lib/api-base-url";
import { dispatchAuthStateChanged } from "./auth-events";
import { clearLegacyAuthTokenStorage } from "./auth-token-store";

interface RefreshResponse {
  success: boolean;
  data?: {
    user?: unknown;
    tokens?: {
      accessToken?: string;
      refreshToken?: string;
    };
  };
  message: string;
}

const GLOBAL_KEY = "__hu_auth_token_refresh_state__";

interface RefreshModuleState {
  refreshInFlight: Promise<boolean> | null;
  refreshDefinitivelyFailed: boolean;
}

function getRefreshState(): RefreshModuleState {
  const globalObject = globalThis as typeof globalThis & {
    [GLOBAL_KEY]?: RefreshModuleState;
  };

  if (!globalObject[GLOBAL_KEY]) {
    globalObject[GLOBAL_KEY] = {
      refreshInFlight: null,
      refreshDefinitivelyFailed: false,
    };
  }

  return globalObject[GLOBAL_KEY];
}

function readRefreshEnvelope(text: string, status: number): RefreshResponse {
  if (!text.trim()) {
    throw new Error(`Refresh failed with status ${status}.`);
  }

  return JSON.parse(text) as RefreshResponse;
}

/**
 * Clear failed-refresh latch so a later login can authenticate normally.
 * Call from login acceptance and logout.
 */
export function resetAuthRefreshState(): void {
  const state = getRefreshState();
  state.refreshDefinitivelyFailed = false;
  state.refreshInFlight = null;
}

/**
 * Session probe already proved guest — skip further refresh attempts until reset.
 */
export function markAuthRefreshDefinitivelyFailed(): void {
  const state = getRefreshState();
  state.refreshDefinitivelyFailed = true;
  clearLegacyAuthTokenStorage();
}

/**
 * Launch Readiness Pack 07 — refresh relies on the HttpOnly refresh cookie
 * (`credentials: "include"`). No refresh token is read from Web Storage.
 *
 * Auth Recovery Hotfix — refresh FAILURE must not dispatch auth-state-changed
 * (that re-entered useClientAuthStatus → getMe → refresh forever).
 * Only successful refresh notifies listeners that the session changed.
 */
async function performTokenRefreshRequest(notifyOnSuccess: boolean): Promise<boolean> {
  clearLegacyAuthTokenStorage();

  const response = await fetch(`${API_BASE_URL}/api/v1/auth/refresh`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
    body: JSON.stringify({}),
  });

  const text = await response.text();

  if (!response.ok) {
    return false;
  }

  const body = readRefreshEnvelope(text, response.status);

  if (!body.success) {
    return false;
  }

  // Cookies were Set-Cookie'd by the API; do not persist JSON tokens.
  clearLegacyAuthTokenStorage();
  getRefreshState().refreshDefinitivelyFailed = false;

  if (notifyOnSuccess) {
    dispatchAuthStateChanged();
  }

  return true;
}

export interface RefreshAuthSessionOptions {
  /**
   * When false, skip auth-state-changed on success (resolver already publishes).
   * Default true for api-client 401 recovery.
   */
  notifyOnSuccess?: boolean;
}

/** Deduplicated refresh — concurrent 401s share one in-flight refresh attempt. */
export async function refreshAuthSessionOnce(
  options: RefreshAuthSessionOptions = {},
): Promise<boolean> {
  const notifyOnSuccess = options.notifyOnSuccess !== false;
  const state = getRefreshState();

  if (state.refreshDefinitivelyFailed) {
    return false;
  }

  if (state.refreshInFlight) {
    return state.refreshInFlight;
  }

  state.refreshInFlight = performTokenRefreshRequest(notifyOnSuccess)
    .then((refreshed) => {
      if (!refreshed) {
        state.refreshDefinitivelyFailed = true;
        clearLegacyAuthTokenStorage();
        // Do NOT dispatch — failure settles to guest in callers; dispatching
        // would restart getMe/refresh via useClientAuthStatus listeners.
      }

      return refreshed;
    })
    .catch(() => {
      state.refreshDefinitivelyFailed = true;
      clearLegacyAuthTokenStorage();
      return false;
    })
    .finally(() => {
      state.refreshInFlight = null;
    });

  return state.refreshInFlight;
}

export function isAuthRefreshExemptPath(path: string): boolean {
  return (
    path.startsWith("/api/v1/auth/login") ||
    path.startsWith("/api/v1/auth/register") ||
    path.startsWith("/api/v1/auth/refresh") ||
    path.startsWith("/api/v1/auth/logout") ||
    path.startsWith("/api/v1/auth/password-reset") ||
    path.startsWith("/api/v1/auth/verify-email") ||
    path.startsWith("/api/v1/auth/session") ||
    path.startsWith("/api/v1/auth/email-confirmation") ||
    path.startsWith("/api/v1/auth/resend-verification")
  );
}

/** Test helper — inspect latch without exposing to product UI. */
export function __testOnly_hasRefreshDefinitivelyFailed(): boolean {
  return getRefreshState().refreshDefinitivelyFailed;
}
