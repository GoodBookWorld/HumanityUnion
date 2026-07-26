import { randomUUID } from "node:crypto";

import { MONGO_COLLECTIONS } from "../../infrastructure/mongodb/mongo-collections.js";
import { isMongoConfigured } from "../../infrastructure/mongodb/mongo-config.js";
import { connectMongoClient } from "../../infrastructure/mongodb/mongo-connection.js";
import { getMongoCollection } from "../../infrastructure/mongodb/mongo-database.js";
import { AuthPersistenceUnavailableError } from "./auth.errors.js";
import type { AuthSessionRecord, CreateAuthSessionInput } from "./auth-session.types.js";
import { hashRefreshToken } from "./auth-password.js";

interface AuthSessionDocument extends AuthSessionRecord {
  _id?: string;
}

async function ensureAuthMongoReady(): Promise<void> {
  if (!isMongoConfigured()) {
    throw new AuthPersistenceUnavailableError();
  }

  await connectMongoClient();
}

export async function createAuthSession(input: CreateAuthSessionInput): Promise<AuthSessionRecord> {
  await ensureAuthMongoReady();

  const record: AuthSessionRecord = {
    sessionId: input.sessionId ?? randomUUID(),
    userId: input.userId,
    refreshTokenHash: hashRefreshToken(input.refreshToken),
    createdAt: new Date().toISOString(),
    expiresAt: input.expiresAt,
    userAgent: input.userAgent,
  };

  const collection = getMongoCollection<AuthSessionDocument>(MONGO_COLLECTIONS.authSessions);
  await collection.insertOne(record);

  return record;
}

export async function findAuthSessionById(sessionId: string): Promise<AuthSessionRecord | null> {
  await ensureAuthMongoReady();

  const collection = getMongoCollection<AuthSessionDocument>(MONGO_COLLECTIONS.authSessions);
  const document = await collection.findOne({ sessionId });

  if (!document) {
    return null;
  }

  const { _id: _ignored, ...record } = document;
  return record;
}

export async function revokeAuthSession(sessionId: string, revokedAt: string): Promise<void> {
  await ensureAuthMongoReady();

  const collection = getMongoCollection<AuthSessionDocument>(MONGO_COLLECTIONS.authSessions);

  await collection.updateOne({ sessionId }, { $set: { revokedAt } });
}

export async function rotateAuthSessionRefreshToken(input: {
  sessionId: string;
  refreshToken: string;
  lastUsedAt: string;
}): Promise<void> {
  await ensureAuthMongoReady();

  const collection = getMongoCollection<AuthSessionDocument>(MONGO_COLLECTIONS.authSessions);

  await collection.updateOne(
    { sessionId: input.sessionId },
    {
      $set: {
        refreshTokenHash: hashRefreshToken(input.refreshToken),
        lastUsedAt: input.lastUsedAt,
      },
    },
  );
}

export async function revokeAllAuthSessionsForUser(
  userId: string,
  exceptSessionId?: string,
): Promise<number> {
  await ensureAuthMongoReady();

  const collection = getMongoCollection<AuthSessionDocument>(MONGO_COLLECTIONS.authSessions);
  const revokedAt = new Date().toISOString();
  const filter: Record<string, unknown> = {
    userId,
    revokedAt: { $exists: false },
  };

  if (exceptSessionId) {
    filter.sessionId = { $ne: exceptSessionId };
  }

  const result = await collection.updateMany(filter, {
    $set: { revokedAt },
  });

  return result.modifiedCount ?? 0;
}

export async function deleteAuthSessionsByUserId(userId: string): Promise<number> {
  await ensureAuthMongoReady();

  const collection = getMongoCollection<AuthSessionDocument>(MONGO_COLLECTIONS.authSessions);
  const result = await collection.deleteMany({ userId });

  return result.deletedCount ?? 0;
}

export async function deleteAuthSessionsByUserIds(userIds: string[]): Promise<number> {
  await ensureAuthMongoReady();

  if (userIds.length === 0) {
    return 0;
  }

  const collection = getMongoCollection<AuthSessionDocument>(MONGO_COLLECTIONS.authSessions);
  const result = await collection.deleteMany({ userId: { $in: userIds } });

  return result.deletedCount ?? 0;
}

export function refreshTokenMatchesSession(
  refreshToken: string,
  session: AuthSessionRecord,
): boolean {
  return hashRefreshToken(refreshToken) === session.refreshTokenHash;
}

export function isAuthSessionActive(session: AuthSessionRecord, now = new Date()): boolean {
  if (session.revokedAt) {
    return false;
  }

  return new Date(session.expiresAt).getTime() > now.getTime();
}
