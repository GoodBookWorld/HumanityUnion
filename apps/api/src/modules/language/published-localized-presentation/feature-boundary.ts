/**
 * Reset 02 — dormant consumer allowlist.
 * No public route may consume published snapshots until Reset 03+ enablement.
 */

/** Empty until Media (or another) migration pack explicitly adds entity types. */
export const PUBLISHED_LOCALIZATION_CONSUMER_ALLOWLIST: readonly string[] = [];

export function isPublishedLocalizationConsumptionEnabled(
  entityType: string,
): boolean {
  return PUBLISHED_LOCALIZATION_CONSUMER_ALLOWLIST.includes(entityType);
}

/**
 * Soft gate for future route wiring. Core APIs remain callable in tests;
 * production route code must check this before substituting legacy paths.
 */
export function assertPublishedLocalizationConsumptionAllowed(entityType: string): void {
  if (!isPublishedLocalizationConsumptionEnabled(entityType)) {
    throw new Error(
      `PUBLISHED_LOCALIZATION_CONSUMPTION_DISABLED:${entityType}`,
    );
  }
}
