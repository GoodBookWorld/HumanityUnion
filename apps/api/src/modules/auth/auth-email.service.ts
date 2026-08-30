import { AuthValidationError, InvalidCredentialsError } from "./auth.errors.js";
import { confirmMemberRegistration } from "../member/application/confirm-member-registration.service.js";
import { toAuthUserPublic } from "./auth-user.projection.js";
import {
  confirmAuthUserEmailChange,
  findAuthUserByEmail,
  findAuthUserById,
  setAuthUserPendingEmail,
  updateAuthUserPassword,
} from "./auth-user.repository.js";
import { revokeAllAuthSessionsForUser } from "./auth-session.repository.js";
import {
  consumeEmailVerificationToken,
  createEmailVerificationToken,
  findValidEmailVerificationToken,
} from "../email/email.tokens.js";
import {
  sendEmailChangeVerificationEmail,
  sendPasswordResetEmail,
  sendRegistrationVerificationEmail,
  sendSecurityAlertEmail,
} from "../email/email.service.js";
import { hashPassword, verifyPassword } from "./auth-password.js";

const PASSWORD_RESET_GENERIC_MESSAGE = "If an account exists, a reset email has been sent.";

export async function queueRegistrationVerificationEmail(userId: string): Promise<void> {
  const user = await findAuthUserById(userId);

  if (!user || user.emailVerificationStatus === "verified") {
    return;
  }

  const issued = await createEmailVerificationToken({
    userId: user.userId,
    purpose: "registration",
  });

  await sendRegistrationVerificationEmail({
    to: user.email,
    displayName: user.displayName,
    verificationToken: issued.token,
  });
}

export async function verifyRegistrationEmail(token: string) {
  if (!token.trim()) {
    throw new AuthValidationError("Verification token is required.");
  }

  const record = await consumeEmailVerificationToken({
    token,
    purpose: "registration",
  });

  if (!record) {
    throw new AuthValidationError("Invalid or expired verification token.");
  }

  const authUser = await findAuthUserById(record.userId);

  if (!authUser) {
    throw new AuthValidationError("User account not found.");
  }

  await confirmMemberRegistration(authUser);

  const user = await findAuthUserById(record.userId);

  if (!user || user.emailVerificationStatus !== "verified") {
    throw new AuthValidationError("User account not found.");
  }

  return toAuthUserPublic(user);
}

export async function resendRegistrationVerification(userId: string) {
  const user = await findAuthUserById(userId);

  if (!user) {
    throw new AuthValidationError("User account not found.");
  }

  if (user.emailVerificationStatus === "verified") {
    throw new AuthValidationError("Email address is already verified.");
  }

  await queueRegistrationVerificationEmail(user.userId);

  return toAuthUserPublic(user);
}

async function issuePasswordResetForUser(user: {
  userId: string;
  email: string;
  displayName: string;
}): Promise<void> {
  const issued = await createEmailVerificationToken({
    userId: user.userId,
    purpose: "password_reset",
  });

  await sendPasswordResetEmail({
    to: user.email,
    displayName: user.displayName,
    resetToken: issued.token,
  });
}

export async function requestPasswordReset(
  email: string,
): Promise<{ requested: true; message: string }> {
  const normalizedEmail = email.trim().toLowerCase();

  if (!normalizedEmail.includes("@")) {
    return { requested: true, message: PASSWORD_RESET_GENERIC_MESSAGE };
  }

  const user = await findAuthUserByEmail(normalizedEmail);

  if (!user) {
    return { requested: true, message: PASSWORD_RESET_GENERIC_MESSAGE };
  }

  await issuePasswordResetForUser(user);

  return { requested: true, message: PASSWORD_RESET_GENERIC_MESSAGE };
}

/**
 * Operator / activation path — send canonical password-reset email by userId.
 * Never returns email, tokens, or password material.
 */
export async function requestPasswordResetForUserId(
  userId: string,
): Promise<{ sent: true } | { sent: false; reason: "not_found" }> {
  const user = await findAuthUserById(userId);

  if (!user) {
    return { sent: false, reason: "not_found" };
  }

  await issuePasswordResetForUser(user);
  return { sent: true };
}

export async function validatePasswordResetToken(token: string): Promise<{ valid: boolean }> {
  if (!token.trim()) {
    return { valid: false };
  }

  const record = await findValidEmailVerificationToken({
    token,
    purpose: "password_reset",
  });

  return { valid: record !== null };
}

export async function resetPasswordWithToken(token: string, password: string) {
  if (!token.trim()) {
    throw new AuthValidationError("Reset token is required.");
  }

  if (password.length < 8) {
    throw new AuthValidationError("Password must be at least 8 characters.");
  }

  const record = await consumeEmailVerificationToken({
    token,
    purpose: "password_reset",
  });

  if (!record) {
    throw new InvalidCredentialsError("Invalid or expired reset token.");
  }

  const passwordHash = await hashPassword(password);
  const user = await updateAuthUserPassword(record.userId, passwordHash);

  if (!user) {
    throw new AuthValidationError("User account not found.");
  }

  await revokeAllAuthSessionsForUser(user.userId);

  await sendSecurityAlertEmail({
    to: user.email,
    displayName: user.displayName,
    alertTitle: "Password changed",
    alertBody:
      "Your Humanity Union account password was changed. If this was not you, contact support immediately.",
  });

  return toAuthUserPublic(user);
}

export async function changePasswordForUser(input: {
  userId: string;
  currentPassword: string;
  newPassword: string;
  currentSessionId?: string;
}) {
  if (input.newPassword.length < 8) {
    throw new AuthValidationError("Password must be at least 8 characters.");
  }

  const user = await findAuthUserById(input.userId);

  if (!user) {
    throw new AuthValidationError("User account not found.");
  }

  const currentValid = await verifyPassword(input.currentPassword, user.passwordHash);

  if (!currentValid) {
    throw new InvalidCredentialsError("Invalid email or password.");
  }

  const passwordHash = await hashPassword(input.newPassword);
  const updated = await updateAuthUserPassword(user.userId, passwordHash);

  if (!updated) {
    throw new AuthValidationError("User account not found.");
  }

  await revokeAllAuthSessionsForUser(user.userId, input.currentSessionId);

  await sendSecurityAlertEmail({
    to: updated.email,
    displayName: updated.displayName,
    alertTitle: "Password changed",
    alertBody:
      "Your Humanity Union account password was changed. If this was not you, contact support immediately.",
  });

  return toAuthUserPublic(updated);
}

export async function requestEmailChange(userId: string, newEmail: string) {
  const normalizedEmail = newEmail.trim().toLowerCase();

  if (!normalizedEmail.includes("@")) {
    throw new AuthValidationError("A valid email address is required.");
  }

  const user = await findAuthUserById(userId);

  if (!user) {
    throw new AuthValidationError("User account not found.");
  }

  if (user.email === normalizedEmail) {
    throw new AuthValidationError("That email is already associated with your account.");
  }

  const existing = await findAuthUserByEmail(normalizedEmail);

  if (existing && existing.userId !== user.userId) {
    throw new AuthValidationError("That email address is already in use.");
  }

  await setAuthUserPendingEmail(user.userId, normalizedEmail);

  const issued = await createEmailVerificationToken({
    userId: user.userId,
    purpose: "email_change",
    metadata: { pendingEmail: normalizedEmail },
  });

  await sendEmailChangeVerificationEmail({
    displayName: user.displayName,
    newEmail: normalizedEmail,
    verificationToken: issued.token,
  });

  const updated = await findAuthUserById(user.userId);

  if (!updated) {
    throw new AuthValidationError("User account not found.");
  }

  return toAuthUserPublic(updated);
}

export async function confirmEmailChangeWithToken(token: string) {
  if (!token.trim()) {
    throw new AuthValidationError("Verification token is required.");
  }

  const record = await consumeEmailVerificationToken({
    token,
    purpose: "email_change",
  });

  if (!record || !record.metadata?.pendingEmail) {
    throw new AuthValidationError("Invalid or expired email change token.");
  }

  const existingUser = await findAuthUserById(record.userId);
  const previousEmail = existingUser?.email;

  const user = await confirmAuthUserEmailChange(record.userId, record.metadata.pendingEmail);

  if (!user) {
    throw new AuthValidationError("User account not found.");
  }

  if (previousEmail && previousEmail !== user.email) {
    await sendSecurityAlertEmail({
      to: previousEmail,
      displayName: user.displayName,
      alertTitle: "Email address changed",
      alertBody: `Your Humanity Union account email was changed to ${user.email}.`,
    }).catch(() => undefined);
  }

  await sendSecurityAlertEmail({
    to: user.email,
    displayName: user.displayName,
    alertTitle: "Email address confirmed",
    alertBody: `Your Humanity Union account now uses ${user.email}.`,
  });

  return toAuthUserPublic(user);
}
