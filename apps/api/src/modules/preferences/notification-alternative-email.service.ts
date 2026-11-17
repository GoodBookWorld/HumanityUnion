/**
 * HU-NOTIF-02B — alternative notification email ownership verification.
 * Never mutates AuthUser.email. Does not enable universal notification delivery.
 */

import type { MemberPreferences } from "@hu/types";

import { assertAuthCodeSendAllowed } from "../auth/auth-code-rate-limit.js";
import { AuthCodeRateLimitError, AuthValidationError } from "../auth/auth.errors.js";
import { findAuthUserById } from "../auth/auth-user.repository.js";
import {
  maskEmailAddress,
  resolveEmailConfirmationConfig,
} from "../email/email-confirmation.config.js";
import {
  consumeEmailConfirmationCode,
  createEmailConfirmationCode,
  findActiveEmailConfirmationCode,
  findLatestEmailConfirmationSendAt,
  incrementEmailConfirmationAttempt,
  markEmailConfirmationCodeDelivered,
  revokeActiveEmailConfirmationCodes,
} from "../email/email-confirmation-code.repository.js";
import { sendNotificationAlternativeEmailCodeEmail } from "../email/email.service.js";
import { PreferencesValidationError } from "./preferences.errors.js";
import {
  applyPreferencesPatchAtomically,
  applyPreferencesPatchIfPendingAlternativeMatches,
  getOrCreatePreferencesForMember,
} from "./preferences.repository.js";

export const NOTIFICATION_ALTERNATIVE_EMAIL_PURPOSE = "notification_alternative_email" as const;

export interface NotificationEmailDestinationView {
  destinationMode: "account" | "alternative";
  accountEmail: string | null;
  accountEmailVerified: boolean;
  alternativeEmail: string | null;
  alternativeEmailVerifiedAt: string | null;
  pendingAlternativeEmail: string | null;
  pendingMaskedEmail: string | null;
  resendAvailableAt: string | null;
  attemptsRemaining: number | null;
}

export interface NotificationAlternativeEmailActionResult {
  preferences: MemberPreferences;
  destination: NotificationEmailDestinationView;
  emailSent?: boolean;
  emailDeliveryError?: string;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function assertValidEmailFormat(email: string): void {
  if (!email.includes("@") || email.length < 5 || email.length > 320) {
    throw new PreferencesValidationError("A valid email address is required.");
  }
}

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

async function patchCommunication(
  memberId: string,
  communicationPreferences: Partial<MemberPreferences["communicationPreferences"]>,
): Promise<MemberPreferences> {
  const updated = await applyPreferencesPatchAtomically(memberId, {
    communicationPreferences,
  });
  if (!updated) {
    throw new PreferencesValidationError("Preferences are unavailable.");
  }
  return updated;
}

async function promoteVerifiedAlternativeIfPendingMatches(
  memberId: string,
  expectedPendingEmail: string,
  communicationPreferences: Partial<MemberPreferences["communicationPreferences"]>,
): Promise<MemberPreferences> {
  const updated = await applyPreferencesPatchIfPendingAlternativeMatches(
    memberId,
    expectedPendingEmail,
    { communicationPreferences },
  );
  if (!updated) {
    throw new AuthValidationError("The confirmation code is incorrect.");
  }
  return updated;
}

export async function buildNotificationEmailDestinationView(input: {
  userId: string;
  memberId: string;
  preferences?: MemberPreferences;
}): Promise<NotificationEmailDestinationView> {
  const [user, preferences, lastSentAt, activeCode] = await Promise.all([
    findAuthUserById(input.userId),
    input.preferences
      ? Promise.resolve(input.preferences)
      : getOrCreatePreferencesForMember({ memberId: input.memberId, userId: input.userId }),
    findLatestEmailConfirmationSendAt({
      userId: input.userId,
      purpose: NOTIFICATION_ALTERNATIVE_EMAIL_PURPOSE,
    }),
    findActiveEmailConfirmationCode({
      userId: input.userId,
      purpose: NOTIFICATION_ALTERNATIVE_EMAIL_PURPOSE,
    }),
  ]);

  const communication = preferences.communicationPreferences;
  const pending = communication.notificationAlternativeEmailPending;
  const mode =
    communication.notificationEmailDestinationMode === "alternative" &&
    typeof communication.notificationAlternativeEmail === "string" &&
    communication.notificationAlternativeEmail.length > 0
      ? "alternative"
      : "account";

  return {
    destinationMode: mode,
    accountEmail: user?.email ?? null,
    accountEmailVerified: user?.emailVerificationStatus === "verified",
    alternativeEmail: communication.notificationAlternativeEmail,
    alternativeEmailVerifiedAt: communication.notificationAlternativeEmailVerifiedAt,
    pendingAlternativeEmail: pending,
    pendingMaskedEmail: pending ? maskEmailAddress(pending) : null,
    resendAvailableAt: resolveResendAvailableAt(lastSentAt ?? activeCode?.lastSentAt),
    attemptsRemaining:
      activeCode && activeCode.status === "active"
        ? Math.max(0, activeCode.maxAttempts - activeCode.attemptCount)
        : null,
  };
}

/**
 * Effective destination for a future notification-copy projector.
 * Never returns an unverified pending address. Never changes auth email.
 */
export function resolveNotificationEmailDestination(input: {
  preferences: MemberPreferences;
  accountEmail: string | null;
  accountEmailVerified: boolean;
}): string | null {
  const communication = input.preferences.communicationPreferences;
  if (
    communication.notificationEmailDestinationMode === "alternative" &&
    typeof communication.notificationAlternativeEmail === "string" &&
    communication.notificationAlternativeEmail.trim().length > 0
  ) {
    return communication.notificationAlternativeEmail.trim().toLowerCase();
  }
  if (input.accountEmailVerified && input.accountEmail) {
    return input.accountEmail.trim().toLowerCase();
  }
  return null;
}

export async function requestAlternativeNotificationEmail(input: {
  userId: string;
  memberId: string;
  email: string;
  ipKey?: string;
}): Promise<NotificationAlternativeEmailActionResult> {
  const normalized = normalizeEmail(input.email);
  assertValidEmailFormat(normalized);

  const user = await findAuthUserById(input.userId);
  if (!user || user.emailVerificationStatus !== "verified") {
    throw new PreferencesValidationError(
      "Confirm your account email before adding an alternative notification email.",
    );
  }

  if (normalizeEmail(user.email) === normalized) {
    throw new PreferencesValidationError(
      "Choose a different address than your account login email.",
    );
  }

  const activeCode = await findActiveEmailConfirmationCode({
    userId: input.userId,
    purpose: NOTIFICATION_ALTERNATIVE_EMAIL_PURPOSE,
  });
  const lastSentAt =
    activeCode?.lastSentAt ??
    (await findLatestEmailConfirmationSendAt({
      userId: input.userId,
      purpose: NOTIFICATION_ALTERNATIVE_EMAIL_PURPOSE,
    })) ??
    undefined;

  await assertAuthCodeSendAllowed({
    userId: input.userId,
    purpose: NOTIFICATION_ALTERNATIVE_EMAIL_PURPOSE,
    ipKey: input.ipKey,
    lastSentAt,
    challengeId: activeCode?.confirmationId,
  });

  const preferences = await getOrCreatePreferencesForMember({
    memberId: input.memberId,
    userId: input.userId,
  });

  const updated = await patchCommunication(input.memberId, {
    notificationAlternativeEmailPending: normalized,
    // Keep current verified destination until confirmation succeeds.
    notificationEmailDestinationMode:
      preferences.communicationPreferences.notificationEmailDestinationMode === "alternative" &&
      preferences.communicationPreferences.notificationAlternativeEmail
        ? "alternative"
        : "account",
  });

  const config = resolveEmailConfirmationConfig();
  // Revokes any previous active challenge for this purpose before issuing.
  const issued = await createEmailConfirmationCode({
    userId: input.userId,
    email: normalized,
    purpose: NOTIFICATION_ALTERNATIVE_EMAIL_PURPOSE,
    ipKey: input.ipKey,
  });

  let emailSent = false;
  let emailDeliveryError: string | undefined;

  try {
    const delivery = await sendNotificationAlternativeEmailCodeEmail({
      to: normalized,
      displayName: user.displayName || "Participant",
      confirmationCode: issued.code,
      expiresMinutes: config.codeTtlMinutes,
    });
    emailSent = delivery.emailSent;
    if (!delivery.emailSent) {
      emailDeliveryError = delivery.emailDeliveryError ?? "delivery_failed";
    }
    if (delivery.emailSent) {
      await markEmailConfirmationCodeDelivered({
        confirmationId: issued.record.confirmationId,
        userId: input.userId,
        email: normalized,
        purpose: NOTIFICATION_ALTERNATIVE_EMAIL_PURPOSE,
        sentAt: new Date().toISOString(),
        ipKey: input.ipKey,
      });
    }
  } catch (error) {
    emailDeliveryError = error instanceof Error ? error.message : "delivery_failed";
  }

  const destination = await buildNotificationEmailDestinationView({
    userId: input.userId,
    memberId: input.memberId,
    preferences: updated,
  });

  return {
    preferences: updated,
    destination,
    emailSent,
    emailDeliveryError,
  };
}

export async function confirmAlternativeNotificationEmail(input: {
  userId: string;
  memberId: string;
  code: string;
}): Promise<NotificationAlternativeEmailActionResult> {
  const code = normalizeConfirmationCode(input.code);
  assertValidConfirmationCodeFormat(code);

  const preferences = await getOrCreatePreferencesForMember({
    memberId: input.memberId,
    userId: input.userId,
  });
  const pending = preferences.communicationPreferences.notificationAlternativeEmailPending;
  if (!pending) {
    throw new AuthValidationError("No alternative email verification is pending.");
  }

  const active = await findActiveEmailConfirmationCode({
    userId: input.userId,
    purpose: NOTIFICATION_ALTERNATIVE_EMAIL_PURPOSE,
  });

  if (!active) {
    throw new AuthValidationError("The confirmation code is incorrect or has expired.");
  }

  if (active.expiresAt <= new Date().toISOString()) {
    throw new AuthValidationError("The confirmation code has expired.");
  }

  // Atomic single-use consume: concurrent confirms cannot both succeed.
  const consumed = await consumeEmailConfirmationCode({
    userId: input.userId,
    code,
    purpose: NOTIFICATION_ALTERNATIVE_EMAIL_PURPOSE,
  });

  if (!consumed) {
    const afterAttempt = await incrementEmailConfirmationAttempt(active.confirmationId);
    if (afterAttempt && afterAttempt.attemptCount >= afterAttempt.maxAttempts) {
      throw new AuthValidationError("Too many incorrect confirmation attempts. Request a new code.");
    }
    throw new AuthValidationError("The confirmation code is incorrect.");
  }

  const verifiedEmail = normalizeEmail(consumed.email);

  // Re-read pending after consume so a newer request cannot be overwritten by a stale confirm.
  const latest = await getOrCreatePreferencesForMember({
    memberId: input.memberId,
    userId: input.userId,
  });
  const currentPending = latest.communicationPreferences.notificationAlternativeEmailPending;
  if (!currentPending || normalizeEmail(currentPending) !== verifiedEmail) {
    throw new AuthValidationError("The confirmation code is incorrect.");
  }

  const verifiedAt = new Date().toISOString();
  const updated = await promoteVerifiedAlternativeIfPendingMatches(input.memberId, verifiedEmail, {
    notificationAlternativeEmail: verifiedEmail,
    notificationAlternativeEmailVerifiedAt: verifiedAt,
    notificationAlternativeEmailPending: null,
    notificationEmailDestinationMode: "alternative",
  });

  // Do not auto-enable notificationEmailCopiesOptIn.
  const destination = await buildNotificationEmailDestinationView({
    userId: input.userId,
    memberId: input.memberId,
    preferences: updated,
  });

  return { preferences: updated, destination };
}

export async function useAccountNotificationEmail(input: {
  userId: string;
  memberId: string;
}): Promise<NotificationAlternativeEmailActionResult> {
  const updated = await patchCommunication(input.memberId, {
    notificationEmailDestinationMode: "account",
  });
  const destination = await buildNotificationEmailDestinationView({
    userId: input.userId,
    memberId: input.memberId,
    preferences: updated,
  });
  return { preferences: updated, destination };
}

export async function removeAlternativeNotificationEmail(input: {
  userId: string;
  memberId: string;
}): Promise<NotificationAlternativeEmailActionResult> {
  await revokeActiveEmailConfirmationCodes({
    userId: input.userId,
    purpose: NOTIFICATION_ALTERNATIVE_EMAIL_PURPOSE,
  });

  const updated = await patchCommunication(input.memberId, {
    notificationEmailDestinationMode: "account",
    notificationAlternativeEmail: null,
    notificationAlternativeEmailVerifiedAt: null,
    notificationAlternativeEmailPending: null,
  });

  const destination = await buildNotificationEmailDestinationView({
    userId: input.userId,
    memberId: input.memberId,
    preferences: updated,
  });
  return { preferences: updated, destination };
}

export { AuthCodeRateLimitError, AuthValidationError };
