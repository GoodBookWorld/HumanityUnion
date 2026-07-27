const PENDING_LOGIN_TWO_STEP_TOKEN_KEY = "hu_pending_login_two_step_token";

export function storePendingLoginTwoStepToken(token: string): void {
  if (typeof window === "undefined") {
    return;
  }

  sessionStorage.setItem(PENDING_LOGIN_TWO_STEP_TOKEN_KEY, token);
}

export function getPendingLoginTwoStepToken(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  return sessionStorage.getItem(PENDING_LOGIN_TWO_STEP_TOKEN_KEY);
}

export function clearPendingLoginTwoStepToken(): void {
  if (typeof window === "undefined") {
    return;
  }

  sessionStorage.removeItem(PENDING_LOGIN_TWO_STEP_TOKEN_KEY);
}

export function buildPendingLoginTwoStepHeaders(): HeadersInit {
  const token = getPendingLoginTwoStepToken();

  if (!token) {
    return {};
  }

  return {
    Authorization: `Bearer ${token}`,
  };
}
