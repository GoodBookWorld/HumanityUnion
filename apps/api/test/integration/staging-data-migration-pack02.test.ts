import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
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
import { ensureMongoIndexes } from "../../src/infrastructure/mongodb/mongo-indexes.js";
import { hashPassword } from "../../src/modules/auth/auth-password.js";
import {
  APPROVED_HISTORICAL_INITIATIVES,
  APPROVED_HISTORICAL_PARTICIPANTS,
  buildMigrationPlan,
  executeStagingHistoricalMigration,
  loadMigrationSourceBundle,
  resolveRepoRoot,
} from "../../src/modules/staging-data-migration/index.js";
import { PORTABLE_CIVIC_SOURCE_RELATIVE_PATH } from "../../src/modules/staging-data-migration/portable-source-bundle.js";
import { createTestId, isMongoAvailableForTests, skipIfMongoUnavailable } from "../helpers/test-env.js";

if (!isMongoAvailableForTests()) {
  skipIfMongoUnavailable();
}

const PREFIX = createTestId("mig02");
const ADMIN_EMAIL = `${PREFIX}-admin@huws.org`;
const ADMIN_USER_ID = randomUUID();
const ADMIN_MEMBER_ID = randomUUID();

describe("Staging Data Migration Pack 02 — isolated execute idempotency", () => {
  let civicSourceDir = "";
  let repoRoot = "";
  let sourceDbName = "";
  let targetDbName = "";

  before(async () => {
    await connectMongoClient();
    await ensureMongoIndexes();

    const configured = resolveMongoConfig().database;
    assert.match(configured, /^hu_test_/);
    assert.notEqual(configured, "humanity_union_dev");
    targetDbName = configured;
    sourceDbName = `${configured}_src`;

    const workspaceRoot = resolveRepoRoot(path.dirname(fileURLToPath(import.meta.url)));
    civicSourceDir = path.join(workspaceRoot, PORTABLE_CIVIC_SOURCE_RELATIVE_PATH);
    assert.ok(fs.existsSync(path.join(civicSourceDir, "manifest.json")));

    repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), "hu-mig02-repo-"));
    fs.mkdirSync(path.join(repoRoot, "apps/api/.runtime/recovery"), { recursive: true });

    const client = getMongoClient();
    const sourceDb = client.db(sourceDbName);
    const targetDb = client.db(targetDbName);

    await targetDb.collection(MONGO_COLLECTIONS.authUsers).insertOne({
      userId: ADMIN_USER_ID,
      memberId: ADMIN_MEMBER_ID,
      email: ADMIN_EMAIL,
      displayName: "Vlad",
      role: "admin",
      status: "active",
      emailVerificationStatus: "verified",
      passwordHash: await hashPassword("StagingAdminPass123!"),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    await targetDb.collection(MONGO_COLLECTIONS.members).insertOne({
      memberId: ADMIN_MEMBER_ID,
      identityId: ADMIN_MEMBER_ID,
      uniqueName: `${PREFIX}-admin`,
      status: "active",
      createdAt: new Date().toISOString(),
    });
    await targetDb.collection(MONGO_COLLECTIONS.initiatives).insertOne({
      _id: "initiative-bootstrap-001",
      title: "Community Garden Initiative",
      stewardId: "member-bootstrap-001",
      lifecyclePhase: "projected",
      status: "proposal",
    });

    for (const participant of APPROVED_HISTORICAL_PARTICIPANTS) {
      const userId = randomUUID();
      const email = `${PREFIX}-${participant.key}@gmail.com`;
      await sourceDb.collection(MONGO_COLLECTIONS.authUsers).insertOne({
        userId,
        memberId: participant.memberId,
        email,
        displayName: participant.displayName,
        role: "member",
        status: "active",
        emailVerificationStatus: "verified",
        passwordHash: await hashPassword("HistoricalPass123!"),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      await sourceDb.collection(MONGO_COLLECTIONS.members).insertOne({
        memberId: participant.memberId,
        identityId: participant.memberId,
        uniqueName: `${PREFIX}-${participant.key}`,
        status: "active",
        createdAt: new Date().toISOString(),
      });
      await sourceDb.collection(MONGO_COLLECTIONS.memberProfiles).insertOne({
        profileId: randomUUID(),
        userId,
        displayName: participant.displayName,
        publicName: `${participant.key}-public`,
        status: "active",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }
  });

  after(async () => {
    const client = getMongoClient();
    await client.db(sourceDbName).dropDatabase().catch(() => undefined);
    const targetDb = client.db(targetDbName);
    await targetDb.collection(MONGO_COLLECTIONS.authUsers).deleteMany({
      email: { $regex: `^${PREFIX}` },
    });
    await targetDb.collection(MONGO_COLLECTIONS.members).deleteMany({
      memberId: {
        $in: [
          ADMIN_MEMBER_ID,
          ...APPROVED_HISTORICAL_PARTICIPANTS.map((p) => p.memberId),
        ],
      },
    });
    await targetDb.collection(MONGO_COLLECTIONS.memberProfiles).deleteMany({
      publicName: { $regex: /-public$/ },
    });
    await targetDb.collection(MONGO_COLLECTIONS.initiatives).deleteMany({
      _id: {
        $in: [
          "initiative-bootstrap-001",
          ...APPROVED_HISTORICAL_INITIATIVES.map((i) => i.initiativeId),
        ],
      },
    });
    await targetDb.collection(MONGO_COLLECTIONS.initiativeAnalyses).deleteMany({});
    await targetDb.collection(MONGO_COLLECTIONS.initiativeImprovementProposals).deleteMany({});
    await targetDb.collection(MONGO_COLLECTIONS.initiativeVersionRevisions).deleteMany({});
    await targetDb.collection(MONGO_COLLECTIONS.initiativePetitionDrafts).deleteMany({});
    fs.rmSync(repoRoot, { recursive: true, force: true });
    await disconnectMongoClient();
  });

  it("imports 4 Participants + 5 Initiatives from portable bundle, protects admin, second run idempotent", async () => {
    const client = getMongoClient();
    const bundle = await loadMigrationSourceBundle({
      client,
      sourceDatabase: sourceDbName,
      targetDatabase: targetDbName,
      civicSourceDir,
    });
    const plan = buildMigrationPlan(bundle);
    assert.equal(plan.conflicts.length, 0);
    assert.equal(plan.participants.length, 4);
    assert.equal(plan.initiatives.length, 5);

    const first = await executeStagingHistoricalMigration({
      client,
      sourceDatabase: sourceDbName,
      targetDatabase: targetDbName,
      civicSourceDir,
      repoRoot,
      plan: { ...plan, mode: "execute" },
    });

    assert.equal(first.stagingAdminUnchanged, true);
    assert.equal(first.written.authUsers, 4);
    assert.equal(first.written.initiatives, 5);
    assert.ok(first.written.analyses >= 1);
    assert.ok(first.written.proposals >= 1);
    assert.ok(first.written.revisions >= 5);

    const targetDb = client.db(targetDbName);
    const admin = await targetDb.collection(MONGO_COLLECTIONS.authUsers).findOne({
      userId: ADMIN_USER_ID,
    });
    assert.equal(admin?.role, "admin");
    assert.equal(admin?.email, ADMIN_EMAIL);

    const historicalVlad = await targetDb.collection(MONGO_COLLECTIONS.authUsers).findOne({
      memberId: APPROVED_HISTORICAL_PARTICIPANTS[0].memberId,
    });
    assert.ok(historicalVlad);
    assert.notEqual(historicalVlad?.userId, ADMIN_USER_ID);
    assert.equal(historicalVlad?.role, "member");

    for (const initiative of APPROVED_HISTORICAL_INITIATIVES) {
      const doc = await targetDb.collection(MONGO_COLLECTIONS.initiatives).findOne({
        _id: initiative.initiativeId,
      });
      assert.ok(doc, initiative.initiativeId);
      assert.equal(String(doc?.stewardId), initiative.stewardMemberId);
      assert.notEqual(String(doc?.stewardId), ADMIN_MEMBER_ID);
    }

    const isabella = await targetDb.collection(MONGO_COLLECTIONS.initiatives).findOne({
      _id: "initiative-1785948978037",
    });
    assert.equal(String(isabella?.stewardId), APPROVED_HISTORICAL_PARTICIPANTS[3].memberId);

    const legacyActivities = await targetDb.collection(MONGO_COLLECTIONS.activities).countDocuments({});
    assert.equal(legacyActivities, 0);

    const bundle2 = await loadMigrationSourceBundle({
      client,
      sourceDatabase: sourceDbName,
      targetDatabase: targetDbName,
      civicSourceDir,
    });
    const plan2 = buildMigrationPlan(bundle2);
    const second = await executeStagingHistoricalMigration({
      client,
      sourceDatabase: sourceDbName,
      targetDatabase: targetDbName,
      civicSourceDir,
      repoRoot,
      plan: { ...plan2, mode: "execute" },
    });
    assert.equal(second.written.authUsers, 0);
    assert.equal(second.written.initiatives, 0);
    assert.equal(second.skipped.authUsers, 4);
    assert.equal(second.skipped.initiatives, 5);
    assert.equal(second.stagingAdminUnchanged, true);
  });
});
