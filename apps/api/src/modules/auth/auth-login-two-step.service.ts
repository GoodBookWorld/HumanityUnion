import type { AuthSessionResult } from "./auth-session.issue.js";
import type { AuthUserRecord } from "./auth-user.types.js";

import { assertAuthCodeSendAllowed } from "./auth-code-rate-limit.js";
import { maskEmailAddress } from "../email/email-confirmation.config.js";
import { resolveLoginEmailTwoStepConfig } from "../email/login-email-two-step.config.js";
import {
  consumeEmailConfirmationCode,
  createEmailConfirmationCode,
  discardEmailConfirmationCode,
  findActiveEmailConfirmationCode,
  findLatestEmailConfirmationSendAt,
  incrementEmailConfirmationAttempt,
  markEmailConfirmationCodeDelivered,
  resolveResendPolicyForPurpose,
  revokeActiveEmailConfirmationCodes,
  revokeActiveEmailConfirmationCodesExcept,
} from "../email/email-confirmation-code.repository.js";
import { sendLoginTwoStepCodeEmail } from "../email/email.service.js";
import { AuthValidationError } from "./auth.errors.js";
import { createPendingLoginTwoStepToken } from "./auth-pending-login-two-step.tokens.js";
import { issueAuthSession } from "./auth-session.issue.js";
import { findAuthUserById, updateAuthUserLastLogin } from "./auth-user.repository.js";
import { resolveEmailConfig } from "../email/email.config.js";
import { sendLoginNotificationEmail } from "../email/email.service.js";

export interface LoginTwoStepRequiredResult {
  authenticationComplete: false;
  twoStepRequired: true;
  emailSent: boolean;
  maskedEmail: string;
  resendAvailableAt: string | null;
  challengeToken: string;
  emailDeliveryError?: string;
}

export interface LoginTwoStepStatusResult {
  status: "pending" | "expired";
  emailSent: boolean;
  maskedEmail: string;
  resendAvailableAt: string | null;
  attemptsRemaining: number | null;
  emailDeliveryError?: string;
}

const LOGIN_TWO_STEP_PURPOSE = "login_email_two_step" as const;

function normalizeCode(code: string): string {
  return code.trim().replace(/\s+/g, "");
}

function assertValidCodeFormat(code: string): void {
  if (!/^\d{6}$/.test(code)) {
    throw new AuthValidationError("The login code is incorrect.");
  }
}

function resolveResendAvailableAt(lastSentAt: string | undefined): string | null {
  const policy = resolveResendPolicyForPurpose(LOGIN_TWO_STEP_PURPOSE);
  const lastSentMs = lastSentAt ? Date.parse(lastSentAt) : 0;
  const availableAt = lastSentMs + policy.resendCooldownSeconds * 1000;

  if (availableAt <= Date.now()) {
    return null;
  }

  return new Date(availableAt).toISOString();
}

async function deliverLoginTwoStepCode(input: {
  user: AuthUserRecord;
  ipKey?: string;
  preserveExistingActive?: boolean;
}): Promise<{ emailSent: boolean; emailDeliveryError?: string }> {
  const issued = await createEmailConfirmationCode({
    userId: input.user.userId,
    email: input.user.email,
    purpose: LOGIN_TWO_STEP_PURPOSE,
    ipKey: input.ipKey,
    preserveExistingActive: input.preserveExistingActive,
  });

  const config = resolveLoginEmailTwoStepConfig();
  const delivery = await sendLoginTwoStepCodeEmail({
    to: input.user.email,
    displayName: input.user.displayName,
    loginCode: issued.code,
    expiresMinutes: config.codeTtlMinutes,
  });

  if (delivery.emailSent) {
    await markEmailConfirmationCodeDelivered({
      confirmationId: issued.record.confirmationId,
      userId: input.user.userId,
      email: input.user.email,
      purpose: LOGIN_TWO_STEP_PURPOSE,
      sentAt: new Date().toISOString(),
      ipKey: input.ipKey,
    });

    if (input.preserveExistingActive) {
      await revokeActiveEmailConfirmationCodesExcept({
        userId: input.user.userId,
        purpose: LOGIN_TWO_STEP_PURPOSE,
        confirmationId: issued.record.confirmationId,
      });
    }
  } else {
    await discardEmailConfirmationCode(issued.record.confirmationId);
  }

  return {
    emailSent: delivery.emailSent,
    emailDeliveryError: delivery.emailDeliveryError,
  };
}

export async function queueLoginTwoStepCode(
  userId: string,
  ipKey?: string,
): Promise<{ emailSent: boolean; emailDeliveryError?: string }> {
  const user = await findAuthUserById(userId);

  if (!user || user.emailVerificationStatus !== "verified" || !user.loginEmailTwoStepEnabled) {
    return { emailSent: false };
  }

  return deliverLoginTwoStepCode({ user, ipKey });
}

export async function buildLoginTwoStepRequiredResult(
  user: AuthUserRecord,
  delivery: { emailSent: boolean; emailDeliveryError?: string },
): Promise<LoginTwoStepRequiredResult> {
  const activeCode = await findActiveEmailConfirmationCode({
    userId: user.userId,
    purpose: LOGIN_TWO_STEP_PURPOSE,
  });
  const lastSentAt =
    activeCode?.lastSentAt ??
    (await findLatestEmailConfirmationSendAt({
      userId: user.userId,
      purpose: LOGIN_TWO_STEP_PURPOSE,
    })) ??
    undefined;

  return {
    authenticationComplete: false,
    twoStepRequired: true,
    emailSent: delivery.emailSent,
    maskedEmail: maskEmailAddress(user.email),
    resendAvailableAt: delivery.emailSent ? resolveResendAvailableAt(lastSentAt) : null,
    challengeToken: createPendingLoginTwoStepToken({
      userId: user.userId,
      memberId: user.memberId,
      email: user.email,
      displayName: user.displayName,
    }),
    emailDeliveryError: delivery.emailDeliveryError,
  };
}

export async function getLoginTwoStepStatus(userId: string): Promise<LoginTwoStepStatusResult> {
  const user = await findAuthUserById(userId);

  if (!user) {
    throw new AuthValidationError("Login verification session is invalid.");
  }

  const activeCode = await findActiveEmailConfirmationCode({
    userId: user.userId,
    purpose: LOGIN_TWO_STEP_PURPOSE,
  });

  if (!activeCode) {
    return {
      status: "expired",
      emailSent: false,
      maskedEmail: maskEmailAddress(user.email),
      resendAvailableAt: null,
      attemptsRemaining: null,
    };
  }

  const lastSentAt =
    activeCode.lastSentAt ??
    (await findLatestEmailConfirmationSendAt({
      userId: user.userId,
      purpose: LOGIN_TWO_STEP_PURPOSE,
    })) ??
    undefined;

  return {
    status: "pending",
    emailSent: Boolean(lastSentAt),
    maskedEmail: maskEmailAddress(user.email),
    resendAvailableAt: resolveResendAvailableAt(lastSentAt),
    attemptsRemaining: Math.max(activeCode.maxAttempts - activeCode.attemptCount, 0),
  };
}

export async function confirmLoginTwoStepCode(input: {
  userId: string;
  code: string;
  userAgent?: string;
}): Promise<AuthSessionResult> {
  const normalizedCode = normalizeCode(input.code);
  assertValidCodeFormat(normalizedCode);

  const user = await findAuthUserById(input.userId);

  if (!user || user.emailVerificationStatus !== "verified" || !user.loginEmailTwoStepEnabled) {
    throw new AuthValidationError("Login verification session is invalid.");
  }

  const activeCode = await findActiveEmailConfirmationCode({
    userId: user.userId,
    purpose: LOGIN_TWO_STEP_PURPOSE,
  });

  if (!activeCode) {
    throw new AuthValidationError("This login code has expired. Request a new code.");
  }

  const consumed = await consumeEmailConfirmationCode({
    userId: user.userId,
    code: normalizedCode,
    purpose: LOGIN_TWO_STEP_PURPOSE,
  });

  if (!consumed) {
    const updated = await incrementEmailConfirmationAttempt(activeCode.confirmationId);

    if (updated && updated.status === "revoked") {
      throw new AuthValidationError(
        "Too many unsuccessful attempts. Request a new code when available.",
      );
    }

    throw new AuthValidationError("The login code is incorrect.");
  }

  await revokeActiveEmailConfirmationCodes({
    userId: user.userId,
    purpose: LOGIN_TWO_STEP_PURPOSE,
  });

  const now = new Date().toISOString();
  await updateAuthUserLastLogin(user.userId, now);

  const loggedInUser = { ...user, lastLoginAt: now, updatedAt: now };
  const emailConfig = resolveEmailConfig();

  if (emailConfig.sendLoginNotifications) {
    void sendLoginNotificationEmail({
      to: loggedInUser.email,
      displayName: loggedInUser.displayName,
      loginTime: now,
      userAgent: input.userAgent,
    }).catch((error) => {
      const message = error instanceof Error ? error.message : "Login notification email failed.";
      console.error(`[auth:email] ${message}`);
    });
  }

  return issueAuthSession(loggedInUser, input.userAgent);
}

export async function resendLoginTwoStepCode(input: {
  userId: string;
  ipKey?: string;
}): Promise<LoginTwoStepStatusResult> {
  const user = await findAuthUserById(input.userId);

  if (!user || user.emailVerificationStatus !== "verified" || !user.loginEmailTwoStepEnabled) {
    throw new AuthValidationError("Login verification session is invalid.");
  }

  const activeCode = await findActiveEmailConfirmationCode({
    userId: user.userId,
    purpose: LOGIN_TWO_STEP_PURPOSE,
  });
  const lastSentAt =
    activeCode?.lastSentAt ??
    (await findLatestEmailConfirmationSendAt({
      userId: user.userId,
      purpose: LOGIN_TWO_STEP_PURPOSE,
    })) ??
    undefined;

  await assertAuthCodeSendAllowed({
    userId: user.userId,
    purpose: LOGIN_TWO_STEP_PURPOSE,
    ipKey: input.ipKey,
    lastSentAt,
    challengeId: activeCode?.confirmationId,
  });

  const delivery = await deliverLoginTwoStepCode({
    user,
    ipKey: input.ipKey,
    preserveExistingActive: true,
  });
  const status = await getLoginTwoStepStatus(user.userId);

  return {
    ...status,
    emailSent: delivery.emailSent,
    emailDeliveryError: delivery.emailDeliveryError,
    resendAvailableAt: delivery.emailSent
      ? status.resendAvailableAt
      : resolveResendAvailableAt(lastSentAt),
  };
}
