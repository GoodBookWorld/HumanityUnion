/**
 * Workspace Home WEB_UI helpers — stable API codes → next-intl messages.
 * Locale-agnostic: works for any Registry-enabled locale with catalog keys.
 */

type TranslateFn = (
  key: string,
  values?: Record<string, string | number | Date>,
) => string;

function safeT(
  t: TranslateFn,
  key: string,
  values?: Record<string, string | number | Date>,
): string | null {
  try {
    const value = values ? t(key, values) : t(key);
    if (!value.trim() || value === key) {
      return null;
    }
    return value;
  } catch {
    return null;
  }
}

/** Quick action id → workspace.home.quickActions.* */
export function resolveWorkspaceQuickActionLabel(
  t: TranslateFn,
  actionId: string,
): string {
  return (
    safeT(t, `home.quickActions.${actionId}`) ??
    actionId.replaceAll("-", " ")
  );
}

/** Timeline event code → civicActivity.timeline.events.* then workspace.home.activityEvents.* */
export function resolveWorkspaceActivityEventLabel(
  tWorkspace: TranslateFn,
  tCivicActivity: TranslateFn,
  eventCode: string,
): string {
  return (
    safeT(tCivicActivity, `timeline.events.${eventCode}`) ??
    safeT(tWorkspace, `home.activityEvents.${eventCode}`) ??
    eventCode.replaceAll("_", " ")
  );
}

/** Readiness missing code → workspace.home.readiness.* */
export function resolveWorkspaceReadinessMissingLabel(
  t: TranslateFn,
  code: string,
): string {
  return safeT(t, `home.readiness.${code}`) ?? code.replaceAll("_", " ");
}

/** Beta onboarding item id → workspace.home.beta.items.* */
export function resolveWorkspaceBetaItemLabel(
  t: TranslateFn,
  itemId: string,
): string {
  return (
    safeT(t, `home.beta.items.${itemId}`) ?? itemId.replaceAll("-", " ")
  );
}

/** CI reason code → workspace.home.ci.reasons.* (falls back to code humanization). */
export function resolveWorkspaceCiReasonLabel(
  t: TranslateFn,
  reasonCode: string,
  fallbackMessage?: string,
): string {
  return (
    safeT(t, `home.ci.reasons.${reasonCode}`) ??
    (fallbackMessage?.trim() ? fallbackMessage : reasonCode.replaceAll("_", " "))
  );
}

/** Personal statistics card key → workspace.home.stats.* */
export function resolveWorkspaceStatsLabel(
  t: TranslateFn,
  statsKey: string,
): string {
  return safeT(t, `home.stats.${statsKey}`) ?? statsKey;
}
