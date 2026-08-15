/**
 * Launch Readiness Pack 07 — login two-step challenge JWT lives in an HttpOnly
 * cookie (`hu_pending_login_two_step`). No JS-readable challenge token.
 */

const LEGACY_PENDING_LOGIN_TWO_STEP_TOKEN_KEY = "hu_pending_login_two_step_token";

function clearLegacyChallengeToken(): void {
  if (typeof window === "undefined") {
    return;
  }

  sessionStorage.removeItem(LEGACY_PENDING_LOGIN_TWO_STEP_TOKEN_KEY);
}

export function storePendingLoginTwoStepToken(_token?: string): void {
  clearLegacyChallengeToken();
}

/** @deprecated Pack 07 — challenge token is cookie-only. */
export function getPendingLoginTwoStepToken(): string | null {
  clearLegacyChallengeToken();
  return null;
}

export function clearPendingLoginTwoStepToken(): void {
  clearLegacyChallengeToken();
}

/** Cookie credentials carry the challenge — no Authorization header. */
export function buildPendingLoginTwoStepHeaders(): HeadersInit {
  clearLegacyChallengeToken();
  return {};
}
