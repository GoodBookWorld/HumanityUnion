/**
 * RESET 04 — universal PLP worker/runtime safety defaults.
 * Preserve staging lessons: concurrency 1, no fanout, no build-on-read.
 */

import type { PlpWorkerSafetyDefaults } from "@hu/types";

/** Default provider timeout for thin localization builds (ms). */
export const PLP_UNIVERSAL_PROVIDER_TIMEOUT_MS = 60_000;

export const PLP_UNIVERSAL_WORKER_SAFETY_DEFAULTS: PlpWorkerSafetyDefaults = {
  PROVIDER_CONCURRENCY: 1,
  MAX_IN_FLIGHT_BUILDS: 1,
  PROVIDER_TIMEOUT_MS: PLP_UNIVERSAL_PROVIDER_TIMEOUT_MS,
  MAX_RSS_MB: null,
  ALLOW_PROVIDER_FANOUT: false,
  ALLOW_BUILD_ON_READ: false,
};

export function resolvePlpProviderConcurrency(
  envValue: string | undefined = process.env.HU_PLP_PROVIDER_CONCURRENCY,
): number {
  const raw = envValue?.trim();
  if (!raw) {
    return PLP_UNIVERSAL_WORKER_SAFETY_DEFAULTS.PROVIDER_CONCURRENCY;
  }
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return 1;
  }
  // Hard ceiling — never uncontrolled fanout.
  return Math.min(parsed, 2);
}
