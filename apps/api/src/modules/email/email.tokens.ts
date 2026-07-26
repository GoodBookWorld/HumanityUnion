import { createHash, randomBytes } from "node:crypto";
import { randomUUID } from "node:crypto";

import type { EmailVerificationTokenPurpose } from "@hu/types";

import { MONGO_COLLECTIONS } from "../../infrastructure/mongodb/mongo-collections.js";
import { isMongoConfigured } from "../../infrastructure/mongodb/mongo-config.js";
import { connectMongoClient } from "../../infrastructure/mongodb/mongo-connection.js";
import { getMongoCollection } from "../../infrastructure/mongodb/mongo-database.js";
import { resolveEmailConfig } from "./email.config.js";

export interface EmailVerificationTokenRecord {
  tokenId: string;
  userId: string;
  purpose: EmailVerificationTokenPurpose;
  tokenHash: string;
  expiresAt: string;
  createdAt: string;
  usedAt?: string;
  metadata?: {
    pendingEmail?: string;
  };
}

interface EmailVerificationTokenDocument extends EmailVerificationTokenRecord {
  _id?: string;
}

export interface IssuedEmailVerificationToken {
  token: string;
  record: EmailVerificationTokenRecord;
}

const memoryTokens: EmailVerificationTokenRecord[] = [];

function hashVerificationToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function generateRawToken(): string {
  return randomBytes(32).toString("base64url");
}

function resolveExpiresMinutes(purpose: EmailVerificationTokenPurpose): number {
  const config = resolveEmailConfig();

  switch (purpose) {
    case "registration":
      return config.verificationTokenExpiresMinutes;
    case "password_reset":
      return config.passwordResetTokenExpiresMinutes;
    case "email_change":
      return config.emailChangeTokenExpiresMinutes;
    default:
      return config.verificationTokenExpiresMinutes;
  }
}

async function ensureTokenMongoReady(): Promise<void> {
  if (!isMongoConfigured()) {
    return;
  }

  await connectMongoClient();
}

export async function createEmailVerificationToken(input: {
  userId: string;
  purpose: EmailVerificationTokenPurpose;
  metadata?: EmailVerificationTokenRecord["metadata"];
}): Promise<IssuedEmailVerificationToken> {
  const token = generateRawToken();
  const now = new Date();
  const expiresAt = new Date(
    now.getTime() + resolveExpiresMinutes(input.purpose) * 60_000,
  ).toISOString();

  const record: EmailVerificationTokenRecord = {
    tokenId: randomUUID(),
    userId: input.userId,
    purpose: input.purpose,
    tokenHash: hashVerificationToken(token),
    expiresAt,
    createdAt: now.toISOString(),
    metadata: input.metadata,
  };

  if (!isMongoConfigured()) {
    memoryTokens.push(record);
    return { token, record };
  }

  await ensureTokenMongoReady();
  const collection = getMongoCollection<EmailVerificationTokenDocument>(
    MONGO_COLLECTIONS.emailVerificationTokens,
  );
  await collection.insertOne(record);

  return { token, record };
}

export async function findValidEmailVerificationToken(input: {
  token: string;
  purpose: EmailVerificationTokenPurpose;
}): Promise<EmailVerificationTokenRecord | null> {
  const tokenHash = hashVerificationToken(input.token);
  const now = new Date().toISOString();

  if (!isMongoConfigured()) {
    return (
      memoryTokens.find(
        (entry) =>
          entry.tokenHash === tokenHash &&
          entry.purpose === input.purpose &&
          !entry.usedAt &&
          entry.expiresAt > now,
      ) ?? null
    );
  }

  await ensureTokenMongoReady();
  const collection = getMongoCollection<EmailVerificationTokenDocument>(
    MONGO_COLLECTIONS.emailVerificationTokens,
  );
  const document = await collection.findOne({
    tokenHash,
    purpose: input.purpose,
    usedAt: { $exists: false },
    expiresAt: { $gt: now },
  });

  if (!document) {
    return null;
  }

  const { _id: _ignored, ...record } = document;
  return record;
}

export async function consumeEmailVerificationToken(input: {
  token: string;
  purpose: EmailVerificationTokenPurpose;
}): Promise<EmailVerificationTokenRecord | null> {
  const record = await findValidEmailVerificationToken(input);

  if (!record) {
    return null;
  }

  const usedAt = new Date().toISOString();

  if (!isMongoConfigured()) {
    record.usedAt = usedAt;
    return record;
  }

  await ensureTokenMongoReady();
  const collection = getMongoCollection<EmailVerificationTokenDocument>(
    MONGO_COLLECTIONS.emailVerificationTokens,
  );

  const result = await collection.findOneAndUpdate(
    {
      tokenId: record.tokenId,
      usedAt: { $exists: false },
    },
    {
      $set: { usedAt },
    },
    { returnDocument: "after" },
  );

  if (!result) {
    return null;
  }

  const { _id: _ignored, ...updated } = result;
  return updated;
}

export function clearEmailVerificationTokensForTests(): void {
  memoryTokens.length = 0;
}

export async function deleteEmailVerificationTokensByUserIds(userIds: string[]): Promise<number> {
  if (userIds.length === 0) {
    return 0;
  }

  if (!isMongoConfigured()) {
    const before = memoryTokens.length;

    for (let index = memoryTokens.length - 1; index >= 0; index -= 1) {
      if (userIds.includes(memoryTokens[index]?.userId ?? "")) {
        memoryTokens.splice(index, 1);
      }
    }

    return before - memoryTokens.length;
  }

  await ensureTokenMongoReady();
  const collection = getMongoCollection<EmailVerificationTokenDocument>(
    MONGO_COLLECTIONS.emailVerificationTokens,
  );
  const result = await collection.deleteMany({ userId: { $in: userIds } });

  return result.deletedCount ?? 0;
}

export { hashVerificationToken };
