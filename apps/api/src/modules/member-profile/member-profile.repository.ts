import { randomUUID } from "node:crypto";

import type { MemberProfile } from "@hu/types";

import { normalizeCountryInput } from "@hu/geography";

import { MONGO_COLLECTIONS } from "../../infrastructure/mongodb/mongo-collections.js";
import { isMongoConfigured } from "../../infrastructure/mongodb/mongo-config.js";
import { connectMongoClient } from "../../infrastructure/mongodb/mongo-connection.js";
import { getMongoCollection } from "../../infrastructure/mongodb/mongo-database.js";
import { AuthPersistenceUnavailableError } from "../auth/auth.errors.js";
import { MemberProfilePersistenceUnavailableError } from "./member-profile.errors.js";
import { slugifyPublicName } from "./member-profile.validators.js";

interface MemberProfileDocument extends MemberProfile {
  _id?: string;
}

async function ensureMemberProfileMongoReady(): Promise<void> {
  if (!isMongoConfigured()) {
    throw new MemberProfilePersistenceUnavailableError();
  }

  await connectMongoClient();
}

function stripDocument(document: MemberProfileDocument): MemberProfile {
  const { _id: _ignored, ...record } = document;

  return {
    ...record,
    skills: record.skills ?? [],
    skillsVisibility: record.skillsVisibility ?? "members_only",
    professionalLinksVisibility: record.professionalLinksVisibility ?? "public",
    membershipPubliclyVisible: record.membershipPubliclyVisible ?? false,
    // Profile UX Pack 02 Part 5 — statistics visibility switches default to
    // `true` for profiles persisted before this pack existed.
    showInitiativesStatistics: record.showInitiativesStatistics ?? true,
    showCollectiveDecisionsStatistics: record.showCollectiveDecisionsStatistics ?? true,
    showAlliesStatistics: record.showAlliesStatistics ?? true,
    showProposalsStatistics: record.showProposalsStatistics ?? true,
    showPetitionsStatistics: record.showPetitionsStatistics ?? true,
    showCommitmentsStatistics: record.showCommitmentsStatistics ?? true,
    // Profile UX Pack 03 Part 6 — defaults to the recommended "Active
    // Allies" policy for every profile persisted before this pack existed.
    messagingPolicy: record.messagingPolicy ?? "active_allies",
  };
}

function createMemberNumber(): string {
  return `HU-${randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase()}`;
}

function createPublicName(displayName: string): string {
  const base = slugifyPublicName(displayName) || "member";
  return `${base}-${randomUUID().slice(0, 6)}`;
}

export function buildDefaultMemberProfile(input: {
  userId: string;
  displayName: string;
  language?: string;
}): MemberProfile {
  const timestamp = new Date().toISOString();

  return {
    profileId: randomUUID(),
    userId: input.userId,
    memberNumber: createMemberNumber(),
    createdAt: timestamp,
    updatedAt: timestamp,
    displayName: input.displayName.trim(),
    publicName: createPublicName(input.displayName),
    biography: undefined,
    avatarUrl: undefined,
    organization: undefined,
    website: undefined,
    linkedinUrl: undefined,
    skills: [],
    country: undefined,
    region: undefined,
    community: undefined,
    participationAreaId: undefined,
    participationVisibility: "members_only",
    language: input.language ?? "en",
    timezone: undefined,
    profileVisibility: "members_only",
    showOrganization: true,
    showLocation: true,
    showParticipationArea: true,
    membershipPubliclyVisible: false,
    skillsVisibility: "members_only",
    professionalLinksVisibility: "public",
    showInitiativesStatistics: true,
    showCollectiveDecisionsStatistics: true,
    showAlliesStatistics: true,
    showProposalsStatistics: true,
    showPetitionsStatistics: true,
    showCommitmentsStatistics: true,
    messagingPolicy: "active_allies",
    status: "active",
  };
}

export async function insertMemberProfile(profile: MemberProfile): Promise<MemberProfile> {
  await ensureMemberProfileMongoReady();

  const collection = getMongoCollection<MemberProfileDocument>(MONGO_COLLECTIONS.memberProfiles);
  await collection.insertOne(profile);

  return profile;
}

export async function findMemberProfileByUserId(userId: string): Promise<MemberProfile | null> {
  await ensureMemberProfileMongoReady();

  const collection = getMongoCollection<MemberProfileDocument>(MONGO_COLLECTIONS.memberProfiles);
  const document = await collection.findOne({ userId });

  return document ? stripDocument(document) : null;
}

export async function findMemberProfileByProfileId(
  profileId: string,
): Promise<MemberProfile | null> {
  await ensureMemberProfileMongoReady();

  const collection = getMongoCollection<MemberProfileDocument>(MONGO_COLLECTIONS.memberProfiles);
  const document = await collection.findOne({ profileId });

  return document ? stripDocument(document) : null;
}

/**
 * UX Evolution Pack 02.4 Part 6 — `publicName` is the human-readable
 * identifier used everywhere a public profile link is generated (see
 * `resolvePublicAuthorIdentity`'s `/member/{publicName}` route), and already
 * carries a unique Mongo index (`member_profile_public_name_unique`). This
 * was the missing read: the `/member/{publicName}` page previously had no
 * way to resolve a profile by this field at all.
 */
export async function findMemberProfileByPublicName(
  publicName: string,
): Promise<MemberProfile | null> {
  await ensureMemberProfileMongoReady();

  const collection = getMongoCollection<MemberProfileDocument>(MONGO_COLLECTIONS.memberProfiles);
  const document = await collection.findOne({ publicName });

  return document ? stripDocument(document) : null;
}

export async function findMemberProfilesByUserIds(
  userIds: readonly string[],
): Promise<Map<string, MemberProfile>> {
  const uniqueUserIds = [...new Set(userIds.filter((userId) => userId.trim().length > 0))];

  if (uniqueUserIds.length === 0) {
    return new Map();
  }

  if (!isMongoConfigured()) {
    return new Map();
  }

  await ensureMemberProfileMongoReady();

  const collection = getMongoCollection<MemberProfileDocument>(MONGO_COLLECTIONS.memberProfiles);
  const documents = await collection.find({ userId: { $in: uniqueUserIds } }).toArray();

  return new Map(documents.map((document) => [document.userId, stripDocument(document)]));
}

export async function updateMemberProfileRecord(
  userId: string,
  patch: Partial<MemberProfile>,
): Promise<MemberProfile | null> {
  await ensureMemberProfileMongoReady();

  const collection = getMongoCollection<MemberProfileDocument>(MONGO_COLLECTIONS.memberProfiles);
  const updatedAt = new Date().toISOString();

  /** Pack 17E — empty professional-link fields must remove the stored URL. */
  const clearableLinkFields = new Set([
    "website",
    "linkedinUrl",
    "facebookUrl",
    "youtubeUrl",
    "instagramUrl",
    "xUrl",
  ]);

  const $set: Record<string, unknown> = { updatedAt };
  const $unset: Record<string, ""> = {};

  for (const [key, value] of Object.entries(patch)) {
    if (clearableLinkFields.has(key) && value === undefined) {
      $unset[key] = "";
    } else {
      $set[key] = value;
    }
  }

  const update: {
    $set: Record<string, unknown>;
    $unset?: Record<string, "">;
  } = { $set };
  if (Object.keys($unset).length > 0) {
    update.$unset = $unset;
  }

  const result = await collection.findOneAndUpdate({ userId }, update, {
    returnDocument: "after",
  });

  return result ? stripDocument(result) : null;
}

export async function deleteMemberProfileByUserId(userId: string): Promise<void> {
  await ensureMemberProfileMongoReady();

  const collection = getMongoCollection<MemberProfileDocument>(MONGO_COLLECTIONS.memberProfiles);
  await collection.deleteOne({ userId });
}

export async function deleteMemberProfilesByUserIdPrefix(prefix: string): Promise<number> {
  await ensureMemberProfileMongoReady();

  const collection = getMongoCollection<MemberProfileDocument>(MONGO_COLLECTIONS.memberProfiles);
  const result = await collection.deleteMany({
    userId: { $regex: `^${prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}` },
  });

  return result.deletedCount ?? 0;
}

export async function countMemberProfiles(): Promise<number> {
  await ensureMemberProfileMongoReady();
  const collection = getMongoCollection<MemberProfileDocument>(MONGO_COLLECTIONS.memberProfiles);
  return collection.countDocuments();
}

export async function countVerifiedParticipantsByCountry(countryCode: string): Promise<number> {
  if (!isMongoConfigured()) {
    return 0;
  }

  await ensureMemberProfileMongoReady();
  await connectMongoClient();

  const normalizedCountry = normalizeCountryInput(countryCode);

  if (!normalizedCountry) {
    return 0;
  }

  const authUsers = getMongoCollection<{
    userId: string;
    emailVerificationStatus: string;
    status: string;
  }>(MONGO_COLLECTIONS.authUsers);
  const profiles = getMongoCollection<MemberProfileDocument>(MONGO_COLLECTIONS.memberProfiles);

  const verifiedUsers = await authUsers
    .find({ emailVerificationStatus: "verified", status: "active" })
    .project({ userId: 1 })
    .toArray();

  if (verifiedUsers.length === 0) {
    return 0;
  }

  const userIds = verifiedUsers.map((user) => user.userId);
  const matchingProfiles = await profiles
    .find({ userId: { $in: userIds } })
    .project({ userId: 1, country: 1 })
    .toArray();

  let count = 0;

  for (const profile of matchingProfiles) {
    const profileCountry = profile.country ? normalizeCountryInput(profile.country) : undefined;

    if (profileCountry === normalizedCountry) {
      count += 1;
    }
  }

  return count;
}

export { AuthPersistenceUnavailableError };
