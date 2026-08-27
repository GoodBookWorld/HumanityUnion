/**
 * Pack 22B.1 — OS/App icon badge from canonical unread notifications.
 * Pack 22H — diagnostic sync results + hardened standalone/support handling.
 * Pack 23C — runtime capability diagnostic (standalone ≠ Badging API; permission-aware).
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

export type PwaAppBadgeApiOutcome = "resolved" | "rejected" | "not_called" | "unsupported";

/**
 * Capability snapshot — feature detection only (no UA sniffing as primary gate).
 * `standalone` is presentation mode; it does NOT imply Badging API support.
 */
export interface PwaAppBadgeCapabilitySnapshot {
  standalone: boolean;
  setAppBadgePresent: boolean;
  clearAppBadgePresent: boolean;
  badgeApiSupported: boolean;
  /** Read-only; never prompts. `unavailable` when Notification API absent. */
  notificationPermission: NotificationPermission | "unavailable";
}

/** Last sync attempt — internal/dev testability only (no PII). */
export interface PwaAppBadgeDiagnosticRecord {
  atMs: number;
  result: PwaAppBadgeSyncResult;
  unreadCount: number | null;
  authenticated: boolean;
  setAppBadgeReached: boolean;
  clearAppBadgeReached: boolean;
  apiOutcome: PwaAppBadgeApiOutcome;
  /**
   * iOS Home Screen: Badging API may resolve but OS hides the badge until
   * notification permission is granted (WebKit). Android launchers may show
   * a dot / ignore numeric badges even when the API call succeeds.
   */
  badgeMayBeHiddenByOsOrPermission: boolean;
  capability: PwaAppBadgeCapabilitySnapshot;
}

let lastDiagnostic: PwaAppBadgeDiagnosticRecord | null = null;

export function getLastPwaAppBadgeDiagnostic(): PwaAppBadgeDiagnosticRecord | null {
  return lastDiagnostic;
}

/** Test seam — reset between cases. */
export function resetLastPwaAppBadgeDiagnostic(): void {
  lastDiagnostic = null;
}

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

export function readNotificationPermission(
  notificationGlobal: typeof Notification | undefined =
    typeof Notification !== "undefined" ? Notification : undefined,
): NotificationPermission | "unavailable" {
  if (!notificationGlobal || typeof notificationGlobal.permission !== "string") {
    return "unavailable";
  }
  return notificationGlobal.permission;
}

export function inspectPwaAppBadgeCapability(input?: {
  navigator?: Navigator;
  isStandalone?: boolean;
  notificationPermission?: NotificationPermission | "unavailable";
}): PwaAppBadgeCapabilitySnapshot {
  const nav =
    input?.navigator ?? (typeof navigator !== "undefined" ? navigator : undefined);
  const badgeNav = getNavigatorWithAppBadge(nav);
  const setAppBadgePresent = typeof badgeNav?.setAppBadge === "function";
  const clearAppBadgePresent = typeof badgeNav?.clearAppBadge === "function";
  const standalone =
    input?.isStandalone ??
    (typeof window !== "undefined" ? isStandaloneDisplayMode({ navigator: nav }) : false);

  return {
    standalone,
    setAppBadgePresent,
    clearAppBadgePresent,
    badgeApiSupported: setAppBadgePresent && clearAppBadgePresent,
    notificationPermission:
      input?.notificationPermission ?? readNotificationPermission(),
  };
}

function recordDiagnostic( partial: Omit<PwaAppBadgeDiagnosticRecord, "atMs">): void {
  lastDiagnostic = { ...partial, atMs: Date.now() };
  if (process.env.NODE_ENV !== "development") {
    return;
  }
  // Capability + result only — never notification content, sender, identity, or tokens.
  console.debug("[pwa-app-badge]", {
    result: partial.result,
    unreadCount: partial.unreadCount,
    setAppBadgeReached: partial.setAppBadgeReached,
    clearAppBadgeReached: partial.clearAppBadgeReached,
    apiOutcome: partial.apiOutcome,
    badgeMayBeHiddenByOsOrPermission: partial.badgeMayBeHiddenByOsOrPermission,
    capability: partial.capability,
  });
}

function permissionMayHideBadge(
  permission: NotificationPermission | "unavailable",
): boolean {
  // WebKit: badge visible on Home Screen only after notification permission granted.
  return permission === "default" || permission === "denied";
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
  /** Test seam — override Notification.permission read. */
  notificationPermission?: NotificationPermission | "unavailable";
}

/**
 * Synchronize OS/App badge with canonical unread notifications.
 *
 * - unauthenticated → clear
 * - hasError or unreadCount null → preserve (no update)
 * - unreadCount === 0 → clear (standalone, or always if not standaloneOnly)
 * - unreadCount > 0 → set (standalone when standaloneOnly)
 *
 * Pack 23C: `UNSUPPORTED BY CURRENT PLATFORM` when Badging API methods are absent
 * even if the session is an installed/standalone PWA.
 */
export async function syncPwaAppBadgeFromUnreadCount(
  input: SyncPwaAppBadgeInput,
): Promise<PwaAppBadgeSyncResult> {
  const nav = input.navigator;
  const capability = inspectPwaAppBadgeCapability({
    navigator: nav ?? (typeof navigator !== "undefined" ? navigator : undefined),
    isStandalone: input.isStandalone,
    notificationPermission: input.notificationPermission,
  });

  if (!input.authenticated) {
    const clearReached = capability.clearAppBadgePresent;
    const result = await clearPwaAppBadge(nav);
    recordDiagnostic({
      result,
      unreadCount: null,
      authenticated: false,
      setAppBadgeReached: false,
      clearAppBadgeReached: clearReached,
      apiOutcome:
        result === "unsupported"
          ? "unsupported"
          : result === "api_error"
            ? "rejected"
            : clearReached
              ? "resolved"
              : "not_called",
      badgeMayBeHiddenByOsOrPermission: false,
      capability: { ...capability, standalone: capability.standalone },
    });
    return result;
  }

  if (input.hasError || input.unreadCount === null) {
    recordDiagnostic({
      result: "preserved",
      unreadCount: input.unreadCount,
      authenticated: true,
      setAppBadgeReached: false,
      clearAppBadgeReached: false,
      apiOutcome: "not_called",
      badgeMayBeHiddenByOsOrPermission: false,
      capability,
    });
    return "preserved";
  }

  const standaloneOnly = input.standaloneOnly !== false;
  const standalone =
    input.isStandalone ??
    (typeof window !== "undefined"
      ? isStandaloneDisplayMode({
          navigator: nav ?? (typeof navigator !== "undefined" ? navigator : undefined),
        })
      : false);

  const capabilityWithStandalone = { ...capability, standalone };

  if (standaloneOnly && !standalone) {
    recordDiagnostic({
      result: "not_standalone",
      unreadCount: input.unreadCount,
      authenticated: true,
      setAppBadgeReached: false,
      clearAppBadgeReached: false,
      apiOutcome: "not_called",
      badgeMayBeHiddenByOsOrPermission: false,
      capability: capabilityWithStandalone,
    });
    return "not_standalone";
  }

  if (!isAppBadgeSupported(nav)) {
    // Installed PWA ≠ Badging API. Explicit unsupported — not a successful sync.
    recordDiagnostic({
      result: "unsupported",
      unreadCount: input.unreadCount,
      authenticated: true,
      setAppBadgeReached: false,
      clearAppBadgeReached: false,
      apiOutcome: "unsupported",
      badgeMayBeHiddenByOsOrPermission: false,
      capability: capabilityWithStandalone,
    });
    return "unsupported";
  }

  if (input.unreadCount > 0) {
    const applied = await setPwaAppBadge(input.unreadCount, nav);
    recordDiagnostic({
      result: applied,
      unreadCount: input.unreadCount,
      authenticated: true,
      setAppBadgeReached: applied !== "unsupported",
      clearAppBadgeReached: false,
      apiOutcome:
        applied === "applied"
          ? "resolved"
          : applied === "api_error"
            ? "rejected"
            : applied === "unsupported"
              ? "unsupported"
              : "resolved",
      badgeMayBeHiddenByOsOrPermission:
        applied === "applied" &&
        permissionMayHideBadge(capabilityWithStandalone.notificationPermission),
      capability: capabilityWithStandalone,
    });
    return applied;
  }

  const cleared = await clearPwaAppBadge(nav);
  recordDiagnostic({
    result: cleared,
    unreadCount: 0,
    authenticated: true,
    setAppBadgeReached: false,
    clearAppBadgeReached: cleared !== "unsupported",
    apiOutcome:
      cleared === "cleared"
        ? "resolved"
        : cleared === "api_error"
          ? "rejected"
          : cleared === "unsupported"
            ? "unsupported"
            : "resolved",
    badgeMayBeHiddenByOsOrPermission: false,
    capability: capabilityWithStandalone,
  });
  return cleared;
}
