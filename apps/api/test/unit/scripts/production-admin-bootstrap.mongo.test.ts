/**
 * Production Admin bootstrap — Mongo write-path certification (isolated hu_test_*).
 * Skips when MONGODB_URI is unset. Never targets humanity_union_production.
 */

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";

import { MONGO_COLLECTIONS } from "../../../src/infrastructure/mongodb/mongo-collections.js";
import { resolveMongoConfig } from "../../../src/infrastructure/mongodb/mongo-config.js";
import {
  connectMongoClient,
  disconnectMongoClient,
  getMongoClient,
} from "../../../src/infrastructure/mongodb/mongo-connection.js";
import {
  APPROVED_PRODUCTION_ADMIN,
  PRODUCTION_ADMIN_BOOTSTRAP_CONFIRM_VALUE,
  PRODUCTION_STEWARD_BOOTSTRAP_CONFIRM_VALUE,
  PROTECTED_PRODUCTION_STEWARD_IDS,
  ProductionAdminBootstrapError,
  runProductionAdminBootstrap,
  type SourceAdminIdentity,
  type SourceAdminManifest,
} from "../../../src/modules/production-admin-bootstrap/index.js";
import { createTestId, isMongoAvailableForTests, skipIfMongoUnavailable } from "../../helpers/test-env.js";

if (!isMongoAvailableForTests()) {
  skipIfMongoUnavailable();
}

const PREFIX = createTestId("pab064");
const nowIso = new Date().toISOString();

function buildManifest(overrides: Partial<SourceAdminIdentity> = {}): SourceAdminManifest {
  const identity: SourceAdminIdentity = {
    label: APPROVED_PRODUCTION_ADMIN.label,
    memberId: APPROVED_PRODUCTION_ADMIN.memberId,
    userId: APPROVED_PRODUCTION_ADMIN.userId,
    profileId: APPROVED_PRODUCTION_ADMIN.profileId,
    email: `${PREFIX}-volody@example.test`,
    displayName: APPROVED_PRODUCTION_ADMIN.displayName,
    publicName: APPROVED_PRODUCTION_ADMIN.publicName,
    uniqueName: APPROVED_PRODUCTION_ADMIN.uniqueName,
    authRole: "admin",
    languages: ["en"],
    sourcePasswordHash: `$2b$12$neverCopySourceHashVolodyXXXX`,
    profile: {
      memberNumber: `HU-${PREFIX.slice(-6).toUpperCase()}`,
      profileVisibility: "public",
      membershipPubliclyVisible: false,
      biography: "Volody Admin bio",
    },
    ...overrides,
  };
  return { version: 1, identities: [identity] };
}

async function seedProtectedStewards(databaseName: string): Promise<void> {
  const db = getMongoClient().db(databaseName);
  for (const steward of PROTECTED_PRODUCTION_STEWARD_IDS) {
    await db.collection(MONGO_COLLECTIONS.authUsers).updateOne(
      { memberId: steward.memberId },
      {
        $set: {
          userId: steward.userId,
          memberId: steward.memberId,
          email: `${PREFIX}-${steward.memberId.slice(0, 8)}@example.test`,
          displayName: steward.label,
          role: "member",
          status: "active",
          emailVerificationStatus: "pending",
          passwordHash: "$2b$12$protectedStewardHashprotectedStewa",
          createdAt: nowIso,
          updatedAt: nowIso,
        },
      },
      { upsert: true },
    );
    await db.collection(MONGO_COLLECTIONS.members).updateOne(
      { memberId: steward.memberId },
      {
        $set: {
          memberId: steward.memberId,
          identityId: steward.userId,
          displayName: steward.label,
          uniqueName: `steward-${steward.memberId.slice(0, 8)}`,
          languages: ["en"],
          status: "active",
          verificationLevel: "email",
          roles: ["member"],
          registrationStatus: "registered",
          version: 1,
          createdAt: nowIso,
          updatedAt: nowIso,
        },
      },
      { upsert: true },
    );
  }
}

async function cleanupVolody(databaseName: string): Promise<void> {
  const db = getMongoClient().db(databaseName);
  const a = APPROVED_PRODUCTION_ADMIN;
  await db.collection(MONGO_COLLECTIONS.authUsers).deleteMany({
    $or: [{ memberId: a.memberId }, { userId: a.userId }],
  });
  await db.collection(MONGO_COLLECTIONS.members).deleteMany({
    $or: [{ memberId: a.memberId }, { identityId: a.userId }],
  });
  await db.collection(MONGO_COLLECTIONS.memberProfiles).deleteMany({
    $or: [{ profileId: a.profileId }, { userId: a.userId }],
  });
  await db.collection(MONGO_COLLECTIONS.memberships).deleteMany({
    $or: [{ memberId: a.memberId }, { userId: a.userId }],
  });
  await db.collection(MONGO_COLLECTIONS.authSessions).deleteMany({ userId: a.userId });
  await db
    .collection(MONGO_COLLECTIONS.emailVerificationTokens)
    .deleteMany({ userId: a.userId });
  await db
    .collection(MONGO_COLLECTIONS.emailConfirmationCodes)
    .deleteMany({ userId: a.userId });
}

describe("Production Admin bootstrap — Mongo execute path", () => {
  let databaseName = "";

  before(async () => {
    await connectMongoClient();
    databaseName = resolveMongoConfig().database;
    assert.match(databaseName, /^hu_test_/);
    assert.notEqual(databaseName, "humanity_union_production");
    await cleanupVolody(databaseName);
    await seedProtectedStewards(databaseName);
  });

  after(async () => {
    await cleanupVolody(databaseName);
    const db = getMongoClient().db(databaseName);
    const memberIds = PROTECTED_PRODUCTION_STEWARD_IDS.map((row) => row.memberId);
    const userIds = PROTECTED_PRODUCTION_STEWARD_IDS.map((row) => row.userId);
    await db.collection(MONGO_COLLECTIONS.authUsers).deleteMany({
      $or: [{ memberId: { $in: memberIds } }, { userId: { $in: userIds } }],
    });
    await db.collection(MONGO_COLLECTIONS.members).deleteMany({
      $or: [{ memberId: { $in: memberIds } }, { identityId: { $in: userIds } }],
    });
    await disconnectMongoClient();
  });

  it("dry-run performs no writes", async () => {
    const client = getMongoClient();
    const db = client.db(databaseName);
    const beforeAuth = await db.collection(MONGO_COLLECTIONS.authUsers).countDocuments({
      memberId: APPROVED_PRODUCTION_ADMIN.memberId,
    });

    const result = await runProductionAdminBootstrap({
      client,
      databaseName,
      identity: buildManifest().identities[0]!,
      execute: false,
      allowTestIsolation: true,
    });

    assert.equal(result.mode, "dry-run");
    assert.equal(result.written.authUsers, 0);
    assert.equal(result.written.members, 0);
    assert.equal(result.written.memberProfiles, 0);
    assert.equal(result.written.memberships, 0);
    assert.equal(result.sessionsWritten, 0);
    assert.equal(result.tokensWritten, 0);
    assert.equal(result.admin.operation, "would_create");
    assert.equal(result.admin.authRole, "admin");
    assert.deepEqual(result.admin.memberRoles, ["member"]);

    const afterAuth = await db.collection(MONGO_COLLECTIONS.authUsers).countDocuments({
      memberId: APPROVED_PRODUCTION_ADMIN.memberId,
    });
    assert.equal(afterAuth, beforeAuth);
  });

  it("execute without Admin confirmation refuses write", async () => {
    await assert.rejects(
      () =>
        runProductionAdminBootstrap({
          client: getMongoClient(),
          databaseName,
          identity: buildManifest().identities[0]!,
          execute: true,
          confirm: PRODUCTION_STEWARD_BOOTSTRAP_CONFIRM_VALUE,
          adminConfirm: undefined,
          allowTestIsolation: true,
        }),
      (error: unknown) =>
        error instanceof ProductionAdminBootstrapError &&
        error.code === "MISSING_ADMIN_CONFIRMATION",
    );
  });

  it("wrong identity cannot use Admin mode", async () => {
    const identity: SourceAdminIdentity = {
      ...buildManifest().identities[0]!,
      memberId: randomUUID(),
      userId: randomUUID(),
      profileId: randomUUID(),
      displayName: "Volody",
      publicName: "@volody",
      authRole: "admin",
    };
    await assert.rejects(
      () =>
        runProductionAdminBootstrap({
          client: getMongoClient(),
          databaseName,
          identity,
          execute: true,
          confirm: PRODUCTION_STEWARD_BOOTSTRAP_CONFIRM_VALUE,
          adminConfirm: PRODUCTION_ADMIN_BOOTSTRAP_CONFIRM_VALUE,
          allowTestIsolation: true,
        }),
      (error: unknown) =>
        error instanceof ProductionAdminBootstrapError &&
        error.code === "ADMIN_ALLOWLIST_MISMATCH",
    );
  });

  it("successful path: role=admin, members.roles=[member], no membership/sessions/tokens; second run collides; stewards untouched", async () => {
    const client = getMongoClient();
    const db = client.db(databaseName);
    const manifest = buildManifest();

    const stewardBefore = await Promise.all(
      PROTECTED_PRODUCTION_STEWARD_IDS.map(async (steward) => {
        const auth = await db
          .collection(MONGO_COLLECTIONS.authUsers)
          .findOne({ memberId: steward.memberId });
        return {
          memberId: steward.memberId,
          updatedAt: auth?.updatedAt,
          role: auth?.role,
        };
      }),
    );

    const first = await runProductionAdminBootstrap({
      client,
      databaseName,
      identity: manifest.identities[0]!,
      execute: true,
      confirm: PRODUCTION_STEWARD_BOOTSTRAP_CONFIRM_VALUE,
      adminConfirm: PRODUCTION_ADMIN_BOOTSTRAP_CONFIRM_VALUE,
      allowTestIsolation: true,
    });

    assert.equal(first.mode, "execute");
    assert.equal(first.written.authUsers, 1);
    assert.equal(first.written.members, 1);
    assert.equal(first.written.memberProfiles, 1);
    assert.equal(first.written.memberships, 0);
    assert.equal(first.sessionsWritten, 0);
    assert.equal(first.tokensWritten, 0);
    assert.equal(first.protectedStewardsUntouched, true);
    assert.equal(first.admin.authRole, "admin");

    const auth = await db.collection(MONGO_COLLECTIONS.authUsers).findOne({
      memberId: APPROVED_PRODUCTION_ADMIN.memberId,
    });
    assert.ok(auth);
    assert.equal(auth.userId, APPROVED_PRODUCTION_ADMIN.userId);
    assert.equal(auth.role, "admin");
    assert.equal(auth.status, "active");
    assert.equal(auth.emailVerificationStatus, "pending");
    assert.equal(auth.emailVerifiedAt, undefined);
    assert.equal(auth.lastLoginAt, undefined);
    assert.equal(auth.pendingEmail, undefined);
    assert.notEqual(auth.passwordHash, manifest.identities[0]?.sourcePasswordHash);
    assert.ok(String(auth.passwordHash).startsWith("$2"));

    const member = await db.collection(MONGO_COLLECTIONS.members).findOne({
      memberId: APPROVED_PRODUCTION_ADMIN.memberId,
    });
    assert.ok(member);
    assert.deepEqual(member.roles, ["member"]);
    assert.equal(member.identityId, APPROVED_PRODUCTION_ADMIN.userId);
    assert.equal(member.uniqueName, "vlad-6038da");

    const profile = await db.collection(MONGO_COLLECTIONS.memberProfiles).findOne({
      profileId: APPROVED_PRODUCTION_ADMIN.profileId,
    });
    assert.ok(profile);
    assert.equal(profile.publicName, "@volody");
    assert.equal(profile.userId, APPROVED_PRODUCTION_ADMIN.userId);
    assert.equal(profile.displayName, "Volody");

    const membershipCount = await db.collection(MONGO_COLLECTIONS.memberships).countDocuments({
      $or: [
        { memberId: APPROVED_PRODUCTION_ADMIN.memberId },
        { userId: APPROVED_PRODUCTION_ADMIN.userId },
      ],
    });
    assert.equal(membershipCount, 0);

    const sessionCount = await db.collection(MONGO_COLLECTIONS.authSessions).countDocuments({
      userId: APPROVED_PRODUCTION_ADMIN.userId,
    });
    const tokenCount = await db
      .collection(MONGO_COLLECTIONS.emailVerificationTokens)
      .countDocuments({ userId: APPROVED_PRODUCTION_ADMIN.userId });
    assert.equal(sessionCount, 0);
    assert.equal(tokenCount, 0);

    for (const [index, steward] of PROTECTED_PRODUCTION_STEWARD_IDS.entries()) {
      const authAfter = await db
        .collection(MONGO_COLLECTIONS.authUsers)
        .findOne({ memberId: steward.memberId });
      assert.ok(authAfter);
      assert.equal(authAfter.role, "member");
      assert.equal(authAfter.updatedAt, stewardBefore[index]?.updatedAt);
      assert.equal(authAfter.userId, steward.userId);
    }

    await assert.rejects(
      () =>
        runProductionAdminBootstrap({
          client,
          databaseName,
          identity: manifest.identities[0]!,
          execute: true,
          confirm: PRODUCTION_STEWARD_BOOTSTRAP_CONFIRM_VALUE,
          adminConfirm: PRODUCTION_ADMIN_BOOTSTRAP_CONFIRM_VALUE,
          allowTestIsolation: true,
        }),
      (error: unknown) =>
        error instanceof ProductionAdminBootstrapError && error.code === "COLLISION",
    );
  });

  it("email collision aborts", async () => {
    const client = getMongoClient();
    const db = client.db(databaseName);
    await cleanupVolody(databaseName);

    const foreignEmail = `${PREFIX}-foreign-admin@example.test`;
    await db.collection(MONGO_COLLECTIONS.authUsers).insertOne({
      userId: randomUUID(),
      memberId: randomUUID(),
      email: foreignEmail,
      displayName: "Foreign",
      role: "member",
      status: "active",
      emailVerificationStatus: "pending",
      passwordHash: "$2b$12$foreignhashforeignhashforeignha",
      createdAt: nowIso,
      updatedAt: nowIso,
    });

    await assert.rejects(
      () =>
        runProductionAdminBootstrap({
          client,
          databaseName,
          identity: buildManifest({ email: foreignEmail }).identities[0]!,
          execute: true,
          confirm: PRODUCTION_STEWARD_BOOTSTRAP_CONFIRM_VALUE,
          adminConfirm: PRODUCTION_ADMIN_BOOTSTRAP_CONFIRM_VALUE,
          allowTestIsolation: true,
        }),
      (error: unknown) =>
        error instanceof ProductionAdminBootstrapError &&
        error.code === "COLLISION" &&
        error.message.includes("email"),
    );

    await db.collection(MONGO_COLLECTIONS.authUsers).deleteMany({ email: foreignEmail });
  });

  it("publicName collision aborts", async () => {
    const client = getMongoClient();
    const db = client.db(databaseName);
    await cleanupVolody(databaseName);

    await db.collection(MONGO_COLLECTIONS.memberProfiles).insertOne({
      profileId: randomUUID(),
      userId: randomUUID(),
      publicName: APPROVED_PRODUCTION_ADMIN.publicName,
      displayName: "Other",
      memberNumber: "HU-OTHER01",
      skills: [],
      status: "active",
      profileVisibility: "public",
      createdAt: nowIso,
      updatedAt: nowIso,
    });

    await assert.rejects(
      () =>
        runProductionAdminBootstrap({
          client,
          databaseName,
          identity: buildManifest().identities[0]!,
          execute: true,
          confirm: PRODUCTION_STEWARD_BOOTSTRAP_CONFIRM_VALUE,
          adminConfirm: PRODUCTION_ADMIN_BOOTSTRAP_CONFIRM_VALUE,
          allowTestIsolation: true,
        }),
      (error: unknown) =>
        error instanceof ProductionAdminBootstrapError &&
        error.code === "COLLISION" &&
        error.message.includes("publicName"),
    );

    await db.collection(MONGO_COLLECTIONS.memberProfiles).deleteMany({
      publicName: APPROVED_PRODUCTION_ADMIN.publicName,
    });
  });

  it("uniqueName collision aborts", async () => {
    const client = getMongoClient();
    const db = client.db(databaseName);
    await cleanupVolody(databaseName);

    await db.collection(MONGO_COLLECTIONS.members).insertOne({
      memberId: randomUUID(),
      identityId: randomUUID(),
      uniqueName: APPROVED_PRODUCTION_ADMIN.uniqueName,
      displayName: "Other",
      languages: ["en"],
      status: "active",
      verificationLevel: "email",
      roles: ["member"],
      registrationStatus: "registered",
      version: 1,
      createdAt: nowIso,
      updatedAt: nowIso,
    });

    await assert.rejects(
      () =>
        runProductionAdminBootstrap({
          client,
          databaseName,
          identity: buildManifest().identities[0]!,
          execute: true,
          confirm: PRODUCTION_STEWARD_BOOTSTRAP_CONFIRM_VALUE,
          adminConfirm: PRODUCTION_ADMIN_BOOTSTRAP_CONFIRM_VALUE,
          allowTestIsolation: true,
        }),
      (error: unknown) =>
        error instanceof ProductionAdminBootstrapError &&
        error.code === "COLLISION" &&
        error.message.includes("uniqueName"),
    );

    await db.collection(MONGO_COLLECTIONS.members).deleteMany({
      uniqueName: APPROVED_PRODUCTION_ADMIN.uniqueName,
    });
  });

  it("partial graph aborts", async () => {
    const client = getMongoClient();
    const db = client.db(databaseName);
    await cleanupVolody(databaseName);

    await db.collection(MONGO_COLLECTIONS.authUsers).insertOne({
      userId: APPROVED_PRODUCTION_ADMIN.userId,
      memberId: APPROVED_PRODUCTION_ADMIN.memberId,
      email: `${PREFIX}-partial@example.test`,
      displayName: "Volody",
      role: "admin",
      status: "active",
      emailVerificationStatus: "pending",
      passwordHash: "$2b$12$partialpartialpartialpartialpa",
      createdAt: nowIso,
      updatedAt: nowIso,
    });

    await assert.rejects(
      () =>
        runProductionAdminBootstrap({
          client,
          databaseName,
          identity: buildManifest().identities[0]!,
          execute: true,
          confirm: PRODUCTION_STEWARD_BOOTSTRAP_CONFIRM_VALUE,
          adminConfirm: PRODUCTION_ADMIN_BOOTSTRAP_CONFIRM_VALUE,
          allowTestIsolation: true,
        }),
      (error: unknown) =>
        error instanceof ProductionAdminBootstrapError &&
        error.code === "COLLISION" &&
        /partial_graph|already exists/i.test(error.message),
    );

    await cleanupVolody(databaseName);
  });
});
