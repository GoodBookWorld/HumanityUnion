import type { Document } from "mongodb";

import type {
  InitiativeCollaborationChannelMessage,
  InitiativeCollaborationChannelMessageType,
  InitiativeCollaborationChannelReadState,
  InitiativeCollaborationSystemEventKind,
} from "@hu/types";

import { InitiativeCollaborationChannelPersistenceError } from "../initiative-collaboration-channel.errors.js";

const VALID_MESSAGE_TYPES = new Set<InitiativeCollaborationChannelMessageType>([
  "participant_message",
  "system_event",
]);

export interface InitiativeCollaborationChannelMessageMongoDocument extends Document {
  messageId: string;
  initiativeId: string;
  type: InitiativeCollaborationChannelMessageType;
  senderParticipantId?: string;
  systemEventKind?: InitiativeCollaborationSystemEventKind;
  systemEventSubjectDisplayName?: string;
  text: string;
  createdAt: string;
}

/**
 * `senderParticipantId`/`systemEventKind`/`systemEventSubjectDisplayName`
 * must be OMITTED entirely when absent, never set to `undefined` — this
 * driver's default `ignoreUndefined: false` would otherwise serialize
 * `undefined` as BSON `null`, which would make every `system_event`
 * message appear to have a (null) sender. Mirrors
 * `toDirectMessageMongoDocument`'s documented reasoning in the Direct
 * Messaging persistence layer.
 */
export function toInitiativeCollaborationChannelMessageMongoDocument(
  record: InitiativeCollaborationChannelMessage,
): InitiativeCollaborationChannelMessageMongoDocument {
  return {
    messageId: record.messageId,
    initiativeId: record.initiativeId,
    type: record.type,
    text: record.text,
    createdAt: record.createdAt,
    ...(record.senderParticipantId !== undefined
      ? { senderParticipantId: record.senderParticipantId }
      : {}),
    ...(record.systemEventKind !== undefined ? { systemEventKind: record.systemEventKind } : {}),
    ...(record.systemEventSubjectDisplayName !== undefined
      ? { systemEventSubjectDisplayName: record.systemEventSubjectDisplayName }
      : {}),
  };
}

export function fromInitiativeCollaborationChannelMessageMongoDocument(
  document: InitiativeCollaborationChannelMessageMongoDocument,
): InitiativeCollaborationChannelMessage {
  if (typeof document.messageId !== "string" || document.messageId.length === 0) {
    throw new InitiativeCollaborationChannelPersistenceError(
      "Persisted Collaboration Channel message is missing a valid messageId.",
    );
  }

  if (typeof document.initiativeId !== "string" || document.initiativeId.length === 0) {
    throw new InitiativeCollaborationChannelPersistenceError(
      `Persisted Collaboration Channel message "${document.messageId}" is missing a valid initiativeId.`,
    );
  }

  if (!VALID_MESSAGE_TYPES.has(document.type)) {
    throw new InitiativeCollaborationChannelPersistenceError(
      `Persisted Collaboration Channel message "${document.messageId}" has an invalid type.`,
    );
  }

  return {
    messageId: document.messageId,
    initiativeId: document.initiativeId,
    type: document.type,
    senderParticipantId: document.senderParticipantId,
    systemEventKind: document.systemEventKind,
    systemEventSubjectDisplayName: document.systemEventSubjectDisplayName,
    text: document.text,
    createdAt: document.createdAt,
  };
}

export interface InitiativeCollaborationChannelReadMongoDocument extends Document {
  initiativeId: string;
  participantId: string;
  lastReadAt: string | null;
  lastReadMessageId: string | null;
}

export function toInitiativeCollaborationChannelReadMongoDocument(
  record: InitiativeCollaborationChannelReadState,
): InitiativeCollaborationChannelReadMongoDocument {
  return {
    initiativeId: record.initiativeId,
    participantId: record.participantId,
    lastReadAt: record.lastReadAt,
    lastReadMessageId: record.lastReadMessageId,
  };
}

export function fromInitiativeCollaborationChannelReadMongoDocument(
  document: InitiativeCollaborationChannelReadMongoDocument,
): InitiativeCollaborationChannelReadState {
  return {
    initiativeId: document.initiativeId,
    participantId: document.participantId,
    lastReadAt: document.lastReadAt ?? null,
    lastReadMessageId: document.lastReadMessageId ?? null,
  };
}
