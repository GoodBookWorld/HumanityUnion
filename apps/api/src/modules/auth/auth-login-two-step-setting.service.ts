import type { AuthUserPublic } from "@hu/types";

import { maskEmailAddress } from "../email/email-confirmation.config.js";
import { resolveLoginEmailTwoStepConfig } from "../email/login-email-two-step.config.js";
import {
  consumeEmailConfirmationCode,
  countRecentEmailConfirmationSends,
  createEmailConfirmationCode,
  findActiveEmailConfirmationCode,
  findLatestEmailConfirmationSendAt,
  incrementEmailConfirmationAttempt,
  markEmailConfirmationCodeDelivered,
  resolveResendPolicyForPurpose,
  revokeActiveEmailConfirmationCodes,
} from "../email/email-confirmation-code.repository.js";
import { sendLoginTwoStepCodeEmail } from "../email/email.service.js";
import { AuthValidationError } from "./auth.errors.js";
import { verifyPassword } from "./auth-password.js";
import { findAuthUserById, setAuthUserLoginEmailTwoStepEnabled } from "./auth-user.repository.js";
import { toAuthUserPublic } from "./auth-user.projection.js";

export interface LoginTwoStepSettingStartResult {
  emailSent: boolean;
  maskedEmail: string;
  resendAvailableAt: string | null;
  emailDeliveryError?: string;
}

function normalizeCode(code: string): string {
  return code.trim().replace(/\s+/g, "");
}

function assertValidCodeFormat(code: string): void {
  if (!/^\d{6}$/.test(code)) {
    throw new AuthValidationError("The code is incorrect.");
  }
}

function resolveResendAvailableAt(
  lastSentAt: string | undefined,
  purpose: "login_two_step_enable" | "login_two_step_disable",
): string | null {
  const policy = resolveResendPolicyForPurpose(purpose);
  const lastSentMs = lastSentAt ? Date.parse(lastSentAt) : 0;
  const availableAt = lastSentMs + policy.resendCooldownSeconds * 1000;

  if (availableAt <= Date.now()) {
    return null;
  }

  return new Date(availableAt).toISOString();
}

async function assertVerifiedUser(userId: string) {
  const user = await findAuthUserById(userId);

  if (!user) {
    throw new AuthValidationError("Authentication session is invalid.");
  }

  if (user.emailVerificationStatus !== "verified") {
    throw new AuthValidationError("Email must be confirmed before changing Two-Step Login.");
  }

  return user;
}

async function assertPassword(userId: string, password: string): Promise<void> {
  const user = await assertVerifiedUser(userId);
  const valid = await verifyPassword(password, user.passwordHash);

  if (!valid) {
    throw new AuthValidationError("Current password is incorrect.");
  }
}

async function queueSettingCode(input: {
  userId: string;
  purpose: "login_two_step_enable" | "login_two_step_disable";
}): Promise<LoginTwoStepSettingStartResult> {
  const user = await assertVerifiedUser(input.userId);
  const issued = await createEmailConfirmationCode({
    userId: user.userId,
    email: user.email,
    purpose: input.purpose,
  });
  const config = resolveLoginEmailTwoStepConfig();

  const delivery = await sendLoginTwoStepCodeEmail({
    to: user.email,
    displayName: user.displayName,
    loginCode: issued.code,
    expiresMinutes: config.codeTtlMinutes,
  });

  if (delivery.emailSent) {
    await markEmailConfirmationCodeDelivered({
      confirmationId: issued.record.confirmationId,
      userId: user.userId,
      email: user.email,
      purpose: input.purpose,
      sentAt: new Date().toISOString(),
    });
  } else {
    await revokeActiveEmailConfirmationCodes({
      userId: user.userId,
      purpose: input.purpose,
    });
  }

  const activeCode = await findActiveEmailConfirmationCode({
    userId: user.userId,
    purpose: input.purpose,
  });

  return {
    emailSent: delivery.emailSent,
    maskedEmail: maskEmailAddress(user.email),
    resendAvailableAt: delivery.emailSent
      ? resolveResendAvailableAt(activeCode?.lastSentAt, input.purpose)
      : null,
    emailDeliveryError: delivery.emailDeliveryError,
  };
}

async function consumeSettingCode(input: {
  userId: string;
  code: string;
  purpose: "login_two_step_enable" | "login_two_step_disable";
}): Promise<void> {
  const normalizedCode = normalizeCode(input.code);
  assertValidCodeFormat(normalizedCode);

  const user = await assertVerifiedUser(input.userId);
  const activeCode = await findActiveEmailConfirmationCode({
    userId: user.userId,
    purpose: input.purpose,
  });

  if (!activeCode) {
    throw new AuthValidationError("This code has expired. Request a new code.");
  }

  const consumed = await consumeEmailConfirmationCode({
    userId: user.userId,
    code: normalizedCode,
    purpose: input.purpose,
  });

  if (!consumed) {
    const updated = await incrementEmailConfirmationAttempt(activeCode.confirmationId);

    if (updated && updated.status === "revoked") {
      throw new AuthValidationError("Too many unsuccessful attempts. Request a new code.");
    }

    throw new AuthValidationError("The code is incorrect.");
  }

  await revokeActiveEmailConfirmationCodes({
    userId: user.userId,
    purpose: input.purpose,
  });
}

export async function startEnableLoginTwoStep(input: {
  userId: string;
  currentPassword: string;
}): Promise<LoginTwoStepSettingStartResult> {
  const user = await assertVerifiedUser(input.userId);

  if (user.loginEmailTwoStepEnabled) {
    throw new AuthValidationError("Two-Step Login is already enabled.");
  }

  await assertPassword(input.userId, input.currentPassword);

  return queueSettingCode({
    userId: input.userId,
    purpose: "login_two_step_enable",
  });
}

export async function confirmEnableLoginTwoStep(input: {
  userId: string;
  code: string;
}): Promise<AuthUserPublic> {
  await consumeSettingCode({
    userId: input.userId,
    code: input.code,
    purpose: "login_two_step_enable",
  });

  const updated = await setAuthUserLoginEmailTwoStepEnabled(input.userId, true);

  if (!updated) {
    throw new AuthValidationError("Unable to enable Two-Step Login.");
  }

  return toAuthUserPublic(updated);
}

export async function startDisableLoginTwoStep(input: {
  userId: string;
  currentPassword: string;
}): Promise<LoginTwoStepSettingStartResult> {
  const user = await assertVerifiedUser(input.userId);

  if (!user.loginEmailTwoStepEnabled) {
    throw new AuthValidationError("Two-Step Login is already disabled.");
  }

  await assertPassword(input.userId, input.currentPassword);

  return queueSettingCode({
    userId: input.userId,
    purpose: "login_two_step_disable",
  });
}

export async function confirmDisableLoginTwoStep(input: {
  userId: string;
  code: string;
}): Promise<AuthUserPublic> {
  await consumeSettingCode({
    userId: input.userId,
    code: input.code,
    purpose: "login_two_step_disable",
  });

  const updated = await setAuthUserLoginEmailTwoStepEnabled(input.userId, false);

  if (!updated) {
    throw new AuthValidationError("Unable to disable Two-Step Login.");
  }

  return toAuthUserPublic(updated);
}

export async function resendLoginTwoStepSettingCode(input: {
  userId: string;
  action: "enable" | "disable";
}): Promise<LoginTwoStepSettingStartResult> {
  const user = await assertVerifiedUser(input.userId);
  const purpose = input.action === "enable" ? "login_two_step_enable" : "login_two_step_disable";

  if (input.action === "enable" && user.loginEmailTwoStepEnabled) {
    throw new AuthValidationError("Two-Step Login is already enabled.");
  }

  if (input.action === "disable" && !user.loginEmailTwoStepEnabled) {
    throw new AuthValidationError("Two-Step Login is already disabled.");
  }

  const lastSentAt = await findLatestEmailConfirmationSendAt({
    userId: user.userId,
    purpose,
  });
  const resendAvailableAt = resolveResendAvailableAt(lastSentAt ?? undefined, purpose);

  if (resendAvailableAt) {
    throw new AuthValidationError("Please wait before requesting another code.");
  }

  const policy = resolveResendPolicyForPurpose(purpose);
  const sinceIso = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const recentSends = await countRecentEmailConfirmationSends({
    userId: user.userId,
    email: user.email,
    sinceIso,
  });

  if (recentSends >= policy.maxSendsPerHour) {
    throw new AuthValidationError("Too many codes sent. Please try again later.");
  }

  return queueSettingCode({
    userId: input.userId,
    purpose,
  });
}
