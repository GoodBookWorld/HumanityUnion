/**
 * Mail Delivery Reliability Pack 01 — defense-in-depth email safety.
 *
 * Automated tests / verification must never reach real SMTP even when
 * apps/api/.env contains production/development credentials.
 */

const RESERVED_TEST_DOMAIN_LABELS = [
  "example.com",
  "example.org",
  "example.net",
  "test",
  "invalid",
  "localhost",
  "local",
] as const;

/** Explicit repository synthetic domains that must never leave the process. */
const REPOSITORY_SYNTHETIC_DOMAIN_SUFFIXES = [
  ".test",
  ".invalid",
  ".example",
  ".localhost",
  ".local",
] as const;

export class TestRecipientBlockedError extends Error {
  readonly code = "test_recipient_blocked" as const;

  constructor(message: string) {
    super(message);
    this.name = "TestRecipientBlockedError";
  }
}

export function isAutomatedTestOrVerificationEnvironment(): boolean {
  return (
    process.env.NODE_TEST_ENV === "true" ||
    process.env.NODE_ENV === "test" ||
    process.env.HU_VERIFICATION_MODE === "true"
  );
}

export function isVerificationMode(): boolean {
  return process.env.HU_VERIFICATION_MODE === "true";
}

export function isRealEmailAllowedInTests(): boolean {
  return process.env.ALLOW_REAL_EMAIL_IN_TESTS === "true";
}

/**
 * Staging / beta / production must never treat mock delivery as a successful
 * auth-code send. Local development may still use EMAIL_PROVIDER=mock.
 */
export function isDeployedPlatformRequiringRealEmail(): boolean {
  if (mustForceMockEmailProvider()) {
    return false;
  }

  if (process.env.NODE_ENV === "production") {
    return true;
  }

  const platformMode = process.env.PLATFORM_MODE?.trim();
  return (
    platformMode === "staging" ||
    platformMode === "beta" ||
    platformMode === "production"
  );
}

/**
 * Real SMTP/Resend must never be selected during automated tests/verification
 * unless a human explicitly opts in for a one-off smoke (`ALLOW_REAL_EMAIL_IN_TESTS`).
 */
export function mustForceMockEmailProvider(): boolean {
  return isAutomatedTestOrVerificationEnvironment() && !isRealEmailAllowedInTests();
}

export function assertSafeEmailProviderForCurrentMode(requestedProvider: string): void {
  if (!mustForceMockEmailProvider()) {
    return;
  }

  if (requestedProvider === "smtp" || requestedProvider === "resend") {
    throw new Error(
      `Unsafe email provider "${requestedProvider}" blocked in automated test/verification mode. ` +
        "EMAIL_PROVIDER is forced to mock. Real providers require ALLOW_REAL_EMAIL_IN_TESTS=true " +
        "for deliberate manual smoke testing only.",
    );
  }
}

/**
 * Generic synthetic/test recipient detector.
 * Covers RFC reserved TLDs (.test / .invalid / .example / .localhost) and
 * documentation domains — not only one repository string.
 */
export function isSyntheticTestRecipient(email: string): boolean {
  const normalized = email.trim().toLowerCase();
  const atIndex = normalized.lastIndexOf("@");

  if (atIndex <= 0 || atIndex === normalized.length - 1) {
    return true;
  }

  const domain = normalized.slice(atIndex + 1);

  if (!domain.includes(".")) {
    // Bare labels such as "localhost" or "test".
    return RESERVED_TEST_DOMAIN_LABELS.includes(
      domain as (typeof RESERVED_TEST_DOMAIN_LABELS)[number],
    );
  }

  if (
    REPOSITORY_SYNTHETIC_DOMAIN_SUFFIXES.some(
      (suffix) => domain === suffix.slice(1) || domain.endsWith(suffix),
    )
  ) {
    return true;
  }

  return RESERVED_TEST_DOMAIN_LABELS.some(
    (reserved) => domain === reserved || domain.endsWith(`.${reserved}`),
  );
}

/** @deprecated Pack 01 — use isSyntheticTestRecipient. */
export function isReservedTestRecipient(email: string): boolean {
  return isSyntheticTestRecipient(email);
}

/**
 * Hard guard before any external provider send.
 * Applies in every environment — not only verification mode — so a misconfigured
 * production/dev process cannot bounce synthetic addresses through Flockmail.
 */
export function assertRecipientAllowedForExternalDelivery(
  recipientEmail: string,
  providerId: string,
): void {
  if (providerId === "mock") {
    return;
  }

  if (isSyntheticTestRecipient(recipientEmail)) {
    throw new TestRecipientBlockedError(
      `Synthetic/test recipient blocked for external provider "${providerId}" ` +
        "(test-recipient-blocked). Message was not submitted to SMTP.",
    );
  }
}

/** Legacy name used by verification docs — always delegates to hard guard. */
export function assertSafeRecipientForVerificationMode(
  recipientEmail: string,
  providerId: string,
): void {
  assertRecipientAllowedForExternalDelivery(recipientEmail, providerId);
}

export function maskRecipientEmail(email: string): string {
  const normalized = email.trim();
  const atIndex = normalized.indexOf("@");

  if (atIndex <= 1) {
    return "***";
  }

  return `${normalized[0]}***${normalized.slice(atIndex)}`;
}

export function recipientDomainForLogs(email: string): string {
  const normalized = email.trim().toLowerCase();
  const atIndex = normalized.lastIndexOf("@");
  if (atIndex <= 0) {
    return "unknown";
  }
  return normalized.slice(atIndex + 1);
}

export function isSafePublicHttpsLogoUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") {
      return false;
    }
    const host = parsed.hostname.toLowerCase();
    if (
      host === "localhost" ||
      host === "127.0.0.1" ||
      host.endsWith(".local") ||
      host.endsWith(".test") ||
      host.endsWith(".invalid") ||
      host.endsWith(".example")
    ) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}
