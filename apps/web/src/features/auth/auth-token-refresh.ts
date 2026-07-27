import type { AuthTokenPair, AuthUserPublic } from "@hu/types";

import { API_BASE_URL } from "../../lib/api-base-url";
import { dispatchAuthStateChanged } from "./auth-events";
import { clearStoredAuthTokens, getStoredRefreshToken, storeAuthTokens } from "./auth-token-store";

interface RefreshResponse {
  success: boolean;
  data: {
    user: AuthUserPublic;
    tokens: AuthTokenPair;
  };
  message: string;
}

let refreshInFlight: Promise<boolean> | null = null;

function readRefreshEnvelope(text: string, status: number): RefreshResponse {
  if (!text.trim()) {
    throw new Error(`Refresh failed with status ${status}.`);
  }

  return JSON.parse(text) as RefreshResponse;
}

async function performTokenRefreshRequest(): Promise<boolean> {
  const refreshToken = getStoredRefreshToken();
  const response = await fetch(`${API_BASE_URL}/api/v1/auth/refresh`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
    body: JSON.stringify(refreshToken ? { refreshToken } : {}),
  });

  const text = await response.text();

  if (!response.ok) {
    return false;
  }

  const body = readRefreshEnvelope(text, response.status);

  if (!body.success || !body.data?.tokens?.accessToken) {
    return false;
  }

  storeAuthTokens(body.data.tokens.accessToken, body.data.tokens.refreshToken);
  dispatchAuthStateChanged();
  return true;
}

/** Deduplicated refresh — concurrent 401s share one in-flight refresh attempt. */
export async function refreshAuthSessionOnce(): Promise<boolean> {
  if (refreshInFlight) {
    return refreshInFlight;
  }

  refreshInFlight = performTokenRefreshRequest()
    .then((refreshed) => {
      if (!refreshed) {
        clearStoredAuthTokens();
        dispatchAuthStateChanged();
      }

      return refreshed;
    })
    .finally(() => {
      refreshInFlight = null;
    });

  return refreshInFlight;
}

export function isAuthRefreshExemptPath(path: string): boolean {
  return (
    path.startsWith("/api/v1/auth/login") ||
    path.startsWith("/api/v1/auth/register") ||
    path.startsWith("/api/v1/auth/refresh") ||
    path.startsWith("/api/v1/auth/logout") ||
    path.startsWith("/api/v1/auth/password-reset") ||
    path.startsWith("/api/v1/auth/verify-email")
  );
}
