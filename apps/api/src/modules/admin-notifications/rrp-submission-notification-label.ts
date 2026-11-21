/**
 * HU-RRP-07F.5 — visible label for an RRP submission notification.
 * One label is stored for every admin, so the country name is the canonical
 * English geography name. Per-admin locale rendering is not available here.
 */

import { resolveCountryDisplayName } from "@hu/geography";

import { findAuthUserByMemberId } from "../auth/auth-user.repository.js";
import { findMemberProfileByUserId } from "../member-profile/member-profile.repository.js";
import { findRrpApplicationById } from "../rrp-application/rrp-application.repository.js";

export const RRP_SUBMISSION_NOTIFICATION_FALLBACK_LABEL =
  "Regional Representative application" as const;

const UNSAFE_PUBLIC_NAME = /[<>\u0000-\u001F\u007F]/;
const MAX_PUBLIC_NAME_LENGTH = 120;

function safePublicDisplayName(value: string | null | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed || [...trimmed].length > MAX_PUBLIC_NAME_LENGTH || UNSAFE_PUBLIC_NAME.test(trimmed)) {
    return null;
  }
  return trimmed;
}

function selectPublicDisplayName(input: {
  profileDisplayName?: string | null;
  authDisplayName?: string | null;
}): string | null {
  const profile = input.profileDisplayName?.trim() ?? "";
  if (profile) {
    return safePublicDisplayName(profile);
  }
  return safePublicDisplayName(input.authDisplayName);
}

/**
 * Canonical dataset name. An unresolved code is omitted rather than shown raw.
 */
export function resolveRrpSubmissionCountryName(countryCode: string | null | undefined): string | null {
  if (typeof countryCode !== "string" || countryCode.trim().length === 0) {
    return null;
  }
  const resolved = resolveCountryDisplayName({
    countryCode,
    locale: "en",
  }).displayName.trim();
  if (!resolved || resolved.toUpperCase() === countryCode.trim().toUpperCase()) {
    return null;
  }
  if (UNSAFE_PUBLIC_NAME.test(resolved)) {
    return null;
  }
  return resolved;
}

export function buildRrpSubmissionNotificationLabel(input: {
  displayName?: string | null;
  countryCode?: string | null;
}): string {
  const name = safePublicDisplayName(input.displayName);
  const country = resolveRrpSubmissionCountryName(input.countryCode);
  if (name && country) {
    return `${name} — ${country}`;
  }
  if (name) {
    return name;
  }
  if (country) {
    return `${RRP_SUBMISSION_NOTIFICATION_FALLBACK_LABEL} — ${country}`;
  }
  return RRP_SUBMISSION_NOTIFICATION_FALLBACK_LABEL;
}

/**
 * Read only the public name and representation country.
 * A store failure still returns a label and does not include the application id.
 */
export async function resolveRrpSubmissionNotificationLabel(input: {
  applicationId: string;
  participantId: string;
}): Promise<string> {
  let countryCode: string | null = null;
  try {
    const application = await findRrpApplicationById(input.applicationId);
    if (application && application.participantId === input.participantId) {
      countryCode = application.representCountryCode;
    }
  } catch {
    countryCode = null;
  }

  let displayName: string | null = null;
  try {
    const authUser = await findAuthUserByMemberId(input.participantId);
    let profileDisplayName: string | null = null;
    if (authUser?.userId) {
      try {
        const profile = await findMemberProfileByUserId(authUser.userId);
        profileDisplayName = profile?.displayName ?? null;
      } catch {
        profileDisplayName = null;
      }
    }
    displayName = selectPublicDisplayName({
      profileDisplayName,
      authDisplayName: authUser?.displayName ?? null,
    });
  } catch {
    displayName = null;
  }

  return buildRrpSubmissionNotificationLabel({ displayName, countryCode });
}
