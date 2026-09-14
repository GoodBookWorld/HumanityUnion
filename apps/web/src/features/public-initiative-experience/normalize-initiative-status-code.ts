import type { InitiativeStatus } from "@hu/types";

/**
 * Canonical InitiativeStatus codes used by catalogs (`initiativeExperience.statuses.*`).
 * World / latest projections historically Title-Case these for display — reverse-map
 * before semantic label lookup so next-intl never receives `statuses.Proposal`.
 */
export const INITIATIVE_STATUS_CODES = [
  "draft",
  "proposal",
  "discussion",
  "revision",
  "ready_for_poll",
  "poll",
  "petition",
  "implementation",
  "completed",
  "archived",
  "revived",
  "superseded",
  "merged",
] as const satisfies readonly InitiativeStatus[];

const STATUS_CODE_SET = new Set<string>(INITIATIVE_STATUS_CODES);

/**
 * Normalize Title-Case / spaced / mixed public status strings to snake_case codes.
 * Unknown values return a lowercased, underscored token (never a namespaced i18n key).
 */
export function normalizeInitiativeStatusCode(status: string): string {
  const trimmed = status.trim();
  if (!trimmed) {
    return trimmed;
  }
  if (STATUS_CODE_SET.has(trimmed)) {
    return trimmed;
  }

  const snake = trimmed
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[\s-]+/g, "_")
    .toLowerCase();

  if (STATUS_CODE_SET.has(snake)) {
    return snake;
  }

  return snake;
}

/** True when a translator result looks like a leaked namespaced message key. */
export function looksLikeRawI18nKey(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed.includes(".")) {
    return false;
  }
  // e.g. initiativeExperience.statuses.Proposal / membershipPublic.foo
  return /^[A-Za-z][A-Za-z0-9_-]*(\.[A-Za-z0-9_-]+)+$/.test(trimmed);
}
