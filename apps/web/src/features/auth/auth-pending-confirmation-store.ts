const PENDING_CONFIRMATION_TOKEN_KEY = "hu_pending_confirmation_token";
const PENDING_CONFIRMATION_MASKED_EMAIL_KEY = "hu_pending_confirmation_masked_email";

export function storePendingConfirmationContext(input: {
  pendingConfirmationToken: string;
  maskedEmail: string;
}): void {
  if (typeof window === "undefined") {
    return;
  }

  sessionStorage.setItem(PENDING_CONFIRMATION_TOKEN_KEY, input.pendingConfirmationToken);
  sessionStorage.setItem(PENDING_CONFIRMATION_MASKED_EMAIL_KEY, input.maskedEmail);
}

export function getPendingConfirmationToken(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  return sessionStorage.getItem(PENDING_CONFIRMATION_TOKEN_KEY);
}

export function getPendingConfirmationMaskedEmail(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  return sessionStorage.getItem(PENDING_CONFIRMATION_MASKED_EMAIL_KEY);
}

export function clearPendingConfirmationContext(): void {
  if (typeof window === "undefined") {
    return;
  }

  sessionStorage.removeItem(PENDING_CONFIRMATION_TOKEN_KEY);
  sessionStorage.removeItem(PENDING_CONFIRMATION_MASKED_EMAIL_KEY);
}

function buildPendingConfirmationHeaders(): HeadersInit {
  const token = getPendingConfirmationToken();

  if (!token) {
    return {};
  }

  return {
    Authorization: `Bearer ${token}`,
  };
}

export { buildPendingConfirmationHeaders };
