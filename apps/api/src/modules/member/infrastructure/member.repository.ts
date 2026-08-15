import type { ClientSession } from "mongodb";

import { MONGO_COLLECTIONS } from "../../../infrastructure/mongodb/mongo-collections.js";
import { isMongoConfigured } from "../../../infrastructure/mongodb/mongo-config.js";
import { connectMongoClient } from "../../../infrastructure/mongodb/mongo-connection.js";
import { getMongoCollection } from "../../../infrastructure/mongodb/mongo-database.js";
import type { PersistedMemberRecord } from "../domain/member.types.js";
import { MemberRegistrationUnavailableError } from "../domain/member.errors.js";
import {
  buildNewPersistedMember,
  fromMemberMongoDocument,
  toMemberMongoDocument,
  type MemberMongoDocument,
} from "./member.persistence.js";
import type { CreatePersistedMemberInput } from "../domain/member.types.js";
import type { EditableMemberProfileFields } from "../domain/member-profile.types.js";

async function ensureMemberMongoReady(): Promise<void> {
  if (!isMongoConfigured()) {
    throw new MemberRegistrationUnavailableError();
  }

  await connectMongoClient();
}

function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: number }).code === 11_000
  );
}

export async function findMemberById(
  memberId: string,
  options: { session?: ClientSession } = {},
): Promise<PersistedMemberRecord | null> {
  await ensureMemberMongoReady();

  const collection = getMongoCollection<MemberMongoDocument>(MONGO_COLLECTIONS.members);
  const document = await collection.findOne({ memberId }, { session: options.session });

  return document ? fromMemberMongoDocument(document) : null;
}

export async function findMemberByIdentityId(
  identityId: string,
  options: { session?: ClientSession } = {},
): Promise<PersistedMemberRecord | null> {
  await ensureMemberMongoReady();

  const collection = getMongoCollection<MemberMongoDocument>(MONGO_COLLECTIONS.members);
  const document = await collection.findOne({ identityId }, { session: options.session });

  return document ? fromMemberMongoDocument(document) : null;
}

export async function findMemberByUniqueName(
  uniqueName: string,
  options: { session?: ClientSession } = {},
): Promise<PersistedMemberRecord | null> {
  await ensureMemberMongoReady();

  const collection = getMongoCollection<MemberMongoDocument>(MONGO_COLLECTIONS.members);
  const document = await collection.findOne({ uniqueName }, { session: options.session });

  return document ? fromMemberMongoDocument(document) : null;
}

export async function existsMemberByIdentityId(
  identityId: string,
  options: { session?: ClientSession } = {},
): Promise<boolean> {
  const member = await findMemberByIdentityId(identityId, options);
  return member !== null;
}

export async function listMembers(): Promise<PersistedMemberRecord[]> {
  await ensureMemberMongoReady();

  const collection = getMongoCollection<MemberMongoDocument>(MONGO_COLLECTIONS.members);
  const documents = await collection.find({}).sort({ createdAt: -1 }).toArray();

  return documents.map(fromMemberMongoDocument);
}

export async function updateMemberProfile(
  memberId: string,
  fields: EditableMemberProfileFields,
): Promise<PersistedMemberRecord | null> {
  await ensureMemberMongoReady();

  const collection = getMongoCollection<MemberMongoDocument>(MONGO_COLLECTIONS.members);
  const existing = await collection.findOne({ memberId });

  if (!existing) {
    return null;
  }

  const update: Partial<MemberMongoDocument> = {
    updatedAt: new Date().toISOString(),
  };

  if (fields.displayName !== undefined) {
    update.displayName = fields.displayName.trim();
  }

  if (fields.country !== undefined) {
    update.country = fields.country;
  }

  if (fields.region !== undefined) {
    update.region = fields.region;
  }

  if (fields.city !== undefined) {
    update.city = fields.city;
  }

  if (fields.languages !== undefined) {
    update.languages = [...fields.languages];
  }

  const result = await collection.findOneAndUpdate(
    { memberId },
    { $set: update },
    { returnDocument: "after" },
  );

  return result ? fromMemberMongoDocument(result as MemberMongoDocument) : null;
}

export async function insertMember(
  input: CreatePersistedMemberInput,
  options: { session?: ClientSession } = {},
): Promise<PersistedMemberRecord> {
  await ensureMemberMongoReady();

  const record = buildNewPersistedMember(input);
  const collection = getMongoCollection<MemberMongoDocument>(MONGO_COLLECTIONS.members);

  try {
    await collection.insertOne(toMemberMongoDocument(record), { session: options.session });
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      throw error;
    }

    throw error;
  }

  return record;
}

export async function countMembersByIdentityId(
  identityId: string,
  options: { session?: ClientSession } = {},
): Promise<number> {
  await ensureMemberMongoReady();

  const collection = getMongoCollection<MemberMongoDocument>(MONGO_COLLECTIONS.members);
  return collection.countDocuments({ identityId }, { session: options.session });
}

export async function countMembersByMemberId(
  memberId: string,
  options: { session?: ClientSession } = {},
): Promise<number> {
  await ensureMemberMongoReady();

  const collection = getMongoCollection<MemberMongoDocument>(MONGO_COLLECTIONS.members);
  return collection.countDocuments({ memberId }, { session: options.session });
}

export async function countOutboxEventsForMember(memberId: string): Promise<number> {
  await ensureMemberMongoReady();

  const collection = getMongoCollection<{ aggregateId: string; eventName: string }>(
    MONGO_COLLECTIONS.outbox,
  );

  return collection.countDocuments({
    aggregateType: "Member",
    aggregateId: memberId,
    eventName: "MemberRegistered",
  });
}

export async function deleteMembersByMemberIdPrefix(prefix: string): Promise<number> {
  if (!isMongoConfigured()) {
    return 0;
  }

  await connectMongoClient();
  const collection = getMongoCollection<MemberMongoDocument>(MONGO_COLLECTIONS.members);
  const result = await collection.deleteMany({ memberId: { $regex: `^${prefix}` } });

  return result.deletedCount ?? 0;
}

export async function deleteMembersByIdentityIdPrefix(prefix: string): Promise<number> {
  if (!isMongoConfigured()) {
    return 0;
  }

  await connectMongoClient();
  const collection = getMongoCollection<MemberMongoDocument>(MONGO_COLLECTIONS.members);
  const result = await collection.deleteMany({ identityId: { $regex: `^${prefix}` } });

  return result.deletedCount ?? 0;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Admin directory search — returns identityIds (auth userIds) matching uniqueName. */
export async function findIdentityIdsByUniqueNameSearch(
  search: string,
  limit = 100,
): Promise<string[]> {
  const trimmed = search.trim();
  if (!trimmed) {
    return [];
  }

  await ensureMemberMongoReady();
  const collection = getMongoCollection<MemberMongoDocument>(MONGO_COLLECTIONS.members);
  const documents = await collection
    .find(
      { uniqueName: { $regex: escapeRegex(trimmed), $options: "i" } },
      { projection: { identityId: 1 } },
    )
    .limit(limit)
    .toArray();

  return documents.map((document) => document.identityId);
}

export async function findMembersByIdentityIds(
  identityIds: readonly string[],
): Promise<Map<string, PersistedMemberRecord>> {
  const uniqueIds = [...new Set(identityIds.filter((id) => id.trim().length > 0))];
  if (uniqueIds.length === 0) {
    return new Map();
  }

  await ensureMemberMongoReady();
  const collection = getMongoCollection<MemberMongoDocument>(MONGO_COLLECTIONS.members);
  const documents = await collection.find({ identityId: { $in: uniqueIds } }).toArray();

  return new Map(
    documents.map((document) => [document.identityId, fromMemberMongoDocument(document)]),
  );
}
