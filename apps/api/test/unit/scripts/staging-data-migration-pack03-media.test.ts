import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  copyFileSync,
  cpSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { MemoryMediaObjectStorage } from "../../../src/modules/media-upload/memory-media.provider.js";
import { MediaUploadService } from "../../../src/modules/media-upload/media-upload.service.js";
import {
  APPROVED_TARGET_DATABASE,
  PORTABLE_MEDIA_SOURCE_RELATIVE_PATH,
  STAGING_ADMIN_MEMBER_ID,
  STAGING_ADMIN_USER_ID,
  STAGING_MEDIA_MIGRATION_FLAG,
  StagingHistoricalMediaError,
  assertStagingMediaMigrationExecuteGuards,
  buildMediaMigrationPlan,
  isExecuteModeRequested,
  loadAndValidatePortableMediaSource,
  resolvePortableMediaSourceDir,
} from "../../../src/modules/staging-historical-media/index.js";

const moduleDir = path.dirname(fileURLToPath(import.meta.url));

function resolveRepoRoot(fromDir: string): string {
  let current = path.resolve(fromDir);
  for (let i = 0; i < 8; i += 1) {
    if (existsSync(path.join(current, "pnpm-workspace.yaml"))) {
      return current;
    }
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return current;
}

const repoRoot = resolveRepoRoot(moduleDir);
const bundleDir = path.join(repoRoot, PORTABLE_MEDIA_SOURCE_RELATIVE_PATH);

describe("Staging Data Migration Pack 03 — media recovery contracts", () => {
  it("bundle contains exactly 5 Initiative covers and 4 evidence-based avatars", () => {
    const loaded = loadAndValidatePortableMediaSource(bundleDir);
    assert.equal(loaded.manifest.initiativeCovers.length, 5);
    assert.equal(loaded.manifest.participantAvatars.length, 4);
    assert.ok(
      loaded.manifest.initiativeCovers.some(
        (item) => item.initiativeId === "initiative-1785948978037",
      ),
    );
    const keys = loaded.manifest.participantAvatars.map((item) => item.key).sort();
    assert.deepEqual(keys, [
      "derek",
      "historical_vlad_gmail",
      "isabella",
      "michael",
    ]);
  });

  it("maps Initiative covers to approved IDs and excludes staging-admin", () => {
    const loaded = loadAndValidatePortableMediaSource(bundleDir);
    assert.equal(
      loaded.manifest.initiativeCovers.find(
        (item) => item.initiativeId === "initiative-1783748417899",
      )?.sourceFilename,
      "1783748417920-befba949-3527-443e-8dad-c06fc9f6be49.webp",
    );
    assert.equal(loaded.manifest.excluded?.stagingAdmin, true);
    for (const avatar of loaded.manifest.participantAvatars) {
      assert.notEqual(avatar.memberId, STAGING_ADMIN_MEMBER_ID);
      assert.notEqual(avatar.userId, STAGING_ADMIN_USER_ID);
    }
  });

  it("checksum validation fails when tampered", () => {
    const tempDir = mkdtempSync(path.join(tmpdir(), "hu-media-tamper-"));
    try {
      for (const name of ["manifest.json", "initiatives", "avatars"]) {
        const src = path.join(bundleDir, name);
        const dest = path.join(tempDir, name);
        if (name.endsWith(".json")) {
          copyFileSync(src, dest);
        } else {
          cpSync(src, dest, { recursive: true });
        }
      }
      const cover = path.join(
        tempDir,
        "initiatives",
        "1783748417920-befba949-3527-443e-8dad-c06fc9f6be49.webp",
      );
      writeFileSync(cover, Buffer.from("tampered"));
      assert.throws(() => loadAndValidatePortableMediaSource(tempDir), /Checksum mismatch/i);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("dry-run defaults and execute/R2 guards", () => {
    assert.equal(isExecuteModeRequested(["node", "script"]), false);
    assert.equal(isExecuteModeRequested(["node", "script", "--execute"]), true);
    assert.throws(
      () =>
        assertStagingMediaMigrationExecuteGuards({
          NODE_ENV: "production",
          PLATFORM_MODE: "staging",
          ALLOW_STAGING_MEDIA_MIGRATION: "true",
          MEDIA_STORAGE_PROVIDER: "r2",
          R2_ACCOUNT_ID: "x",
          R2_ACCESS_KEY_ID: "x",
          R2_SECRET_ACCESS_KEY: "x",
          R2_BUCKET: "x",
          R2_PUBLIC_BASE_URL: "https://media.example",
          targetDatabase: APPROVED_TARGET_DATABASE,
          execute: false,
        }),
      StagingHistoricalMediaError,
    );
    assert.throws(
      () =>
        assertStagingMediaMigrationExecuteGuards({
          NODE_ENV: "production",
          PLATFORM_MODE: "staging",
          ALLOW_STAGING_MEDIA_MIGRATION: "true",
          MEDIA_STORAGE_PROVIDER: "local",
          targetDatabase: APPROVED_TARGET_DATABASE,
          execute: true,
        }),
      /MEDIA_STORAGE_PROVIDER must be r2/,
    );
    assert.match(STAGING_MEDIA_MIGRATION_FLAG, /ALLOW_STAGING_MEDIA_MIGRATION/);
  });

  it("plans Initiative media field updates without touching authored content", () => {
    const loaded = loadAndValidatePortableMediaSource(bundleDir);
    const storage = new MemoryMediaObjectStorage();
    const cover = loaded.manifest.initiativeCovers[0];
    const plan = buildMediaMigrationPlan({
      targetDatabase: APPROVED_TARGET_DATABASE,
      portable: loaded,
      buildPublicUrl: (key) => storage.buildPublicUrl(key),
      initiativesById: new Map([
        [
          cover.initiativeId,
          {
            metadata: {
              imageUrl: cover.historicalLocalhostUrl,
              imageAltText: "keep-me",
            },
          },
        ],
        ...loaded.manifest.initiativeCovers.slice(1).map((item) => [
          item.initiativeId,
          { metadata: { imageUrl: item.historicalLocalhostUrl } },
        ] as const),
      ]),
      profilesByUserId: new Map(
        loaded.manifest.participantAvatars.map((avatar) => [
          avatar.userId,
          { userId: avatar.userId, avatarUrl: avatar.historicalLocalhostUrl },
        ]),
      ),
      authByMemberId: new Map(
        loaded.manifest.participantAvatars.map((avatar) => [
          avatar.memberId,
          { userId: avatar.userId, memberId: avatar.memberId, role: "member" },
        ]),
      ),
      existingMediaByStorageKey: new Map(),
    });

    assert.equal(plan.initiatives.length, 5);
    assert.ok(plan.initiatives.every((item) => item.action === "upload_and_update"));
    assert.equal(plan.avatars.length, 4);
    assert.ok(plan.avatars.every((item) => item.action === "upload_and_update"));
    assert.equal(plan.summary.unresolvedAvatars, 0);
  });

  it("second upload with same deterministic key is idempotent; conflicting hash fails", async () => {
    const storage = new MemoryMediaObjectStorage();
    const service = new MediaUploadService(storage);
    const buffer = Buffer.from("avatar-bytes");
    const sha = createHash("sha256").update(buffer).digest("hex");
    const key = `avatars/historical-recovery/${sha}.jpg`;

    await service.uploadMedia({
      purpose: "avatar",
      file: { buffer, mimeType: "image/jpeg", extension: ".jpg", size: buffer.length, width: 1, height: 1 },
      ownerUserId: "u1",
      ownerParticipantId: "m1",
      storageKey: key,
    });
    await service.uploadMedia({
      purpose: "avatar",
      file: { buffer, mimeType: "image/jpeg", extension: ".jpg", size: buffer.length, width: 1, height: 1 },
      ownerUserId: "u1",
      ownerParticipantId: "m1",
      storageKey: key,
    });

    await assert.rejects(
      () =>
        service.uploadMedia({
          purpose: "avatar",
          file: {
            buffer: Buffer.from("different"),
            mimeType: "image/jpeg",
            extension: ".jpg",
            size: 9,
            width: 1,
            height: 1,
          },
          ownerUserId: "u1",
          ownerParticipantId: "m1",
          storageKey: key,
        }),
      /Conflicting media object/,
    );
  });

  it("script never logs secrets and Render-style path uses portable bundle", () => {
    const script = readFileSync(
      path.join(repoRoot, "apps/api/src/scripts/migrate-staging-historical-media.ts"),
      "utf8",
    );
    assert.match(script, /dry-run|DRY RUN/);
    assert.match(script, /ALLOW_STAGING_MEDIA_MIGRATION/);
    assert.match(script, /credentials.*redacted/i);
    assert.doesNotMatch(script, /console\.log\([^)]*R2_SECRET/);
    assert.doesNotMatch(script, /console\.log\([^)]*MONGODB_URI/);
    assert.equal(
      resolvePortableMediaSourceDir(repoRoot).endsWith("staging-media-source-v1"),
      true,
    );
    assert.ok(!resolvePortableMediaSourceDir(repoRoot).includes(`${path.sep}.runtime${path.sep}`));
  });

  it("localhost URLs are planned for replacement only on approved records", () => {
    const loaded = loadAndValidatePortableMediaSource(bundleDir);
    const plan = buildMediaMigrationPlan({
      targetDatabase: APPROVED_TARGET_DATABASE,
      portable: loaded,
      buildPublicUrl: (key) => `https://media-staging.example/${key}`,
      initiativesById: new Map(
        loaded.manifest.initiativeCovers.map((item) => [
          item.initiativeId,
          { metadata: { imageUrl: item.historicalLocalhostUrl } },
        ]),
      ),
      profilesByUserId: new Map(
        loaded.manifest.participantAvatars.map((avatar) => [
          avatar.userId,
          { userId: avatar.userId, avatarUrl: avatar.historicalLocalhostUrl },
        ]),
      ),
      authByMemberId: new Map(
        loaded.manifest.participantAvatars.map((avatar) => [
          avatar.memberId,
          { userId: avatar.userId, memberId: avatar.memberId },
        ]),
      ),
      existingMediaByStorageKey: new Map(),
    });

    for (const item of plan.initiatives) {
      assert.match(item.currentImageUrl ?? "", /localhost/);
      assert.doesNotMatch(item.plannedPublicUrl, /localhost/);
    }
    for (const item of plan.avatars) {
      assert.match(item.currentAvatarUrl ?? "", /localhost/);
      assert.doesNotMatch(item.plannedPublicUrl ?? "", /localhost/);
    }
  });
});
