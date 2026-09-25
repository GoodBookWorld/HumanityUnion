/**
 * STEP 15D.8E.3 — Auth register/login Turnstile gate (fail-closed).
 */
import { verifyTurnstileToken } from "../security/turnstile.js";
import { AuthValidationError } from "./auth.errors.js";

const UNAVAILABLE_MESSAGE =
  "Security verification is temporarily unavailable. Please try again.";

/**
 * Verify Turnstile before any credential/registration work.
 * Does not leak Cloudflare internals.
 */
export async function requireAuthTurnstileToken(
  token: unknown,
  remoteIp?: string,
): Promise<void> {
  const result = await verifyTurnstileToken({ token, remoteIp });
  if (result.ok) {
    return;
  }
  if (result.reason === "turnstile_missing") {
    throw new AuthValidationError("Security verification is required.");
  }
  if (result.reason === "turnstile_unavailable") {
    throw new AuthValidationError(UNAVAILABLE_MESSAGE);
  }
  throw new AuthValidationError("Security verification failed. Please try again.");
}
