export type MediaUploadPurpose = "avatar" | "initiative-image" | "blog-image" | "media-resource-logo";

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

export type { MediaObjectStorage, MediaStorageProvider } from "./media-object-storage.js";
