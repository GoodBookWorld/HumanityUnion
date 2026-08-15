import type { Document } from "mongodb";

import type { SharedDocument, SharedDocumentContextRef, SharedDocumentVerificationStatus } from "@hu/types";

import { SharedDocumentPersistenceError } from "../shared-documents.errors.js";

/** The internal, storage-aware shape — `storageKey` is never part of the public `SharedDocument`/`SharedDocumentView` types (Part 8: no public URLs, ever). */
export type SharedDocumentRecord = SharedDocument & { storageKey: string };

/** Flattened context fields so a single compound index (`contextType`+`conversationId`/`initiativeId`/`sessionId`) can serve every context type without a nested-field index. */
export interface SharedDocumentMongoDocument extends Document {
  documentId: string;
  documentFamilyId: string;
  version: number;
  isLatestVersion: boolean;
  contextType: SharedDocumentContextRef["contextType"];
  conversationId?: string;
  initiativeId?: string;
  sessionId?: string;
  responseId?: string;
  fileName: string;
  mimeType: string;
  extension: string;
  size: number;
  storageKey: string;
  verificationStatus: SharedDocumentVerificationStatus;
  uploadedByParticipantId: string;
  uploadedAt: string;
  supersededAt?: string;
  removedAt?: string;
}

export function toSharedDocumentMongoDocument(record: SharedDocumentRecord): SharedDocumentMongoDocument {
  return {
    documentId: record.documentId,
    documentFamilyId: record.documentFamilyId,
    version: record.version,
    isLatestVersion: record.isLatestVersion,
    contextType: record.context.contextType,
    ...(record.context.contextType === "direct_conversation" ? { conversationId: record.context.conversationId } : {}),
    ...(record.context.contextType === "collaboration_channel" ? { initiativeId: record.context.initiativeId } : {}),
    ...(record.context.contextType === "collaboration_session"
      ? { initiativeId: record.context.initiativeId, sessionId: record.context.sessionId }
      : {}),
    ...(record.context.contextType === "official_response"
      ? { initiativeId: record.context.initiativeId, responseId: record.context.responseId }
      : {}),
    fileName: record.fileName,
    mimeType: record.mimeType,
    extension: record.extension,
    size: record.size,
    storageKey: record.storageKey,
    verificationStatus: record.verificationStatus,
    uploadedByParticipantId: record.uploadedByParticipantId,
    uploadedAt: record.uploadedAt,
    ...(record.supersededAt !== undefined ? { supersededAt: record.supersededAt } : {}),
    ...(record.removedAt !== undefined ? { removedAt: record.removedAt } : {}),
  };
}

function toContextRef(document: SharedDocumentMongoDocument): SharedDocumentContextRef {
  if (document.contextType === "direct_conversation") {
    if (!document.conversationId) {
      throw new SharedDocumentPersistenceError(
        `Persisted Shared Document "${document.documentId}" is missing conversationId for its direct_conversation context.`,
      );
    }

    return { contextType: "direct_conversation", conversationId: document.conversationId };
  }

  if (document.contextType === "collaboration_channel") {
    if (!document.initiativeId) {
      throw new SharedDocumentPersistenceError(
        `Persisted Shared Document "${document.documentId}" is missing initiativeId for its collaboration_channel context.`,
      );
    }

    return { contextType: "collaboration_channel", initiativeId: document.initiativeId };
  }

  if (document.contextType === "collaboration_session") {
    if (!document.initiativeId || !document.sessionId) {
      throw new SharedDocumentPersistenceError(
        `Persisted Shared Document "${document.documentId}" is missing initiativeId/sessionId for its collaboration_session context.`,
      );
    }

    return {
      contextType: "collaboration_session",
      initiativeId: document.initiativeId,
      sessionId: document.sessionId,
    };
  }

  if (!document.initiativeId || !document.responseId) {
    throw new SharedDocumentPersistenceError(
      `Persisted Shared Document "${document.documentId}" is missing initiativeId/responseId for its official_response context.`,
    );
  }

  return {
    contextType: "official_response",
    initiativeId: document.initiativeId,
    responseId: document.responseId,
  };
}

export function fromSharedDocumentMongoDocument(document: SharedDocumentMongoDocument): SharedDocumentRecord {
  if (typeof document.documentId !== "string" || document.documentId.length === 0) {
    throw new SharedDocumentPersistenceError("Persisted Shared Document is missing a valid documentId.");
  }

  return {
    documentId: document.documentId,
    documentFamilyId: document.documentFamilyId,
    version: document.version,
    isLatestVersion: document.isLatestVersion,
    context: toContextRef(document),
    fileName: document.fileName,
    mimeType: document.mimeType,
    extension: document.extension,
    size: document.size,
    storageKey: document.storageKey,
    verificationStatus: document.verificationStatus,
    uploadedByParticipantId: document.uploadedByParticipantId,
    uploadedAt: document.uploadedAt,
    supersededAt: document.supersededAt,
    removedAt: document.removedAt,
  };
}
