import type {
  MediaStorageProvider,
  MediaUploadPurpose,
  StoredMediaRecord,
} from "./media-upload.types.js";
import type { ValidatedUploadFile } from "./media-upload.validation.js";
import {
  canPersistMediaUploadMetadata,
  deleteMediaUploadRecord,
  listAllMediaUploadRecords,
  upsertMediaUploadRecord,
} from "./persistence/media-upload.repository.js";

const mediaRecords = new Map<string, StoredMediaRecord>();

function persistMediaRecordBestEffort(record: StoredMediaRecord): void {
  if (!canPersistMediaUploadMetadata()) {
    return;
  }

  void upsertMediaUploadRecord(record).catch((error) => {
    console.error(
      "[media-upload] Failed to persist media metadata:",
      error instanceof Error ? error.message : error,
    );
  });
}

function deletePersistedMediaRecordBestEffort(mediaId: string): void {
  if (!canPersistMediaUploadMetadata()) {
    return;
  }

  void deleteMediaUploadRecord(mediaId).catch((error) => {
    console.error(
      "[media-upload] Failed to delete media metadata:",
      error instanceof Error ? error.message : error,
    );
  });
}

/** Production Deployment Pack 02 — hydrate durable media metadata after Mongo bootstrap. */
export async function hydrateMediaUploadRecordsFromMongo(): Promise<void> {
  if (!canPersistMediaUploadMetadata()) {
    return;
  }

  const records = await listAllMediaUploadRecords();
  mediaRecords.clear();

  for (const record of records) {
    mediaRecords.set(record.mediaId, structuredClone(record));
  }
}

export function getMediaRecordById(mediaId: string): StoredMediaRecord | undefined {
  const record = mediaRecords.get(mediaId);
  return record ? structuredClone(record) : undefined;
}

export function listMediaRecordsForOwner(ownerUserId: string): StoredMediaRecord[] {
  return Array.from(mediaRecords.values())
    .filter((record) => record.ownerUserId === ownerUserId)
    .map((record) => structuredClone(record));
}

/**
 * Initiative UX Pack 01.1 Part 5/6 — every uploaded media record (e.g. the
 * cover image) attached to one Initiative, regardless of owner. Used to
 * clean up Draft media when the Draft is permanently deleted.
 */
export function listMediaRecordsByInitiativeId(initiativeId: string): StoredMediaRecord[] {
  return Array.from(mediaRecords.values())
    .filter((record) => record.initiativeId === initiativeId)
    .map((record) => structuredClone(record));
}

export function saveMediaRecord(record: StoredMediaRecord): StoredMediaRecord {
  mediaRecords.set(record.mediaId, structuredClone(record));
  persistMediaRecordBestEffort(record);
  return structuredClone(record);
}

export async function saveMediaRecordDurable(record: StoredMediaRecord): Promise<StoredMediaRecord> {
  mediaRecords.set(record.mediaId, structuredClone(record));

  if (canPersistMediaUploadMetadata()) {
    await upsertMediaUploadRecord(record);
  }

  return structuredClone(record);
}

export function deleteMediaRecord(mediaId: string): StoredMediaRecord | undefined {
  const existing = mediaRecords.get(mediaId);

  if (!existing) {
    return undefined;
  }

  mediaRecords.delete(mediaId);
  deletePersistedMediaRecordBestEffort(mediaId);
  return structuredClone(existing);
}

export async function deleteMediaRecordDurable(
  mediaId: string,
): Promise<StoredMediaRecord | undefined> {
  const existing = mediaRecords.get(mediaId);

  if (!existing) {
    return undefined;
  }

  mediaRecords.delete(mediaId);

  if (canPersistMediaUploadMetadata()) {
    await deleteMediaUploadRecord(mediaId);
  }

  return structuredClone(existing);
}

export function findMediaRecordByUrl(mediaUrl: string): StoredMediaRecord | undefined {
  for (const record of mediaRecords.values()) {
    if (record.mediaUrl === mediaUrl) {
      return structuredClone(record);
    }
  }

  return undefined;
}

/** Test seam — clear in-memory cache only. */
export function resetMediaUploadMemoryStoreForTests(): void {
  mediaRecords.clear();
}

export class MediaUploadService {
  constructor(private readonly provider: MediaStorageProvider) {}

  async uploadMedia(input: {
    purpose: MediaUploadPurpose;
    file: ValidatedUploadFile;
    ownerUserId: string;
    ownerParticipantId: string;
    initiativeId?: string;
    publicBaseUrl?: string;
  }): Promise<StoredMediaRecord> {
    const stored = await this.provider.saveFile({
      purpose: input.purpose,
      buffer: input.file.buffer,
      mimeType: input.file.mimeType,
      extension: input.file.extension,
    });

    const mediaId = `media-${crypto.randomUUID()}`;
    const providerUrl = this.provider.buildPublicUrl(stored.storageKey);
    // Absolute CDN/object URLs must not be prefixed with the API origin.
    const mediaUrl =
      /^https?:\/\//i.test(providerUrl) || !input.publicBaseUrl
        ? providerUrl
        : `${input.publicBaseUrl.replace(/\/$/, "")}${providerUrl}`;

    const record: StoredMediaRecord = {
      mediaId,
      mediaUrl,
      mediaType: input.file.mimeType,
      size: input.file.size,
      createdAt: new Date().toISOString(),
      ownerUserId: input.ownerUserId,
      ownerParticipantId: input.ownerParticipantId,
      purpose: input.purpose,
      initiativeId: input.initiativeId,
      storageKey: stored.storageKey,
    };

    return saveMediaRecordDurable(record);
  }

  async deleteMedia(mediaId: string): Promise<StoredMediaRecord | undefined> {
    const existing = await deleteMediaRecordDurable(mediaId);

    if (!existing) {
      return undefined;
    }

    await this.provider.deleteFile(existing.storageKey);
    return existing;
  }
}
