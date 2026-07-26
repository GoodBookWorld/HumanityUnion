import type {
  MediaStorageProvider,
  MediaUploadPurpose,
  StoredMediaRecord,
} from "./media-upload.types.js";
import type { ValidatedUploadFile } from "./media-upload.validation.js";

const mediaRecords = new Map<string, StoredMediaRecord>();

export function getMediaRecordById(mediaId: string): StoredMediaRecord | undefined {
  const record = mediaRecords.get(mediaId);
  return record ? structuredClone(record) : undefined;
}

export function listMediaRecordsForOwner(ownerUserId: string): StoredMediaRecord[] {
  return Array.from(mediaRecords.values())
    .filter((record) => record.ownerUserId === ownerUserId)
    .map((record) => structuredClone(record));
}

export function saveMediaRecord(record: StoredMediaRecord): StoredMediaRecord {
  mediaRecords.set(record.mediaId, structuredClone(record));
  return structuredClone(record);
}

export function deleteMediaRecord(mediaId: string): StoredMediaRecord | undefined {
  const existing = mediaRecords.get(mediaId);

  if (!existing) {
    return undefined;
  }

  mediaRecords.delete(mediaId);
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
    const relativeUrl = this.provider.buildPublicUrl(stored.storageKey);
    const mediaUrl = input.publicBaseUrl
      ? `${input.publicBaseUrl.replace(/\/$/, "")}${relativeUrl}`
      : relativeUrl;

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

    return saveMediaRecord(record);
  }

  async deleteMedia(mediaId: string): Promise<StoredMediaRecord | undefined> {
    const existing = deleteMediaRecord(mediaId);

    if (!existing) {
      return undefined;
    }

    await this.provider.deleteFile(existing.storageKey);
    return existing;
  }
}
