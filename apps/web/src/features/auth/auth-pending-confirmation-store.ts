/**
 * Launch Readiness Pack 07 — pending confirmation JWT lives in an HttpOnly
 * cookie (`hu_pending_confirmation`). Only non-sensitive UI state (masked
 * email) remains in sessionStorage.
 */

const PENDING_CONFIRMATION_MASKED_EMAIL_KEY = "hu_pending_confirmation_masked_email";
const LEGACY_PENDING_CONFIRMATION_TOKEN_KEY = "hu_pending_confirmation_token";

function clearLegacyPendingToken(): void {
  if (typeof window === "undefined") {
    return;
  }

  sessionStorage.removeItem(LEGACY_PENDING_CONFIRMATION_TOKEN_KEY);
}

export function storePendingConfirmationContext(input: {
  pendingConfirmationToken?: string;
  maskedEmail: string;
}): void {
  clearLegacyPendingToken();
  sessionStorage.setItem(PENDING_CONFIRMATION_MASKED_EMAIL_KEY, input.maskedEmail);
}

/** @deprecated Pack 07 — pending token is cookie-only. */
export function getPendingConfirmationToken(): string | null {
  clearLegacyPendingToken();
  return null;
}

export function getPendingConfirmationMaskedEmail(): string | null {
  return sessionStorage.getItem(PENDING_CONFIRMATION_MASKED_EMAIL_KEY);
}

export function clearPendingConfirmationContext(): void {
  clearLegacyPendingToken();
  sessionStorage.removeItem(PENDING_CONFIRMATION_MASKED_EMAIL_KEY);
}

/** Cookie credentials carry the pending session — no Authorization header. */
export function buildPendingConfirmationHeaders(): HeadersInit {
  clearLegacyPendingToken();
  return {};
}
