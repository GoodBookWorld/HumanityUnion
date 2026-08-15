import { randomUUID } from "node:crypto";

import type { MembershipRecord } from "@hu/types";

import { MONGO_COLLECTIONS } from "../../infrastructure/mongodb/mongo-collections.js";
import { isMongoConfigured } from "../../infrastructure/mongodb/mongo-config.js";
import { connectMongoClient } from "../../infrastructure/mongodb/mongo-connection.js";
import { getMongoCollection } from "../../infrastructure/mongodb/mongo-database.js";
import { MembershipPersistenceUnavailableError } from "./membership.errors.js";
import { normalizeMembershipRecordCountries } from "./membership-participation-countries.js";

interface MembershipDocument extends Omit<MembershipRecord, "memberNumber" | "memberGrantedAt"> {
  _id?: string;
  memberNumber?: string | null;
  memberGrantedAt?: string | null;
}

async function ensureMembershipMongoReady(): Promise<void> {
  if (!isMongoConfigured()) {
    throw new MembershipPersistenceUnavailableError();
  }

  await connectMongoClient();
}

function toMembershipDocument(record: MembershipRecord): MembershipDocument {
  const document: MembershipDocument = { ...record };

  if (document.memberNumber === null) {
    delete document.memberNumber;
  }

  if (document.memberGrantedAt === null) {
    delete document.memberGrantedAt;
  }

  return document;
}

function stripDocument(document: MembershipDocument): MembershipRecord {
  const { _id: _ignored, ...record } = document;

  return {
    ...record,
    memberNumber: record.memberNumber ?? null,
    memberGrantedAt: record.memberGrantedAt ?? null,
    countryCode: record.countryCode ?? null,
    participationCountryCodes: record.participationCountryCodes ?? null,
    displayNameConfirmed: record.displayNameConfirmed ?? null,
    termsVersion: record.termsVersion ?? null,
    termsAcceptedAt: record.termsAcceptedAt ?? null,
    applicationSubmittedAt: record.applicationSubmittedAt ?? null,
  };
}

function normalizeStoredRecord(record: MembershipRecord): MembershipRecord {
  return normalizeMembershipRecordCountries(record);
}

export function buildDefaultMembershipRecord(input: {
  userId: string;
  profileId: string;
}): MembershipRecord {
  const timestamp = new Date().toISOString();

  return {
    membershipId: randomUUID(),
    userId: input.userId,
    profileId: input.profileId,
    memberNumber: null,
    status: "not_started",
    applicationStatus: "not_started",
    countryCode: null,
    participationCountryCodes: null,
    displayNameConfirmed: null,
    termsVersion: null,
    termsAcceptedAt: null,
    applicationSubmittedAt: null,
    memberGrantedAt: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export async function insertMembershipRecord(record: MembershipRecord): Promise<MembershipRecord> {
  await ensureMembershipMongoReady();

  const collection = getMongoCollection<MembershipDocument>(MONGO_COLLECTIONS.memberships);
  await collection.insertOne(toMembershipDocument(record));

  return record;
}

export async function findMembershipByUserId(userId: string): Promise<MembershipRecord | null> {
  if (!isMongoConfigured()) {
    throw new MembershipPersistenceUnavailableError();
  }

  await connectMongoClient();
  const collection = getMongoCollection<MembershipDocument>(MONGO_COLLECTIONS.memberships);
  const document = await collection.findOne({ userId });

  return document ? normalizeStoredRecord(stripDocument(document)) : null;
}

export async function updateMembershipRecord(
  membershipId: string,
  patch: Partial<MembershipRecord>,
): Promise<MembershipRecord | null> {
  await ensureMembershipMongoReady();

  const collection = getMongoCollection<MembershipDocument>(MONGO_COLLECTIONS.memberships);
  const sanitizedPatch = { ...patch };
  delete sanitizedPatch.membershipId;
  delete sanitizedPatch.userId;
  delete sanitizedPatch.profileId;

  const updateDocument: Partial<MembershipDocument> = {
    ...sanitizedPatch,
    updatedAt: new Date().toISOString(),
  };

  if (updateDocument.memberNumber === null) {
    delete updateDocument.memberNumber;
  }

  if (updateDocument.memberGrantedAt === null) {
    delete updateDocument.memberGrantedAt;
  }

  const result = await collection.findOneAndUpdate(
    { membershipId },
    {
      $set: updateDocument,
    },
    { returnDocument: "after" },
  );

  return result ? normalizeStoredRecord(stripDocument(result)) : null;
}

export async function deleteMembershipByUserId(userId: string): Promise<number> {
  if (!isMongoConfigured()) {
    return 0;
  }

  await connectMongoClient();
  const collection = getMongoCollection<MembershipDocument>(MONGO_COLLECTIONS.memberships);
  const result = await collection.deleteMany({ userId });

  return result.deletedCount ?? 0;
}

export async function deleteMembershipsByUserIdPrefix(prefix: string): Promise<number> {
  if (!isMongoConfigured()) {
    return 0;
  }

  await connectMongoClient();
  const collection = getMongoCollection<MembershipDocument>(MONGO_COLLECTIONS.memberships);
  const users = await getMongoCollection<{ userId: string; email: string }>(
    MONGO_COLLECTIONS.authUsers,
  )
    .find({ email: { $regex: `^${prefix}` } })
    .project({ userId: 1 })
    .toArray();

  const userIds = users.map((user) => user.userId);

  if (userIds.length === 0) {
    return 0;
  }

  const result = await collection.deleteMany({ userId: { $in: userIds } });
  return result.deletedCount ?? 0;
}

export async function countActiveMembershipMembers(): Promise<number> {
  if (!isMongoConfigured()) {
    return 0;
  }

  await ensureMembershipMongoReady();
  const collection = getMongoCollection<MembershipDocument>(MONGO_COLLECTIONS.memberships);
  return collection.countDocuments({ status: "active_member" });
}

export async function countActiveMembershipMembersByCountry(countryCode: string): Promise<number> {
  if (!isMongoConfigured()) {
    return 0;
  }

  await ensureMembershipMongoReady();
  const collection = getMongoCollection<MembershipDocument>(MONGO_COLLECTIONS.memberships);
  return collection.countDocuments({
    status: "active_member",
    countryCode: countryCode.toUpperCase(),
  });
}

/** Test-only helper for future payment activation (TASK-092). Not used in production flows yet. */
export async function assignMembershipMemberNumberForTests(input: {
  membershipId: string;
  memberNumber: string;
  memberGrantedAt: string;
}): Promise<MembershipRecord | null> {
  return updateMembershipRecord(input.membershipId, {
    memberNumber: input.memberNumber,
    memberGrantedAt: input.memberGrantedAt,
    status: "active_member",
    applicationStatus: "approved",
  });
}

export async function findMembershipsByUserIds(
  userIds: readonly string[],
): Promise<Map<string, MembershipRecord>> {
  const uniqueIds = [...new Set(userIds.filter((id) => id.trim().length > 0))];
  if (uniqueIds.length === 0) {
    return new Map();
  }

  await ensureMembershipMongoReady();
  const collection = getMongoCollection<MembershipDocument>(MONGO_COLLECTIONS.memberships);
  const documents = await collection.find({ userId: { $in: uniqueIds } }).toArray();

  return new Map(
    documents.map((document) => [document.userId, normalizeStoredRecord(stripDocument(document))]),
  );
}

/** Returns userIds whose membership status matches (for admin directory filters). */
export async function findUserIdsByMembershipStatus(
  status: MembershipRecord["status"],
): Promise<string[]> {
  await ensureMembershipMongoReady();
  const collection = getMongoCollection<MembershipDocument>(MONGO_COLLECTIONS.memberships);
  const documents = await collection
    .find({ status }, { projection: { userId: 1 } })
    .toArray();

  return documents.map((document) => document.userId);
}
