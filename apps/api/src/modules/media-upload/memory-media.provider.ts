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
  readonly contentSha256ByKey = new Map<string, string>();

  buildPublicUrl(storageKey: string): string {
    return `/api/v1/media/files/${storageKey.replace(/\\/g, "/")}`;
  }

  async saveFile(input: {
    purpose: MediaUploadPurpose;
    buffer: Buffer;
    mimeType: string;
    extension: string;
    storageKey?: string;
  }): Promise<{ storageKey: string }> {
    const storageKey =
      input.storageKey?.replace(/\\/g, "/").replace(/^\/+/, "") ??
      `${PURPOSE_PREFIX[input.purpose]}/${Date.now()}-${crypto.randomUUID()}${input.extension}`;

    if (storageKey.includes("..")) {
      throw new Error("Invalid media storage key.");
    }

    const { createHash } = await import("node:crypto");
    const sha = createHash("sha256").update(input.buffer).digest("hex");
    const existingSha = this.contentSha256ByKey.get(storageKey);
    if (existingSha && existingSha !== sha) {
      throw new Error(
        `Conflicting media object at ${storageKey}: existing content hash differs.`,
      );
    }

    this.objects.set(storageKey, input.buffer);
    this.contentSha256ByKey.set(storageKey, sha);
    return { storageKey };
  }

  async deleteFile(storageKey: string): Promise<void> {
    const key = storageKey.replace(/\\/g, "/");
    this.objects.delete(key);
    this.contentSha256ByKey.delete(key);
  }
}
