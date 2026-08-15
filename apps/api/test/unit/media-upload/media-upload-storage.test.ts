import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { after, describe, it } from "node:test";

import { LocalMediaStorageProvider } from "../../../src/modules/media-upload/local-media.provider.js";

/**
 * UX Evolution Pack 03 Part 8/12 (test #22) — storage paths must be
 * independent of any user-supplied filename, and generated filenames must
 * be safe (no path traversal, no reuse of client input).
 */

describe("LocalMediaStorageProvider — safe generated filenames", () => {
  const provider = new LocalMediaStorageProvider();
  const savedKeys: string[] = [];

  after(async () => {
    // Leave no test uploads behind on disk.
    await Promise.all(savedKeys.map((key) => provider.deleteFile(key)));
  });

  it("never derives the storage filename from user-supplied input — the API accepts no filename at all", async () => {
    const { storageKey, absolutePath } = await provider.saveFile({
      purpose: "initiative-image",
      buffer: Buffer.from("fixture-bytes"),
      mimeType: "image/png",
      extension: ".png",
    });
    savedKeys.push(storageKey);

    assert.match(storageKey, /^initiatives\/\d+-[0-9a-f-]{36}\.png$/);
    assert.ok(existsSync(absolutePath));
  });

  it("rejects a path-traversal extension rather than escaping the upload root", async () => {
    // Enough "../" segments to escape the upload root regardless of exactly
    // how many directories deep it happens to be checked out at.
    const escapingExtension = `/${"../".repeat(20)}etc/evil.png`;

    await assert.rejects(
      () =>
        provider.saveFile({
          purpose: "initiative-image",
          buffer: Buffer.from("fixture-bytes"),
          mimeType: "image/png",
          extension: escapingExtension,
        }),
      /Invalid media storage path/,
    );
  });

  it("builds a platform-relative public URL rather than exposing the filesystem path", async () => {
    const { storageKey } = await provider.saveFile({
      purpose: "initiative-image",
      buffer: Buffer.from("fixture-bytes"),
      mimeType: "image/png",
      extension: ".png",
    });
    savedKeys.push(storageKey);

    const publicUrl = provider.buildPublicUrl(storageKey);
    assert.match(publicUrl, /^\/api\/v1\/media\/files\/initiatives\/\d+-[0-9a-f-]{36}\.png$/);
  });
});
