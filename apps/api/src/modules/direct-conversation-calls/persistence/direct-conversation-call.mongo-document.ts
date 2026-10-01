import type { Document } from "mongodb";

import type {
  DirectConversationCall,
  DirectConversationCallStatus,
} from "@hu/types";

import { DirectConversationCallPersistenceError } from "../direct-conversation-call.errors.js";

export const DIRECT_CONVERSATION_CALL_LIVE_STATUSES = ["invited", "accepted"] as const;

export const DIRECT_CONVERSATION_CALL_TERMINAL_STATUSES = ["declined", "ended", "missed"] as const;

const VALID_STATUSES = new Set<DirectConversationCallStatus>([
  ...DIRECT_CONVERSATION_CALL_LIVE_STATUSES,
  ...DIRECT_CONVERSATION_CALL_TERMINAL_STATUSES,
]);

export interface DirectConversationCallMongoDocument extends Document {
  callId: string;
  contextType: "direct_conversation";
  conversationId: string;
  participantIds: string[];
  initiatorParticipantId: string;
  status: DirectConversationCallStatus;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
  acceptedAt?: string;
  endedAt?: string;
}

export function toDirectConversationCallMongoDocument(
  record: DirectConversationCall,
): DirectConversationCallMongoDocument {
  return {
    callId: record.callId,
    contextType: "direct_conversation",
    conversationId: record.conversationId,
    participantIds: record.participantIds,
    initiatorParticipantId: record.initiatorParticipantId,
    status: record.status,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    expiresAt: record.expiresAt,
    ...(record.acceptedAt !== undefined ? { acceptedAt: record.acceptedAt } : {}),
    ...(record.endedAt !== undefined ? { endedAt: record.endedAt } : {}),
  };
}

export function deriveDirectConversationCallDurationMs(
  record: Pick<DirectConversationCall, "status" | "acceptedAt" | "endedAt">,
): number | undefined {
  if (record.status !== "ended" || !record.acceptedAt || !record.endedAt) {
    return undefined;
  }

  const durationMs = Date.parse(record.endedAt) - Date.parse(record.acceptedAt);

  if (!Number.isFinite(durationMs) || durationMs < 0) {
    return undefined;
  }

  return durationMs;
}

export function fromDirectConversationCallMongoDocument(
  document: DirectConversationCallMongoDocument,
): DirectConversationCall {
  if (typeof document.callId !== "string" || document.callId.length === 0) {
    throw new DirectConversationCallPersistenceError("Persisted call is missing a valid callId.");
  }

  if (document.contextType !== "direct_conversation") {
    throw new DirectConversationCallPersistenceError(
      `Persisted call "${document.callId}" has an unsupported context.`,
    );
  }

  if (typeof document.conversationId !== "string" || document.conversationId.length === 0) {
    throw new DirectConversationCallPersistenceError(
      `Persisted call "${document.callId}" is missing a conversationId.`,
    );
  }

  if (
    !Array.isArray(document.participantIds) ||
    document.participantIds.length !== 2 ||
    document.participantIds.some((id) => typeof id !== "string" || id.length === 0)
  ) {
    throw new DirectConversationCallPersistenceError(
      `Persisted call "${document.callId}" must record the two conversation participants.`,
    );
  }

  if (
    typeof document.initiatorParticipantId !== "string" ||
    !document.participantIds.includes(document.initiatorParticipantId)
  ) {
    throw new DirectConversationCallPersistenceError(
      `Persisted call "${document.callId}" has an initiator outside the conversation pair.`,
    );
  }

  if (!VALID_STATUSES.has(document.status)) {
    throw new DirectConversationCallPersistenceError(
      `Persisted call "${document.callId}" has an invalid status.`,
    );
  }

  const record: DirectConversationCall = {
    callId: document.callId,
    contextType: "direct_conversation",
    conversationId: document.conversationId,
    participantIds: document.participantIds,
    initiatorParticipantId: document.initiatorParticipantId,
    status: document.status,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
    expiresAt: document.expiresAt,
    ...(typeof document.acceptedAt === "string" ? { acceptedAt: document.acceptedAt } : {}),
    ...(typeof document.endedAt === "string" ? { endedAt: document.endedAt } : {}),
  };

  const durationMs = deriveDirectConversationCallDurationMs(record);

  return durationMs === undefined ? record : { ...record, durationMs };
}
