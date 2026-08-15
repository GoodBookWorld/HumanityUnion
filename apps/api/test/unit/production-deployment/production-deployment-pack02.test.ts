import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";

import { collectInvalidMediaStorageConfig } from "../../../src/config/validate-production-environment.js";
import {
  deleteMediaRecord,
  getMediaRecordById,
  resetMediaUploadMemoryStoreForTests,
  saveMediaRecord,
} from "../../../src/modules/media-upload/media-upload.service.js";
import {
  LocalSecureDocumentStorageProvider,
  resetSecureDocumentStorageProviderForTests,
  resolveSecureDocumentStorageProvider,
} from "../../../src/modules/shared-documents/secure-document-storage.provider.js";

function restoreEnv(previous: Record<string, string | undefined>): void {
  for (const [key, value] of Object.entries(previous)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

describe("Production Deployment Pack 02 — media durability seams", () => {
  beforeEach(() => {
    resetMediaUploadMemoryStoreForTests();
    resetSecureDocumentStorageProviderForTests();
  });

  it("keeps media metadata in the process cache for sync reads", () => {
    const saved = saveMediaRecord({
      mediaId: "media-pack02-1",
      mediaUrl: "https://cdn.example.org/avatars/a.webp",
      mediaType: "image/webp",
      size: 12,
      createdAt: new Date().toISOString(),
      ownerUserId: "user-1",
      ownerParticipantId: "participant-1",
      purpose: "avatar",
      storageKey: "avatars/a.webp",
    });

    assert.equal(getMediaRecordById(saved.mediaId)?.storageKey, "avatars/a.webp");
    deleteMediaRecord(saved.mediaId);
    assert.equal(getMediaRecordById(saved.mediaId), undefined);
  });

  it("defaults Shared Documents to local private storage (not public media root)", () => {
    delete process.env.SECURE_DOCUMENT_STORAGE_PROVIDER;
    process.env.MEDIA_STORAGE_PROVIDER = "local";
    resetSecureDocumentStorageProviderForTests();

    const provider = resolveSecureDocumentStorageProvider();
    assert.ok(provider instanceof LocalSecureDocumentStorageProvider);
  });

  it("rejects identical public and private R2 bucket names in production validation", () => {
    const previous = {
      MEDIA_STORAGE_PROVIDER: process.env.MEDIA_STORAGE_PROVIDER,
      R2_ACCOUNT_ID: process.env.R2_ACCOUNT_ID,
      R2_ACCESS_KEY_ID: process.env.R2_ACCESS_KEY_ID,
      R2_SECRET_ACCESS_KEY: process.env.R2_SECRET_ACCESS_KEY,
      R2_BUCKET: process.env.R2_BUCKET,
      R2_PUBLIC_BASE_URL: process.env.R2_PUBLIC_BASE_URL,
      R2_PRIVATE_BUCKET: process.env.R2_PRIVATE_BUCKET,
    };

    try {
      process.env.MEDIA_STORAGE_PROVIDER = "r2";
      process.env.R2_ACCOUNT_ID = "acct";
      process.env.R2_ACCESS_KEY_ID = "key";
      process.env.R2_SECRET_ACCESS_KEY = "secret";
      process.env.R2_BUCKET = "humanity-union-staging-media";
      process.env.R2_PUBLIC_BASE_URL = "https://media-staging.example.org";
      process.env.R2_PRIVATE_BUCKET = "humanity-union-staging-media";

      const problems = collectInvalidMediaStorageConfig();
      assert.ok(problems.some((item) => item.includes("R2_PRIVATE_BUCKET must differ")));
    } finally {
      restoreEnv(previous);
    }
  });

  it("requires R2_PRIVATE_BUCKET when MEDIA_STORAGE_PROVIDER=r2", () => {
    const previous = {
      MEDIA_STORAGE_PROVIDER: process.env.MEDIA_STORAGE_PROVIDER,
      R2_ACCOUNT_ID: process.env.R2_ACCOUNT_ID,
      R2_ACCESS_KEY_ID: process.env.R2_ACCESS_KEY_ID,
      R2_SECRET_ACCESS_KEY: process.env.R2_SECRET_ACCESS_KEY,
      R2_BUCKET: process.env.R2_BUCKET,
      R2_PUBLIC_BASE_URL: process.env.R2_PUBLIC_BASE_URL,
      R2_PRIVATE_BUCKET: process.env.R2_PRIVATE_BUCKET,
    };

    try {
      process.env.MEDIA_STORAGE_PROVIDER = "r2";
      process.env.R2_ACCOUNT_ID = "acct";
      process.env.R2_ACCESS_KEY_ID = "key";
      process.env.R2_SECRET_ACCESS_KEY = "secret";
      process.env.R2_BUCKET = "humanity-union-staging-media";
      process.env.R2_PUBLIC_BASE_URL = "https://media-staging.example.org";
      delete process.env.R2_PRIVATE_BUCKET;

      const problems = collectInvalidMediaStorageConfig();
      assert.ok(problems.some((item) => item.includes("R2_PRIVATE_BUCKET")));
    } finally {
      restoreEnv(previous);
    }
  });
});
