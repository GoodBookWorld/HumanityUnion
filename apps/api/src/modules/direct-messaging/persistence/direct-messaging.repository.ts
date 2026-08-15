import type { ClientSession } from "mongodb";

import type { DirectConversation, DirectMessage } from "@hu/types";

import { MONGO_COLLECTIONS } from "../../../infrastructure/mongodb/mongo-collections.js";
import { isMongoConfigured } from "../../../infrastructure/mongodb/mongo-config.js";
import { connectMongoClient } from "../../../infrastructure/mongodb/mongo-connection.js";
import { getMongoCollection } from "../../../infrastructure/mongodb/mongo-database.js";
import { DirectMessagingPersistenceError, DirectMessagingPersistenceUnavailableError } from "../direct-messaging.errors.js";
import {
  buildDirectConversationPairKey,
  fromDirectConversationMongoDocument,
  fromDirectMessageMongoDocument,
  toDirectConversationMongoDocument,
  toDirectMessageMongoDocument,
  type DirectConversationMongoDocument,
  type DirectMessageMongoDocument,
} from "./direct-messaging.mongo-document.js";

export function isDuplicateDirectMessagingKeyError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: number }).code === 11_000
  );
}

/**
 * Part 21 #8 — "unrelated Mongo errors are not swallowed" cuts both ways:
 * a genuine `TransientTransactionError` (e.g. a `WriteConflict` from two
 * concurrent transactions touching the same conversation document, Part
 * 21 #1/#8) must reach `session.withTransaction()` completely unwrapped,
 * because the MongoDB driver's built-in whole-transaction retry only
 * triggers on `error.hasErrorLabel("TransientTransactionError")` against
 * the *raw* driver error. Wrapping it in `DirectMessagingPersistenceError`
 * here would silently defeat that retry and turn an ordinary, expected
 * write conflict into a hard user-facing failure.
 */
function isTransientMongoTransactionError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) {
    return false;
  }

  if (typeof (error as { hasErrorLabel?: unknown }).hasErrorLabel === "function") {
    return (error as { hasErrorLabel: (label: string) => boolean }).hasErrorLabel(
      "TransientTransactionError",
    );
  }

  const labelSet = (error as { errorLabelSet?: unknown }).errorLabelSet;

  return labelSet instanceof Set && labelSet.has("TransientTransactionError");
}

async function ensureDirectMessagingMongoReady(): Promise<void> {
  if (!isMongoConfigured()) {
    throw new DirectMessagingPersistenceUnavailableError();
  }

  await connectMongoClient();
}

function conversationsCollection() {
  return getMongoCollection<DirectConversationMongoDocument>(MONGO_COLLECTIONS.directConversations);
}

function messagesCollection() {
  return getMongoCollection<DirectMessageMongoDocument>(MONGO_COLLECTIONS.directMessages);
}

export interface RepositorySessionOptions {
  session?: ClientSession;
}

/**
 * Open-or-create (Part 3/21 #1): one atomic `findOneAndUpdate(..., {
 * upsert: true })` against the unique `pairKey` index. `$setOnInsert` means
 * a caller that finds an existing conversation makes no write at all, and
 * two concurrent callers racing to create the first conversation for a
 * pair are resolved by MongoDB itself into a single winning document — the
 * loser's upsert simply becomes a (no-op) match. No retry loop is needed
 * because this is a pure "create if absent" operation, not a compare-and-
 * swap on mutable state.
 */
export async function openOrCreateDirectConversationDocument(
  conversation: DirectConversation,
): Promise<{ conversation: DirectConversation; created: boolean }> {
  await ensureDirectMessagingMongoReady();

  const pairKey = buildDirectConversationPairKey(
    conversation.participantIds[0]!,
    conversation.participantIds[1]!,
  );

  try {
    const before = await conversationsCollection().findOne({ pairKey });

    const result = await conversationsCollection().findOneAndUpdate(
      { pairKey },
      { $setOnInsert: toDirectConversationMongoDocument(conversation) },
      { upsert: true, returnDocument: "after" },
    );

    if (!result) {
      throw new DirectMessagingPersistenceError(
        "Direct Conversation open-or-create returned no document.",
      );
    }

    return {
      conversation: fromDirectConversationMongoDocument(result),
      created: !before,
    };
  } catch (error) {
    if (error instanceof DirectMessagingPersistenceError) {
      throw error;
    }

    if (isDuplicateDirectMessagingKeyError(error)) {
      const existing = await conversationsCollection().findOne({ pairKey });

      if (existing) {
        return { conversation: fromDirectConversationMongoDocument(existing), created: false };
      }
    }

    throw new DirectMessagingPersistenceError("Direct Conversation open-or-create failed.", error);
  }
}

export async function findDirectConversationById(
  conversationId: string,
  options: RepositorySessionOptions = {},
): Promise<DirectConversation | null> {
  await ensureDirectMessagingMongoReady();

  const document = await conversationsCollection().findOne(
    { conversationId },
    { session: options.session },
  );

  return document ? fromDirectConversationMongoDocument(document) : null;
}

export async function listDirectConversationsForParticipant(
  participantId: string,
): Promise<DirectConversation[]> {
  await ensureDirectMessagingMongoReady();

  const documents = await conversationsCollection()
    .find({ participantIds: participantId })
    .sort({ lastMessageAt: -1 })
    .toArray();

  return documents.map((document) => fromDirectConversationMongoDocument(document));
}

/**
 * Part 11/12 — updates conversation metadata (last message) and the
 * sender's own read marker in one call, always inside the same transaction
 * as the message insert. The sender's `reads` entry always pre-exists
 * (seeded at conversation creation), so this is a plain `$set` via
 * `arrayFilters`, never an upsert — Part 12's "sender does not receive an
 * unread marker for their own message" falls out of this for free, and the
 * recipient's entry is left completely untouched.
 */
export async function recordNewDirectMessageOnConversation(
  input: {
    conversationId: string;
    senderParticipantId: string;
    messageId: string;
    createdAt: string;
    preview: string;
  },
  options: RepositorySessionOptions = {},
): Promise<void> {
  await ensureDirectMessagingMongoReady();

  try {
    await conversationsCollection().updateOne(
      { conversationId: input.conversationId },
      {
        $set: {
          lastMessageAt: input.createdAt,
          lastMessageId: input.messageId,
          lastMessageSenderParticipantId: input.senderParticipantId,
          lastMessagePreview: input.preview,
          updatedAt: input.createdAt,
          "reads.$[sender].lastReadAt": input.createdAt,
          "reads.$[sender].lastReadMessageId": input.messageId,
        },
      },
      {
        arrayFilters: [{ "sender.participantId": input.senderParticipantId }],
        session: options.session,
      },
    );
  } catch (error) {
    if (isTransientMongoTransactionError(error)) {
      throw error;
    }

    throw new DirectMessagingPersistenceError(
      "Direct Conversation metadata update failed.",
      error,
    );
  }
}

/**
 * Part 12 — idempotent mark-read: always a plain `$set` via `arrayFilters`
 * against the Participant's pre-existing `reads` entry (never an upsert),
 * so repeated calls with the same or an older `lastReadMessageId` all
 * converge on the same terminal state safely.
 */
export async function markDirectConversationReadForParticipant(input: {
  conversationId: string;
  participantId: string;
  lastReadAt: string;
  lastReadMessageId: string;
}): Promise<void> {
  await ensureDirectMessagingMongoReady();

  try {
    await conversationsCollection().updateOne(
      { conversationId: input.conversationId },
      {
        $set: {
          "reads.$[reader].lastReadAt": input.lastReadAt,
          "reads.$[reader].lastReadMessageId": input.lastReadMessageId,
        },
      },
      { arrayFilters: [{ "reader.participantId": input.participantId }] },
    );
  } catch (error) {
    throw new DirectMessagingPersistenceError("Direct Conversation mark-read failed.", error);
  }
}

export async function insertDirectMessageDocument(
  message: DirectMessage,
  options: RepositorySessionOptions = {},
): Promise<void> {
  await ensureDirectMessagingMongoReady();

  try {
    await messagesCollection().insertOne(toDirectMessageMongoDocument(message), {
      session: options.session,
    });
  } catch (error) {
    if (isDuplicateDirectMessagingKeyError(error) || isTransientMongoTransactionError(error)) {
      throw error;
    }

    throw new DirectMessagingPersistenceError("Direct Message insert failed.", error);
  }
}

export async function findDirectMessageByClientMessageId(
  conversationId: string,
  senderParticipantId: string,
  clientMessageId: string,
): Promise<DirectMessage | null> {
  await ensureDirectMessagingMongoReady();

  const document = await messagesCollection().findOne({
    conversationId,
    senderParticipantId,
    clientMessageId,
  });

  return document ? fromDirectMessageMongoDocument(document) : null;
}

/** Exact message lookup for pagination anchors (avoids bounded recent-page re-scan). */
export async function findDirectMessageById(
  conversationId: string,
  messageId: string,
): Promise<DirectMessage | null> {
  await ensureDirectMessagingMongoReady();

  const document = await messagesCollection().findOne({
    conversationId,
    messageId,
  });

  return document ? fromDirectMessageMongoDocument(document) : null;
}

/** Most recent bounded page, newest-first; caller reverses for chronological display (Part 10). */
export async function listRecentDirectMessages(
  conversationId: string,
  limit: number,
): Promise<{ messages: DirectMessage[]; hasMore: boolean }> {
  await ensureDirectMessagingMongoReady();

  const documents = await messagesCollection()
    .find({ conversationId })
    .sort({ createdAt: -1, messageId: -1 })
    .limit(limit + 1)
    .toArray();

  const hasMore = documents.length > limit;
  const page = hasMore ? documents.slice(0, limit) : documents;

  return { messages: page.map((document) => fromDirectMessageMongoDocument(document)), hasMore };
}

/**
 * Cursor-paginated older page (Part 10/21 #5): the compound
 * `(createdAt, messageId)` cursor guarantees no duplicate and no skipped
 * record even when two messages share the same millisecond timestamp,
 * which a `createdAt`-only cursor could not guarantee.
 */
export async function listDirectMessagesBefore(
  conversationId: string,
  cursor: { createdAt: string; messageId: string },
  limit: number,
): Promise<{ messages: DirectMessage[]; hasMore: boolean }> {
  await ensureDirectMessagingMongoReady();

  const documents = await messagesCollection()
    .find({
      conversationId,
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

  return { messages: page.map((document) => fromDirectMessageMongoDocument(document)), hasMore };
}

// --- Narrow test-only cleanup helpers (exact selectors only; no delete-all). ---

export async function deleteDirectConversationsByParticipantIdForTests(
  participantId: string,
): Promise<number> {
  if (!isMongoConfigured()) {
    return 0;
  }

  await connectMongoClient();
  const conversations = await conversationsCollection().find({ participantIds: participantId }).toArray();

  for (const conversation of conversations) {
    await messagesCollection().deleteMany({ conversationId: conversation.conversationId });
  }

  const result = await conversationsCollection().deleteMany({ participantIds: participantId });

  return result.deletedCount ?? 0;
}

export async function deleteDirectConversationByIdForTests(conversationId: string): Promise<void> {
  if (!isMongoConfigured()) {
    return;
  }

  await connectMongoClient();
  await messagesCollection().deleteMany({ conversationId });
  await conversationsCollection().deleteOne({ conversationId });
}
