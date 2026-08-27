import { createHash, randomBytes, randomUUID } from "node:crypto";

import { MONGO_COLLECTIONS } from "../../infrastructure/mongodb/mongo-collections.js";
import { isMongoConfigured } from "../../infrastructure/mongodb/mongo-config.js";
import { connectMongoClient } from "../../infrastructure/mongodb/mongo-connection.js";
import { getMongoCollection } from "../../infrastructure/mongodb/mongo-database.js";
import { AuthPersistenceUnavailableError } from "../auth/auth.errors.js";
import type {
  CreateParticipantSuspensionInput,
  IssuedParticipantSuspension,
  ParticipantSuspensionRecord,
  ParticipantSuspensionReviewRequestRecord,
} from "./participant-suspension.types.js";

interface ParticipantSuspensionDocument extends ParticipantSuspensionRecord {
  _id?: string;
}

const REVIEW_TOKEN_TTL_DAYS = 14;

const memorySuspensions: ParticipantSuspensionRecord[] = [];

let forceMemoryForTests = false;

export function setParticipantSuspensionForceMemoryForTests(enabled: boolean): void {
  forceMemoryForTests = enabled;
}

export function resetParticipantSuspensionsMemoryForTests(): void {
  memorySuspensions.length = 0;
}

function shouldUseMemoryAdapter(): boolean {
  return forceMemoryForTests || !isMongoConfigured();
}

async function ensureSuspensionMongoReady(): Promise<void> {
  if (shouldUseMemoryAdapter()) {
    return;
  }
  if (!isMongoConfigured()) {
    throw new AuthPersistenceUnavailableError();
  }
  await connectMongoClient();
}

function toRecord(document: ParticipantSuspensionDocument): ParticipantSuspensionRecord {
  const { _id: _ignored, ...record } = document;
  return record;
}

export function hashSuspensionReviewToken(rawToken: string): string {
  return createHash("sha256").update(rawToken.trim()).digest("hex");
}

export function generateSuspensionReviewToken(): string {
  return randomBytes(32).toString("base64url");
}

export function resolveSuspensionReviewTokenExpiresAt(from: Date = new Date()): string {
  return new Date(from.getTime() + REVIEW_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();
}

function insertMemory(record: ParticipantSuspensionRecord): ParticipantSuspensionRecord {
  memorySuspensions.push({ ...record });
  return { ...record };
}

function replaceMemory(record: ParticipantSuspensionRecord): ParticipantSuspensionRecord | null {
  const index = memorySuspensions.findIndex((row) => row.suspensionId === record.suspensionId);
  if (index < 0) {
    return null;
  }
  memorySuspensions[index] = { ...record };
  return { ...record };
}

function listMemory(): ParticipantSuspensionRecord[] {
  return memorySuspensions.map((row) => ({ ...row }));
}

export async function insertParticipantSuspension(
  input: CreateParticipantSuspensionInput & { rawReviewToken: string },
): Promise<IssuedParticipantSuspension> {
  await ensureSuspensionMongoReady();

  const now = new Date().toISOString();
  const record: ParticipantSuspensionRecord = {
    suspensionId: randomUUID(),
    participantId: input.participantId,
    userId: input.userId,
    reasonCode: input.reasonCode,
    suspendedAt: now,
    suspendedByParticipantId: input.suspendedByParticipantId,
    status: "active",
    reviewTokenHash: input.reviewTokenHash,
    reviewTokenExpiresAt: input.reviewTokenExpiresAt,
  };

  if (shouldUseMemoryAdapter()) {
    insertMemory(record);
    return { suspension: record, rawReviewToken: input.rawReviewToken };
  }

  const collection = getMongoCollection<ParticipantSuspensionDocument>(
    MONGO_COLLECTIONS.participantSuspensions,
  );
  await collection.insertOne(record);
  return { suspension: record, rawReviewToken: input.rawReviewToken };
}

export async function findActiveSuspensionByParticipantId(
  participantId: string,
): Promise<ParticipantSuspensionRecord | null> {
  await ensureSuspensionMongoReady();

  if (shouldUseMemoryAdapter()) {
    return (
      listMemory().find((row) => row.participantId === participantId && row.status === "active") ??
      null
    );
  }

  const collection = getMongoCollection<ParticipantSuspensionDocument>(
    MONGO_COLLECTIONS.participantSuspensions,
  );
  const document = await collection.findOne({ participantId, status: "active" });
  return document ? toRecord(document) : null;
}

export async function findActiveSuspensionsByParticipantIds(
  participantIds: readonly string[],
): Promise<Map<string, ParticipantSuspensionRecord>> {
  const uniqueIds = [...new Set(participantIds.filter((id) => id.trim().length > 0))];
  if (uniqueIds.length === 0) {
    return new Map();
  }

  await ensureSuspensionMongoReady();

  if (shouldUseMemoryAdapter()) {
    const map = new Map<string, ParticipantSuspensionRecord>();
    for (const row of listMemory()) {
      if (row.status === "active" && uniqueIds.includes(row.participantId)) {
        map.set(row.participantId, { ...row });
      }
    }
    return map;
  }

  const collection = getMongoCollection<ParticipantSuspensionDocument>(
    MONGO_COLLECTIONS.participantSuspensions,
  );
  const documents = await collection
    .find({ participantId: { $in: uniqueIds }, status: "active" })
    .toArray();

  return new Map(documents.map((document) => [document.participantId, toRecord(document)]));
}

export async function findSuspensionByReviewTokenHash(
  reviewTokenHash: string,
): Promise<ParticipantSuspensionRecord | null> {
  await ensureSuspensionMongoReady();

  if (shouldUseMemoryAdapter()) {
    return listMemory().find((row) => row.reviewTokenHash === reviewTokenHash) ?? null;
  }

  const collection = getMongoCollection<ParticipantSuspensionDocument>(
    MONGO_COLLECTIONS.participantSuspensions,
  );
  const document = await collection.findOne({ reviewTokenHash });
  return document ? toRecord(document) : null;
}

export async function findSuspensionById(
  suspensionId: string,
): Promise<ParticipantSuspensionRecord | null> {
  await ensureSuspensionMongoReady();

  if (shouldUseMemoryAdapter()) {
    return listMemory().find((row) => row.suspensionId === suspensionId) ?? null;
  }

  const collection = getMongoCollection<ParticipantSuspensionDocument>(
    MONGO_COLLECTIONS.participantSuspensions,
  );
  const document = await collection.findOne({ suspensionId });
  return document ? toRecord(document) : null;
}

export async function replaceParticipantSuspension(
  record: ParticipantSuspensionRecord,
): Promise<ParticipantSuspensionRecord> {
  await ensureSuspensionMongoReady();

  if (shouldUseMemoryAdapter()) {
    const updated = replaceMemory(record);
    if (!updated) {
      throw new Error("Suspension record not found.");
    }
    return updated;
  }

  const collection = getMongoCollection<ParticipantSuspensionDocument>(
    MONGO_COLLECTIONS.participantSuspensions,
  );
  const { suspensionId, ...rest } = record;
  const result = await collection.findOneAndUpdate(
    { suspensionId },
    { $set: rest },
    { returnDocument: "after" },
  );

  if (!result) {
    throw new Error("Suspension record not found.");
  }

  return toRecord(result);
}

export async function setPendingReviewRequest(
  suspensionId: string,
  reviewRequest: ParticipantSuspensionReviewRequestRecord,
): Promise<ParticipantSuspensionRecord | null> {
  const existing = await findSuspensionById(suspensionId);
  if (!existing || existing.status !== "active") {
    return null;
  }

  if (existing.reviewRequest?.status === "pending") {
    return existing;
  }

  return replaceParticipantSuspension({
    ...existing,
    reviewRequest,
  });
}

export async function markSuspensionRestored(input: {
  suspensionId: string;
  restoredByParticipantId: string;
}): Promise<ParticipantSuspensionRecord | null> {
  const existing = await findSuspensionById(input.suspensionId);
  if (!existing || existing.status !== "active") {
    return existing;
  }

  const now = new Date().toISOString();
  const reviewRequest =
    existing.reviewRequest?.status === "pending"
      ? {
          ...existing.reviewRequest,
          status: "resolved" as const,
          resolvedAt: now,
        }
      : existing.reviewRequest;

  return replaceParticipantSuspension({
    ...existing,
    status: "restored",
    restoredAt: now,
    restoredByParticipantId: input.restoredByParticipantId,
    reviewTokenConsumedAt: existing.reviewTokenConsumedAt ?? now,
    reviewRequest,
  });
}
