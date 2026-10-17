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
  /**
   * Bumped when a browser session is accepted. A probe captures this at start
   * and must not publish a guest result after a newer acceptance.
   */
  epoch: number;
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
      epoch: 0,
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

function isCurrentEpoch(epoch: number): boolean {
  return getState().epoch === epoch;
}

/** Status already published by a newer acceptance or settlement. */
function adoptedStatus(): ResolvedClientAuthStatus {
  return getState().latest === "authenticated" ? "authenticated" : "unauthenticated";
}

async function settleAuthenticated(epoch: number): Promise<ResolvedClientAuthStatus> {
  if (!isCurrentEpoch(epoch)) {
    return adoptedStatus();
  }

  const state = getState();
  state.guestSettled = false;
  publish("authenticated");
  return "authenticated";
}

async function settleGuest(epoch: number): Promise<ResolvedClientAuthStatus> {
  if (!isCurrentEpoch(epoch)) {
    // The stale probe's refresh failure must not stick after session acceptance.
    resetAuthRefreshState();
    return adoptedStatus();
  }

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

  const epoch = state.epoch;
  const flight = (async () => {
    clearLegacyAuthTokenStorage();

    try {
      const session = await fetchAuthSession();

      if (!isCurrentEpoch(epoch)) {
        return adoptedStatus();
      }

      if (session.authenticated && session.user) {
        return settleAuthenticated(epoch);
      }

      // Guest probe may still have a valid refresh cookie (expired access).
      const refreshed = await refreshAuthSessionOnce({ notifyOnSuccess: false });

      if (!isCurrentEpoch(epoch)) {
        resetAuthRefreshState();
        return adoptedStatus();
      }

      if (refreshed) {
        const nextSession = await fetchAuthSession();

        if (!isCurrentEpoch(epoch)) {
          return adoptedStatus();
        }

        if (nextSession.authenticated && nextSession.user) {
          return settleAuthenticated(epoch);
        }

        try {
          await getMe();
          return settleAuthenticated(epoch);
        } catch {
          return settleGuest(epoch);
        }
      }

      return settleGuest(epoch);
    } catch (sessionError) {
      if (!isCurrentEpoch(epoch)) {
        return adoptedStatus();
      }

      if (process.env.NODE_ENV !== "production") {
        console.warn("[hu-auth] session probe failed; falling back to /me", sessionError);
      }
    }

    if (!isCurrentEpoch(epoch)) {
      return adoptedStatus();
    }

    // Older deployments without /session — one bounded /me (+ api-client refresh).
    try {
      await getMe();
      return settleAuthenticated(epoch);
    } catch {
      clearLegacyAuthTokenStorage();
      return settleGuest(epoch);
    }
  })();

  const tracked = flight.finally(() => {
    if (state.inFlight === tracked) {
      state.inFlight = null;
    }
  });
  state.inFlight = tracked;
  return tracked;
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
  state.epoch += 1;
  state.guestSettled = false;
  resetAuthRefreshState();
  publish("authenticated");
}

export function acceptGuestClientAuthStatus(): void {
  void settleGuest(getState().epoch);
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
  state.epoch = 0;
  state.listeners.clear();
  // Keep browserBound — re-binding would duplicate window listeners in tests/HMR.
}
