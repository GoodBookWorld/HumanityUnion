/**
 * Workflow 09F — real Blog author capability after Binding Recovery acknowledgement.
 *
 * Same isolation as Workflow 09B: a process-owned single-node MongoMemoryReplSet
 * on 127.0.0.1, one hu_test_ database, no MONGODB_URI, no external server.
 * Uses the real recovery service, acknowledgement service, reconciler, Blog
 * capability ensurer, and Blog repository. Steps 2–4 never override the ensurer.
 */
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { after, before, beforeEach, describe, it } from "node:test";

import type { Document } from "mongodb";
import { MongoMemoryReplSet } from "mongodb-memory-server-core";

import {
  isProtectedDatabaseName,
  MAX_EPHEMERAL_DATABASE_NAME_BYTES,
  TEST_DATABASE_NAME_PATTERN,
} from "../../../src/infrastructure/mongodb/ephemeral-mongo-database-safety.js";
import {
  assertExplicitIsolatedMongoTestTarget,
  isExplicitIsolatedMongoTest,
  lockExplicitIsolatedMongoTestConfig,
} from "../../../src/infrastructure/mongodb/explicit-isolated-mongo-test.js";
import { MONGO_COLLECTIONS } from "../../../src/infrastructure/mongodb/mongo-collections.js";
import { getLockedMongoConfigForTests } from "../../../src/infrastructure/mongodb/mongo-config.js";
import {
  connectMongoClient,
  disconnectMongoClient,
} from "../../../src/infrastructure/mongodb/mongo-connection.js";
import { getMongoCollection, getMongoDatabase } from "../../../src/infrastructure/mongodb/mongo-database.js";
import { ensureBlogAuthorCapability } from "../../../src/modules/blog/blog-author-capability.js";
import { setIntegrityMediaBindingRecoveryInterruptForTests } from "../../../src/modules/external-author-link/external-author-link.binding-recovery.js";
import { redeemIntegrityMediaBindingRecovery } from "../../../src/modules/external-author-link/external-author-link.binding-recovery.service.js";
import {
  INTEGRITY_MEDIA_BINDING_RECOVERY_ENABLED_ENV,
  INTEGRITY_MEDIA_LINK_HMAC_SECRET_ENV,
  INTEGRITY_MEDIA_SOURCE,
} from "../../../src/modules/external-author-link/external-author-link.constants.js";
import {
  buildIntegrityMediaBindingRecoveryPayload,
  buildIntegrityMediaLinkAcknowledgePayload,
  resetIntegrityMediaAcknowledgeReplayCacheForTests,
  resetIntegrityMediaBindingRecoveryReplayCacheForTests,
  signIntegrityMediaLinkRedeem,
} from "../../../src/modules/external-author-link/external-author-link.hmac.js";
import {
  EXTERNAL_AUTHOR_LINK_AUDIT_INDEXES,
  EXTERNAL_AUTHOR_LINK_INDEXES,
  EXTERNAL_AUTHOR_LINK_RECOVERY_RECEIPT_INDEXES,
  EXTERNAL_AUTHOR_LINK_RESULT_INDEXES,
} from "../../../src/modules/external-author-link/external-author-link.indexes.js";
import { setProvisionMemoryForTests } from "../../../src/modules/external-author-link/external-author-link.provision.database.js";
import { reconcilePendingIntegrityMediaAuthorActivations } from "../../../src/modules/external-author-link/external-author-link.reconciliation.js";
import {
  acknowledgeIntegrityMediaLink,
  setIntegrityMediaAuthorCapabilityEnsurerForTests,
} from "../../../src/modules/external-author-link/external-author-link.service.js";
import {
  createMongoExternalAuthorLinkStore,
  setExternalAuthorLinkStoreForTests,
} from "../../../src/modules/external-author-link/external-author-link.store.js";
import type {
  ExternalAuthorLinkRecord,
  ExternalAuthorLinkResultRecord,
} from "../../../src/modules/external-author-link/external-author-link.types.js";

const RUN = randomBytes(4).toString("hex");
const DATABASE = `hu_test_cap_${RUN}`;
const SECRET = `hu-binding-recovery-capability-test-${RUN}`;
const LOCAL_HOSTS = new Set(["127.0.0.1", "localhost", "[::1]"]);
const GRANTS_INDEX = "blog_capability_grants_participant_unique";

const AUTHOR = randomUUID();
const HISTORICAL_MEMBER = randomUUID();
const REPLACEMENT_MEMBER = randomUUID();
const UNRELATED_MEMBER = randomUUID();
const HISTORICAL_INSTANCE = randomUUID();
const HISTORICAL_REVISION = 4;
const RECOVERY_ID = `rcv_${RUN}_capability_01`;
const RESULT_CODE = `capResultCode_${RUN}_0123456789abcdefABCDEF`;
const ENV_KEYS = [
  "NODE_TEST_ENV",
  "PLATFORM_MODE",
  INTEGRITY_MEDIA_LINK_HMAC_SECRET_ENV,
  INTEGRITY_MEDIA_BINDING_RECOVERY_ENABLED_ENV,
];

const lockedBeforeThisSuite = getLockedMongoConfigForTests();

let replSet: MongoMemoryReplSet | null = null;
let connected = false;
let timestampOffset = 0;
const savedEnv = new Map<string, string | undefined>();

describe("real Blog author capability after Binding Recovery acknowledgement", () => {
  if (lockedBeforeThisSuite) {
    it("NOT_RUN_EXTERNAL_MONGO_CONFIGURED", () => {
      assert.notEqual(lockedBeforeThisSuite, null);
    });
    return;
  }

  before(async () => {
    for (const key of ENV_KEYS) {
      savedEnv.set(key, process.env[key]);
    }
    process.env.NODE_TEST_ENV = "true";

    assert.match(DATABASE, TEST_DATABASE_NAME_PATTERN);
    assert.equal(isProtectedDatabaseName(DATABASE), false);
    assert.ok(Buffer.byteLength(DATABASE) <= MAX_EPHEMERAL_DATABASE_NAME_BYTES);

    replSet = await MongoMemoryReplSet.create({
      replSet: { count: 1, storageEngine: "wiredTiger" },
    });
    const uri = replSet.getUri(DATABASE);
    assertLocalReplSetUri(uri);
    assertExplicitIsolatedMongoTestTarget({ uri, database: DATABASE });
    lockExplicitIsolatedMongoTestConfig({ uri, database: DATABASE });
    assert.equal(isExplicitIsolatedMongoTest(), true);

    process.env.PLATFORM_MODE = "staging";
    process.env[INTEGRITY_MEDIA_LINK_HMAC_SECRET_ENV] = SECRET;
    process.env[INTEGRITY_MEDIA_BINDING_RECOVERY_ENABLED_ENV] = "true";

    await connectMongoClient();
    connected = true;
    assert.equal(getMongoDatabase().databaseName, DATABASE);
    await links().createIndexes(EXTERNAL_AUTHOR_LINK_INDEXES);
    await results().createIndexes(EXTERNAL_AUTHOR_LINK_RESULT_INDEXES);
    await receipts().createIndexes(EXTERNAL_AUTHOR_LINK_RECOVERY_RECEIPT_INDEXES);
    await audits().createIndexes(EXTERNAL_AUTHOR_LINK_AUDIT_INDEXES);
    await grants().createIndex({ participantId: 1 }, { unique: true, name: GRANTS_INDEX });

    setProvisionMemoryForTests(null);
    setExternalAuthorLinkStoreForTests(createMongoExternalAuthorLinkStore());
  });

  after(async () => {
    try {
      if (connected) {
        await removeGrantValidator().catch(() => undefined);
        if (getMongoDatabase().databaseName === DATABASE) {
          await getMongoDatabase().dropDatabase();
        }
      }
    } finally {
      try {
        if (connected) {
          await disconnectMongoClient();
        }
      } finally {
        await replSet?.stop({ doCleanup: true });
        setExternalAuthorLinkStoreForTests(null);
        setIntegrityMediaAuthorCapabilityEnsurerForTests(null);
        setIntegrityMediaBindingRecoveryInterruptForTests(null);
        for (const [key, value] of savedEnv) {
          if (value === undefined) {
            delete process.env[key];
          } else {
            process.env[key] = value;
          }
        }
      }
    }
  });

  beforeEach(async () => {
    process.env[INTEGRITY_MEDIA_BINDING_RECOVERY_ENABLED_ENV] = "true";
    setIntegrityMediaAuthorCapabilityEnsurerForTests(null);
    setIntegrityMediaBindingRecoveryInterruptForTests(null);
    resetIntegrityMediaBindingRecoveryReplayCacheForTests();
    resetIntegrityMediaAcknowledgeReplayCacheForTests();
    await removeGrantValidator();
    await Promise.all(
      [links(), results(), receipts(), audits(), grants(), authUsers()].map((collection) =>
        collection.deleteMany({}),
      ),
    );
    await links().insertOne(historicalLink());
    await results().insertOne(recoveryResult());
    await grants().insertMany([
      { participantId: HISTORICAL_MEMBER, capabilities: ["author"], updatedAt: "2026-01-01T00:00:00.000Z" },
      {
        participantId: UNRELATED_MEMBER,
        capabilities: ["editor"],
        updatedAt: "2026-01-01T00:00:00.000Z",
        administrativelyBlocked: true,
        administrativeBlockAuthority: "ADMIN",
        administrativelyBlockedAt: "2026-01-01T00:00:00.000Z",
        administrativelyBlockedByParticipantId: randomUUID(),
        administrativeBlockReason: "synthetic",
      },
    ]);
    await authUsers().insertMany(
      [HISTORICAL_MEMBER, REPLACEMENT_MEMBER, UNRELATED_MEMBER].map((memberId) => syntheticUser(memberId)),
    );
  });

  it("activates the replacement member, preserves trusted publishing, and leaves everyone else untouched", async () => {
    await grants().insertOne({
      participantId: REPLACEMENT_MEMBER,
      capabilities: ["author_applicant"],
      updatedAt: "2026-01-01T00:00:00.000Z",
      publishWithoutManualReview: true,
    });
    const historicalGrant = await rawGrant(HISTORICAL_MEMBER);
    const unrelatedGrant = await rawGrant(UNRELATED_MEMBER);
    const usersBefore = await rawUsers();

    const tuple = await recoverOk();
    assert.equal((await linkFor())?.linkFinalization, "provisional");
    assert.equal(await grants().countDocuments({ capabilities: "author", participantId: REPLACEMENT_MEMBER }), 0);

    const acknowledged = await acknowledge(tuple);
    assert.equal(acknowledged.ok, true);
    assert.equal(acknowledged.ok && acknowledged.idempotent, false);

    const link = await linkFor();
    assert.equal(link?.linkFinalization, "confirmed");
    assert.equal(link?.memberId, REPLACEMENT_MEMBER);
    assert.equal(link?.authorActivationPending, false);

    const replacement = await grants().findOne({ participantId: REPLACEMENT_MEMBER }, { projection: { _id: 0 } });
    assert.deepEqual(replacement?.capabilities, ["author"]);
    assert.equal(replacement?.publishWithoutManualReview, true);
    assert.equal(await grants().countDocuments({ participantId: REPLACEMENT_MEMBER }), 1);

    assert.equal(await rawGrant(HISTORICAL_MEMBER), historicalGrant);
    assert.equal(await rawGrant(UNRELATED_MEMBER), unrelatedGrant);
    assert.deepEqual(await rawUsers(), usersBefore);
    assert.equal(await grants().countDocuments({}), 3);
  });

  it("does not newly grant trusted publishing or stronger capabilities", async () => {
    await grants().insertOne({
      participantId: REPLACEMENT_MEMBER,
      capabilities: ["author_applicant"],
      updatedAt: "2026-01-01T00:00:00.000Z",
    });

    assert.equal((await acknowledge(await recoverOk())).ok, true);
    const replacement = await grants().findOne({ participantId: REPLACEMENT_MEMBER }, { projection: { _id: 0 } });

    assert.deepEqual(replacement?.capabilities, ["author"]);
    assert.equal("publishWithoutManualReview" in (replacement ?? {}), false);
    assert.equal("administrativelyBlocked" in (replacement ?? {}), false);
  });

  it("creates exactly one grant for a replacement member who had none", async () => {
    assert.equal((await acknowledge(await recoverOk())).ok, true);
    const replacement = await grants().findOne({ participantId: REPLACEMENT_MEMBER }, { projection: { _id: 0 } });

    assert.deepEqual(replacement?.capabilities, ["author"]);
    assert.equal(await grants().countDocuments({ participantId: REPLACEMENT_MEMBER }), 1);
  });

  it("stays idempotent for repeated and concurrent acknowledgements", async () => {
    const tuple = await recoverOk();
    const linkAfterRecovery = await linkFor();
    const recoveryAudits = await audits().countDocuments({ action: "link_binding_recovered" });

    const first = await acknowledge(tuple);
    const grantAfterFirst = await rawGrant(REPLACEMENT_MEMBER);
    const repeated = await acknowledge(tuple);
    const concurrent = await Promise.all([acknowledge(tuple), acknowledge(tuple), acknowledge(tuple)]);

    assert.equal(first.ok && first.idempotent, false);
    for (const response of [repeated, ...concurrent]) {
      assert.equal(response.ok, true);
      assert.equal(response.ok && response.idempotent, true);
    }
    assert.equal(await rawGrant(REPLACEMENT_MEMBER), grantAfterFirst);
    assert.equal(await grants().countDocuments({ participantId: REPLACEMENT_MEMBER }), 1);
    const replacement = await grants().findOne({ participantId: REPLACEMENT_MEMBER });
    assert.equal(replacement?.capabilities.filter((capability: string) => capability === "author").length, 1);

    assert.equal(await audits().countDocuments({ action: "link_acknowledged" }), 1);
    assert.equal(await audits().countDocuments({ action: "author_capability_ensured" }), 1);
    assert.equal(await audits().countDocuments({ action: "link_binding_recovered" }), recoveryAudits);
    assert.equal(await receipts().countDocuments({}), 1);
    const link = await linkFor();
    assert.equal(link?.linkRevision, linkAfterRecovery?.linkRevision);
    assert.equal(link?.linkInstanceId, linkAfterRecovery?.linkInstanceId);
  });

  it("keeps one grant when concurrent first acknowledgements race to create it", async () => {
    const tuple = await recoverOk();
    const responses = await Promise.all([acknowledge(tuple), acknowledge(tuple), acknowledge(tuple)]);

    assert.ok(responses.every((response) => response.ok));
    assert.deepEqual(responses.map((response) => response.ok && response.idempotent).sort(), [false, true, true]);
    assert.equal(await grants().countDocuments({ participantId: REPLACEMENT_MEMBER }), 1);
    assert.deepEqual(
      (await grants().findOne({ participantId: REPLACEMENT_MEMBER }))?.capabilities,
      ["author"],
    );
  });

  it("recovers a failed capability write through the pending-author reconciler", async () => {
    await grants().insertOne({
      participantId: REPLACEMENT_MEMBER,
      capabilities: ["author_applicant"],
      updatedAt: "2026-01-01T00:00:00.000Z",
    });
    const tuple = await recoverOk();
    const grantBefore = await rawGrant(REPLACEMENT_MEMBER);
    const historicalGrant = await rawGrant(HISTORICAL_MEMBER);

    await rejectAllGrantWrites();
    const failed = await acknowledge(tuple);
    assert.equal(failed.ok, false);
    assert.equal(!failed.ok && failed.status, 503);
    assert.equal(!failed.ok && failed.code, "author_setup_pending");

    const pendingLink = await linkFor();
    assert.equal(pendingLink?.linkFinalization, "confirmed");
    assert.equal(pendingLink?.authorActivationPending, true);
    assert.equal(await rawGrant(REPLACEMENT_MEMBER), grantBefore);

    await removeGrantValidator();
    const later = new Date(Date.now() + 2 * 60 * 1000);
    const reconciled = await reconcilePendingIntegrityMediaAuthorActivations({ now: later });
    assert.deepEqual(reconciled, { examined: 1, recovered: 1, pending: 0 });

    const replacement = await grants().findOne({ participantId: REPLACEMENT_MEMBER }, { projection: { _id: 0 } });
    assert.deepEqual(replacement?.capabilities, ["author"]);
    const activeLink = await linkFor();
    assert.equal(activeLink?.authorActivationPending, false);
    assert.equal(activeLink?.memberId, REPLACEMENT_MEMBER);
    assert.equal(await rawGrant(HISTORICAL_MEMBER), historicalGrant);

    const grantAfter = await rawGrant(REPLACEMENT_MEMBER);
    const again = await reconcilePendingIntegrityMediaAuthorActivations({
      now: new Date(later.getTime() + 2 * 60 * 1000),
    });
    assert.deepEqual(again, { examined: 0, recovered: 0, pending: 0 });
    assert.equal(await rawGrant(REPLACEMENT_MEMBER), grantAfter);
    assert.equal(await grants().countDocuments({ participantId: REPLACEMENT_MEMBER }), 1);

    const retried = await acknowledge(tuple);
    assert.equal(retried.ok && retried.idempotent, true);
    assert.equal(await rawGrant(REPLACEMENT_MEMBER), grantAfter);
  });

  describe("historical activation already pending when recovery begins", () => {
    beforeEach(async () => {
      await links().updateOne(
        { externalAuthorId: AUTHOR },
        { $set: { authorActivationPending: true, authorActivationAttemptAt: "2026-01-01T00:00:00.000Z" } },
      );
      await grants().deleteOne({ participantId: HISTORICAL_MEMBER });
    });

    it("does not activate the historical member when the reconciler runs after recovery", async () => {
      const tuple = await recoverOk();
      const recoveredLink = await linkFor();
      assert.equal(recoveredLink?.authorActivationPending, true);

      const reconciled = await reconcilePendingIntegrityMediaAuthorActivations({
        now: new Date(Date.now() + 2 * 60 * 1000),
      });
      assert.deepEqual(reconciled, { examined: 0, recovered: 0, pending: 0 });
      assert.equal(await grants().countDocuments({ participantId: HISTORICAL_MEMBER }), 0);

      assert.equal((await acknowledge(tuple)).ok, true);
      assert.deepEqual((await grants().findOne({ participantId: REPLACEMENT_MEMBER }))?.capabilities, ["author"]);
      assert.equal((await linkFor())?.authorActivationPending, false);
      assert.equal(await grants().countDocuments({ participantId: HISTORICAL_MEMBER }), 0);
    });

    it("CHARACTERIZATION: an in-flight reconciler grants author to the historical member after recovery commits", async () => {
      let reachedEnsure!: () => void;
      const ensureReached = new Promise<void>((resolve) => {
        reachedEnsure = resolve;
      });
      let releaseEnsure!: () => void;
      const ensureReleased = new Promise<void>((resolve) => {
        releaseEnsure = resolve;
      });
      const ensuredFor: string[] = [];
      // Coordination only: pauses, then delegates to the real ensurer and repository.
      setIntegrityMediaAuthorCapabilityEnsurerForTests(async (participantId) => {
        ensuredFor.push(participantId);
        reachedEnsure();
        await ensureReleased;
        return ensureBlogAuthorCapability(participantId);
      });

      const inFlight = reconcilePendingIntegrityMediaAuthorActivations({
        now: new Date(Date.now() + 2 * 60 * 1000),
        limit: 1,
      });
      await withTimeout(ensureReached, "the reconciler did not reach the capability ensurer");
      assert.deepEqual(ensuredFor, [HISTORICAL_MEMBER]);

      const tuple = await recoverOk();
      assert.equal((await linkFor())?.memberId, REPLACEMENT_MEMBER);

      releaseEnsure();
      const reconciled = await inFlight;
      assert.deepEqual(reconciled, { examined: 1, recovered: 0, pending: 1 });

      // Observed: the stale pass completed activation for the previous member.
      assert.deepEqual((await grants().findOne({ participantId: HISTORICAL_MEMBER }))?.capabilities, ["author"]);
      const link = await linkFor();
      assert.equal(link?.memberId, REPLACEMENT_MEMBER);
      assert.equal(link?.linkFinalization, "provisional");
      assert.equal(link?.authorActivationPending, true);
      assert.equal(
        await audits().countDocuments({ action: "author_capability_ensured", memberId: HISTORICAL_MEMBER }),
        1,
      );

      // The replacement still activates normally through acknowledgement.
      setIntegrityMediaAuthorCapabilityEnsurerForTests(null);
      assert.equal((await acknowledge(tuple)).ok, true);
      assert.deepEqual((await grants().findOne({ participantId: REPLACEMENT_MEMBER }))?.capabilities, ["author"]);
      assert.equal((await linkFor())?.authorActivationPending, false);
    });
  });
});

function assertLocalReplSetUri(uri: string): void {
  assert.ok(uri.startsWith("mongodb://"), "Only a local mongodb:// URI is allowed.");
  const authority = uri.slice("mongodb://".length).split("/")[0] ?? "";
  assert.doesNotMatch(authority, /@/, "The local test URI must not carry credentials.");
  for (const host of authority.split(",")) {
    const name = host.startsWith("[") ? host.slice(0, host.indexOf("]") + 1) : host.split(":")[0]!;
    assert.ok(LOCAL_HOSTS.has(name), `Refusing a non-local MongoDB host: ${name}`);
  }
}

function links() {
  return getMongoCollection<ExternalAuthorLinkRecord>(MONGO_COLLECTIONS.externalAuthorLinks);
}

function results() {
  return getMongoCollection<ExternalAuthorLinkResultRecord>(MONGO_COLLECTIONS.externalAuthorLinkResults);
}

function receipts() {
  return getMongoCollection<Document>(MONGO_COLLECTIONS.externalAuthorLinkRecoveryReceipts);
}

function audits() {
  return getMongoCollection<Document>(MONGO_COLLECTIONS.externalAuthorLinkAudit);
}

function grants() {
  return getMongoCollection<Document>(MONGO_COLLECTIONS.blogCapabilityGrants);
}

function authUsers() {
  return getMongoCollection<Document>(MONGO_COLLECTIONS.authUsers);
}

/** Every grant write fails at the server while this validator is installed. */
async function rejectAllGrantWrites(): Promise<void> {
  await getMongoDatabase().command({
    collMod: MONGO_COLLECTIONS.blogCapabilityGrants,
    validator: { $expr: { $eq: [1, 0] } },
    validationLevel: "strict",
    validationAction: "error",
  });
}

async function removeGrantValidator(): Promise<void> {
  await getMongoDatabase().command({
    collMod: MONGO_COLLECTIONS.blogCapabilityGrants,
    validator: {},
    validationLevel: "strict",
    validationAction: "error",
  });
}

async function rawGrant(participantId: string): Promise<string | null> {
  const document = await grants().findOne({ participantId });
  return document ? JSON.stringify(document) : null;
}

async function rawUsers(): Promise<string[]> {
  return (await authUsers().find({}).toArray()).map((document) => JSON.stringify(document)).sort();
}

async function linkFor(): Promise<ExternalAuthorLinkRecord | null> {
  return links().findOne({ source: INTEGRITY_MEDIA_SOURCE, externalAuthorId: AUTHOR }, { projection: { _id: 0 } });
}

function historicalLink(): ExternalAuthorLinkRecord {
  return {
    source: INTEGRITY_MEDIA_SOURCE,
    externalAuthorId: AUTHOR,
    memberId: HISTORICAL_MEMBER,
    state: "linked",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-02T00:00:00.000Z",
    confirmedAt: "2026-01-02T00:00:00.000Z",
    disconnectedAt: null,
    collaborationStatus: "active",
    authorActivationPending: false,
    linkRevision: HISTORICAL_REVISION,
    linkInstanceId: HISTORICAL_INSTANCE,
    linkFinalization: "confirmed",
  };
}

function recoveryResult(): ExternalAuthorLinkResultRecord {
  return {
    resultCode: RESULT_CODE,
    source: INTEGRITY_MEDIA_SOURCE,
    attemptState: `hur1_capability_state_${RUN}`,
    memberId: REPLACEMENT_MEMBER,
    expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
    consumedAt: null,
    createdAt: new Date().toISOString(),
    purpose: "binding_recovery",
    externalAuthorId: AUTHOR,
    bindingRecoveryId: RECOVERY_ID,
    huTarget: "staging",
  };
}

function syntheticUser(memberId: string): Document {
  return {
    userId: `user-${memberId}`,
    email: `${memberId}@example.invalid`,
    passwordHash: "not-a-credential",
    displayName: "Synthetic Participant",
    role: "member",
    status: "active",
    memberId,
    emailVerificationStatus: "verified",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

function nextTimestamp(): string {
  timestampOffset += 1;
  return String(Math.floor(Date.now() / 1000) - (timestampOffset % 240));
}

async function recoverOk(): Promise<{ memberId: string; linkRevision: number; linkInstanceId: string }> {
  const body = {
    resultCode: RESULT_CODE,
    externalAuthorId: AUTHOR,
    huTarget: "staging",
    expectedHuMemberId: HISTORICAL_MEMBER,
    expectedHuLinkRevision: HISTORICAL_REVISION,
    expectedHuLinkInstanceId: HISTORICAL_INSTANCE,
    recoveryId: RECOVERY_ID,
  };
  const timestamp = nextTimestamp();
  const response = await redeemIntegrityMediaBindingRecovery({
    ...body,
    timestamp,
    signature: signIntegrityMediaLinkRedeem(SECRET, buildIntegrityMediaBindingRecoveryPayload({ timestamp, ...body })),
    secret: SECRET,
  });
  assert.equal(response.ok, true, JSON.stringify(response));
  assert.ok(response.ok);
  assert.equal(response.memberId, REPLACEMENT_MEMBER);
  return {
    memberId: response.memberId,
    linkRevision: response.linkRevision,
    linkInstanceId: response.linkInstanceId,
  };
}

async function acknowledge(tuple: { memberId: string; linkRevision: number; linkInstanceId: string }) {
  const eventId = randomUUID();
  const timestamp = nextTimestamp();
  return acknowledgeIntegrityMediaLink({
    eventId,
    externalAuthorId: AUTHOR,
    memberId: tuple.memberId,
    linkRevision: tuple.linkRevision,
    linkInstanceId: tuple.linkInstanceId,
    timestamp,
    signature: signIntegrityMediaLinkRedeem(
      SECRET,
      buildIntegrityMediaLinkAcknowledgePayload({ timestamp, eventId, externalAuthorId: AUTHOR, ...tuple }),
    ),
    secret: SECRET,
  });
}

async function withTimeout(promise: Promise<void>, message: string): Promise<void> {
  let timer: NodeJS.Timeout | undefined;
  try {
    await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(message)), 5_000);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
