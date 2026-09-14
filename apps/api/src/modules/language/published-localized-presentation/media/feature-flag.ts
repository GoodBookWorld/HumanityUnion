/**
 * Reset 01 — Media PLP is the sole public presentation owner by default.
 * Set HU_MEDIA_PLP_ENABLED=false only for explicit legacy rollback.
 */

import {
  MEDIA_PLP_ENTITY_TYPES,
  type MediaPlpEntityType,
} from "@hu/types";

let mediaPlpEnabledOverride: boolean | null = null;

export function setMediaPlpConsumptionEnabledForTests(enabled: boolean | null): void {
  mediaPlpEnabledOverride = enabled;
}

export function isMediaPlpConsumptionEnabled(): boolean {
  if (mediaPlpEnabledOverride !== null) {
    return mediaPlpEnabledOverride;
  }
  const raw = process.env.HU_MEDIA_PLP_ENABLED;
  if (raw === undefined || raw === "") {
    return true;
  }
  return raw === "true";
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
