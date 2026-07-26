import type { AuthSessionResult } from "./auth-session.issue.js";

import { confirmMemberRegistration } from "../member/application/confirm-member-registration.service.js";
import { findMemberByIdentityId } from "../member/infrastructure/member.repository.js";
import { assertAuthCodeSendAllowed } from "./auth-code-rate-limit.js";
import {
  maskEmailAddress,
  resolveEmailConfirmationConfig,
} from "../email/email-confirmation.config.js";
import {
  consumeEmailConfirmationCode,
  createEmailConfirmationCode,
  discardEmailConfirmationCode,
  findActiveEmailConfirmationCode,
  findLatestEmailConfirmationSendAt,
  incrementEmailConfirmationAttempt,
  markEmailConfirmationCodeDelivered,
  revokeActiveEmailConfirmationCodes,
  revokeActiveEmailConfirmationCodesExcept,
} from "../email/email-confirmation-code.repository.js";
import {
  sendRegistrationConfirmationCodeEmail,
  sendRegistrationWelcomeEmail,
} from "../email/email.service.js";
import { AuthValidationError } from "./auth.errors.js";
import { createPendingConfirmationToken } from "./auth-pending-confirmation.tokens.js";
import { issueAuthSession } from "./auth-session.issue.js";
import {
  findAuthUserById,
  markRegistrationWelcomeEmailSent,
} from "./auth-user.repository.js";

export interface RegistrationPendingConfirmationResult {
  emailConfirmationRequired: true;
  emailSent: boolean;
  maskedEmail: string;
  resendAvailableAt: string | null;
  pendingConfirmationToken: string;
  emailDeliveryError?: string;
}

export interface EmailConfirmationStatusResult {
  status: "pending" | "confirmed" | "expired";
  emailSent: boolean;
  maskedEmail: string;
  resendAvailableAt: string | null;
  attemptsRemaining: number | null;
  emailDeliveryError?: string;
}

const REGISTRATION_CONFIRMATION_PURPOSE = "registration_email_confirmation" as const;

function normalizeConfirmationCode(code: string): string {
  return code.trim().replace(/\s+/g, "");
}

function assertValidConfirmationCodeFormat(code: string): void {
  if (!/^\d{6}$/.test(code)) {
    throw new AuthValidationError("The confirmation code is incorrect.");
  }
}

function resolveResendAvailableAt(lastSentAt: string | undefined): string | null {
  const config = resolveEmailConfirmationConfig();
  const lastSentMs = lastSentAt ? Date.parse(lastSentAt) : 0;
  const availableAt = lastSentMs + config.resendCooldownSeconds * 1000;

  if (availableAt <= Date.now()) {
    return null;
  }

  return new Date(availableAt).toISOString();
}

async function deliverRegistrationConfirmationCode(input: {
  userId: string;
  email: string;
  displayName: string;
  ipKey?: string;
  preserveExistingActive?: boolean;
}): Promise<{ emailSent: boolean; emailDeliveryError?: string }> {
  const user = await findAuthUserById(input.userId);

  if (!user || user.emailVerificationStatus === "verified") {
    return { emailSent: false };
  }

  const issued = await createEmailConfirmationCode({
    userId: input.userId,
    email: input.email,
    purpose: REGISTRATION_CONFIRMATION_PURPOSE,
    ipKey: input.ipKey,
    preserveExistingActive: input.preserveExistingActive,
  });

  const delivery = await sendRegistrationConfirmationCodeEmail({
    to: input.email,
    displayName: input.displayName,
    confirmationCode: issued.code,
    expiresMinutes: resolveEmailConfirmationConfig().codeTtlMinutes,
  });

  if (delivery.emailSent) {
    await markEmailConfirmationCodeDelivered({
      confirmationId: issued.record.confirmationId,
      userId: input.userId,
      email: input.email,
      purpose: REGISTRATION_CONFIRMATION_PURPOSE,
      sentAt: new Date().toISOString(),
      ipKey: input.ipKey,
    });

    if (input.preserveExistingActive) {
      await revokeActiveEmailConfirmationCodesExcept({
        userId: input.userId,
        purpose: REGISTRATION_CONFIRMATION_PURPOSE,
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

export async function queueRegistrationConfirmationCode(
  userId: string,
  ipKey?: string,
): Promise<{ emailSent: boolean; emailDeliveryError?: string }> {
  const user = await findAuthUserById(userId);

  if (!user || user.emailVerificationStatus === "verified") {
    return { emailSent: false };
  }

  return deliverRegistrationConfirmationCode({
    userId: user.userId,
    email: user.email,
    displayName: user.displayName,
    ipKey,
  });
}

export async function buildRegistrationPendingConfirmationResultAsync(
  user: {
    userId: string;
    memberId: string;
    email: string;
    displayName: string;
  },
  delivery: { emailSent: boolean; emailDeliveryError?: string },
): Promise<RegistrationPendingConfirmationResult> {
  const activeCode = await findActiveEmailConfirmationCode({
    userId: user.userId,
    purpose: "registration_email_confirmation",
  });

  return {
    emailConfirmationRequired: true,
    emailSent: delivery.emailSent,
    maskedEmail: maskEmailAddress(user.email),
    resendAvailableAt: delivery.emailSent ? resolveResendAvailableAt(activeCode?.lastSentAt) : null,
    pendingConfirmationToken: createPendingConfirmationToken({
      userId: user.userId,
      memberId: user.memberId,
      email: user.email,
      displayName: user.displayName,
    }),
    emailDeliveryError: delivery.emailDeliveryError,
  };
}

export async function getEmailConfirmationStatus(
  userId: string,
): Promise<EmailConfirmationStatusResult> {
  const user = await findAuthUserById(userId);

  if (!user) {
    throw new AuthValidationError("Email confirmation session is invalid.");
  }

  if (user.emailVerificationStatus === "verified") {
    return {
      status: "confirmed",
      emailSent: true,
      maskedEmail: maskEmailAddress(user.email),
      resendAvailableAt: null,
      attemptsRemaining: null,
    };
  }

  const activeCode = await findActiveEmailConfirmationCode({
    userId: user.userId,
    purpose: "registration_email_confirmation",
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

  return {
    status: "pending",
    emailSent: Boolean(activeCode.lastSentAt),
    maskedEmail: maskEmailAddress(user.email),
    resendAvailableAt: resolveResendAvailableAt(activeCode.lastSentAt),
    attemptsRemaining: Math.max(activeCode.maxAttempts - activeCode.attemptCount, 0),
  };
}

export async function confirmRegistrationEmailCode(input: {
  userId: string;
  code: string;
}): Promise<AuthSessionResult> {
  const normalizedCode = normalizeConfirmationCode(input.code);
  assertValidConfirmationCodeFormat(normalizedCode);

  const user = await findAuthUserById(input.userId);

  if (!user) {
    throw new AuthValidationError("Email confirmation session is invalid.");
  }

  if (user.emailVerificationStatus === "verified") {
    const existingMember = await findMemberByIdentityId(user.userId);

    if (existingMember) {
      return issueAuthSession(user);
    }

    await confirmMemberRegistration(user);
    const refreshedUser = await findAuthUserById(user.userId);

    if (!refreshedUser) {
      throw new AuthValidationError("Email confirmation session is invalid.");
    }

    return issueAuthSession(refreshedUser);
  }

  const activeCode = await findActiveEmailConfirmationCode({
    userId: user.userId,
    purpose: "registration_email_confirmation",
  });

  if (!activeCode) {
    throw new AuthValidationError("This confirmation code has expired. Request a new code.");
  }

  const consumed = await consumeEmailConfirmationCode({
    userId: user.userId,
    code: normalizedCode,
    purpose: "registration_email_confirmation",
  });

  if (!consumed) {
    const updated = await incrementEmailConfirmationAttempt(activeCode.confirmationId);

    if (updated && updated.status === "revoked") {
      throw new AuthValidationError(
        "Too many unsuccessful attempts. Request a new code when available.",
      );
    }

    throw new AuthValidationError("The confirmation code is incorrect.");
  }

  await revokeActiveEmailConfirmationCodes({
    userId: user.userId,
    purpose: "registration_email_confirmation",
  });

  await confirmMemberRegistration(user);
  const verifiedUser = await findAuthUserById(user.userId);

  if (!verifiedUser || verifiedUser.emailVerificationStatus !== "verified") {
    throw new AuthValidationError("Email confirmation session is invalid.");
  }

  const welcomeSent = await markRegistrationWelcomeEmailSent(verifiedUser.userId);

  if (welcomeSent) {
    await sendRegistrationWelcomeEmail({
      to: verifiedUser.email,
      displayName: verifiedUser.displayName,
    }).catch((error) => {
      const message = error instanceof Error ? error.message : "Welcome email failed.";
      console.error(`[auth:email] ${message}`);
    });
  }

  return issueAuthSession(verifiedUser);
}

export async function resendRegistrationConfirmationCode(input: {
  userId: string;
  ipKey?: string;
}): Promise<EmailConfirmationStatusResult> {
  const user = await findAuthUserById(input.userId);

  if (!user) {
    throw new AuthValidationError("Email confirmation session is invalid.");
  }

  if (user.emailVerificationStatus === "verified") {
    throw new AuthValidationError("Email address is already confirmed.");
  }

  const activeCode = await findActiveEmailConfirmationCode({
    userId: user.userId,
    purpose: "registration_email_confirmation",
  });
  const lastSentAt =
    activeCode?.lastSentAt ??
    (await findLatestEmailConfirmationSendAt({
      userId: user.userId,
      purpose: "registration_email_confirmation",
    })) ??
    undefined;

  await assertAuthCodeSendAllowed({
    userId: user.userId,
    purpose: REGISTRATION_CONFIRMATION_PURPOSE,
    ipKey: input.ipKey,
    lastSentAt,
    challengeId: activeCode?.confirmationId,
  });

  const delivery = await deliverRegistrationConfirmationCode({
    userId: user.userId,
    email: user.email,
    displayName: user.displayName,
    ipKey: input.ipKey,
    preserveExistingActive: true,
  });
  const status = await getEmailConfirmationStatus(user.userId);

  return {
    ...status,
    emailSent: delivery.emailSent,
    emailDeliveryError: delivery.emailDeliveryError,
    resendAvailableAt: delivery.emailSent
      ? status.resendAvailableAt
      : resolveResendAvailableAt(lastSentAt),
  };
}
