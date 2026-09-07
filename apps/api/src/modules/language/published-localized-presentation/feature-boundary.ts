/**
 * Reset 02/04 — published localization consumption gates (domain-neutral).
 *
 * Domain-specific flags (e.g. HU_MEDIA_PLP_ENABLED) register via
 * `registerPlpConsumptionChecker` — core does not import Media entity IDs.
 */

/** Explicit non-flag allowlist for migrated non-Media types (RESET 05+). */
export const PUBLISHED_LOCALIZATION_CONSUMER_ALLOWLIST: readonly string[] = [];

type PlpConsumptionChecker = (entityType: string) => boolean;

const checkers: PlpConsumptionChecker[] = [];

export function registerPlpConsumptionChecker(checker: PlpConsumptionChecker): void {
  checkers.push(checker);
}

export function resetPlpConsumptionCheckersForTests(): void {
  checkers.length = 0;
}

export function isPublishedLocalizationConsumptionEnabled(
  entityType: string,
): boolean {
  if (PUBLISHED_LOCALIZATION_CONSUMER_ALLOWLIST.includes(entityType)) {
    return true;
  }
  for (const checker of checkers) {
    if (checker(entityType)) {
      return true;
    }
  }
  return false;
}

export function assertPublishedLocalizationConsumptionAllowed(entityType: string): void {
  if (!isPublishedLocalizationConsumptionEnabled(entityType)) {
    throw new Error(
      `PUBLISHED_LOCALIZATION_CONSUMPTION_DISABLED:${entityType}`,
    );
  }
}
