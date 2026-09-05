/**
 * Reset 02/03 — published localization consumption gates.
 *
 * Media entity types are consumable only when HU_MEDIA_PLP_ENABLED=true
 * (or test override). Default remains legacy (flag OFF).
 */

import { MEDIA_PLP_ENTITY_TYPES } from "@hu/types";

import { isMediaPlpConsumptionEnabled } from "./media/feature-flag.js";

/** Non-Media allowlist (still empty — Media uses the Media PLP flag). */
export const PUBLISHED_LOCALIZATION_CONSUMER_ALLOWLIST: readonly string[] = [];

export function isPublishedLocalizationConsumptionEnabled(
  entityType: string,
): boolean {
  if (PUBLISHED_LOCALIZATION_CONSUMER_ALLOWLIST.includes(entityType)) {
    return true;
  }
  if (
    (MEDIA_PLP_ENTITY_TYPES as readonly string[]).includes(entityType) &&
    isMediaPlpConsumptionEnabled()
  ) {
    return true;
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
