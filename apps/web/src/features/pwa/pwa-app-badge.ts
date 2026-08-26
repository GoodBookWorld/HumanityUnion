/**
 * Pack 22B.1 — OS/App icon badge from canonical unread notifications.
 *
 * Number-only Badging API wrapper. No Push, no Service Worker involvement.
 * Foreground/open PWA only; closed-app badge updates require Web Push (out of scope).
 */
import { isStandaloneDisplayMode } from "./presentation-mode";

export type NavigatorWithAppBadge = Navigator & {
  setAppBadge?: (contents?: number) => Promise<void>;
  clearAppBadge?: () => Promise<void>;
};

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

/** Clear OS app badge when supported. Never throws into UI. */
export async function clearPwaAppBadge(
  nav: Navigator | undefined = typeof navigator !== "undefined" ? navigator : undefined,
): Promise<void> {
  const badgeNav = getNavigatorWithAppBadge(nav);
  if (typeof badgeNav?.clearAppBadge !== "function") {
    return;
  }
  try {
    await badgeNav.clearAppBadge();
  } catch {
    // Unsupported / denied / transient OS errors must not break the app.
  }
}

/**
 * Set OS app badge to a non-negative integer when supported.
 * Callers must pass a number only — never message content.
 */
export async function setPwaAppBadge(
  unreadCount: number,
  nav: Navigator | undefined = typeof navigator !== "undefined" ? navigator : undefined,
): Promise<void> {
  const badgeNav = getNavigatorWithAppBadge(nav);
  if (typeof badgeNav?.setAppBadge !== "function") {
    return;
  }
  if (!Number.isFinite(unreadCount) || unreadCount <= 0) {
    await clearPwaAppBadge(nav);
    return;
  }
  const safeCount = Math.min(Math.floor(unreadCount), Number.MAX_SAFE_INTEGER);
  try {
    await badgeNav.setAppBadge(safeCount);
  } catch {
    // Degrade silently (some platforms reject large values or deny the API).
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
export async function syncPwaAppBadgeFromUnreadCount(input: SyncPwaAppBadgeInput): Promise<void> {
  const nav = input.navigator;
  if (!input.authenticated) {
    await clearPwaAppBadge(nav);
    return;
  }

  if (input.hasError || input.unreadCount === null) {
    return;
  }

  const standaloneOnly = input.standaloneOnly !== false;
  const standalone =
    input.isStandalone ?? (typeof window !== "undefined" ? isStandaloneDisplayMode() : false);

  if (standaloneOnly && !standalone) {
    // Browser tab: keep website header/nav badges only; do not touch OS icon.
    return;
  }

  if (input.unreadCount > 0) {
    await setPwaAppBadge(input.unreadCount, nav);
    return;
  }

  await clearPwaAppBadge(nav);
}
