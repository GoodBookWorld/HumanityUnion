import type { InitiativeCollaborationChannelMessage, InitiativeCollaborationChannelReadState } from "@hu/types";

import { MONGO_COLLECTIONS } from "../../../infrastructure/mongodb/mongo-collections.js";
import { isMongoConfigured } from "../../../infrastructure/mongodb/mongo-config.js";
import { connectMongoClient } from "../../../infrastructure/mongodb/mongo-connection.js";
import { getMongoCollection } from "../../../infrastructure/mongodb/mongo-database.js";
import {
  InitiativeCollaborationChannelPersistenceError,
  InitiativeCollaborationChannelPersistenceUnavailableError,
} from "../initiative-collaboration-channel.errors.js";
import {
  fromInitiativeCollaborationChannelMessageMongoDocument,
  fromInitiativeCollaborationChannelReadMongoDocument,
  toInitiativeCollaborationChannelMessageMongoDocument,
  toInitiativeCollaborationChannelReadMongoDocument,
  type InitiativeCollaborationChannelMessageMongoDocument,
  type InitiativeCollaborationChannelReadMongoDocument,
} from "./initiative-collaboration-channel.mongo-document.js";

async function ensureCollaborationChannelMongoReady(): Promise<void> {
  if (!isMongoConfigured()) {
    throw new InitiativeCollaborationChannelPersistenceUnavailableError();
  }

  await connectMongoClient();
}

function messagesCollection() {
  return getMongoCollection<InitiativeCollaborationChannelMessageMongoDocument>(
    MONGO_COLLECTIONS.initiativeCollaborationChannelMessages,
  );
}

function readsCollection() {
  return getMongoCollection<InitiativeCollaborationChannelReadMongoDocument>(
    MONGO_COLLECTIONS.initiativeCollaborationChannelReads,
  );
}

export async function insertCollaborationChannelMessageDocument(
  message: InitiativeCollaborationChannelMessage,
): Promise<void> {
  await ensureCollaborationChannelMongoReady();

  try {
    await messagesCollection().insertOne(toInitiativeCollaborationChannelMessageMongoDocument(message));
  } catch (error) {
    throw new InitiativeCollaborationChannelPersistenceError(
      "Initiative Collaboration Channel message insert failed.",
      error,
    );
  }
}

/** Most recent bounded page, newest-first; caller reverses for chronological display (mirrors Direct Messaging's history read). */
export async function listRecentCollaborationChannelMessages(
  initiativeId: string,
  limit: number,
): Promise<{ messages: InitiativeCollaborationChannelMessage[]; hasMore: boolean }> {
  await ensureCollaborationChannelMongoReady();

  const documents = await messagesCollection()
    .find({ initiativeId })
    .sort({ createdAt: -1, messageId: -1 })
    .limit(limit + 1)
    .toArray();

  const hasMore = documents.length > limit;
  const page = hasMore ? documents.slice(0, limit) : documents;

  return {
    messages: page.map((document) => fromInitiativeCollaborationChannelMessageMongoDocument(document)),
    hasMore,
  };
}

/** Cursor-paginated older page — compound `(createdAt, messageId)` cursor, same guarantee as Direct Messaging's `listDirectMessagesBefore`. */
export async function listCollaborationChannelMessagesBefore(
  initiativeId: string,
  cursor: { createdAt: string; messageId: string },
  limit: number,
): Promise<{ messages: InitiativeCollaborationChannelMessage[]; hasMore: boolean }> {
  await ensureCollaborationChannelMongoReady();

  const documents = await messagesCollection()
    .find({
      initiativeId,
      $or: [
        { createdAt: { $lt: cursor.createdAt } },
        { createdAt: cursor.createdAt, messageId: { $lt: cursor.messageId } },
      ],
    })
    .sort({ createdAt: -1, messageId: -1 })
    .limit(limit + 1)
    .toArray();

  const hasMore = documents.length > limit;
  const page = hasMore ? documents.slice(0, limit) : documents;

  return {
    messages: page.map((document) => fromInitiativeCollaborationChannelMessageMongoDocument(document)),
    hasMore,
  };
}

export async function findLastCollaborationChannelMessage(
  initiativeId: string,
): Promise<InitiativeCollaborationChannelMessage | null> {
  await ensureCollaborationChannelMongoReady();

  const document = await messagesCollection()
    .find({ initiativeId })
    .sort({ createdAt: -1, messageId: -1 })
    .limit(1)
    .next();

  return document ? fromInitiativeCollaborationChannelMessageMongoDocument(document) : null;
}

/**
 * Unread count (Part 6): messages created after the viewer's last-read
 * marker, excluding the viewer's own messages (a Participant's own
 * messages are never "unread" to themselves) but always including system
 * events (no `senderParticipantId`).
 */
export async function countUnreadCollaborationChannelMessages(
  initiativeId: string,
  viewerParticipantId: string,
  sinceCreatedAt: string | null,
): Promise<number> {
  await ensureCollaborationChannelMongoReady();

  return messagesCollection().countDocuments({
    initiativeId,
    ...(sinceCreatedAt ? { createdAt: { $gt: sinceCreatedAt } } : {}),
    $or: [{ senderParticipantId: { $ne: viewerParticipantId } }, { senderParticipantId: { $exists: false } }],
  });
}

export async function findCollaborationChannelReadState(
  initiativeId: string,
  participantId: string,
): Promise<InitiativeCollaborationChannelReadState | null> {
  await ensureCollaborationChannelMongoReady();

  const document = await readsCollection().findOne({ initiativeId, participantId });

  return document ? fromInitiativeCollaborationChannelReadMongoDocument(document) : null;
}

/** Idempotent upsert — the Channel's participant set changes over time (unlike Direct Messaging's fixed pair), so read markers are lazily created, never pre-seeded. */
export async function upsertCollaborationChannelReadState(
  readState: InitiativeCollaborationChannelReadState,
): Promise<void> {
  await ensureCollaborationChannelMongoReady();

  try {
    await readsCollection().updateOne(
      { initiativeId: readState.initiativeId, participantId: readState.participantId },
      { $set: toInitiativeCollaborationChannelReadMongoDocument(readState) },
      { upsert: true },
    );
  } catch (error) {
    throw new InitiativeCollaborationChannelPersistenceError(
      "Initiative Collaboration Channel read-state upsert failed.",
      error,
    );
  }
}

/**
 * Initiative UX Pack 01.1 Part 5/6 — production-safe cleanup: removes every
 * Collaboration Channel message and read-marker for one Initiative. Called
 * when a Draft Initiative that was never published is permanently deleted
 * (Collaboration Channel access is not lifecycle-gated — see
 * `resolveInitiativeCollaborationChannelAccess` — so an Author can already
 * have Channel messages on a still-Draft Initiative via Initiative Group
 * Chat). Exact `initiativeId` selector only, identical scope to the
 * test-only helper below — a no-op when MongoDB is not configured, since
 * this module has no in-memory fallback and therefore cannot hold any data
 * to clean up in that case.
 */
export async function deleteCollaborationChannelDataByInitiativeId(
  initiativeId: string,
): Promise<void> {
  if (!isMongoConfigured()) {
    return;
  }

  await connectMongoClient();
  await messagesCollection().deleteMany({ initiativeId });
  await readsCollection().deleteMany({ initiativeId });
}

// --- Narrow test-only cleanup helpers (exact selectors only; no delete-all). ---

export async function deleteCollaborationChannelDataByInitiativeIdForTests(
  initiativeId: string,
): Promise<void> {
  await deleteCollaborationChannelDataByInitiativeId(initiativeId);
}
