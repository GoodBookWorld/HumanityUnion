import type { Document } from "mongodb";

import type {
  DirectConversation,
  DirectConversationReadState,
  DirectConversationStatus,
  DirectMessage,
  DirectMessageStatus,
} from "@hu/types";

import { DirectMessagingPersistenceError } from "../direct-messaging.errors.js";

const VALID_CONVERSATION_STATUSES = new Set<DirectConversationStatus>(["active"]);
const VALID_MESSAGE_STATUSES = new Set<DirectMessageStatus>(["sent"]);

/**
 * Deterministic identity (Part 3): `min(participantIdA, participantIdB)` +
 * `"::"` + `max(...)`. Two Participants always resolve to exactly the same
 * `pairKey` regardless of who calls first, and `pairKey` carries the
 * database-enforced unique index (`direct_conversations_pair_key_unique`)
 * that is the sole concurrency authority for "at most one active
 * conversation per unordered pair" — never an in-memory check.
 */
export function sortedParticipantIds(
  participantIdA: string,
  participantIdB: string,
): [string, string] {
  return participantIdA <= participantIdB
    ? [participantIdA, participantIdB]
    : [participantIdB, participantIdA];
}

export function buildDirectConversationPairKey(
  participantIdA: string,
  participantIdB: string,
): string {
  const [first, second] = sortedParticipantIds(participantIdA, participantIdB);
  return `${first}::${second}`;
}

export function buildDirectConversationId(participantIdA: string, participantIdB: string): string {
  return `direct-conversation:${buildDirectConversationPairKey(participantIdA, participantIdB)}`;
}

export interface DirectConversationMongoDocument extends Document {
  conversationId: string;
  pairKey: string;
  participantIds: string[];
  createdAt: string;
  updatedAt: string;
  lastMessageAt: string;
  lastMessageId?: string;
  lastMessageSenderParticipantId?: string;
  lastMessagePreview?: string;
  status: DirectConversationStatus;
  reads: DirectConversationReadState[];
}

export function toDirectConversationMongoDocument(
  record: DirectConversation,
): DirectConversationMongoDocument {
  return {
    conversationId: record.conversationId,
    pairKey: buildDirectConversationPairKey(record.participantIds[0]!, record.participantIds[1]!),
    participantIds: record.participantIds,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    lastMessageAt: record.lastMessageAt,
    status: record.status,
    reads: record.reads,
    // Omitted (not set to `undefined`) when absent — see the doc comment on
    // `toDirectMessageMongoDocument` for why this matters with this
    // driver's default `ignoreUndefined: false` behavior.
    ...(record.lastMessageId !== undefined ? { lastMessageId: record.lastMessageId } : {}),
    ...(record.lastMessageSenderParticipantId !== undefined
      ? { lastMessageSenderParticipantId: record.lastMessageSenderParticipantId }
      : {}),
    ...(record.lastMessagePreview !== undefined
      ? { lastMessagePreview: record.lastMessagePreview }
      : {}),
  };
}

export function fromDirectConversationMongoDocument(
  document: DirectConversationMongoDocument,
): DirectConversation {
  if (typeof document.conversationId !== "string" || document.conversationId.length === 0) {
    throw new DirectMessagingPersistenceError(
      "Persisted Direct Conversation is missing a valid conversationId.",
    );
  }

  if (!Array.isArray(document.participantIds) || document.participantIds.length !== 2) {
    throw new DirectMessagingPersistenceError(
      `Persisted Direct Conversation "${document.conversationId}" must have exactly two participantIds.`,
    );
  }

  if (!VALID_CONVERSATION_STATUSES.has(document.status)) {
    throw new DirectMessagingPersistenceError(
      `Persisted Direct Conversation "${document.conversationId}" has an invalid status.`,
    );
  }

  if (!Array.isArray(document.reads)) {
    throw new DirectMessagingPersistenceError(
      `Persisted Direct Conversation "${document.conversationId}" is missing read state.`,
    );
  }

  return {
    conversationId: document.conversationId,
    participantIds: document.participantIds,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
    lastMessageAt: document.lastMessageAt,
    lastMessageId: document.lastMessageId,
    lastMessageSenderParticipantId: document.lastMessageSenderParticipantId,
    lastMessagePreview: document.lastMessagePreview,
    status: document.status,
    reads: document.reads,
  };
}

export interface DirectMessageMongoDocument extends Document {
  messageId: string;
  conversationId: string;
  senderParticipantId: string;
  text: string;
  createdAt: string;
  editedAt?: string;
  status: DirectMessageStatus;
  clientMessageId?: string;
}

/**
 * Critical: `clientMessageId` (and `editedAt`) must be OMITTED entirely when
 * absent, never set to `undefined`. The MongoDB Node driver's default
 * `ignoreUndefined: false` serializes an `undefined` property as BSON
 * `null` rather than dropping the key — which would make every plain
 * (non-idempotent) message from the same sender into the same conversation
 * collide on the sparse unique `(conversationId, senderParticipantId,
 * clientMessageId)` index after the very first one. Building the document
 * with conditional spreads keeps the key genuinely absent, which is what
 * makes the index's sparseness (Part 21 #2) actually work.
 */
export function toDirectMessageMongoDocument(record: DirectMessage): DirectMessageMongoDocument {
  return {
    messageId: record.messageId,
    conversationId: record.conversationId,
    senderParticipantId: record.senderParticipantId,
    text: record.text,
    createdAt: record.createdAt,
    status: record.status,
    ...(record.editedAt !== undefined ? { editedAt: record.editedAt } : {}),
    ...(record.clientMessageId !== undefined ? { clientMessageId: record.clientMessageId } : {}),
  };
}

export function fromDirectMessageMongoDocument(document: DirectMessageMongoDocument): DirectMessage {
  if (typeof document.messageId !== "string" || document.messageId.length === 0) {
    throw new DirectMessagingPersistenceError("Persisted Direct Message is missing a valid messageId.");
  }

  if (typeof document.conversationId !== "string" || document.conversationId.length === 0) {
    throw new DirectMessagingPersistenceError(
      `Persisted Direct Message "${document.messageId}" is missing a valid conversationId.`,
    );
  }

  if (!VALID_MESSAGE_STATUSES.has(document.status)) {
    throw new DirectMessagingPersistenceError(
      `Persisted Direct Message "${document.messageId}" has an invalid status.`,
    );
  }

  return {
    messageId: document.messageId,
    conversationId: document.conversationId,
    senderParticipantId: document.senderParticipantId,
    text: document.text,
    createdAt: document.createdAt,
    editedAt: document.editedAt,
    status: document.status,
    clientMessageId: document.clientMessageId,
  };
}
