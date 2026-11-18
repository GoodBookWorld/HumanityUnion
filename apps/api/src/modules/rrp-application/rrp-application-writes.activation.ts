/**
 * HU-RRP-03L.2 — server-side activation gate for RRP state-changing operations.
 * Default OFF. Only exact env value "true" enables writes.
 * WEB entry flag is separate and does not unlock API writes.
 */

import { RrpApplicationUnavailableError } from "./rrp-application.errors.js";

export const RRP_APPLICATIONS_WRITES_ENABLED_ENV = "RRP_APPLICATIONS_WRITES_ENABLED";

let writesEnabledOverrideForTests: boolean | null = null;

/**
 * Test-only override. Pass `null` to clear and resume env-based evaluation.
 */
export function setRrpApplicationWritesEnabledForTests(enabled: boolean | null): void {
  writesEnabledOverrideForTests = enabled;
}

export function isRrpApplicationWritesEnabled(
  env: Readonly<Record<string, string | undefined>> = process.env,
): boolean {
  if (writesEnabledOverrideForTests !== null) {
    return writesEnabledOverrideForTests;
  }
  return env[RRP_APPLICATIONS_WRITES_ENABLED_ENV] === "true";
}

/**
 * Fail closed when RRP writes are not explicitly enabled.
 * Used by shared service/domain entry points (not WEB-only).
 */
export function assertRrpApplicationWritesEnabled(): void {
  if (!isRrpApplicationWritesEnabled()) {
    throw new RrpApplicationUnavailableError(
      "Regional Representative application writes are not enabled.",
    );
  }
}
