import type { StoredMediaRecord } from "../media-upload.types.js";

export interface MediaUploadMongoDocument extends StoredMediaRecord {
  _id?: unknown;
  updatedAt: string;
}

export function toMediaUploadMongoDocument(record: StoredMediaRecord): MediaUploadMongoDocument {
  return {
    ...structuredClone(record),
    updatedAt: new Date().toISOString(),
  };
}

export function fromMediaUploadMongoDocument(document: MediaUploadMongoDocument): StoredMediaRecord {
  return {
    mediaId: document.mediaId,
    mediaUrl: document.mediaUrl,
    mediaType: document.mediaType,
    size: document.size,
    createdAt: document.createdAt,
    ownerUserId: document.ownerUserId,
    ownerParticipantId: document.ownerParticipantId,
    purpose: document.purpose,
    initiativeId: document.initiativeId,
    storageKey: document.storageKey,
  };
}
