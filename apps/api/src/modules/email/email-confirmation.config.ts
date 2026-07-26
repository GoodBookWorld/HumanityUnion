export interface EmailConfirmationConfig {
  codeTtlMinutes: number;
  maxAttempts: number;
  resendCooldownSeconds: number;
  maxSendsPerHour: number;
  ipMaxSendsPerHour: number;
  maxResendsPerChallenge: number;
  pendingTokenExpiresIn: string;
}

export function resolveEmailConfirmationConfig(): EmailConfirmationConfig {
  return {
    codeTtlMinutes: Number.parseInt(process.env.EMAIL_CONFIRMATION_CODE_TTL_MINUTES ?? "15", 10),
    maxAttempts: Number.parseInt(process.env.EMAIL_CONFIRMATION_MAX_ATTEMPTS ?? "5", 10),
    resendCooldownSeconds: Number.parseInt(
      process.env.EMAIL_CONFIRMATION_RESEND_COOLDOWN_SECONDS ?? "60",
      10,
    ),
    maxSendsPerHour: Number.parseInt(process.env.EMAIL_CONFIRMATION_MAX_SENDS_PER_HOUR ?? "5", 10),
    ipMaxSendsPerHour: Number.parseInt(
      process.env.EMAIL_CONFIRMATION_IP_MAX_SENDS_PER_HOUR ?? "20",
      10,
    ),
    maxResendsPerChallenge: Number.parseInt(
      process.env.EMAIL_CONFIRMATION_MAX_RESENDS_PER_CHALLENGE ?? "5",
      10,
    ),
    pendingTokenExpiresIn: process.env.EMAIL_CONFIRMATION_PENDING_TOKEN_EXPIRES_IN ?? "24h",
  };
}

export function maskEmailAddress(email: string): string {
  const normalized = email.trim().toLowerCase();
  const [localPart, domain] = normalized.split("@");

  if (!localPart || !domain) {
    return "your email address";
  }

  if (localPart.length <= 2) {
    return `${localPart[0] ?? "*"}*@${domain}`;
  }

  const visible = localPart.slice(0, 2);
  return `${visible}${"*".repeat(Math.max(localPart.length - 2, 1))}@${domain}`;
}
