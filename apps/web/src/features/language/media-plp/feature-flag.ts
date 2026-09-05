/**
 * Reset 03 — Web Media PLP feature flag (default OFF → legacy Media path).
 */

let mediaPlpEnabledOverride: boolean | null = null;

export function setMediaPlpWebEnabledForTests(enabled: boolean | null): void {
  mediaPlpEnabledOverride = enabled;
}

/**
 * Master switch for /media and Country Recommended Media PLP consumption.
 * Default false — one env flip enables; unset restores legacy without deploy rollback.
 */
export function isMediaPlpWebEnabled(): boolean {
  if (mediaPlpEnabledOverride !== null) {
    return mediaPlpEnabledOverride;
  }
  if (typeof process !== "undefined" && process.env?.HU_MEDIA_PLP_ENABLED === "true") {
    return true;
  }
  return false;
}
