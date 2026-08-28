/**
 * Pack 26A — Stripe livemode / environment mismatch guard.
 * Uses Stripe event/session `livemode` (not key-prefix inference).
 */
import { isPlatformModeProduction, resolvePlatformMode } from "../../config/platform.config.js";

export class StripeLivemodeMismatchError extends Error {
  readonly code = "STRIPE_LIVEMODE_MISMATCH" as const;

  constructor(message: string) {
    super(message);
    this.name = "StripeLivemodeMismatchError";
  }
}

/**
 * Production expects Live Mode (`livemode=true`).
 * Staging / beta / development expect Test Mode (`livemode=false`).
 *
 * `PLATFORM_MODE=staging` resolves to beta via {@link resolvePlatformMode}.
 */
export function expectStripeLivemode(): boolean {
  return isPlatformModeProduction();
}

export function assertStripeLivemodeMatchesEnvironment(livemode: boolean): void {
  const expectedLive = expectStripeLivemode();
  if (livemode === expectedLive) {
    return;
  }

  const mode = resolvePlatformMode();
  throw new StripeLivemodeMismatchError(
    expectedLive
      ? `Stripe Test Mode event rejected in PLATFORM_MODE=${mode} (expected Live Mode).`
      : `Stripe Live Mode event rejected in PLATFORM_MODE=${mode} (expected Test Mode).`,
  );
}
