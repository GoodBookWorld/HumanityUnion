/**
 * Pack 22I.1 — sessionStorage guard for once-per-PWA-session launch.
 */

import { PWA_LAUNCH_SESSION_KEY } from "./pwa-launch-constants";

export type LaunchSessionStorage = Pick<Storage, "getItem" | "setItem">;

export function hasPwaLaunchPlayedThisSession(
  storage: LaunchSessionStorage | null | undefined =
    typeof sessionStorage !== "undefined" ? sessionStorage : null,
): boolean {
  if (!storage) {
    return true;
  }
  try {
    return storage.getItem(PWA_LAUNCH_SESSION_KEY) === "1";
  } catch {
    // If storage is unavailable, do not risk looping launch overlays.
    return true;
  }
}

/** Claim the session early so remounts cannot replay. */
export function markPwaLaunchPlayedThisSession(
  storage: LaunchSessionStorage | null | undefined =
    typeof sessionStorage !== "undefined" ? sessionStorage : null,
): void {
  if (!storage) {
    return;
  }
  try {
    storage.setItem(PWA_LAUNCH_SESSION_KEY, "1");
  } catch {
    // Ignore quota / private-mode failures.
  }
}

export function clearPwaLaunchPlayedThisSessionForTests(
  storage: LaunchSessionStorage | null | undefined =
    typeof sessionStorage !== "undefined" ? sessionStorage : null,
): void {
  if (!storage || typeof (storage as Storage).removeItem !== "function") {
    return;
  }
  try {
    (storage as Storage).removeItem(PWA_LAUNCH_SESSION_KEY);
  } catch {
    // ignore
  }
}
