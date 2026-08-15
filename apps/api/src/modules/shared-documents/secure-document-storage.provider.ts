import path from "node:path";
import { createReadStream } from "node:fs";
import { fileURLToPath } from "node:url";

import { R2SecureDocumentStorageProvider } from "./r2-secure-document.provider.js";

/**
 * Communication UX Pack 03.7 Part 8/13 — private storage for Shared
 * Documents.
 *
 * This intentionally does NOT reuse public `MediaObjectStorage` roots
 * served by `express.static` / R2 public CDN. Shared Documents must
 * satisfy: "Files are private. No public URLs. Every download requires
 * authorization."
 *
 * Production Deployment Pack 02 — when MEDIA_STORAGE_PROVIDER=r2,
 * private bytes use a dedicated R2_PRIVATE_BUCKET (never R2_BUCKET /
 * R2_PUBLIC_BASE_URL). Local filesystem remains the development default.
 */

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const API_ROOT = path.resolve(MODULE_DIR, "../../..");
export const SECURE_DOCUMENT_STORAGE_ROOT = path.join(
  API_ROOT,
  ".runtime",
  "secure-uploads",
  "shared-documents",
);

export interface SecureDocumentStorageProvider {
  saveFile(input: {
    buffer: Buffer;
    extension: string;
    mimeType?: string;
  }): Promise<{ storageKey: string; absolutePath?: string }>;
  deleteFile(storageKey: string): Promise<void>;
  openReadStream(storageKey: string): Promise<NodeJS.ReadableStream>;
}

function resolveSafeAbsolutePath(storageKey: string): string {
  const normalizedKey = storageKey.replace(/\\/g, "/");

  if (normalizedKey.includes("..")) {
    throw new Error("Invalid Shared Document storage key.");
  }

  const absolutePath = path.resolve(SECURE_DOCUMENT_STORAGE_ROOT, normalizedKey);
  const rootResolved = path.resolve(SECURE_DOCUMENT_STORAGE_ROOT);

  if (!absolutePath.startsWith(rootResolved)) {
    throw new Error("Invalid Shared Document storage key.");
  }

  return absolutePath;
}

export class LocalSecureDocumentStorageProvider implements SecureDocumentStorageProvider {
  async saveFile(input: {
    buffer: Buffer;
    extension: string;
    mimeType?: string;
  }): Promise<{ storageKey: string; absolutePath: string }> {
    const { mkdir, writeFile } = await import("node:fs/promises");
    await mkdir(SECURE_DOCUMENT_STORAGE_ROOT, { recursive: true });

    const storageKey = `${Date.now()}-${crypto.randomUUID()}${input.extension}`;
    const absolutePath = resolveSafeAbsolutePath(storageKey);

    await writeFile(absolutePath, input.buffer);
    void input.mimeType;

    return { storageKey, absolutePath };
  }

  async deleteFile(storageKey: string): Promise<void> {
    const { unlink } = await import("node:fs/promises");
    const absolutePath = resolveSafeAbsolutePath(storageKey);

    try {
      await unlink(absolutePath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error;
      }
    }
  }

  async openReadStream(storageKey: string): Promise<NodeJS.ReadableStream> {
    return createReadStream(resolveSafeAbsolutePath(storageKey));
  }
}

let cachedProvider: SecureDocumentStorageProvider | null = null;

export function resolveSecureDocumentStorageProvider(): SecureDocumentStorageProvider {
  if (cachedProvider) {
    return cachedProvider;
  }

  const explicit = process.env.SECURE_DOCUMENT_STORAGE_PROVIDER?.trim().toLowerCase();
  const mediaProvider = (process.env.MEDIA_STORAGE_PROVIDER ?? "local").trim().toLowerCase();
  const useR2 = explicit === "r2" || (explicit !== "local" && mediaProvider === "r2");

  cachedProvider = useR2
    ? new R2SecureDocumentStorageProvider()
    : new LocalSecureDocumentStorageProvider();

  return cachedProvider;
}

/** Test seam — reset singleton between cases. */
export function resetSecureDocumentStorageProviderForTests(): void {
  cachedProvider = null;
}
