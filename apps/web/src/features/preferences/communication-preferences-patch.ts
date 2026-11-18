/**
 * HU-NOTIF-02C.12B — ordinary preferences PATCH must never send protected
 * notification-email destination fields (destination mode / alt / pending).
 * Those fields are owned by dedicated verification endpoints only.
 */

import type { CommunicationPreferences, MemberPreferences } from "@hu/types";

/** Fields the general preferences API accepts under communicationPreferences. */
export const ORDINARY_COMMUNICATION_PREFERENCE_KEYS = [
  "announcementPreference",
  "invitationPreference",
  "digestFrequency",
  "messageCategories",
  "notificationFrequency",
  "emailNotificationsEnabled",
  "notificationEmailCopiesOptIn",
  "interestMatchNotificationsEnabled",
  "disabledNotificationCategories",
] as const satisfies ReadonlyArray<keyof CommunicationPreferences>;

export type OrdinaryCommunicationPreferenceKey =
  (typeof ORDINARY_COMMUNICATION_PREFERENCE_KEYS)[number];

/** Destination / verification fields — forbidden on ordinary PATCH. */
export const PROTECTED_NOTIFICATION_EMAIL_COMMUNICATION_KEYS = [
  "notificationEmailDestinationMode",
  "notificationAlternativeEmail",
  "notificationAlternativeEmailVerifiedAt",
  "notificationAlternativeEmailPending",
] as const satisfies ReadonlyArray<keyof CommunicationPreferences>;

export type ProtectedNotificationEmailCommunicationKey =
  (typeof PROTECTED_NOTIFICATION_EMAIL_COMMUNICATION_KEYS)[number];

/**
 * Build a communicationPreferences object safe for PATCH /api/v1/preferences/me.
 * Only copies allowlisted keys that are present on the source.
 */
export function buildOrdinaryCommunicationPreferencesPatch(
  source: Partial<CommunicationPreferences> | null | undefined,
): Partial<CommunicationPreferences> {
  if (!source || typeof source !== "object") {
    return {};
  }

  const patch: Partial<CommunicationPreferences> = {};
  for (const key of ORDINARY_COMMUNICATION_PREFERENCE_KEYS) {
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      const value = source[key];
      if (value !== undefined) {
        (patch as Record<string, unknown>)[key] = value;
      }
    }
  }
  return patch;
}

/**
 * Merge baseline + patch, then strip protected destination fields for ordinary PATCH.
 */
export function buildOrdinaryCommunicationPreferencesUpdate(input: {
  baseline: CommunicationPreferences;
  patch?: Partial<CommunicationPreferences>;
}): Partial<CommunicationPreferences> {
  return buildOrdinaryCommunicationPreferencesPatch({
    ...input.baseline,
    ...input.patch,
  });
}

/** True when a communication object includes any protected destination key. */
export function communicationPreferencesContainProtectedFields(
  source: Partial<CommunicationPreferences> | Record<string, unknown> | null | undefined,
): boolean {
  if (!source || typeof source !== "object") {
    return false;
  }
  return PROTECTED_NOTIFICATION_EMAIL_COMMUNICATION_KEYS.some((key) =>
    Object.prototype.hasOwnProperty.call(source, key),
  );
}

export type MemberPreferencesOrdinaryPatch = Partial<
  Omit<MemberPreferences, "communicationPreferences">
> & {
  communicationPreferences?: Partial<CommunicationPreferences>;
};
