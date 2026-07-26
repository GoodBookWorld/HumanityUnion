import type { EmailConfirmationCodePurpose } from "../email/email-confirmation-code.repository.js";
import {
  countAccountAuthCodeSends,
  countChallengeAuthCodeResends,
  countIpAuthCodeSends,
} from "../email/email-confirmation-code.repository.js";
import { resolveEmailConfirmationConfig } from "../email/email-confirmation.config.js";
import { resolveLoginEmailTwoStepConfig } from "../email/login-email-two-step.config.js";
import { AuthCodeRateLimitError } from "./auth.errors.js";

export type AuthCodeRateLimitType =
  "cooldown" | "account_hourly_limit" | "ip_hourly_limit" | "challenge_limit";

interface AuthCodeRateLimitPolicy {
  resendCooldownSeconds: number;
  maxSendsPerHour: number;
  ipMaxSendsPerHour: number;
  maxResendsPerChallenge: number;
}

function resolvePolicyForPurpose(purpose: EmailConfirmationCodePurpose): AuthCodeRateLimitPolicy {
  if (
    purpose === "login_email_two_step" ||
    purpose === "login_two_step_enable" ||
    purpose === "login_two_step_disable"
  ) {
    const config = resolveLoginEmailTwoStepConfig();
    return {
      resendCooldownSeconds: config.resendCooldownSeconds,
      maxSendsPerHour: config.maxSendsPerHour,
      ipMaxSendsPerHour: config.ipMaxSendsPerHour,
      maxResendsPerChallenge: config.maxResendsPerChallenge,
    };
  }

  const config = resolveEmailConfirmationConfig();
  return {
    resendCooldownSeconds: config.resendCooldownSeconds,
    maxSendsPerHour: config.maxSendsPerHour,
    ipMaxSendsPerHour: config.ipMaxSendsPerHour,
    maxResendsPerChallenge: config.maxResendsPerChallenge,
  };
}

function formatRetryMinutes(seconds: number): string {
  const minutes = Math.max(1, Math.ceil(seconds / 60));
  return minutes === 1 ? "1 minute" : `${minutes} minutes`;
}

function buildRateLimitMessage(
  limitType: AuthCodeRateLimitType,
  retryAfterSeconds: number,
): string {
  const timeLabel =
    retryAfterSeconds >= 60
      ? formatRetryMinutes(retryAfterSeconds)
      : `${Math.max(1, retryAfterSeconds)} seconds`;

  switch (limitType) {
    case "cooldown":
      return `Please wait before requesting another code. Try again in ${timeLabel}.`;
    case "account_hourly_limit":
      return `Too many codes have been requested for this account. Try again in ${timeLabel}.`;
    case "ip_hourly_limit":
      return `Too many codes have been requested from this network. Try again in ${timeLabel}.`;
    case "challenge_limit":
      return `Too many codes have been requested for this verification challenge. Try again in ${timeLabel}.`;
    default:
      return `Too many codes have been requested. Try again in ${timeLabel}.`;
  }
}

export function resolveCooldownRetrySeconds(
  lastSentAt: string | undefined,
  cooldownSeconds: number,
): number {
  if (!lastSentAt) {
    return 0;
  }

  const availableAt = Date.parse(lastSentAt) + cooldownSeconds * 1000;
  const remainingMs = availableAt - Date.now();

  return remainingMs > 0 ? Math.ceil(remainingMs / 1000) : 0;
}

export async function assertAuthCodeSendAllowed(input: {
  userId: string;
  purpose: EmailConfirmationCodePurpose;
  ipKey?: string;
  lastSentAt?: string;
  challengeId?: string;
}): Promise<void> {
  const policy = resolvePolicyForPurpose(input.purpose);
  const cooldownRetrySeconds = resolveCooldownRetrySeconds(
    input.lastSentAt,
    policy.resendCooldownSeconds,
  );

  if (cooldownRetrySeconds > 0) {
    throw new AuthCodeRateLimitError(
      buildRateLimitMessage("cooldown", cooldownRetrySeconds),
      cooldownRetrySeconds,
      "cooldown",
    );
  }

  const sinceIso = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const accountSends = await countAccountAuthCodeSends({
    userId: input.userId,
    purpose: input.purpose,
    sinceIso,
  });

  if (accountSends >= policy.maxSendsPerHour) {
    const retryAfterSeconds = 3600;
    throw new AuthCodeRateLimitError(
      buildRateLimitMessage("account_hourly_limit", retryAfterSeconds),
      retryAfterSeconds,
      "account_hourly_limit",
    );
  }

  if (input.ipKey) {
    const ipSends = await countIpAuthCodeSends({
      ipKey: input.ipKey,
      purpose: input.purpose,
      sinceIso,
    });

    if (ipSends >= policy.ipMaxSendsPerHour) {
      const retryAfterSeconds = 3600;
      throw new AuthCodeRateLimitError(
        buildRateLimitMessage("ip_hourly_limit", retryAfterSeconds),
        retryAfterSeconds,
        "ip_hourly_limit",
      );
    }
  }

  if (input.challengeId) {
    const challengeResends = await countChallengeAuthCodeResends({
      confirmationId: input.challengeId,
    });

    if (challengeResends >= policy.maxResendsPerChallenge) {
      const retryAfterSeconds = policy.resendCooldownSeconds;
      throw new AuthCodeRateLimitError(
        buildRateLimitMessage("challenge_limit", retryAfterSeconds),
        retryAfterSeconds,
        "challenge_limit",
      );
    }
  }
}
