/**
 * Reset 03 — Web Media PLP feature flag (default OFF → legacy Media path).
 * Reset 03E.6 — runtime env read (dynamic key); FORCE_LEGACY for Web-only rollback.
 */

let mediaPlpEnabledOverride: boolean | null = null;

export function setMediaPlpWebEnabledForTests(enabled: boolean | null): void {
  mediaPlpEnabledOverride = enabled;
}

function readProcessEnv(name: string): string | undefined {
  // Dynamic key access — avoid accidental build-time inlining of a missing value.
  if (typeof process === "undefined" || !process.env) {
    return undefined;
  }
  return process.env[name];
}

/**
 * Intentional Web-only rollback while API PLP may remain ON for diagnostics.
 * When true, /media must stay on LEGACY regardless of HU_MEDIA_PLP_ENABLED.
 */
export function isMediaPlpWebForceLegacy(): boolean {
  return readProcessEnv("HU_MEDIA_PLP_WEB_FORCE_LEGACY") === "true";
}

/**
 * Master switch for /media and Country Recommended Media PLP consumption.
 * Default false — one env flip enables; unset restores legacy without deploy rollback.
 *
 * Reset 03E.6: same env name as API, read at request time (not NEXT_PUBLIC / build bake).
 * Independent Web FORCE_LEGACY preserves rollback when API stays enabled.
 */
export function isMediaPlpWebEnabled(): boolean {
  if (mediaPlpEnabledOverride !== null) {
    return mediaPlpEnabledOverride;
  }
  if (isMediaPlpWebForceLegacy()) {
    return false;
  }
  return readProcessEnv("HU_MEDIA_PLP_ENABLED") === "true";
}

export function readMediaPlpWebFlagSourceForTests(): {
  readonly HU_MEDIA_PLP_ENABLED: string;
  readonly HU_MEDIA_PLP_WEB_FORCE_LEGACY: string;
} {
  return {
    HU_MEDIA_PLP_ENABLED: readProcessEnv("HU_MEDIA_PLP_ENABLED") ?? "(unset)",
    HU_MEDIA_PLP_WEB_FORCE_LEGACY:
      readProcessEnv("HU_MEDIA_PLP_WEB_FORCE_LEGACY") ?? "(unset)",
  };
}
