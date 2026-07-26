export type MediaUploadPurpose = "avatar" | "initiative-image";

export interface StoredMediaRecord {
  mediaId: string;
  mediaUrl: string;
  mediaType: string;
  size: number;
  createdAt: string;
  ownerUserId: string;
  ownerParticipantId: string;
  purpose: MediaUploadPurpose;
  initiativeId?: string;
  storageKey: string;
}

export interface MediaUploadResponse {
  mediaId: string;
  mediaUrl: string;
  mediaType: string;
  size: number;
  createdAt: string;
}

export interface MediaStorageProvider {
  saveFile(input: {
    purpose: MediaUploadPurpose;
    buffer: Buffer;
    mimeType: string;
    extension: string;
  }): Promise<{ storageKey: string; absolutePath: string }>;
  deleteFile(storageKey: string): Promise<void>;
  buildPublicUrl(storageKey: string): string;
}
