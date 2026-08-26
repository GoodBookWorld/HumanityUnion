/**
 * Pack 22B.1 — OS/App icon badge from canonical unread notifications.
 * Pack 22H — diagnostic sync results + hardened standalone/support handling.
 *
 * Number-only Badging API wrapper. No Push, no Service Worker involvement.
 * Foreground/open PWA only; closed-app badge updates require Web Push (out of scope).
 */
import { isStandaloneDisplayMode } from "./presentation-mode";

export type NavigatorWithAppBadge = Navigator & {
  setAppBadge?: (contents?: number) => Promise<void>;
  clearAppBadge?: () => Promise<void>;
};

/** Internal observability only — never surfaced as noisy user UI. */
export type PwaAppBadgeSyncResult =
  | "applied"
  | "cleared"
  | "unsupported"
  | "not_standalone"
  | "api_error"
  | "preserved";

export function getNavigatorWithAppBadge(
  nav: Navigator | undefined = typeof navigator !== "undefined" ? navigator : undefined,
): NavigatorWithAppBadge | null {
  if (!nav) {
    return null;
  }
  return nav as NavigatorWithAppBadge;
}

export function isAppBadgeSupported(
  nav: Navigator | undefined = typeof navigator !== "undefined" ? navigator : undefined,
): boolean {
  const badgeNav = getNavigatorWithAppBadge(nav);
  return (
    typeof badgeNav?.setAppBadge === "function" && typeof badgeNav?.clearAppBadge === "function"
  );
}

function logBadgeDiagnostic(result: PwaAppBadgeSyncResult, unreadCount: number | null): void {
  if (process.env.NODE_ENV !== "development") {
    return;
  }
  // Number + result only — never notification content, sender, or message text.
  console.debug("[pwa-app-badge]", { result, unreadCount });
}

/** Clear OS app badge when supported. Never throws into UI. */
export async function clearPwaAppBadge(
  nav: Navigator | undefined = typeof navigator !== "undefined" ? navigator : undefined,
): Promise<PwaAppBadgeSyncResult> {
  const badgeNav = getNavigatorWithAppBadge(nav);
  if (typeof badgeNav?.clearAppBadge !== "function") {
    return "unsupported";
  }
  try {
    await badgeNav.clearAppBadge();
    return "cleared";
  } catch {
    return "api_error";
  }
}

/**
 * Set OS app badge to a non-negative integer when supported.
 * Callers must pass a number only — never message content.
 */
export async function setPwaAppBadge(
  unreadCount: number,
  nav: Navigator | undefined = typeof navigator !== "undefined" ? navigator : undefined,
): Promise<PwaAppBadgeSyncResult> {
  const badgeNav = getNavigatorWithAppBadge(nav);
  if (typeof badgeNav?.setAppBadge !== "function") {
    return "unsupported";
  }
  if (!Number.isFinite(unreadCount) || unreadCount <= 0) {
    return clearPwaAppBadge(nav);
  }
  const safeCount = Math.min(Math.floor(unreadCount), Number.MAX_SAFE_INTEGER);
  try {
    await badgeNav.setAppBadge(safeCount);
    return "applied";
  } catch {
    return "api_error";
  }
}

export interface SyncPwaAppBadgeInput {
  /** Canonical unread count; null means unknown (loading/error). */
  unreadCount: number | null;
  authenticated: boolean;
  /** When true, preserve the last OS badge (do not fabricate or clear). */
  hasError?: boolean;
  /**
   * When true (default), only set badges in installed/standalone PWA.
   * Logout/unauthenticated always clears regardless of presentation mode.
   */
  standaloneOnly?: boolean;
  /** Test seam — override presentation detection. */
  isStandalone?: boolean;
  navigator?: Navigator;
}

/**
 * Synchronize OS/App badge with canonical unread notifications.
 *
 * - unauthenticated → clear
 * - hasError or unreadCount null → preserve (no update)
 * - unreadCount === 0 → clear (standalone, or always if not standaloneOnly)
 * - unreadCount > 0 → set (standalone when standaloneOnly)
 */
export async function syncPwaAppBadgeFromUnreadCount(
  input: SyncPwaAppBadgeInput,
): Promise<PwaAppBadgeSyncResult> {
  const nav = input.navigator;

  if (!input.authenticated) {
    const result = await clearPwaAppBadge(nav);
    logBadgeDiagnostic(result, null);
    return result;
  }

  if (input.hasError || input.unreadCount === null) {
    logBadgeDiagnostic("preserved", input.unreadCount);
    return "preserved";
  }

  const standaloneOnly = input.standaloneOnly !== false;
  const standalone =
    input.isStandalone ?? (typeof window !== "undefined" ? isStandaloneDisplayMode() : false);

  if (standaloneOnly && !standalone) {
    // Browser tab: keep website header/nav badges only; do not touch OS icon.
    logBadgeDiagnostic("not_standalone", input.unreadCount);
    return "not_standalone";
  }

  if (!isAppBadgeSupported(nav)) {
    logBadgeDiagnostic("unsupported", input.unreadCount);
    return "unsupported";
  }

  if (input.unreadCount > 0) {
    const applied = await setPwaAppBadge(input.unreadCount, nav);
    logBadgeDiagnostic(applied, input.unreadCount);
    return applied;
  }

  const cleared = await clearPwaAppBadge(nav);
  logBadgeDiagnostic(cleared, 0);
  return cleared;
}
