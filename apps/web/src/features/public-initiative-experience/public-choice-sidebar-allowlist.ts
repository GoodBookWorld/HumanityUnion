/**
 * Fix 07B — Public Choice sidebar allowlist (not denylist).
 *
 * Only these widgets may mount for PUBLIC_CHOICE. Anything else
 * (Active Allies, AI Assistant, Support, Revision History, Latest,
 * icw-tabs / Channel) must not appear on the public PC sidebar.
 */

export type PublicChoiceSidebarWidgetId =
  | "candidates"
  | "your_participation"
  | "related_initiatives";

export function resolvePublicChoiceSidebarAllowlist(input: {
  /** Visitor = false; Participant / Member / Author = true. */
  authenticated: boolean;
}): readonly PublicChoiceSidebarWidgetId[] {
  if (!input.authenticated) {
    return ["candidates", "related_initiatives"] as const;
  }

  return ["candidates", "your_participation", "related_initiatives"] as const;
}

export function publicChoiceSidebarAllows(
  allowlist: readonly PublicChoiceSidebarWidgetId[],
  widgetId: PublicChoiceSidebarWidgetId,
): boolean {
  return allowlist.includes(widgetId);
}
