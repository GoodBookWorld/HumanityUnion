/**
 * Production steward bootstrap — Mongo write-path certification (isolated hu_test_*).
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
  APPROVED_PRODUCTION_STEWARDS,
  PRODUCTION_STEWARD_BOOTSTRAP_CONFIRM_VALUE,
  ProductionStewardBootstrapError,
  runProductionStewardBootstrap,
  type SourceStewardIdentity,
  type SourceStewardManifest,
} from "../../../src/modules/production-steward-bootstrap/index.js";
import { createTestId, isMongoAvailableForTests, skipIfMongoUnavailable } from "../../helpers/test-env.js";

if (!isMongoAvailableForTests()) {
  skipIfMongoUnavailable();
}

const PREFIX = createTestId("psb05");

function buildManifest(): SourceStewardManifest {
  const identities: SourceStewardIdentity[] = APPROVED_PRODUCTION_STEWARDS.map((approved, index) => ({
    label: approved.label,
    memberId: approved.memberId,
    userId: approved.userId,
    profileId: approved.profileId,
    email: `${PREFIX}-steward${index + 1}@example.test`,
    displayName: approved.label,
    publicName: approved.publicName,
    uniqueName: approved.uniqueName,
    languages: ["en", "fr"],
    sourcePasswordHash: `$2b$12$neverCopySourceHash${index}`,
    profile: {
      memberNumber: `HU-${PREFIX.slice(-6).toUpperCase()}${index}`,
      profileVisibility: "public",
      biography: `Bio ${approved.label}`,
    },
  }));
  return { version: 1, identities };
}

describe("Production steward bootstrap — Mongo execute path", () => {
  let databaseName = "";

  before(async () => {
    await connectMongoClient();
    databaseName = resolveMongoConfig().database;
    assert.match(databaseName, /^hu_test_/);
    assert.notEqual(databaseName, "humanity_union_production");
  });

  after(async () => {
    const db = getMongoClient().db(databaseName);
    const memberIds = APPROVED_PRODUCTION_STEWARDS.map((row) => row.memberId);
    const userIds = APPROVED_PRODUCTION_STEWARDS.map((row) => row.userId);
    const profileIds = APPROVED_PRODUCTION_STEWARDS.map((row) => row.profileId);
    await db.collection(MONGO_COLLECTIONS.authUsers).deleteMany({
      $or: [{ memberId: { $in: memberIds } }, { userId: { $in: userIds } }],
    });
    await db.collection(MONGO_COLLECTIONS.members).deleteMany({
      $or: [{ memberId: { $in: memberIds } }, { identityId: { $in: userIds } }],
    });
    await db.collection(MONGO_COLLECTIONS.memberProfiles).deleteMany({
      $or: [{ profileId: { $in: profileIds } }, { userId: { $in: userIds } }],
    });
    await db.collection(MONGO_COLLECTIONS.authSessions).deleteMany({ userId: { $in: userIds } });
    await db
      .collection(MONGO_COLLECTIONS.emailVerificationTokens)
      .deleteMany({ userId: { $in: userIds } });
    await disconnectMongoClient();
  });

  it("dry-run performs no writes", async () => {
    const client = getMongoClient();
    const db = client.db(databaseName);
    const beforeAuth = await db.collection(MONGO_COLLECTIONS.authUsers).countDocuments({
      memberId: { $in: APPROVED_PRODUCTION_STEWARDS.map((row) => row.memberId) },
    });

    const result = await runProductionStewardBootstrap({
      client,
      databaseName,
      identities: buildManifest().identities,
      execute: false,
      allowTestIsolation: true,
    });

    assert.equal(result.mode, "dry-run");
    assert.equal(result.written.authUsers, 0);
    assert.equal(result.written.members, 0);
    assert.equal(result.written.memberProfiles, 0);
    assert.equal(result.sessionsWritten, 0);
    assert.equal(result.tokensWritten, 0);
    assert.ok(result.stewards.every((row) => row.operation === "would_create"));

    const afterAuth = await db.collection(MONGO_COLLECTIONS.authUsers).countDocuments({
      memberId: { $in: APPROVED_PRODUCTION_STEWARDS.map((row) => row.memberId) },
    });
    assert.equal(afterAuth, beforeAuth);
  });

  it("execute without confirm refuses write", async () => {
    await assert.rejects(
      () =>
        runProductionStewardBootstrap({
          client: getMongoClient(),
          databaseName,
          identities: buildManifest().identities,
          execute: true,
          confirm: undefined,
          allowTestIsolation: true,
        }),
      (error: unknown) =>
        error instanceof ProductionStewardBootstrapError && error.code === "MISSING_CONFIRMATION",
    );
  });

  it("successful path creates exactly 4+4+4, sanitizes auth, preserves legacy uniqueNames; second run collides", async () => {
    const client = getMongoClient();
    const db = client.db(databaseName);
    const manifest = buildManifest();

    const first = await runProductionStewardBootstrap({
      client,
      databaseName,
      identities: manifest.identities,
      execute: true,
      confirm: PRODUCTION_STEWARD_BOOTSTRAP_CONFIRM_VALUE,
      allowTestIsolation: true,
    });

    assert.equal(first.mode, "execute");
    assert.equal(first.written.authUsers, 4);
    assert.equal(first.written.members, 4);
    assert.equal(first.written.memberProfiles, 4);
    assert.equal(first.sessionsWritten, 0);
    assert.equal(first.tokensWritten, 0);
    assert.equal(first.rollbackPerformed, false);

    const authCount = await db.collection(MONGO_COLLECTIONS.authUsers).countDocuments({
      memberId: { $in: APPROVED_PRODUCTION_STEWARDS.map((row) => row.memberId) },
    });
    const memberCount = await db.collection(MONGO_COLLECTIONS.members).countDocuments({
      memberId: { $in: APPROVED_PRODUCTION_STEWARDS.map((row) => row.memberId) },
    });
    const profileCount = await db.collection(MONGO_COLLECTIONS.memberProfiles).countDocuments({
      profileId: { $in: APPROVED_PRODUCTION_STEWARDS.map((row) => row.profileId) },
    });
    assert.equal(authCount, 4);
    assert.equal(memberCount, 4);
    assert.equal(profileCount, 4);

    const sessionCount = await db.collection(MONGO_COLLECTIONS.authSessions).countDocuments({
      userId: { $in: APPROVED_PRODUCTION_STEWARDS.map((row) => row.userId) },
    });
    const tokenCount = await db
      .collection(MONGO_COLLECTIONS.emailVerificationTokens)
      .countDocuments({
        userId: { $in: APPROVED_PRODUCTION_STEWARDS.map((row) => row.userId) },
      });
    assert.equal(sessionCount, 0);
    assert.equal(tokenCount, 0);

    for (const [index, approved] of APPROVED_PRODUCTION_STEWARDS.entries()) {
      const auth = await db.collection(MONGO_COLLECTIONS.authUsers).findOne({
        memberId: approved.memberId,
      });
      assert.ok(auth);
      assert.equal(auth.userId, approved.userId);
      assert.equal(auth.role, "member");
      assert.equal(auth.emailVerificationStatus, "pending");
      assert.equal(auth.emailVerifiedAt, undefined);
      assert.notEqual(auth.passwordHash, manifest.identities[index]?.sourcePasswordHash);
      assert.ok(String(auth.passwordHash).startsWith("$2"));

      const member = await db.collection(MONGO_COLLECTIONS.members).findOne({
        memberId: approved.memberId,
      });
      assert.ok(member);
      assert.equal(member.identityId, approved.userId);
      assert.equal(member.uniqueName, approved.uniqueName);

      const profile = await db.collection(MONGO_COLLECTIONS.memberProfiles).findOne({
        profileId: approved.profileId,
      });
      assert.ok(profile);
      assert.equal(profile.userId, approved.userId);
      assert.equal(profile.publicName, approved.publicName);
      assert.equal(profile.membershipPubliclyVisible, false);
    }

    const leonardo = await db.collection(MONGO_COLLECTIONS.members).findOne({
      memberId: APPROVED_PRODUCTION_STEWARDS[1]!.memberId,
    });
    const munia = await db.collection(MONGO_COLLECTIONS.members).findOne({
      memberId: APPROVED_PRODUCTION_STEWARDS[3]!.memberId,
    });
    assert.equal(leonardo?.uniqueName, "michael-9cde6a4e");
    assert.equal(munia?.uniqueName, "isabella-2dfd0e");

    await assert.rejects(
      () =>
        runProductionStewardBootstrap({
          client,
          databaseName,
          identities: manifest.identities,
          execute: true,
          confirm: PRODUCTION_STEWARD_BOOTSTRAP_CONFIRM_VALUE,
          allowTestIsolation: true,
        }),
      (error: unknown) =>
        error instanceof ProductionStewardBootstrapError && error.code === "COLLISION",
    );
  });

  it("email collision aborts", async () => {
    const client = getMongoClient();
    const db = client.db(databaseName);
    // Clear steward graphs from previous test so we can isolate email collision.
    const memberIds = APPROVED_PRODUCTION_STEWARDS.map((row) => row.memberId);
    const userIds = APPROVED_PRODUCTION_STEWARDS.map((row) => row.userId);
    const profileIds = APPROVED_PRODUCTION_STEWARDS.map((row) => row.profileId);
    await db.collection(MONGO_COLLECTIONS.authUsers).deleteMany({
      $or: [{ memberId: { $in: memberIds } }, { userId: { $in: userIds } }],
    });
    await db.collection(MONGO_COLLECTIONS.members).deleteMany({
      $or: [{ memberId: { $in: memberIds } }, { identityId: { $in: userIds } }],
    });
    await db.collection(MONGO_COLLECTIONS.memberProfiles).deleteMany({
      $or: [{ profileId: { $in: profileIds } }, { userId: { $in: userIds } }],
    });

    const foreignEmail = `${PREFIX}-foreign@example.test`;
    await db.collection(MONGO_COLLECTIONS.authUsers).insertOne({
      userId: randomUUID(),
      memberId: randomUUID(),
      email: foreignEmail,
      displayName: "Foreign",
      role: "member",
      status: "active",
      emailVerificationStatus: "pending",
      passwordHash: "$2b$12$foreignhashforeignhashforeignha",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const manifest = buildManifest();
    manifest.identities[0]!.email = foreignEmail;

    await assert.rejects(
      () =>
        runProductionStewardBootstrap({
          client,
          databaseName,
          identities: manifest.identities,
          execute: true,
          confirm: PRODUCTION_STEWARD_BOOTSTRAP_CONFIRM_VALUE,
          allowTestIsolation: true,
        }),
      (error: unknown) =>
        error instanceof ProductionStewardBootstrapError &&
        error.code === "COLLISION" &&
        error.message.includes("email"),
    );

    await db.collection(MONGO_COLLECTIONS.authUsers).deleteMany({ email: foreignEmail });
  });

  it("publicName collision aborts", async () => {
    const client = getMongoClient();
    const db = client.db(databaseName);
    await db.collection(MONGO_COLLECTIONS.memberProfiles).insertOne({
      profileId: randomUUID(),
      userId: randomUUID(),
      publicName: APPROVED_PRODUCTION_STEWARDS[0]!.publicName,
      displayName: "Other",
      memberNumber: "HU-OTHER01",
      skills: [],
      status: "active",
      profileVisibility: "public",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    await assert.rejects(
      () =>
        runProductionStewardBootstrap({
          client,
          databaseName,
          identities: buildManifest().identities,
          execute: true,
          confirm: PRODUCTION_STEWARD_BOOTSTRAP_CONFIRM_VALUE,
          allowTestIsolation: true,
        }),
      (error: unknown) =>
        error instanceof ProductionStewardBootstrapError &&
        error.code === "COLLISION" &&
        error.message.includes("publicName"),
    );

    await db.collection(MONGO_COLLECTIONS.memberProfiles).deleteMany({
      publicName: APPROVED_PRODUCTION_STEWARDS[0]!.publicName,
    });
  });

  it("uniqueName collision aborts", async () => {
    const client = getMongoClient();
    const db = client.db(databaseName);
    await db.collection(MONGO_COLLECTIONS.members).insertOne({
      memberId: randomUUID(),
      identityId: randomUUID(),
      uniqueName: APPROVED_PRODUCTION_STEWARDS[0]!.uniqueName,
      displayName: "Other",
      languages: ["en"],
      status: "active",
      verificationLevel: "email",
      roles: ["member"],
      registrationStatus: "registered",
      version: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    await assert.rejects(
      () =>
        runProductionStewardBootstrap({
          client,
          databaseName,
          identities: buildManifest().identities,
          execute: true,
          confirm: PRODUCTION_STEWARD_BOOTSTRAP_CONFIRM_VALUE,
          allowTestIsolation: true,
        }),
      (error: unknown) =>
        error instanceof ProductionStewardBootstrapError &&
        error.code === "COLLISION" &&
        error.message.includes("uniqueName"),
    );

    await db.collection(MONGO_COLLECTIONS.members).deleteMany({
      uniqueName: APPROVED_PRODUCTION_STEWARDS[0]!.uniqueName,
    });
  });

  it("partial graph aborts", async () => {
    const client = getMongoClient();
    const db = client.db(databaseName);
    const approved = APPROVED_PRODUCTION_STEWARDS[2]!;
    await db.collection(MONGO_COLLECTIONS.authUsers).insertOne({
      userId: approved.userId,
      memberId: approved.memberId,
      email: `${PREFIX}-partial@example.test`,
      displayName: approved.label,
      role: "member",
      status: "active",
      emailVerificationStatus: "pending",
      passwordHash: "$2b$12$partialpartialpartialpartialpa",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    await assert.rejects(
      () =>
        runProductionStewardBootstrap({
          client,
          databaseName,
          identities: buildManifest().identities,
          execute: true,
          confirm: PRODUCTION_STEWARD_BOOTSTRAP_CONFIRM_VALUE,
          allowTestIsolation: true,
        }),
      (error: unknown) =>
        error instanceof ProductionStewardBootstrapError &&
        error.code === "COLLISION" &&
        /partial_graph|already exists/i.test(error.message),
    );

    await db.collection(MONGO_COLLECTIONS.authUsers).deleteMany({
      memberId: approved.memberId,
    });
  });

  it("exact-ID collision aborts", async () => {
    const client = getMongoClient();
    const db = client.db(databaseName);
    const approved = APPROVED_PRODUCTION_STEWARDS[0]!;
    await db.collection(MONGO_COLLECTIONS.members).insertOne({
      memberId: approved.memberId,
      identityId: approved.userId,
      uniqueName: `${PREFIX}-id-collision`,
      displayName: "Existing",
      languages: ["en"],
      status: "active",
      verificationLevel: "email",
      roles: ["member"],
      registrationStatus: "registered",
      version: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    await assert.rejects(
      () =>
        runProductionStewardBootstrap({
          client,
          databaseName,
          identities: buildManifest().identities,
          execute: true,
          confirm: PRODUCTION_STEWARD_BOOTSTRAP_CONFIRM_VALUE,
          allowTestIsolation: true,
        }),
      (error: unknown) =>
        error instanceof ProductionStewardBootstrapError && error.code === "COLLISION",
    );

    await db.collection(MONGO_COLLECTIONS.members).deleteMany({
      memberId: approved.memberId,
    });
  });
});
