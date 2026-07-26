import { randomUUID } from "node:crypto";

import type {
  CreateInitiativeCommentInput,
  InitiativeComment,
  InitiativeCommentListResult,
} from "@hu/types";

import { MONGO_COLLECTIONS } from "../../infrastructure/mongodb/mongo-collections.js";
import { isMongoConfigured } from "../../infrastructure/mongodb/mongo-config.js";
import { connectMongoClient } from "../../infrastructure/mongodb/mongo-connection.js";
import { getMongoCollection } from "../../infrastructure/mongodb/mongo-database.js";

const MAX_COMMENT_LENGTH = 2000;
const MIN_POST_INTERVAL_MS = 5000;

const lastPostAtByUser = new Map<string, number>();

interface InitiativeCommentDocument extends InitiativeComment {
  _id?: string;
}

async function ensureMongoReady(): Promise<void> {
  if (!isMongoConfigured()) {
    throw new Error("MongoDB is not configured for initiative comments.");
  }

  await connectMongoClient();
}

function sanitizeCommentBody(body: string): string {
  return body.replace(/<[^>]*>/g, "").trim();
}

function assertValidBody(body: string): string {
  if (/[<>]/.test(body)) {
    throw new Error("Comment contains invalid characters.");
  }

  const sanitized = sanitizeCommentBody(body);

  if (!sanitized) {
    throw new Error("Comment cannot be empty.");
  }

  if (sanitized.length > MAX_COMMENT_LENGTH) {
    throw new Error(`Comment cannot exceed ${MAX_COMMENT_LENGTH} characters.`);
  }

  if (/[<>]/.test(sanitized)) {
    throw new Error("Comment contains invalid characters.");
  }

  return sanitized;
}

function assertRateLimit(authorUserId: string): void {
  const lastPostAt = lastPostAtByUser.get(authorUserId) ?? 0;
  const elapsed = Date.now() - lastPostAt;

  if (elapsed < MIN_POST_INTERVAL_MS) {
    throw new Error("Please wait before trying again.");
  }
}

export async function deleteInitiativeCommentsByIdPrefix(prefix: string): Promise<number> {
  await ensureMongoReady();
  const collection = getMongoCollection<InitiativeCommentDocument>(
    MONGO_COLLECTIONS.initiativeComments,
  );
  const result = await collection.deleteMany({ commentId: { $regex: `^${prefix}` } });
  return result.deletedCount ?? 0;
}

export async function createInitiativeCommentMongo(
  input: CreateInitiativeCommentInput,
): Promise<InitiativeComment> {
  await ensureMongoReady();
  assertRateLimit(input.authorUserId);

  const body = assertValidBody(input.body);
  const now = new Date().toISOString();
  const comment: InitiativeComment = {
    commentId: randomUUID(),
    initiativeId: input.initiativeId,
    authorUserId: input.authorUserId,
    authorDisplayName: input.authorDisplayName?.trim() || "Participant",
    body,
    status: "approved",
    moderationState: "none",
    parentCommentId: input.parentCommentId,
    createdAt: now,
    updatedAt: now,
  };

  const collection = getMongoCollection<InitiativeCommentDocument>(
    MONGO_COLLECTIONS.initiativeComments,
  );

  await collection.insertOne(comment);
  lastPostAtByUser.set(input.authorUserId, Date.now());

  return comment;
}

export async function listApprovedInitiativeCommentsMongo(input: {
  initiativeId: string;
  limit?: number;
  offset?: number;
}): Promise<InitiativeCommentListResult> {
  await ensureMongoReady();

  const limit = Math.min(Math.max(input.limit ?? 40, 1), 40);
  const offset = Math.max(input.offset ?? 0, 0);
  const collection = getMongoCollection<InitiativeCommentDocument>(
    MONGO_COLLECTIONS.initiativeComments,
  );

  const filter = { initiativeId: input.initiativeId, status: "approved" as const };
  const total = await collection.countDocuments(filter);
  const documents = await collection
    .find(filter)
    .sort({ createdAt: -1 })
    .skip(offset)
    .limit(limit)
    .toArray();

  const comments = documents.map(({ _id: _ignored, ...comment }) => comment);

  return {
    comments,
    total,
    limit,
    offset,
    hasMore: offset + comments.length < total,
  };
}

export async function getApprovedInitiativeCommentByIdMongo(
  commentId: string,
): Promise<InitiativeComment | null> {
  await ensureMongoReady();
  const collection = getMongoCollection<InitiativeCommentDocument>(
    MONGO_COLLECTIONS.initiativeComments,
  );
  const document = await collection.findOne({
    commentId,
    status: "approved",
    deletedAt: { $exists: false },
  });

  if (!document) {
    return null;
  }

  const { _id: _ignored, ...comment } = document;
  return comment;
}

export async function deleteInitiativeCommentMongo(input: {
  commentId: string;
  authorUserId: string;
}): Promise<InitiativeComment | null> {
  await ensureMongoReady();
  const collection = getMongoCollection<InitiativeCommentDocument>(
    MONGO_COLLECTIONS.initiativeComments,
  );
  const existing = await collection.findOne({
    commentId: input.commentId,
    authorUserId: input.authorUserId,
    status: "approved",
  });

  if (!existing) {
    return null;
  }

  const now = new Date().toISOString();
  await collection.updateOne(
    { commentId: input.commentId },
    { $set: { status: "removed", deletedAt: now, updatedAt: now } },
  );

  return {
    ...existing,
    status: "removed",
    deletedAt: now,
    updatedAt: now,
  };
}

export function resetInitiativeCommentRateLimitsForTests(): void {
  lastPostAtByUser.clear();
}
