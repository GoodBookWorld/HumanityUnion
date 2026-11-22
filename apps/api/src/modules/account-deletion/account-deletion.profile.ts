import type { MemberProfile } from "@hu/types";

import { getMongoCollection } from "../../infrastructure/mongodb/mongo-database.js";
import { MONGO_COLLECTIONS } from "../../infrastructure/mongodb/mongo-collections.js";
import { isMongoConfigured } from "../../infrastructure/mongodb/mongo-config.js";
import { connectMongoClient } from "../../infrastructure/mongodb/mongo-connection.js";
import { MemberProfilePersistenceUnavailableError } from "../member-profile/member-profile.errors.js";
import { CIVIC_DISPLAY_NAME_RETENTION } from "./account-deletion.state.js";

/**
 * Fields removed from the public profile at finalization.
 * `displayName` is intentionally absent: see `CIVIC_DISPLAY_NAME_RETENTION`.
 * Civic documents, messages, appointments, and grants are not in this patch.
 */
export const ACCOUNT_DELETION_CLEARED_PROFILE_FIELDS = [
  "biography",
  "avatarUrl",
  "organization",
  "website",
  "linkedinUrl",
  "facebookUrl",
  "youtubeUrl",
  "instagramUrl",
  "xUrl",
  "country",
  "region",
  "community",
] as const;

export function buildClosedProfileUpdate(nowIso: string): {
  $set: { status: "closed"; profileVisibility: "private"; updatedAt: string };
  $unset: Record<(typeof ACCOUNT_DELETION_CLEARED_PROFILE_FIELDS)[number], "">;
} {
  const $unset = Object.fromEntries(
    ACCOUNT_DELETION_CLEARED_PROFILE_FIELDS.map((field) => [field, ""]),
  ) as Record<(typeof ACCOUNT_DELETION_CLEARED_PROFILE_FIELDS)[number], "">;

  return {
    $set: {
      status: "closed",
      profileVisibility: "private",
      updatedAt: nowIso,
    },
    $unset,
  };
}

export function profileRetainsCivicDisplayName(profile: Pick<MemberProfile, "displayName">): boolean {
  return profile.displayName.trim().length > 0 && CIVIC_DISPLAY_NAME_RETENTION.length > 0;
}

export async function closeMemberProfileForAccountDeletion(
  userId: string,
  nowIso: string,
): Promise<void> {
  if (!isMongoConfigured()) {
    throw new MemberProfilePersistenceUnavailableError();
  }
  await connectMongoClient();
  const update = buildClosedProfileUpdate(nowIso);
  await getMongoCollection(MONGO_COLLECTIONS.memberProfiles).updateOne({ userId }, update);
}
