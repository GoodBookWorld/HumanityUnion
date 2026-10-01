import type { DirectConversationCall, DirectConversationCallStatus } from "@hu/types";

import { MONGO_COLLECTIONS } from "../../../infrastructure/mongodb/mongo-collections.js";
import { isMongoConfigured } from "../../../infrastructure/mongodb/mongo-config.js";
import { connectMongoClient } from "../../../infrastructure/mongodb/mongo-connection.js";
import { getMongoCollection } from "../../../infrastructure/mongodb/mongo-database.js";
import { DIRECT_CONVERSATION_CALL_HISTORY_LIMIT } from "../direct-conversation-call.config.js";
import {
  DirectConversationCallPersistenceError,
  DirectConversationCallPersistenceUnavailableError,
} from "../direct-conversation-call.errors.js";
import {
  DIRECT_CONVERSATION_CALL_TERMINAL_STATUSES,
  fromDirectConversationCallMongoDocument,
  toDirectConversationCallMongoDocument,
  type DirectConversationCallMongoDocument,
} from "./direct-conversation-call.mongo-document.js";

export function isDuplicateDirectConversationCallKeyError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: number }).code === 11_000
  );
}

async function ensureReady(): Promise<void> {
  if (!isMongoConfigured()) {
    throw new DirectConversationCallPersistenceUnavailableError();
  }

  await connectMongoClient();
}

function callsCollection() {
  return getMongoCollection<DirectConversationCallMongoDocument>(MONGO_COLLECTIONS.directConversationCalls);
}

export async function insertDirectConversationCall(
  record: DirectConversationCall,
): Promise<void> {
  await ensureReady();

  try {
    await callsCollection().insertOne(toDirectConversationCallMongoDocument(record));
  } catch (error) {
    if (isDuplicateDirectConversationCallKeyError(error)) {
      throw error;
    }

    throw new DirectConversationCallPersistenceError("Unable to store the call.", error);
  }
}

export async function findDirectConversationCallById(
  callId: string,
): Promise<DirectConversationCall | null> {
  await ensureReady();
  const document = await callsCollection().findOne({ callId });
  return document ? fromDirectConversationCallMongoDocument(document) : null;
}

export async function findLiveDirectConversationCall(
  conversationId: string,
): Promise<DirectConversationCall | null> {
  await ensureReady();
  const document = await callsCollection().findOne({
    conversationId,
    status: { $in: ["invited", "accepted"] },
  });
  return document ? fromDirectConversationCallMongoDocument(document) : null;
}

export async function listOverdueInvitedDirectConversationCalls(
  conversationId: string,
  now: string,
): Promise<DirectConversationCall[]> {
  await ensureReady();
  const documents = await callsCollection()
    .find({ conversationId, status: "invited", expiresAt: { $lte: now } })
    .toArray();
  return documents.map((document) => fromDirectConversationCallMongoDocument(document));
}

export async function listTerminalDirectConversationCalls(
  conversationId: string,
  limit: number,
): Promise<DirectConversationCall[]> {
  await ensureReady();
  const documents = await callsCollection()
    .find({
      conversationId,
      status: { $in: [...DIRECT_CONVERSATION_CALL_TERMINAL_STATUSES] },
    })
    .sort({ createdAt: -1, callId: -1 })
    .limit(limit)
    .toArray();
  return documents.map((document) => fromDirectConversationCallMongoDocument(document));
}

/**
 * Compare-and-swap. A lost race returns null and leaves the row unchanged.
 */
export async function transitionDirectConversationCall(input: {
  callId: string;
  fromStatus: DirectConversationCallStatus;
  expiresAtLte?: string;
  expiresAtGt?: string;
  toStatus: DirectConversationCallStatus;
  updatedAt: string;
  acceptedAt?: string;
  endedAt?: string;
}): Promise<DirectConversationCall | null> {
  await ensureReady();

  const filter: Record<string, unknown> = {
    callId: input.callId,
    status: input.fromStatus,
  };

  if (input.expiresAtLte !== undefined) {
    filter.expiresAt = { $lte: input.expiresAtLte };
  }

  if (input.expiresAtGt !== undefined) {
    filter.expiresAt = { $gt: input.expiresAtGt };
  }

  const update: Record<string, string> = {
    status: input.toStatus,
    updatedAt: input.updatedAt,
  };

  if (input.acceptedAt !== undefined) {
    update.acceptedAt = input.acceptedAt;
  }

  if (input.endedAt !== undefined) {
    update.endedAt = input.endedAt;
  }

  const document = await callsCollection().findOneAndUpdate(
    filter,
    { $set: update },
    { returnDocument: "after" },
  );

  return document ? fromDirectConversationCallMongoDocument(document) : null;
}

/**
 * Deletes terminal rows older than the newest `limit` for this conversation.
 * The filter repeats the terminal-status constraint so a live row cannot match.
 */
export async function pruneTerminalDirectConversationCalls(
  conversationId: string,
  limit = DIRECT_CONVERSATION_CALL_HISTORY_LIMIT,
): Promise<number> {
  await ensureReady();

  const stale = await callsCollection()
    .find({
      conversationId,
      status: { $in: [...DIRECT_CONVERSATION_CALL_TERMINAL_STATUSES] },
    })
    .sort({ createdAt: -1, callId: -1 })
    .skip(limit)
    .project<{ callId: string }>({ callId: 1 })
    .toArray();

  if (stale.length === 0) {
    return 0;
  }

  const result = await callsCollection().deleteMany({
    callId: { $in: stale.map((document) => document.callId) },
    status: { $in: [...DIRECT_CONVERSATION_CALL_TERMINAL_STATUSES] },
  });

  return result.deletedCount ?? 0;
}

export async function findRawDirectConversationCallDocumentForTests(
  callId: string,
): Promise<DirectConversationCallMongoDocument | null> {
  if (!isMongoConfigured()) {
    return null;
  }

  await connectMongoClient();
  return callsCollection().findOne({ callId });
}

export async function deleteDirectConversationCallsByConversationIdForTests(
  conversationId: string,
): Promise<void> {
  if (!isMongoConfigured()) {
    return;
  }

  await connectMongoClient();
  await callsCollection().deleteMany({ conversationId });
}
