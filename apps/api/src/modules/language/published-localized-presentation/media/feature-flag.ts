/**
 * Reset 03 — Media PLP consumption flag (default OFF = legacy Media path).
 */

import {
  MEDIA_PLP_ENTITY_TYPES,
  type MediaPlpEntityType,
} from "@hu/types";

/**
 * Master switch. Default false — production/staging stay on legacy until
 * explicit enablement after cold-cache acceptance.
 */
let mediaPlpEnabledOverride: boolean | null = null;

export function setMediaPlpConsumptionEnabledForTests(enabled: boolean | null): void {
  mediaPlpEnabledOverride = enabled;
}

export function isMediaPlpConsumptionEnabled(): boolean {
  if (mediaPlpEnabledOverride !== null) {
    return mediaPlpEnabledOverride;
  }
  return process.env.HU_MEDIA_PLP_ENABLED === "true";
}

export function isMediaPlpEntityConsumptionEnabled(
  entityType: string,
): boolean {
  if (!isMediaPlpConsumptionEnabled()) {
    return false;
  }
  return (MEDIA_PLP_ENTITY_TYPES as readonly string[]).includes(entityType);
}

export function listEnabledMediaPlpEntityTypes(): readonly MediaPlpEntityType[] {
  if (!isMediaPlpConsumptionEnabled()) {
    return [];
  }
  return MEDIA_PLP_ENTITY_TYPES;
}
