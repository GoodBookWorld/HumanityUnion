import type { MediaUploadPurpose } from "./media-upload.types.js";

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
