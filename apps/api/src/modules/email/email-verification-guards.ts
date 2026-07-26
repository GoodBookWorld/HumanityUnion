const RESERVED_TEST_DOMAINS = [
  "example.com",
  "example.org",
  "example.net",
  "test",
  "invalid",
  "localhost",
] as const;

export function isVerificationMode(): boolean {
  return process.env.HU_VERIFICATION_MODE === "true";
}

export function isRealEmailAllowedInTests(): boolean {
  return process.env.ALLOW_REAL_EMAIL_IN_TESTS === "true";
}

export function assertSafeEmailProviderForCurrentMode(requestedProvider: string): void {
  if (!isVerificationMode()) {
    return;
  }

  if (isRealEmailAllowedInTests()) {
    return;
  }

  if (requestedProvider === "smtp" || requestedProvider === "resend") {
    throw new Error(
      `Unsafe email provider "${requestedProvider}" blocked in verification mode. ` +
        "Set EMAIL_PROVIDER=mock or HU_VERIFICATION_MODE=false. " +
        "Real providers require ALLOW_REAL_EMAIL_IN_TESTS=true for deliberate manual testing only.",
    );
  }
}

export function isReservedTestRecipient(email: string): boolean {
  const normalized = email.trim().toLowerCase();
  const atIndex = normalized.lastIndexOf("@");

  if (atIndex <= 0) {
    return true;
  }

  const domain = normalized.slice(atIndex + 1);

  return RESERVED_TEST_DOMAINS.some(
    (reserved) => domain === reserved || domain.endsWith(`.${reserved}`),
  );
}

export function assertSafeRecipientForVerificationMode(
  recipientEmail: string,
  providerId: string,
): void {
  if (!isVerificationMode()) {
    return;
  }

  if (providerId === "mock") {
    return;
  }

  if (isReservedTestRecipient(recipientEmail)) {
    throw new Error(
      `Reserved test recipient domain blocked for real provider "${providerId}" in verification mode.`,
    );
  }
}

export function maskRecipientEmail(email: string): string {
  const normalized = email.trim();
  const atIndex = normalized.indexOf("@");

  if (atIndex <= 1) {
    return "***";
  }

  return `${normalized[0]}***${normalized.slice(atIndex)}`;
}
