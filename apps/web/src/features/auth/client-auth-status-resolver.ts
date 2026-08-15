import { fetchAuthSession, getMe } from "./auth-api";
import { AUTH_STATE_CHANGED_EVENT } from "./auth-events";
import {
  markAuthRefreshDefinitivelyFailed,
  refreshAuthSessionOnce,
  resetAuthRefreshState,
} from "./auth-token-refresh";
import { clearLegacyAuthTokenStorage } from "./auth-token-store";

export type ResolvedClientAuthStatus = "authenticated" | "unauthenticated";

type AuthStatusListener = (status: ResolvedClientAuthStatus | "pending") => void;

const GLOBAL_KEY = "__hu_client_auth_status_resolver__";

interface ResolverState {
  latest: ResolvedClientAuthStatus | "pending";
  inFlight: Promise<ResolvedClientAuthStatus> | null;
  listeners: Set<AuthStatusListener>;
  /**
   * After a definitive guest resolution, ignore duplicate resolve calls until
   * login/logout/successful refresh invalidates via AUTH_STATE_CHANGED_EVENT.
   */
  guestSettled: boolean;
  browserBound: boolean;
}

function getState(): ResolverState {
  const globalObject = globalThis as typeof globalThis & {
    [GLOBAL_KEY]?: ResolverState;
  };

  if (!globalObject[GLOBAL_KEY]) {
    globalObject[GLOBAL_KEY] = {
      latest: "pending",
      inFlight: null,
      listeners: new Set(),
      guestSettled: false,
      browserBound: false,
    };
  }

  return globalObject[GLOBAL_KEY];
}

function publish(status: ResolvedClientAuthStatus | "pending"): void {
  const state = getState();
  state.latest = status;

  for (const listener of state.listeners) {
    listener(status);
  }
}

function ensureBrowserBinding(): void {
  if (typeof window === "undefined") {
    return;
  }

  const state = getState();

  if (state.browserBound) {
    return;
  }

  state.browserBound = true;

  window.addEventListener(AUTH_STATE_CHANGED_EVENT, () => {
    const current = getState();

    // A resolution already owns the transition (e.g. login accept in-flight).
    if (current.inFlight) {
      return;
    }

    // Login / logout / successful refresh only — failed refresh must not dispatch.
    invalidateClientAuthStatusResolution();
    publish("pending");
    void resolveClientAuthStatus();
  });
}

async function settleAuthenticated(): Promise<ResolvedClientAuthStatus> {
  const state = getState();
  state.guestSettled = false;
  publish("authenticated");
  return "authenticated";
}

async function settleGuest(): Promise<ResolvedClientAuthStatus> {
  const state = getState();
  markAuthRefreshDefinitivelyFailed();
  state.guestSettled = true;
  publish("unauthenticated");
  return "unauthenticated";
}

/**
 * Single-flight session resolution shared by every useClientAuthStatus mount.
 *
 * Canonical transitions:
 * - valid access → session authenticated
 * - expired access + valid refresh → session guest → refresh once → session/me authenticated
 * - no session → session guest → refresh once → fail → guest STOP
 */
export async function resolveClientAuthStatus(): Promise<ResolvedClientAuthStatus> {
  ensureBrowserBinding();
  const state = getState();

  if (state.guestSettled && state.latest === "unauthenticated") {
    return "unauthenticated";
  }

  if (state.inFlight) {
    return state.inFlight;
  }

  state.inFlight = (async () => {
    clearLegacyAuthTokenStorage();

    try {
      const session = await fetchAuthSession();

      if (session.authenticated && session.user) {
        return settleAuthenticated();
      }

      // Guest probe may still have a valid refresh cookie (expired access).
      const refreshed = await refreshAuthSessionOnce({ notifyOnSuccess: false });

      if (refreshed) {
        const nextSession = await fetchAuthSession();

        if (nextSession.authenticated && nextSession.user) {
          return settleAuthenticated();
        }

        try {
          await getMe();
          return settleAuthenticated();
        } catch {
          return settleGuest();
        }
      }

      return settleGuest();
    } catch (sessionError) {
      if (process.env.NODE_ENV !== "production") {
        console.warn("[hu-auth] session probe failed; falling back to /me", sessionError);
      }
    }

    // Older deployments without /session — one bounded /me (+ api-client refresh).
    try {
      await getMe();
      return settleAuthenticated();
    } catch {
      clearLegacyAuthTokenStorage();
      return settleGuest();
    }
  })().finally(() => {
    state.inFlight = null;
  });

  return state.inFlight;
}

/**
 * Login / logout / successful refresh may change cookies — allow a fresh probe.
 */
export function invalidateClientAuthStatusResolution(): void {
  const state = getState();
  state.guestSettled = false;
  state.inFlight = null;
}

export function acceptAuthenticatedClientAuthStatus(): void {
  const state = getState();
  state.guestSettled = false;
  resetAuthRefreshState();
  publish("authenticated");
}

export function acceptGuestClientAuthStatus(): void {
  void settleGuest();
}

export function getClientAuthStatusSnapshot(): ResolvedClientAuthStatus | "pending" {
  return getState().latest;
}

export function subscribeClientAuthStatus(listener: AuthStatusListener): () => void {
  ensureBrowserBinding();
  const state = getState();
  state.listeners.add(listener);

  if (state.latest !== "pending") {
    listener(state.latest);
  }

  return () => {
    state.listeners.delete(listener);
  };
}

/** Test helper */
export function __testOnly_resetClientAuthStatusResolver(): void {
  const state = getState();
  state.latest = "pending";
  state.inFlight = null;
  state.guestSettled = false;
  state.listeners.clear();
  // Keep browserBound — re-binding would duplicate window listeners in tests/HMR.
}
