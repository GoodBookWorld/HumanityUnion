import { randomUUID } from "node:crypto";

import type { SharedDocumentContextRef, SharedDocumentListResult, SharedDocumentUploaderIdentity, SharedDocumentView } from "@hu/types";

import { resolvePublicAuthorsForParticipantIds } from "../initiative-discussion-collaboration/public-participant-identity.projection.js";

import { resolveSharedDocumentContextAccess, type SharedDocumentContextAccess } from "./shared-documents-access.js";
import { UnavailableMalwareScanProvider, type MalwareScanProvider } from "./shared-documents-malware-scan.js";
import { decideMediaModerationOutcome, UnavailableMediaModerationProvider, type MediaModerationProvider } from "./shared-documents-moderation.js";
import {
  emitSharedDocumentRemovedNotification,
  emitSharedDocumentReplacedNotification,
  emitSharedDocumentUploadedNotification,
  type SharedDocumentNotificationInput,
} from "./shared-documents-notifications.js";
import { isImageSubtype, validateSharedDocumentFile, type ValidatedSharedDocumentFile } from "./shared-documents.validators.js";
import {
  SharedDocumentMalwareDetectedError,
  SharedDocumentManagerOnlyError,
  SharedDocumentNotFoundError,
  SharedDocumentValidationError,
} from "./shared-documents.errors.js";
import type { SharedDocumentRecord } from "./persistence/shared-documents.mongo-document.js";
import {
  findSharedDocumentById,
  insertSharedDocument,
  listLatestSharedDocumentsByContext,
  markSharedDocumentRemoved,
  markSharedDocumentSuperseded,
} from "./persistence/shared-documents.repository.js";
import {
  resolveSecureDocumentStorageProvider,
  type SecureDocumentStorageProvider,
} from "./secure-document-storage.provider.js";

export interface SharedDocumentUploadFileInput {
  originalName: unknown;
  buffer: Buffer | undefined;
  mimeType: string;
  size: number;
}

/**
 * Communication UX Pack 03.7 — every collaborator (authorization,
 * persistence, identity resolution, notifications) is injectable, mirroring
 * the exact convention `InitiativeCollaborationChannelDependencies` /
 * `InitiativeCollaborationSessionDependencies` already established, so this
 * service is fully unit-testable without a real MongoDB connection.
 */
export interface SharedDocumentServiceDependencies {
  resolveAccess(context: SharedDocumentContextRef, participantId: string): Promise<SharedDocumentContextAccess>;
  insertDocument(record: SharedDocumentRecord): Promise<void>;
  findDocumentById(documentId: string): Promise<SharedDocumentRecord | null>;
  listLatestDocumentsByContext(context: SharedDocumentContextRef): Promise<SharedDocumentRecord[]>;
  markSuperseded(documentId: string, supersededAt: string): Promise<void>;
  markRemoved(documentId: string, removedAt: string): Promise<void>;
  resolveIdentities(participantIds: readonly string[]): Promise<Map<string, SharedDocumentUploaderIdentity>>;
  storageProvider: SecureDocumentStorageProvider;
  moderationProvider: MediaModerationProvider;
  malwareScanProvider: MalwareScanProvider;
  notifyUploaded(input: SharedDocumentNotificationInput): void;
  notifyReplaced(input: SharedDocumentNotificationInput): void;
  notifyRemoved(input: SharedDocumentNotificationInput): void;
  now(): string;
}

function contextQuery(context: SharedDocumentContextRef) {
  if (context.contextType === "direct_conversation") {
    return { contextType: context.contextType, conversationId: context.conversationId };
  }

  if (context.contextType === "collaboration_channel") {
    return { contextType: context.contextType, initiativeId: context.initiativeId };
  }

  if (context.contextType === "official_response") {
    return { contextType: context.contextType, initiativeId: context.initiativeId, responseId: context.responseId };
  }

  return { contextType: context.contextType, initiativeId: context.initiativeId, sessionId: context.sessionId };
}

export const defaultSharedDocumentServiceDependencies: SharedDocumentServiceDependencies = {
  resolveAccess: resolveSharedDocumentContextAccess,
  insertDocument: insertSharedDocument,
  findDocumentById: findSharedDocumentById,
  listLatestDocumentsByContext: (context) => listLatestSharedDocumentsByContext(contextQuery(context)),
  markSuperseded: markSharedDocumentSuperseded,
  markRemoved: markSharedDocumentRemoved,
  resolveIdentities: resolvePublicAuthorsForParticipantIds,
  // Lazy: resolve from env at call time so unit tests keep local disk while staging uses private R2.
  get storageProvider(): SecureDocumentStorageProvider {
    return resolveSecureDocumentStorageProvider();
  },
  moderationProvider: new UnavailableMediaModerationProvider(),
  malwareScanProvider: new UnavailableMalwareScanProvider(),
  notifyUploaded: emitSharedDocumentUploadedNotification,
  notifyReplaced: emitSharedDocumentReplacedNotification,
  notifyRemoved: emitSharedDocumentRemovedNotification,
  now: () => new Date().toISOString(),
};

function contextsMatch(a: SharedDocumentContextRef, b: SharedDocumentContextRef): boolean {
  if (a.contextType !== b.contextType) {
    return false;
  }

  if (a.contextType === "direct_conversation" && b.contextType === "direct_conversation") {
    return a.conversationId === b.conversationId;
  }

  if (a.contextType === "collaboration_channel" && b.contextType === "collaboration_channel") {
    return a.initiativeId === b.initiativeId;
  }

  if (a.contextType === "collaboration_session" && b.contextType === "collaboration_session") {
    return a.initiativeId === b.initiativeId && a.sessionId === b.sessionId;
  }

  if (a.contextType === "official_response" && b.contextType === "official_response") {
    return a.initiativeId === b.initiativeId && a.responseId === b.responseId;
  }

  return false;
}

const FALLBACK_UPLOADER_IDENTITY: SharedDocumentUploaderIdentity = { displayName: "A participant" };

function buildView(
  record: SharedDocumentRecord,
  identities: Map<string, SharedDocumentUploaderIdentity>,
  viewerParticipantId: string,
): SharedDocumentView {
  return {
    documentId: record.documentId,
    documentFamilyId: record.documentFamilyId,
    version: record.version,
    isLatestVersion: record.isLatestVersion,
    context: record.context,
    fileName: record.fileName,
    mimeType: record.mimeType,
    extension: record.extension,
    size: record.size,
    verificationStatus: record.verificationStatus,
    uploadedBy: identities.get(record.uploadedByParticipantId) ?? FALLBACK_UPLOADER_IDENTITY,
    uploadedByParticipantId: record.uploadedByParticipantId,
    uploadedAt: record.uploadedAt,
    supersededAt: record.supersededAt,
    canDownload: !record.removedAt,
    canManage: record.uploadedByParticipantId === viewerParticipantId,
  };
}

async function resolveVerificationStatus(
  validated: ValidatedSharedDocumentFile,
  deps: SharedDocumentServiceDependencies,
) {
  if (!isImageSubtype(validated.subtype)) {
    // Part 4 — "Documents: Metadata validation only." Stage 1 having already passed is the entire pipeline for non-image types.
    return "approved" as const;
  }

  const moderation = await deps.moderationProvider.moderate({ buffer: validated.buffer, mimeType: validated.mimeType });
  const decision = decideMediaModerationOutcome(moderation.signal);

  if (decision === "rejected") {
    throw new SharedDocumentValidationError(
      "This image cannot be approved for display. Please choose another file.",
    );
  }

  return decision;
}

function notifyOthers(
  emit: (input: SharedDocumentNotificationInput) => void,
  access: SharedDocumentContextAccess,
  uploaderParticipantId: string,
): void {
  for (const recipientParticipantId of access.otherParticipantIds) {
    emit({
      recipientParticipantId,
      uploaderParticipantId,
      relatedEntityType: access.relatedEntityType,
      relatedEntityId: access.relatedEntityId,
      relatedUrl: access.relatedUrl,
    });
  }
}

/**
 * Communication UX Pack 03.7 Part 3 — the full upload pipeline: Stage 1
 * (technical validation) → Stage "malware" (Part 5 extension point) →
 * Stage 2 (AI moderation, images only, Part 4) → Stage 3 (decision) →
 * store → notify. Any failure before "store" throws and nothing is ever
 * persisted (Part 3 — "Rejected files are never stored as active
 * documents").
 */
export async function uploadSharedDocument(
  context: SharedDocumentContextRef,
  uploaderParticipantId: string,
  file: SharedDocumentUploadFileInput,
  deps: SharedDocumentServiceDependencies = defaultSharedDocumentServiceDependencies,
): Promise<SharedDocumentView> {
  const access = await deps.resolveAccess(context, uploaderParticipantId);
  const validated = validateSharedDocumentFile(file);

  const malwareOutcome = await deps.malwareScanProvider.scan({ buffer: validated.buffer, mimeType: validated.mimeType });

  if (!malwareOutcome.clean) {
    throw new SharedDocumentMalwareDetectedError();
  }

  const verificationStatus = await resolveVerificationStatus(validated, deps);

  const stored = await deps.storageProvider.saveFile({
    buffer: validated.buffer,
    extension: validated.extension,
    mimeType: validated.mimeType,
  });
  const documentId = randomUUID();
  const uploadedAt = deps.now();

  const record: SharedDocumentRecord = {
    documentId,
    documentFamilyId: documentId,
    version: 1,
    isLatestVersion: true,
    context,
    fileName: validated.fileName,
    mimeType: validated.mimeType,
    extension: validated.extension,
    size: validated.size,
    storageKey: stored.storageKey,
    verificationStatus,
    uploadedByParticipantId: uploaderParticipantId,
    uploadedAt,
  };

  await deps.insertDocument(record);
  notifyOthers(deps.notifyUploaded, access, uploaderParticipantId);

  const identities = await deps.resolveIdentities([uploaderParticipantId]);

  return buildView(record, identities, uploaderParticipantId);
}

/** Part 11 — newest first, latest version only, excluding removed. Part 15 — one batched uploader-identity resolution, never per-document. */
export async function listSharedDocuments(
  context: SharedDocumentContextRef,
  viewerParticipantId: string,
  deps: SharedDocumentServiceDependencies = defaultSharedDocumentServiceDependencies,
): Promise<SharedDocumentListResult> {
  await deps.resolveAccess(context, viewerParticipantId);

  const records = await deps.listLatestDocumentsByContext(context);
  const identities = await deps.resolveIdentities(records.map((record) => record.uploadedByParticipantId));

  return {
    context,
    documents: records.map((record) => buildView(record, identities, viewerParticipantId)),
  };
}

async function requireActiveDocumentInContext(
  context: SharedDocumentContextRef,
  documentId: string,
  deps: SharedDocumentServiceDependencies,
): Promise<SharedDocumentRecord> {
  const record = await deps.findDocumentById(documentId);

  if (!record || record.removedAt || !contextsMatch(record.context, context)) {
    throw new SharedDocumentNotFoundError();
  }

  return record;
}

export interface SharedDocumentDownloadTarget {
  openReadStream: () => Promise<NodeJS.ReadableStream>;
  fileName: string;
  mimeType: string;
}

/** Part 8 — every download re-verifies context authorization here; the caller never derives a URL that bypasses this check. */
export async function resolveSharedDocumentDownload(
  context: SharedDocumentContextRef,
  documentId: string,
  viewerParticipantId: string,
  deps: SharedDocumentServiceDependencies = defaultSharedDocumentServiceDependencies,
): Promise<SharedDocumentDownloadTarget> {
  await deps.resolveAccess(context, viewerParticipantId);
  const record = await requireActiveDocumentInContext(context, documentId, deps);

  return {
    openReadStream: () => deps.storageProvider.openReadStream(record.storageKey),
    fileName: record.fileName,
    mimeType: record.mimeType,
  };
}

/** Part 9 — replace is immutable: the prior version's bytes/row are never mutated, only marked superseded; a brand-new row/file is created. */
export async function replaceSharedDocument(
  context: SharedDocumentContextRef,
  documentId: string,
  actorParticipantId: string,
  file: SharedDocumentUploadFileInput,
  deps: SharedDocumentServiceDependencies = defaultSharedDocumentServiceDependencies,
): Promise<SharedDocumentView> {
  const access = await deps.resolveAccess(context, actorParticipantId);
  const existing = await requireActiveDocumentInContext(context, documentId, deps);

  if (!existing.isLatestVersion) {
    throw new SharedDocumentNotFoundError();
  }

  if (existing.uploadedByParticipantId !== actorParticipantId) {
    throw new SharedDocumentManagerOnlyError();
  }

  const validated = validateSharedDocumentFile(file);

  const malwareOutcome = await deps.malwareScanProvider.scan({ buffer: validated.buffer, mimeType: validated.mimeType });

  if (!malwareOutcome.clean) {
    throw new SharedDocumentMalwareDetectedError();
  }

  const verificationStatus = await resolveVerificationStatus(validated, deps);
  const stored = await deps.storageProvider.saveFile({
    buffer: validated.buffer,
    extension: validated.extension,
    mimeType: validated.mimeType,
  });
  const uploadedAt = deps.now();

  const newRecord: SharedDocumentRecord = {
    documentId: randomUUID(),
    documentFamilyId: existing.documentFamilyId,
    version: existing.version + 1,
    isLatestVersion: true,
    context,
    fileName: validated.fileName,
    mimeType: validated.mimeType,
    extension: validated.extension,
    size: validated.size,
    storageKey: stored.storageKey,
    verificationStatus,
    uploadedByParticipantId: actorParticipantId,
    uploadedAt,
  };

  await deps.markSuperseded(existing.documentId, uploadedAt);
  await deps.insertDocument(newRecord);
  notifyOthers(deps.notifyReplaced, access, actorParticipantId);

  const identities = await deps.resolveIdentities([actorParticipantId]);

  return buildView(newRecord, identities, actorParticipantId);
}

/** Part 9 — the file's bytes are actually deleted from storage (freeing storage is the point of "remove", unlike "replace" which always preserves prior bytes). */
export async function removeSharedDocument(
  context: SharedDocumentContextRef,
  documentId: string,
  actorParticipantId: string,
  deps: SharedDocumentServiceDependencies = defaultSharedDocumentServiceDependencies,
): Promise<void> {
  const access = await deps.resolveAccess(context, actorParticipantId);
  const existing = await requireActiveDocumentInContext(context, documentId, deps);

  if (existing.uploadedByParticipantId !== actorParticipantId) {
    throw new SharedDocumentManagerOnlyError();
  }

  await deps.storageProvider.deleteFile(existing.storageKey);
  await deps.markRemoved(existing.documentId, deps.now());
  notifyOthers(deps.notifyRemoved, access, actorParticipantId);
}
