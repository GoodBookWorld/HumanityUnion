import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { MONGO_COLLECTIONS } from "../../src/infrastructure/mongodb/mongo-collections.js";
import { resolveMongoConfig } from "../../src/infrastructure/mongodb/mongo-config.js";
import {
  connectMongoClient,
  disconnectMongoClient,
  getMongoClient,
} from "../../src/infrastructure/mongodb/mongo-connection.js";
import { MemoryMediaObjectStorage } from "../../src/modules/media-upload/memory-media.provider.js";
import { __testOnly_resetMediaObjectStorage } from "../../src/modules/media-upload/resolve-media-object-storage.js";
import {
  PORTABLE_MEDIA_SOURCE_RELATIVE_PATH,
  STAGING_ADMIN_MEMBER_ID,
  STAGING_ADMIN_USER_ID,
  executeStagingHistoricalMediaMigration,
  loadAndValidatePortableMediaSource,
  loadTargetMediaContext,
} from "../../src/modules/staging-historical-media/index.js";
import { createTestId, isMongoAvailableForTests, skipIfMongoUnavailable } from "../helpers/test-env.js";

if (!isMongoAvailableForTests()) {
  skipIfMongoUnavailable();
}

function resolveRepoRoot(fromDir: string): string {
  let current = path.resolve(fromDir);
  for (let i = 0; i < 8; i += 1) {
    if (existsSync(path.join(current, "pnpm-workspace.yaml"))) return current;
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return current;
}

function isAtlasCollectionLimitError(error: unknown): boolean {
  return Boolean(
    error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code?: number }).code === 8000,
  );
}

const PREFIX = createTestId("media03");
const HISTORICAL = [
  {
    key: "historical_vlad_gmail",
    memberId: "a5e65d2f-3be7-4f8f-acd9-87c68027d662",
    userId: "5a56a3fd-58d1-41b3-be64-c15ca3e93a28",
  },
  {
    key: "michael",
    memberId: "9cde6a4e-0fda-4132-8e7e-78432b864231",
    userId: "2e3375dd-dfb1-42a2-8ce2-98a9022cbaae",
  },
  {
    key: "derek",
    memberId: "57696395-199d-48b2-bbeb-bc30d2a1ba6c",
    userId: "0bf8690c-5e07-4fff-8acb-d56722d5ce80",
  },
  {
    key: "isabella",
    memberId: "5bb8e373-c042-4786-a69c-0340301711d8",
    userId: "7e876d38-0c1e-4241-b520-44bdfc11781a",
  },
] as const;

describe("Staging Data Migration Pack 03 — isolated media execute", () => {
  let targetDbName = "";
  let storage: MemoryMediaObjectStorage;
  let portableDir = "";
  let atlasCollectionLimit = false;

  before(async () => {
    await connectMongoClient();
    targetDbName = resolveMongoConfig().database;
    assert.match(targetDbName, /^hu_test_/);

    const repoRoot = resolveRepoRoot(path.dirname(fileURLToPath(import.meta.url)));
    portableDir = path.join(repoRoot, PORTABLE_MEDIA_SOURCE_RELATIVE_PATH);
    const portable = loadAndValidatePortableMediaSource(portableDir);

    storage = new MemoryMediaObjectStorage();
    __testOnly_resetMediaObjectStorage();

    const db = getMongoClient().db(targetDbName);

    try {
      await db.collection(MONGO_COLLECTIONS.authUsers).insertOne({
        userId: STAGING_ADMIN_USER_ID,
        memberId: STAGING_ADMIN_MEMBER_ID,
        email: `${PREFIX}-admin@huws.org`,
        displayName: "Vlad",
        role: "admin",
        status: "active",
        passwordHash: "not-a-real-hash",
        emailVerificationStatus: "verified",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      await db.collection(MONGO_COLLECTIONS.memberProfiles).insertOne({
        profileId: randomUUID(),
        userId: STAGING_ADMIN_USER_ID,
        displayName: "Vlad",
        avatarUrl: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      for (const person of HISTORICAL) {
        const avatar = portable.manifest.participantAvatars.find((item) => item.key === person.key)!;
        await db.collection(MONGO_COLLECTIONS.authUsers).insertOne({
          userId: person.userId,
          memberId: person.memberId,
          email: `${PREFIX}-${person.key}@gmail.com`,
          displayName: person.key,
          role: "member",
          status: "active",
          passwordHash: "not-a-real-hash",
          emailVerificationStatus: "pending",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
        await db.collection(MONGO_COLLECTIONS.memberProfiles).insertOne({
          profileId: randomUUID(),
          userId: person.userId,
          displayName: person.key,
          avatarUrl: avatar.historicalLocalhostUrl,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }

      for (const cover of portable.manifest.initiativeCovers) {
        await db.collection(MONGO_COLLECTIONS.initiatives).insertOne({
          _id: cover.initiativeId,
          title: cover.title,
          stewardId: "steward",
          lifecyclePhase: "projected",
          status: "proposal",
          metadata: {
            imageUrl: cover.historicalLocalhostUrl,
            imageAltText:
              cover.initiativeId === "initiative-1783748417899" ? "keep-alt" : undefined,
            coverMedia:
              cover.initiativeId.startsWith("initiative-178569") ||
              cover.initiativeId.startsWith("initiative-178594")
                ? {
                    type: "image",
                    url: cover.historicalLocalhostUrl,
                    verificationStatus: "approved",
                    createdAt: "2026-08-01T00:00:00.000Z",
                  }
                : undefined,
          },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }
    } catch (error) {
      if (isAtlasCollectionLimitError(error)) {
        atlasCollectionLimit = true;
        console.log(
          "SKIP execute integration: Atlas collection limit reached (hu_test_* residue). Unit tests cover Pack 03 execute contracts.",
        );
        return;
      }
      throw error;
    }
  });

  after(async () => {
    if (!atlasCollectionLimit) {
      const db = getMongoClient().db(targetDbName);
      await db.collection(MONGO_COLLECTIONS.authUsers).deleteMany({
        email: { $regex: `^${PREFIX}` },
      });
      await db.collection(MONGO_COLLECTIONS.memberProfiles).deleteMany({
        userId: {
          $in: [STAGING_ADMIN_USER_ID, ...HISTORICAL.map((person) => person.userId)],
        },
      });
      await db.collection(MONGO_COLLECTIONS.initiatives).deleteMany({
        _id: { $regex: /^initiative-178/ },
      });
      await db.collection(MONGO_COLLECTIONS.mediaUploadRecords).deleteMany({
        storageKey: { $regex: /historical-recovery/ },
      });
    }
    __testOnly_resetMediaObjectStorage();
    await disconnectMongoClient();
  });

  it("uploads media, updates only media fields, protects admin, second run idempotent", async (t) => {
    if (atlasCollectionLimit) {
      t.skip("Atlas collection limit — clean hu_test_* residue to re-enable");
      return;
    }

    const client = getMongoClient();
    const portable = loadAndValidatePortableMediaSource(portableDir);
    const plan = await loadTargetMediaContext({
      client,
      targetDatabase: targetDbName,
      portable,
      storage,
    });
    assert.equal(plan.conflicts.length, 0);
    assert.equal(plan.initiatives.length, 5);
    assert.equal(plan.avatars.length, 4);

    const first = await executeStagingHistoricalMediaMigration({
      client,
      targetDatabase: targetDbName,
      portable,
      storage,
      plan: { ...plan, mode: "execute" },
    });
    assert.equal(first.stagingAdminUntouched, true);
    assert.equal(first.uploaded.initiatives, 5);
    assert.equal(first.uploaded.avatars, 4);

    const db = client.db(targetDbName);
    for (const cover of portable.manifest.initiativeCovers) {
      const doc = await db.collection(MONGO_COLLECTIONS.initiatives).findOne({
        _id: cover.initiativeId,
      });
      assert.ok(doc);
      assert.equal(doc?.title, cover.title);
      assert.doesNotMatch(String(doc?.metadata?.imageUrl ?? ""), /localhost/);
      assert.doesNotMatch(String(doc?.metadata?.coverMedia?.url ?? ""), /localhost/);
      assert.equal(doc?.metadata?.coverMedia?.type, "image");
      if (cover.initiativeId === "initiative-1783748417899") {
        assert.equal(doc?.metadata?.imageAltText, "keep-alt");
      }
    }

    for (const person of HISTORICAL) {
      const profile = await db.collection(MONGO_COLLECTIONS.memberProfiles).findOne({
        userId: person.userId,
      });
      assert.doesNotMatch(String(profile?.avatarUrl ?? ""), /localhost/);
    }

    const adminProfile = await db.collection(MONGO_COLLECTIONS.memberProfiles).findOne({
      userId: STAGING_ADMIN_USER_ID,
    });
    assert.equal(adminProfile?.avatarUrl ?? null, null);

    const plan2 = await loadTargetMediaContext({
      client,
      targetDatabase: targetDbName,
      portable,
      storage,
    });
    const second = await executeStagingHistoricalMediaMigration({
      client,
      targetDatabase: targetDbName,
      portable,
      storage,
      plan: { ...plan2, mode: "execute" },
    });
    assert.equal(second.uploaded.initiatives, 0);
    assert.equal(second.uploaded.avatars, 0);
    assert.equal(second.skipped.initiatives, 5);
    assert.equal(second.skipped.avatars, 4);
    assert.equal(second.stagingAdminUntouched, true);
  });
});
