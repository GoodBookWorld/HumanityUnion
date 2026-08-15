import { randomUUID } from "node:crypto";

import type { ClientSession } from "mongodb";

import { MONGO_COLLECTIONS } from "../../infrastructure/mongodb/mongo-collections.js";
import { isMongoConfigured } from "../../infrastructure/mongodb/mongo-config.js";
import { connectMongoClient } from "../../infrastructure/mongodb/mongo-connection.js";
import { getMongoCollection } from "../../infrastructure/mongodb/mongo-database.js";
import { AuthPersistenceUnavailableError } from "./auth.errors.js";
import type { AuthUserRecord, RegisterAuthUserInput } from "./auth-user.types.js";
import { hashPassword } from "./auth-password.js";

interface AuthUserDocument extends AuthUserRecord {
  _id?: string;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

async function ensureAuthMongoReady(): Promise<void> {
  if (!isMongoConfigured()) {
    throw new AuthPersistenceUnavailableError();
  }

  await connectMongoClient();
}

export async function findAuthUserByEmail(email: string): Promise<AuthUserRecord | null> {
  await ensureAuthMongoReady();

  const collection = getMongoCollection<AuthUserDocument>(MONGO_COLLECTIONS.authUsers);
  const document = await collection.findOne({ email: normalizeEmail(email) });

  if (!document) {
    return null;
  }

  const { _id: _ignored, ...record } = document;
  return record;
}

export async function findAuthUserById(userId: string): Promise<AuthUserRecord | null> {
  await ensureAuthMongoReady();

  const collection = getMongoCollection<AuthUserDocument>(MONGO_COLLECTIONS.authUsers);
  const document = await collection.findOne({ userId });

  if (!document) {
    return null;
  }

  const { _id: _ignored, ...record } = document;
  return record;
}

/**
 * Performance Recovery Task — batch equivalent of `findAuthUserById`, used
 * where a caller previously issued one `findOne` per unique author id (see
 * `attachCollaborationStateToComments`). A single `$in` query replaces N
 * parallel round trips with one round trip, mirroring the existing
 * `findMemberProfilesByUserIds` batching pattern.
 */
export async function findAuthUsersByIds(
  userIds: readonly string[],
): Promise<Map<string, AuthUserRecord>> {
  const uniqueUserIds = [...new Set(userIds.filter((userId) => userId.trim().length > 0))];

  if (uniqueUserIds.length === 0) {
    return new Map();
  }

  await ensureAuthMongoReady();

  const collection = getMongoCollection<AuthUserDocument>(MONGO_COLLECTIONS.authUsers);
  const documents = await collection.find({ userId: { $in: uniqueUserIds } }).toArray();

  return new Map(
    documents.map((document) => {
      const { _id: _ignored, ...record } = document;
      return [document.userId, record];
    }),
  );
}

export async function findAuthUserByMemberId(memberId: string): Promise<AuthUserRecord | null> {
  await ensureAuthMongoReady();

  const collection = getMongoCollection<AuthUserDocument>(MONGO_COLLECTIONS.authUsers);
  const document = await collection.findOne({ memberId });

  if (!document) {
    return null;
  }

  const { _id: _ignored, ...record } = document;
  return record;
}

/**
 * Profile UX Pack 01 — batch equivalent of `findAuthUserByMemberId`, used to
 * enrich a list of Initiative-scoped Ally rows (each keyed by
 * `participantId`, i.e. `memberId`) with public author identity in one
 * round trip instead of one `findOne` per row (see
 * `resolvePublicAuthorsForParticipantIds`).
 */
export async function findAuthUsersByMemberIds(
  memberIds: readonly string[],
): Promise<Map<string, AuthUserRecord>> {
  const uniqueMemberIds = [...new Set(memberIds.filter((memberId) => memberId.trim().length > 0))];

  if (uniqueMemberIds.length === 0) {
    return new Map();
  }

  await ensureAuthMongoReady();

  const collection = getMongoCollection<AuthUserDocument>(MONGO_COLLECTIONS.authUsers);
  const documents = await collection.find({ memberId: { $in: uniqueMemberIds } }).toArray();

  return new Map(
    documents.map((document) => {
      const { _id: _ignored, ...record } = document;
      return [document.memberId, record];
    }),
  );
}

export async function insertAuthUser(
  input: RegisterAuthUserInput,
  memberId: string,
): Promise<AuthUserRecord> {
  await ensureAuthMongoReady();

  const now = new Date().toISOString();
  const passwordHash = await hashPassword(input.password);
  const record: AuthUserRecord = {
    userId: randomUUID(),
    email: normalizeEmail(input.email),
    passwordHash,
    displayName: input.displayName.trim(),
    role: input.role ?? "member",
    status: "active",
    memberId,
    emailVerificationStatus: "pending",
    createdAt: now,
    updatedAt: now,
  };

  const collection = getMongoCollection<AuthUserDocument>(MONGO_COLLECTIONS.authUsers);

  try {
    await collection.insertOne(record);
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code?: number }).code === 11000
    ) {
      throw error;
    }

    throw error;
  }

  return record;
}

export async function updateAuthUserLastLogin(userId: string, lastLoginAt: string): Promise<void> {
  await ensureAuthMongoReady();

  const collection = getMongoCollection<AuthUserDocument>(MONGO_COLLECTIONS.authUsers);

  await collection.updateOne(
    { userId },
    {
      $set: {
        lastLoginAt,
        updatedAt: lastLoginAt,
      },
    },
  );
}

export async function deleteAuthUsersByEmailPrefix(emailPrefix: string): Promise<number> {
  await ensureAuthMongoReady();

  const collection = getMongoCollection<AuthUserDocument>(MONGO_COLLECTIONS.authUsers);
  const result = await collection.deleteMany({
    email: { $regex: `^${emailPrefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}` },
  });

  return result.deletedCount ?? 0;
}

export async function findRawAuthUserByEmail(email: string): Promise<AuthUserRecord | null> {
  return findAuthUserByEmail(email);
}

export async function markAuthUserEmailVerified(
  userId: string,
  options: { session?: ClientSession } = {},
): Promise<AuthUserRecord | null> {
  await ensureAuthMongoReady();

  const now = new Date().toISOString();
  const collection = getMongoCollection<AuthUserDocument>(MONGO_COLLECTIONS.authUsers);

  const verifiedUpdate = await collection.findOneAndUpdate(
    { userId, emailVerificationStatus: "pending" },
    {
      $set: {
        emailVerificationStatus: "verified",
        emailVerifiedAt: now,
        updatedAt: now,
      },
      $unset: {
        pendingEmail: "",
      },
    },
    { returnDocument: "after", session: options.session },
  );

  if (verifiedUpdate) {
    const { _id: _ignored, ...record } = verifiedUpdate;
    return record;
  }

  const alreadyVerified = await collection.findOne(
    { userId, emailVerificationStatus: "verified" },
    { session: options.session },
  );

  if (!alreadyVerified) {
    return null;
  }

  const { _id: _ignoredVerified, ...verifiedRecord } = alreadyVerified;
  return verifiedRecord;
}

export async function markRegistrationWelcomeEmailSent(userId: string): Promise<boolean> {
  await ensureAuthMongoReady();

  const now = new Date().toISOString();
  const collection = getMongoCollection<AuthUserDocument>(MONGO_COLLECTIONS.authUsers);

  const result = await collection.findOneAndUpdate(
    {
      userId,
      registrationWelcomeEmailSentAt: { $exists: false },
    },
    {
      $set: {
        registrationWelcomeEmailSentAt: now,
        updatedAt: now,
      },
    },
    { returnDocument: "after" },
  );

  return Boolean(result);
}

export async function setAuthUserLoginEmailTwoStepEnabled(
  userId: string,
  enabled: boolean,
): Promise<AuthUserRecord | null> {
  await ensureAuthMongoReady();

  const now = new Date().toISOString();
  const collection = getMongoCollection<AuthUserDocument>(MONGO_COLLECTIONS.authUsers);

  const result = await collection.findOneAndUpdate(
    { userId },
    {
      $set: {
        loginEmailTwoStepEnabled: enabled,
        updatedAt: now,
      },
    },
    { returnDocument: "after" },
  );

  if (!result) {
    return null;
  }

  const { _id: _ignored, ...record } = result;
  return record;
}

export async function setAuthUserPendingEmail(
  userId: string,
  pendingEmail: string,
): Promise<AuthUserRecord | null> {
  await ensureAuthMongoReady();

  const now = new Date().toISOString();
  const collection = getMongoCollection<AuthUserDocument>(MONGO_COLLECTIONS.authUsers);

  const result = await collection.findOneAndUpdate(
    { userId },
    {
      $set: {
        pendingEmail: normalizeEmail(pendingEmail),
        updatedAt: now,
      },
    },
    { returnDocument: "after" },
  );

  if (!result) {
    return null;
  }

  const { _id: _ignored, ...record } = result;
  return record;
}

export async function markExistingAuthUsersEmailVerifiedForMigration(): Promise<number> {
  await ensureAuthMongoReady();

  const now = new Date().toISOString();
  const collection = getMongoCollection<AuthUserDocument>(MONGO_COLLECTIONS.authUsers);

  const result = await collection.updateMany(
    {
      emailVerificationStatus: { $ne: "verified" },
    },
    {
      $set: {
        emailVerificationStatus: "verified",
        emailVerifiedAt: now,
        updatedAt: now,
      },
    },
  );

  return result.modifiedCount ?? 0;
}

export async function confirmAuthUserEmailChange(
  userId: string,
  newEmail: string,
): Promise<AuthUserRecord | null> {
  await ensureAuthMongoReady();

  const now = new Date().toISOString();
  const collection = getMongoCollection<AuthUserDocument>(MONGO_COLLECTIONS.authUsers);

  const result = await collection.findOneAndUpdate(
    { userId },
    {
      $set: {
        email: normalizeEmail(newEmail),
        emailVerificationStatus: "verified",
        emailVerifiedAt: now,
        updatedAt: now,
      },
      $unset: {
        pendingEmail: "",
      },
    },
    { returnDocument: "after" },
  );

  if (!result) {
    return null;
  }

  const { _id: _ignored, ...record } = result;
  return record;
}

export async function countActiveAuthUsers(): Promise<number> {
  if (!isMongoConfigured()) {
    return 0;
  }

  await ensureAuthMongoReady();

  const collection = getMongoCollection<AuthUserDocument>(MONGO_COLLECTIONS.authUsers);

  return collection.countDocuments({
    status: { $ne: "disabled" },
  });
}

export async function countVerifiedActiveAuthUsers(): Promise<number> {
  if (!isMongoConfigured()) {
    return 0;
  }

  await ensureAuthMongoReady();

  const collection = getMongoCollection<AuthUserDocument>(MONGO_COLLECTIONS.authUsers);

  return collection.countDocuments({
    status: { $ne: "disabled" },
    emailVerificationStatus: "verified",
  });
}

export async function listActiveAuthUserMemberIds(): Promise<Map<string, string>> {
  if (!isMongoConfigured()) {
    return new Map();
  }

  await ensureAuthMongoReady();

  const collection = getMongoCollection<AuthUserDocument>(MONGO_COLLECTIONS.authUsers);
  const documents = await collection
    .find({ status: { $ne: "disabled" } }, { projection: { userId: 1, memberId: 1 } })
    .toArray();

  return new Map(documents.map((document) => [document.memberId, document.userId] as const));
}

export async function updateAuthUserPassword(
  userId: string,
  passwordHash: string,
): Promise<AuthUserRecord | null> {
  await ensureAuthMongoReady();

  const now = new Date().toISOString();
  const collection = getMongoCollection<AuthUserDocument>(MONGO_COLLECTIONS.authUsers);

  const result = await collection.findOneAndUpdate(
    { userId },
    {
      $set: {
        passwordHash,
        updatedAt: now,
      },
    },
    { returnDocument: "after" },
  );

  if (!result) {
    return null;
  }

  const { _id: _ignored, ...record } = result;
  return record;
}

export type AdminAuthUserListSort = "createdAt" | "lastLoginAt" | "email";

export interface ListAuthUsersForAdminQuery {
  search?: string;
  status?: AuthUserRecord["status"];
  role?: AuthUserRecord["role"];
  /** When set, only these userIds are considered (intersection). */
  userIdAllowlist?: readonly string[];
  /** Extra userIds matched via Member.uniqueName search — OR'd with email/displayName search. */
  searchAlsoUserIds?: readonly string[];
  sort: AdminAuthUserListSort;
  order: "asc" | "desc";
  limit: number;
  offset: number;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function stripAuthDocument(document: AuthUserDocument): AuthUserRecord {
  const { _id: _ignored, ...record } = document;
  return record;
}

/**
 * Admin Panel Pack 03 — pageable auth_users list for Participant directory.
 * Caller must enforce admin authorization. Never expose passwordHash outside service projection.
 */
export async function listAuthUsersForAdmin(
  query: ListAuthUsersForAdminQuery,
): Promise<{ items: AuthUserRecord[]; total: number }> {
  await ensureAuthMongoReady();

  const collection = getMongoCollection<AuthUserDocument>(MONGO_COLLECTIONS.authUsers);
  const filter: Record<string, unknown> = {};

  if (query.status) {
    filter.status = query.status;
  }

  if (query.role) {
    filter.role = query.role;
  }

  if (query.userIdAllowlist) {
    if (query.userIdAllowlist.length === 0) {
      return { items: [], total: 0 };
    }
    filter.userId = { $in: [...query.userIdAllowlist] };
  }

  const search = query.search?.trim();
  if (search) {
    const pattern = escapeRegex(search);
    const orClauses: Record<string, unknown>[] = [
      { email: { $regex: pattern, $options: "i" } },
      { displayName: { $regex: pattern, $options: "i" } },
    ];

    if (query.searchAlsoUserIds && query.searchAlsoUserIds.length > 0) {
      orClauses.push({ userId: { $in: [...query.searchAlsoUserIds] } });
    }

    filter.$or = orClauses;
  }

  const sortDirection = query.order === "asc" ? 1 : -1;
  const sort: Record<string, 1 | -1> = { [query.sort]: sortDirection };

  const [total, documents] = await Promise.all([
    collection.countDocuments(filter),
    collection.find(filter).sort(sort).skip(query.offset).limit(query.limit).toArray(),
  ]);

  return {
    total,
    items: documents.map(stripAuthDocument),
  };
}
