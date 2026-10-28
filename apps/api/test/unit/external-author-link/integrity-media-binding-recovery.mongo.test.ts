/**
 * Workflow 09B — Binding Recovery against real MongoDB transactions.
 *
 * Starts a process-owned single-node MongoMemoryReplSet on 127.0.0.1 and
 * locks this test process to one hu_test_ database. Never reads MONGODB_URI
 * or MONGODB_DATABASE, never contacts an external server, and drops only
 * the database it created.
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
import { runMongoTransaction } from "../../../src/infrastructure/mongodb/mongo-transaction.js";
import {
  executeBindingRecovery,
  resolveAbortedBindingRecovery,
  setIntegrityMediaBindingRecoveryInterruptForTests,
  type BindingRecoveryApplyResult,
  type IntegrityMediaBindingRecoveryRequest,
} from "../../../src/modules/external-author-link/external-author-link.binding-recovery.js";
import { redeemIntegrityMediaBindingRecovery } from "../../../src/modules/external-author-link/external-author-link.binding-recovery.service.js";
import {
  INTEGRITY_MEDIA_BINDING_RECOVERY_ENABLED_ENV,
  INTEGRITY_MEDIA_LINK_HMAC_SECRET_ENV,
  INTEGRITY_MEDIA_SOURCE,
} from "../../../src/modules/external-author-link/external-author-link.constants.js";
import {
  buildIntegrityMediaBindingRecoveryPayload,
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
import {
  createMongoBindingRecoveryPersistence,
  createMongoExternalAuthorLinkStore,
  setExternalAuthorLinkStoreForTests,
  type ExternalAuthorLinkStore,
} from "../../../src/modules/external-author-link/external-author-link.store.js";
import type {
  ExternalAuthorLinkRecord,
  ExternalAuthorLinkResultRecord,
} from "../../../src/modules/external-author-link/external-author-link.types.js";

const RUN = randomBytes(4).toString("hex");
const DATABASE = `hu_test_br_${RUN}`;
const SECRET = `hu-binding-recovery-mongo-test-${RUN}`;
const LOCAL_HOSTS = new Set(["127.0.0.1", "localhost", "[::1]"]);

const AUTHOR = randomUUID();
const OTHER_AUTHOR = randomUUID();
const HISTORICAL_MEMBER = randomUUID();
const REPLACEMENT_MEMBER = randomUUID();
const OTHER_MEMBER = randomUUID();
const HISTORICAL_INSTANCE = randomUUID();
const OTHER_INSTANCE = randomUUID();
const HISTORICAL_REVISION = 4;
const RECOVERY_ID = `rcv_${RUN}_primary_0001`;
const RESULT_CODE = `mongoResultCode_${RUN}_0123456789abcdefABCD`;
const ENV_KEYS = [
  "NODE_TEST_ENV",
  "PLATFORM_MODE",
  INTEGRITY_MEDIA_LINK_HMAC_SECRET_ENV,
  INTEGRITY_MEDIA_BINDING_RECOVERY_ENABLED_ENV,
];

/** Set by the shared test setup only when MONGODB_URI was configured. This suite refuses that. */
const lockedBeforeThisSuite = getLockedMongoConfigForTests();

let replSet: MongoMemoryReplSet | null = null;
let store: ExternalAuthorLinkStore;
let connected = false;
let timestampOffset = 0;
const savedEnv = new Map<string, string | undefined>();

describe("real MongoDB Binding Recovery transactions", () => {
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

    setProvisionMemoryForTests(null);
    store = createMongoExternalAuthorLinkStore();
    setExternalAuthorLinkStoreForTests(store);
  });

  after(async () => {
    try {
      if (connected && getMongoDatabase().databaseName === DATABASE) {
        await getMongoDatabase().dropDatabase();
      }
    } finally {
      try {
        if (connected) {
          await disconnectMongoClient();
        }
      } finally {
        await replSet?.stop({ doCleanup: true });
        setExternalAuthorLinkStoreForTests(null);
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
    process.env.PLATFORM_MODE = "staging";
    setIntegrityMediaBindingRecoveryInterruptForTests(null);
    resetIntegrityMediaBindingRecoveryReplayCacheForTests();
    await Promise.all([
      links().deleteMany({}),
      results().deleteMany({}),
      receipts().deleteMany({}),
      audits().deleteMany({}),
    ]);
    await links().insertOne(confirmedLink());
    await results().insertOne(recoveryResult());
  });

  it("1. recovers a confirmed historical binding in one committed transaction", async () => {
    const response = await recover();

    assert.equal(response.ok, true);
    assert.ok(response.ok);
    assert.equal(response.memberId, REPLACEMENT_MEMBER);
    assert.equal(response.linkRevision, HISTORICAL_REVISION + 1);
    assert.notEqual(response.linkInstanceId, HISTORICAL_INSTANCE);
    assert.equal(response.replacedMemberId, HISTORICAL_MEMBER);
    assert.equal(response.replacedLinkRevision, HISTORICAL_REVISION);
    assert.equal(response.replacedLinkInstanceId, HISTORICAL_INSTANCE);

    const link = await linkFor(AUTHOR);
    assert.equal(link?.memberId, REPLACEMENT_MEMBER);
    assert.equal(link?.linkRevision, HISTORICAL_REVISION + 1);
    assert.equal(link?.linkInstanceId, response.linkInstanceId);
    assert.equal(link?.linkFinalization, "provisional");
    assert.equal(link?.state, "linked");
    assert.equal(link?.collaborationStatus, "active");
    assert.equal(link?.bindingRecoveryId, RECOVERY_ID);
    assert.equal(link?.bindingRecoveryReplacedMemberId, HISTORICAL_MEMBER);

    const receipt = await receipts().findOne({ recoveryId: RECOVERY_ID });
    assert.equal(receipt?.status, "completed");
    assert.equal(receipt?.outcome?.memberId, REPLACEMENT_MEMBER);
    const audit = await audits().findOne({ action: "link_binding_recovered", recoveryId: RECOVERY_ID });
    assert.equal(audit?.memberId, REPLACEMENT_MEMBER);
    assert.equal(audit?.replacedMemberId, HISTORICAL_MEMBER);
    assert.doesNotMatch(JSON.stringify(audit), new RegExp(RESULT_CODE));
  });

  it("2. keeps one receipt per recovery id under the unique index", async () => {
    assert.equal((await recover()).ok, true);
    const names = (await receipts().indexes()).map((index) => index.name);
    assert.ok(names.includes("external_author_link_recovery_receipts_recovery_id_unique"));

    const stored = await receipts().findOne({ recoveryId: RECOVERY_ID }, { projection: { _id: 0 } });
    await assert.rejects(receipts().insertOne({ ...stored! }), (error: unknown) => duplicateKey(error));
    assert.equal((await recover()).ok, true);
    assert.equal(await receipts().countDocuments({ recoveryId: RECOVERY_ID }), 1);
  });

  it("3. replaces the historical member atomically, including a unique-index race", async () => {
    assert.equal((await recover()).ok, true);
    assert.equal(await links().countDocuments({ source: INTEGRITY_MEDIA_SOURCE, memberId: HISTORICAL_MEMBER }), 0);
    assert.equal(await links().countDocuments({ source: INTEGRITY_MEDIA_SOURCE, memberId: REPLACEMENT_MEMBER }), 1);
    assert.equal(await links().countDocuments({ externalAuthorId: AUTHOR }), 1);

    // Two authors race to the same replacement member from separate "processes".
    await resetCollections();
    const secondInstance = randomUUID();
    await links().insertMany([
      confirmedLink(),
      confirmedLink({ externalAuthorId: OTHER_AUTHOR, memberId: OTHER_MEMBER, linkInstanceId: secondInstance }),
    ]);
    const otherRecoveryId = `rcv_${RUN}_race_member_02`;
    const otherCode = `mongoResultCode_${RUN}_race_member_ABCDEF`;
    await results().insertMany([
      recoveryResult(),
      recoveryResult({ resultCode: otherCode, externalAuthorId: OTHER_AUTHOR, bindingRecoveryId: otherRecoveryId }),
    ]);
    const outcomes = await Promise.all([
      applyAsSeparateProcess(request()),
      applyAsSeparateProcess(
        request({
          resultCode: otherCode,
          externalAuthorId: OTHER_AUTHOR,
          expectedHuMemberId: OTHER_MEMBER,
          expectedHuLinkInstanceId: secondInstance,
          recoveryId: otherRecoveryId,
        }),
      ),
    ]);

    const recovered = outcomes.filter((outcome) => outcome.kind === "recovered");
    const refused = outcomes.filter((outcome) => outcome.kind !== "recovered");
    assert.equal(recovered.length, 1);
    assert.deepEqual(refused, [{ kind: "rejected", code: "member_already_linked" }]);
    assert.equal(await links().countDocuments({ memberId: REPLACEMENT_MEMBER }), 1);

    const loserAuthor = outcomes[0]!.kind === "recovered" ? OTHER_AUTHOR : AUTHOR;
    const loserRecoveryId = loserAuthor === AUTHOR ? RECOVERY_ID : otherRecoveryId;
    const loserCode = loserAuthor === AUTHOR ? RESULT_CODE : otherCode;
    const loserLink = await linkFor(loserAuthor);
    assert.notEqual(loserLink?.memberId, REPLACEMENT_MEMBER);
    assert.equal(loserLink?.linkRevision, HISTORICAL_REVISION);
    assert.equal(loserLink?.linkFinalization, "confirmed");
    const loserResult = await results().findOne({ resultCode: loserCode });
    assert.equal(loserResult?.consumedAt, null);
    assert.equal(loserResult?.bindingRecoveryReservationId, undefined);
    assert.equal(await audits().countDocuments({ recoveryId: loserRecoveryId }), 0);
    assert.notEqual((await receipts().findOne({ recoveryId: loserRecoveryId }))?.status, "completed");
  });

  it("4. reserves and consumes the confirmation result in the same transaction", async () => {
    assert.equal((await recover()).ok, true);
    const stored = await results().findOne({ resultCode: RESULT_CODE });
    assert.equal(stored?.bindingRecoveryReservationId, RECOVERY_ID);
    assert.ok(stored?.consumedAt);

    const before = await results().findOne({ resultCode: RESULT_CODE }, { projection: { _id: 0 } });
    assert.deepEqual(await store.claimResult(RESULT_CODE, new Date().toISOString()), { status: "consumed" });
    assert.deepEqual(await results().findOne({ resultCode: RESULT_CODE }, { projection: { _id: 0 } }), before);
  });

  it("5. replays the same request idempotently, including a lost response", async () => {
    const timestamp = nextTimestamp();
    const first = await recover({}, { timestamp });
    const afterFirst = await snapshot();

    const repeated = await recover();
    resetIntegrityMediaBindingRecoveryReplayCacheForTests();
    const lostResponse = await recover({}, { timestamp });

    assert.deepEqual(repeated, first);
    assert.deepEqual(lostResponse, first);
    assert.deepEqual(await snapshot(), afterFirst);
  });

  it("6. rejects the same recovery id with a different request body", async () => {
    assert.equal((await recover()).ok, true);
    const before = await snapshot();
    const changed = await recover({ expectedHuLinkInstanceId: OTHER_INSTANCE });

    assert.deepEqual(failureOf(changed), [409, "recovery_conflict"]);
    assert.deepEqual(await snapshot(), before);
  });

  it("7. never commits two rebinds for concurrent requests", async () => {
    const secondId = `rcv_${RUN}_concurrent_002`;
    const secondCode = `mongoResultCode_${RUN}_concurrent_ABCDEF`;
    await results().insertOne(
      recoveryResult({ resultCode: secondCode, memberId: OTHER_MEMBER, bindingRecoveryId: secondId }),
    );

    // Through the service: one process, serialized by the link critical section.
    const viaService = await Promise.all([recover(), recover({ resultCode: secondCode, recoveryId: secondId })]);
    assert.deepEqual(viaService.map((response) => response.ok).sort(), [false, true]);
    assert.equal((await linkFor(AUTHOR))?.linkRevision, HISTORICAL_REVISION + 1);
    assert.equal(await audits().countDocuments({ action: "link_binding_recovered" }), 1);

    // Separate "processes": no shared in-process lock, only MongoDB transactions.
    await resetCollections();
    await links().insertOne(confirmedLink());
    await results().insertMany([
      recoveryResult(),
      recoveryResult({ resultCode: secondCode, memberId: OTHER_MEMBER, bindingRecoveryId: secondId }),
    ]);
    const differentIds = await Promise.all([
      applyAsSeparateProcess(request()),
      applyAsSeparateProcess(request({ resultCode: secondCode, recoveryId: secondId })),
    ]);
    assert.deepEqual(differentIds.map((outcome) => outcome.kind).sort(), ["recovered", "rejected"]);
    assert.equal((await linkFor(AUTHOR))?.linkRevision, HISTORICAL_REVISION + 1);
    assert.equal(await audits().countDocuments({ action: "link_binding_recovered" }), 1);

    await resetCollections();
    await links().insertOne(confirmedLink());
    await results().insertOne(recoveryResult());
    const sameId = await Promise.all([
      applyAsSeparateProcess(request()),
      applyAsSeparateProcess(request()),
      applyAsSeparateProcess(request()),
    ]);
    assert.ok(sameId.every((outcome) => outcome.kind === "recovered"));
    assert.deepEqual(sameId[1], sameId[0]);
    assert.deepEqual(sameId[2], sameId[0]);
    assert.equal((await linkFor(AUTHOR))?.linkRevision, HISTORICAL_REVISION + 1);
    assert.equal(await receipts().countDocuments({ recoveryId: RECOVERY_ID }), 1);
    assert.equal(await audits().countDocuments({ action: "link_binding_recovered" }), 1);
  });

  it("8. rolls back an interruption after the rebind and then resumes", async () => {
    const before = await snapshot();
    setIntegrityMediaBindingRecoveryInterruptForTests("after_rebind");
    const interrupted = await recover();

    assert.deepEqual(failureOf(interrupted), [503, "recovery_incomplete"]);
    assert.deepEqual(await snapshot(), before);

    setIntegrityMediaBindingRecoveryInterruptForTests(null);
    const resumed = await recover();
    assert.equal(resumed.ok, true);
    assert.equal((await linkFor(AUTHOR))?.memberId, REPLACEMENT_MEMBER);
    assert.equal(await audits().countDocuments({ action: "link_binding_recovered" }), 1);
  });

  it("9. rolls back an interruption after consumption and then resumes", async () => {
    const before = await snapshot();
    setIntegrityMediaBindingRecoveryInterruptForTests("after_consume");
    const interrupted = await recover();

    assert.deepEqual(failureOf(interrupted), [503, "recovery_incomplete"]);
    assert.deepEqual(await snapshot(), before);

    setIntegrityMediaBindingRecoveryInterruptForTests(null);
    const resumed = await recover();
    assert.equal(resumed.ok, true);
    assert.ok((await results().findOne({ resultCode: RESULT_CODE }))?.consumedAt);
    assert.equal(await audits().countDocuments({ action: "link_binding_recovered" }), 1);
  });

  it("10. rejects an expired unreserved result without consuming it", async () => {
    await results().updateOne({ resultCode: RESULT_CODE }, { $set: { expiresAt: pastIso() } });
    const response = await recover();

    assert.deepEqual(failureOf(response), [410, "result_expired"]);
    assert.equal((await linkFor(AUTHOR))?.memberId, HISTORICAL_MEMBER);
    const stored = await results().findOne({ resultCode: RESULT_CODE });
    assert.equal(stored?.consumedAt, null);
    assert.equal(stored?.bindingRecoveryReservationId, undefined);
    const receipt = await receipts().findOne({ recoveryId: RECOVERY_ID });
    assert.equal(receipt?.status, "rejected");
    assert.equal(receipt?.rejectionCode, "result_expired");
  });

  it("11. finishes with an expired result already reserved by the same recovery id", async () => {
    await results().updateOne(
      { resultCode: RESULT_CODE },
      { $set: { expiresAt: pastIso(), bindingRecoveryReservationId: RECOVERY_ID } },
    );
    const response = await recover();

    assert.equal(response.ok, true);
    assert.ok((await results().findOne({ resultCode: RESULT_CODE }))?.consumedAt);

    await resetCollections();
    await links().insertOne(confirmedLink());
    await results().insertOne(
      recoveryResult({ expiresAt: pastIso(), bindingRecoveryReservationId: `rcv_${RUN}_someone_else_01` }),
    );
    resetIntegrityMediaBindingRecoveryReplayCacheForTests();
    assert.deepEqual(failureOf(await recover()), [409, "result_already_used"]);
    assert.equal((await linkFor(AUTHOR))?.memberId, HISTORICAL_MEMBER);
  });

  it("12. replays a completed receipt after the result expired", async () => {
    const first = await recover();
    await results().updateOne({ resultCode: RESULT_CODE }, { $set: { expiresAt: pastIso() } });
    resetIntegrityMediaBindingRecoveryReplayCacheForTests();
    const replay = await recover();

    assert.deepEqual(replay, first);
    assert.equal(await audits().countDocuments({ action: "link_binding_recovered" }), 1);
  });

  it("13. rejects a wrong destination without mutation", async () => {
    const before = await snapshot();
    const production = await recover({ huTarget: "production" });
    assert.deepEqual(failureOf(production), [409, "environment_rejected"]);
    assert.deepEqual(await snapshot(), before);

    await results().updateOne({ resultCode: RESULT_CODE }, { $set: { huTarget: "production" } });
    const boundElsewhere = await recover();
    assert.deepEqual(failureOf(boundElsewhere), [409, "result_recovery_mismatch"]);
    assert.equal((await linkFor(AUTHOR))?.memberId, HISTORICAL_MEMBER);
    assert.equal((await results().findOne({ resultCode: RESULT_CODE }))?.consumedAt, null);
  });

  it("14. causes no mutation while recovery is disabled", async () => {
    const before = await snapshot();
    for (const value of [undefined, "false", "TRUE"]) {
      if (value === undefined) {
        delete process.env[INTEGRITY_MEDIA_BINDING_RECOVERY_ENABLED_ENV];
      } else {
        process.env[INTEGRITY_MEDIA_BINDING_RECOVERY_ENABLED_ENV] = value;
      }
      assert.deepEqual(failureOf(await recover()), [503, "binding_recovery_disabled"]);
    }
    assert.deepEqual(await snapshot(), before);
  });

  it("15. writes no duplicate audit or receipt records", async () => {
    const timestamp = nextTimestamp();
    await recover({}, { timestamp });
    await recover();
    resetIntegrityMediaBindingRecoveryReplayCacheForTests();
    await recover({}, { timestamp });
    await Promise.all([applyAsSeparateProcess(request()), applyAsSeparateProcess(request())]);
    setIntegrityMediaBindingRecoveryInterruptForTests("after_consume");
    await recover();
    setIntegrityMediaBindingRecoveryInterruptForTests(null);

    assert.equal(await receipts().countDocuments({}), 1);
    assert.equal(await audits().countDocuments({ action: "link_binding_recovered" }), 1);
    assert.equal(await links().countDocuments({}), 1);
    assert.equal((await linkFor(AUTHOR))?.linkRevision, HISTORICAL_REVISION + 1);
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

async function resetCollections(): Promise<void> {
  resetIntegrityMediaBindingRecoveryReplayCacheForTests();
  await Promise.all([
    links().deleteMany({}),
    results().deleteMany({}),
    receipts().deleteMany({}),
    audits().deleteMany({}),
  ]);
}

async function snapshot() {
  const read = async (collection: ReturnType<typeof receipts>) =>
    (await collection.find({}, { projection: { _id: 0 } }).toArray()).map((doc) => JSON.stringify(doc)).sort();
  return {
    links: await read(links() as unknown as ReturnType<typeof receipts>),
    results: await read(results() as unknown as ReturnType<typeof receipts>),
    receipts: await read(receipts()),
    audits: await read(audits()),
  };
}

async function linkFor(externalAuthorId: string): Promise<ExternalAuthorLinkRecord | null> {
  return links().findOne({ source: INTEGRITY_MEDIA_SOURCE, externalAuthorId }, { projection: { _id: 0 } });
}

function confirmedLink(overrides: Partial<ExternalAuthorLinkRecord> = {}): ExternalAuthorLinkRecord {
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
    ...overrides,
  };
}

function recoveryResult(overrides: Partial<ExternalAuthorLinkResultRecord> = {}): ExternalAuthorLinkResultRecord {
  return {
    resultCode: RESULT_CODE,
    source: INTEGRITY_MEDIA_SOURCE,
    attemptState: `hur1_mongo_state_${RUN}`,
    memberId: REPLACEMENT_MEMBER,
    expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
    consumedAt: null,
    createdAt: new Date().toISOString(),
    purpose: "binding_recovery",
    externalAuthorId: AUTHOR,
    bindingRecoveryId: RECOVERY_ID,
    huTarget: "staging",
    ...overrides,
  };
}

function request(
  overrides: Partial<IntegrityMediaBindingRecoveryRequest> = {},
): IntegrityMediaBindingRecoveryRequest {
  return {
    resultCode: RESULT_CODE,
    externalAuthorId: AUTHOR,
    huTarget: "staging",
    expectedHuMemberId: HISTORICAL_MEMBER,
    expectedHuLinkRevision: HISTORICAL_REVISION,
    expectedHuLinkInstanceId: HISTORICAL_INSTANCE,
    recoveryId: RECOVERY_ID,
    ...overrides,
  };
}

/** Each call gets a distinct signature unless a timestamp is reused on purpose. */
function nextTimestamp(): string {
  timestampOffset += 1;
  return String(Math.floor(Date.now() / 1000) - (timestampOffset % 240));
}

async function recover(
  overrides: Partial<IntegrityMediaBindingRecoveryRequest> = {},
  options: { timestamp?: string } = {},
) {
  const body = request(overrides);
  const timestamp = options.timestamp ?? nextTimestamp();
  return redeemIntegrityMediaBindingRecovery({
    ...body,
    timestamp,
    signature: signIntegrityMediaLinkRedeem(
      SECRET,
      buildIntegrityMediaBindingRecoveryPayload({ timestamp, ...body }),
    ),
    secret: SECRET,
  });
}

/**
 * The Mongo store's recovery path without the in-process critical section,
 * as a second API instance would run it: one transaction, then a read-only
 * interpretation of a duplicate key.
 */
async function applyAsSeparateProcess(
  body: IntegrityMediaBindingRecoveryRequest,
): Promise<BindingRecoveryApplyResult> {
  const input = { request: body, provisionAuthorId: null, now: new Date() };
  try {
    return await runMongoTransaction((session) =>
      executeBindingRecovery(createMongoBindingRecoveryPersistence(session), input),
    );
  } catch (error) {
    return resolveAbortedBindingRecovery({
      error,
      request: body,
      readCommittedReceipt: async () => {
        const document = await receipts().findOne({ recoveryId: body.recoveryId }, { projection: { _id: 0 } });
        return document as never;
      },
    });
  }
}

function failureOf(response: Awaited<ReturnType<typeof recover>>): [number, string] | null {
  return response.ok ? null : [response.status, response.code];
}

function pastIso(): string {
  return new Date(Date.now() - 60_000).toISOString();
}

function duplicateKey(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: unknown }).code === 11000;
}
