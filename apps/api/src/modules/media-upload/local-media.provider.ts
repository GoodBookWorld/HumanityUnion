import path from "node:path";
import { fileURLToPath } from "node:url";

import type { MediaStorageProvider, MediaUploadPurpose } from "./media-upload.types.js";

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const API_ROOT = path.resolve(MODULE_DIR, "../../..");
export const LOCAL_MEDIA_UPLOAD_ROOT = path.join(API_ROOT, ".runtime", "uploads");

const PURPOSE_DIRECTORIES: Record<MediaUploadPurpose, string> = {
  avatar: "avatars",
  "initiative-image": "initiatives",
  "blog-image": "blog",
};

function purposeDirectory(purpose: MediaUploadPurpose): string {
  return path.join(LOCAL_MEDIA_UPLOAD_ROOT, PURPOSE_DIRECTORIES[purpose]);
}

export class LocalMediaStorageProvider implements MediaStorageProvider {
  buildPublicUrl(storageKey: string): string {
    return `/api/v1/media/files/${storageKey.replace(/\\/g, "/")}`;
  }

  async saveFile(input: {
    purpose: MediaUploadPurpose;
    buffer: Buffer;
    mimeType: string;
    extension: string;
  }): Promise<{ storageKey: string; absolutePath: string }> {
    const { mkdir, writeFile } = await import("node:fs/promises");
    const directory = purposeDirectory(input.purpose);
    await mkdir(directory, { recursive: true });

    const safeFilename = `${Date.now()}-${crypto.randomUUID()}${input.extension}`;
    const storageKey = `${PURPOSE_DIRECTORIES[input.purpose]}/${safeFilename}`;
    const absolutePath = path.join(LOCAL_MEDIA_UPLOAD_ROOT, storageKey);

    const resolved = path.resolve(absolutePath);
    const rootResolved = path.resolve(LOCAL_MEDIA_UPLOAD_ROOT);

    if (!resolved.startsWith(rootResolved)) {
      throw new Error("Invalid media storage path.");
    }

    await writeFile(resolved, input.buffer);

    return {
      storageKey,
      absolutePath: resolved,
    };
  }

  async deleteFile(storageKey: string): Promise<void> {
    const { unlink } = await import("node:fs/promises");
    const normalizedKey = storageKey.replace(/\\/g, "/");

    if (normalizedKey.includes("..")) {
      throw new Error("Invalid media storage key.");
    }

    const absolutePath = path.resolve(LOCAL_MEDIA_UPLOAD_ROOT, normalizedKey);
    const rootResolved = path.resolve(LOCAL_MEDIA_UPLOAD_ROOT);

    if (!absolutePath.startsWith(rootResolved)) {
      throw new Error("Invalid media storage key.");
    }

    try {
      await unlink(absolutePath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error;
      }
    }
  }
}

export function resolveLocalMediaAbsolutePath(storageKey: string): string {
  const normalizedKey = storageKey.replace(/\\/g, "/");

  if (normalizedKey.includes("..")) {
    throw new Error("Invalid media storage key.");
  }

  const absolutePath = path.resolve(LOCAL_MEDIA_UPLOAD_ROOT, normalizedKey);
  const rootResolved = path.resolve(LOCAL_MEDIA_UPLOAD_ROOT);

  if (!absolutePath.startsWith(rootResolved)) {
    throw new Error("Invalid media storage key.");
  }

  return absolutePath;
}
