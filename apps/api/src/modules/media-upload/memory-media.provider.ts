import type { MediaObjectStorage } from "./media-object-storage.js";
import type { MediaUploadPurpose } from "./media-upload.types.js";

const PURPOSE_PREFIX: Record<MediaUploadPurpose, string> = {
  avatar: "avatars",
  "initiative-image": "initiatives",
  "blog-image": "blog",
};

/** Test-only in-memory object storage — never used for production durability. */
export class MemoryMediaObjectStorage implements MediaObjectStorage {
  readonly objects = new Map<string, Buffer>();

  buildPublicUrl(storageKey: string): string {
    return `/api/v1/media/files/${storageKey.replace(/\\/g, "/")}`;
  }

  async saveFile(input: {
    purpose: MediaUploadPurpose;
    buffer: Buffer;
    mimeType: string;
    extension: string;
  }): Promise<{ storageKey: string }> {
    const storageKey = `${PURPOSE_PREFIX[input.purpose]}/${Date.now()}-${crypto.randomUUID()}${input.extension}`;
    this.objects.set(storageKey, input.buffer);
    return { storageKey };
  }

  async deleteFile(storageKey: string): Promise<void> {
    this.objects.delete(storageKey.replace(/\\/g, "/"));
  }
}
