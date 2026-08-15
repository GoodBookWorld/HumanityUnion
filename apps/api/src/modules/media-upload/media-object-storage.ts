import type { MediaUploadPurpose } from "./media-upload.types.js";

/**
 * Provider-independent media byte storage (Production Hardening Pack 01).
 * Domain code must depend on this seam — not R2/S3/local specifics.
 */
export interface MediaObjectStorage {
  saveFile(input: {
    purpose: MediaUploadPurpose;
    buffer: Buffer;
    mimeType: string;
    extension: string;
  }): Promise<{ storageKey: string; absolutePath?: string }>;
  deleteFile(storageKey: string): Promise<void>;
  buildPublicUrl(storageKey: string): string;
}

/** @deprecated Prefer MediaObjectStorage — kept for existing imports. */
export type MediaStorageProvider = MediaObjectStorage;

export type MediaStorageProviderName = "local" | "r2" | "memory";

export function resolveMediaStorageProviderName(): MediaStorageProviderName {
  const raw = process.env.MEDIA_STORAGE_PROVIDER?.trim().toLowerCase();
  if (raw === "r2" || raw === "local" || raw === "memory") {
    return raw;
  }
  return "local";
}
