/**
 * Workflow 09I — author reply vs. disconnect and Binding Recovery on real MongoDB.
 *
 * Same isolation as Workflow 09B: a process-owned single-node MongoMemoryReplSet
 * on 127.0.0.1 and one hu_test_ database. The competing disconnect, recovery,
 * or reply runs in a separate Node process, so the in-process link critical
 * section cannot serialize it; only MongoDB can.
 */
import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import path from "node:path";
import { after, before, beforeEach, describe, it } from "node:test";
import { fileURLToPath } from "node:url";

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
import {
  INTEGRITY_MEDIA_BINDING_RECOVERY_ENABLED_ENV,
  INTEGRITY_MEDIA_LINK_HMAC_SECRET_ENV,
  INTEGRITY_MEDIA_SOURCE,
} from "../../../src/modules/external-author-link/external-author-link.constants.js";
import {
  buildIntegrityMediaLinkAcknowledgePayload,
  resetIntegrityMediaAcknowledgeReplayCacheForTests,
  signIntegrityMediaLinkRedeem,
} from "../../../src/modules/external-author-link/external-author-link.hmac.js";
import {
  EXTERNAL_AUTHOR_LINK_AUDIT_INDEXES,
  EXTERNAL_AUTHOR_LINK_INDEXES,
  EXTERNAL_AUTHOR_LINK_RECOVERY_RECEIPT_INDEXES,
  EXTERNAL_AUTHOR_LINK_RESULT_INDEXES,
} from "../../../src/modules/external-author-link/external-author-link.indexes.js";
import { setProvisionMemoryForTests } from "../../../src/modules/external-author-link/external-author-link.provision.database.js";
import { acknowledgeIntegrityMediaLink } from "../../../src/modules/external-author-link/external-author-link.service.js";
import { externalAuthorLinkStoreUsesOverride } from "../../../src/modules/external-author-link/external-author-link.store.js";
import type {
  ExternalAuthorLinkRecord,
  ExternalAuthorLinkResultRecord,
} from "../../../src/modules/external-author-link/external-author-link.types.js";
import {
  INTEGRITY_MEDIA_AUTHOR_MESSAGE_AUDIT_INDEXES,
  INTEGRITY_MEDIA_AUTHOR_MESSAGE_INDEXES,
} from "../../../src/modules/integrity-media-author-messages/integrity-media-author-message.indexes.js";
import {
  createMongoIntegrityMediaAuthorMessageStore,
  setIntegrityMediaAuthorMessageStoreForTests,
} from "../../../src/modules/integrity-media-author-messages/integrity-media-author-message.store.js";
import type { IntegrityMediaAuthorMessageRecord } from "../../../src/modules/integrity-media-author-messages/integrity-media-author-message.types.js";
import {
  buildIntegrityMediaAuthorReplyCanonical,
  hashIntegrityMediaAuthorReplyContent,
  resetIntegrityMediaAuthorReplyReplayCacheForTests,
  signIntegrityMediaAuthorReply,
} from "../../../src/modules/integrity-media-author-messages/integrity-media-author-reply.hmac.js";
import { acceptIntegrityMediaAuthorReply } from "../../../src/modules/integrity-media-author-messages/integrity-media-author-reply.service.js";

const RUN = randomBytes(4).toString("hex");
const DATABASE = `hu_test_reply_${RUN}`;
const SECRET = `hu-author-reply-mongo-test-${RUN}`;
const LOCAL_HOSTS = new Set(["127.0.0.1", "localhost", "[::1]"]);
const API_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const CHILD_SCRIPT = path.join(API_ROOT, "test/helpers/integrity-media-link-concurrency.child.ts");
const HOLD_WINDOW_MS = 800;

const AUTHOR = randomUUID();
const MEMBER = randomUUID();
const REPLACEMENT_MEMBER = randomUUID();
const ADMIN_MEMBER = randomUUID();
const INSTANCE = randomUUID();
const REVISION = 4;
const OUTBOUND_MESSAGE = randomUUID();
const RECOVERY_ID = `rcv_${RUN}_reply_race_01`;
const RESULT_CODE = `replyResultCode_${RUN}_0123456789abcdefABCD`;
const ENV_KEYS = [
  "NODE_TEST_ENV",
  "PLATFORM_MODE",
  INTEGRITY_MEDIA_LINK_HMAC_SECRET_ENV,
  INTEGRITY_MEDIA_BINDING_RECOVERY_ENABLED_ENV,
];

const lockedBeforeThisSuite = getLockedMongoConfigForTests();

interface Gate {
  reached: Promise<void>;
  released: Promise<void>;
  release(): void;
  reach(): void;
}

let replSet: MongoMemoryReplSet | null = null;
let uri = "";
let connected = false;
let insertGate: Gate | null = null;
let replyTargetGate: Gate | null = null;
let timestampOffset = 0;
const children = new Set<ChildProcess>();
const savedEnv = new Map<string, string | undefined>();

describe("author reply concurrency on real MongoDB", () => {
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
    uri = replSet.getUri(DATABASE);
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
    await linkAudits().createIndexes(EXTERNAL_AUTHOR_LINK_AUDIT_INDEXES);
    await messages().createIndexes(INTEGRITY_MEDIA_AUTHOR_MESSAGE_INDEXES);
    await messageAudits().createIndexes(INTEGRITY_MEDIA_AUTHOR_MESSAGE_AUDIT_INDEXES);
    await grants().createIndex(
      { participantId: 1 },
      { unique: true, name: "blog_capability_grants_participant_unique" },
    );

    setProvisionMemoryForTests(null);
    // The reply path uses a Mongo transaction only when the link store is not overridden.
    assert.equal(externalAuthorLinkStoreUsesOverride(), false);
    const realMessages = createMongoIntegrityMediaAuthorMessageStore();
    // Coordination only: optional pauses, then delegation to the real Mongo message store.
    setIntegrityMediaAuthorMessageStoreForTests({
      ...realMessages,
      async findByMessageId(messageId, options) {
        const gate = replyTargetGate;
        if (gate && messageId === OUTBOUND_MESSAGE) {
          replyTargetGate = null;
          gate.reach();
          await gate.released;
        }
        return realMessages.findByMessageId(messageId, options);
      },
      async insert(record, options) {
        const gate = insertGate;
        if (gate && record.direction === "im_to_hu") {
          insertGate = null;
          gate.reach();
          await gate.released;
        }
        return realMessages.insert(record, options);
      },
    });
  });

  after(async () => {
    for (const child of children) {
      child.kill("SIGKILL");
    }
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
        setIntegrityMediaAuthorMessageStoreForTests(null);
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
    insertGate = null;
    replyTargetGate = null;
    resetIntegrityMediaAuthorReplyReplayCacheForTests();
    resetIntegrityMediaAcknowledgeReplayCacheForTests();
    await Promise.all(
      [links(), results(), receipts(), linkAudits(), messages(), messageAudits(), grants()].map((collection) =>
        collection.deleteMany({}),
      ),
    );
    await links().insertOne(confirmedLink());
    await messages().insertOne(outboundMessage());
  });

  it("A. waits for a reply that holds the link before a separate-process disconnect commits", async () => {
    insertGate = gate();
    const replyGate = insertGate;
    const reply = sendReply();
    const disconnect = await raceGuard(replyGate, reply, async () => {
      await withTimeout(replyGate.reached, "the reply did not reach its insert");
      const started = startChild({
        op: "disconnect",
        externalAuthorId: AUTHOR,
        memberId: MEMBER,
        linkRevision: REVISION,
      });
      await started.ready;
      await sleep(HOLD_WINDOW_MS);
      assert.equal(started.settled(), false, "disconnect committed underneath the reply transaction");
      assert.equal((await linkFor())?.state, "linked");
      return started;
    });

    const accepted = await reply;
    assert.equal(accepted.ok, true, JSON.stringify(accepted));
    assert.equal(accepted.ok && accepted.memberId, MEMBER);
    assert.equal(await disconnect.result, "disabled");

    const link = await linkFor();
    assert.equal(link?.state, "disabled");
    const inbound = await inboundMessages();
    assert.equal(inbound.length, 1);
    assert.equal(inbound[0]?.recipientMemberId, MEMBER);
    assert.equal(inbound[0]?.linkRevision, REVISION);
  });

  it("B. rejects a reply whose hold comes after a separate-process disconnect committed", async () => {
    replyTargetGate = gate();
    const targetGate = replyTargetGate;
    const reply = sendReply({ replyToMessageId: OUTBOUND_MESSAGE });
    await raceGuard(targetGate, reply, async () => {
      await withTimeout(targetGate.reached, "the reply did not reach its reply-target check");
      const disconnect = startChild({
        op: "disconnect",
        externalAuthorId: AUTHOR,
        memberId: MEMBER,
        linkRevision: REVISION,
      });
      assert.equal(await disconnect.result, "disabled");
      assert.equal((await linkFor())?.state, "disabled");
      return disconnect;
    });

    const rejected = await reply;
    assert.equal(rejected.ok, false);
    assert.equal(!rejected.ok && rejected.status, 409);
    assert.equal(!rejected.ok && rejected.code, "link_disabled");
    assert.equal((await inboundMessages()).length, 0);
    assert.equal(
      await messageAudits().countDocuments({
        action: "integrity_media_author_reply_rejected",
        reason: "link_disabled",
      }),
      1,
    );

    resetIntegrityMediaAuthorReplyReplayCacheForTests();
    const afterwards = await sendReply();
    assert.equal(!afterwards.ok && afterwards.code, "link_disabled");
    assert.equal((await inboundMessages()).length, 0);
  });

  it("C. waits for a reply that holds the link before a separate-process recovery commits", async () => {
    await results().insertOne(recoveryResult());
    insertGate = gate();
    const replyGate = insertGate;
    const reply = sendReply();
    const recovery = await raceGuard(replyGate, reply, async () => {
      await withTimeout(replyGate.reached, "the reply did not reach its insert");
      const started = startChild({ op: "recover", secret: SECRET, request: recoveryRequest() });
      await started.ready;
      await sleep(HOLD_WINDOW_MS);
      assert.equal(started.settled(), false, "recovery committed underneath the reply transaction");
      assert.equal((await linkFor())?.memberId, MEMBER);
      return started;
    });

    const accepted = await reply;
    assert.equal(accepted.ok, true, JSON.stringify(accepted));
    const recovered = (await recovery.result) as { ok: boolean; memberId?: string };
    assert.equal(recovered.ok, true, JSON.stringify(recovered));
    assert.equal(recovered.memberId, REPLACEMENT_MEMBER);

    const link = await linkFor();
    assert.equal(link?.memberId, REPLACEMENT_MEMBER);
    assert.equal(link?.linkRevision, REVISION + 1);
    assert.equal(await receipts().countDocuments({ status: "completed" }), 1);
    assert.equal(await linkAudits().countDocuments({ action: "link_binding_recovered" }), 1);

    const inbound = await inboundMessages();
    assert.equal(inbound.length, 1);
    assert.equal(inbound[0]?.recipientMemberId, MEMBER);
    assert.equal(inbound[0]?.linkRevision, REVISION);
    assert.equal(await messages().countDocuments({ recipientMemberId: REPLACEMENT_MEMBER }), 0);
  });

  it("D. rejects a reply whose hold comes after a separate-process recovery committed", async () => {
    await results().insertOne(recoveryResult());
    replyTargetGate = gate();
    const targetGate = replyTargetGate;
    const reply = sendReply({ replyToMessageId: OUTBOUND_MESSAGE });
    await raceGuard(targetGate, reply, async () => {
      await withTimeout(targetGate.reached, "the reply did not reach its reply-target check");
      const recovery = startChild({ op: "recover", secret: SECRET, request: recoveryRequest() });
      const recovered = (await recovery.result) as { ok: boolean };
      assert.equal(recovered.ok, true, JSON.stringify(recovered));
      assert.equal((await linkFor())?.memberId, REPLACEMENT_MEMBER);
      return recovery;
    });

    const rejected = await reply;
    assert.equal(rejected.ok, false);
    assert.equal(!rejected.ok && rejected.code, "member_mismatch");
    assert.equal((await inboundMessages()).length, 0);
    assert.equal(
      await messageAudits().countDocuments({
        action: "integrity_media_author_reply_rejected",
        reason: "member_mismatch",
      }),
      1,
    );
  });

  it("keeps an identical message id idempotent without a second hold", async () => {
    const messageId = randomUUID();
    const first = await sendReply({ messageId });
    const repeated = await sendReply({ messageId });

    assert.equal(first.ok && first.idempotent, false);
    assert.equal(repeated.ok && repeated.idempotent, true);
    assert.equal((await inboundMessages()).length, 1);
    assert.equal((await linkFor())?.linkWriteGuard, 1);
  });

  it("accepts concurrent replies for one author, including from a separate process", async () => {
    const inProcess = await Promise.all([sendReply(), sendReply(), sendReply()]);
    assert.ok(inProcess.every((response) => response.ok));

    insertGate = gate();
    const replyGate = insertGate;
    const reply = sendReply();
    const other = await raceGuard(replyGate, reply, async () => {
      await withTimeout(replyGate.reached, "the reply did not reach its insert");
      const started = startChild({
        op: "reply",
        secret: SECRET,
        authorId: AUTHOR,
        memberId: MEMBER,
        linkRevision: REVISION,
        body: "Reply from a second API process.",
      });
      await started.ready;
      await sleep(HOLD_WINDOW_MS);
      assert.equal(started.settled(), false, "the second process wrote the link underneath the first reply");
      return started;
    });

    assert.equal((await reply).ok, true);
    const otherResult = (await other.result) as { ok: boolean; idempotent?: boolean };
    assert.equal(otherResult.ok, true, JSON.stringify(otherResult));
    assert.equal(otherResult.idempotent, false);

    assert.equal((await inboundMessages()).length, 5);
    assert.equal((await linkFor())?.linkWriteGuard, 5);
  });

  it("rejects a stale revision and accepts the current revision after reconnect", async () => {
    const stale = await sendReply({ linkRevision: REVISION - 1 });
    assert.equal(!stale.ok && stale.code, "revision_conflict");

    await links().updateOne(
      { externalAuthorId: AUTHOR },
      { $set: { state: "disabled", disconnectedAt: new Date().toISOString() } },
    );
    const disabled = await sendReply();
    assert.equal(!disabled.ok && disabled.code, "link_disabled");

    await links().updateOne(
      { externalAuthorId: AUTHOR },
      { $set: { state: "linked", disconnectedAt: null, linkRevision: REVISION + 1, linkInstanceId: randomUUID() } },
    );
    const previous = await sendReply();
    assert.equal(!previous.ok && previous.code, "revision_conflict");
    const current = await sendReply({ linkRevision: REVISION + 1 });
    assert.equal(current.ok, true, JSON.stringify(current));
    assert.equal((await inboundMessages()).length, 1);
    assert.equal((await inboundMessages())[0]?.linkRevision, REVISION + 1);
  });

  it("stays compatible with acknowledgement of a provisional link", async () => {
    const instance = randomUUID();
    await links().updateOne(
      { externalAuthorId: AUTHOR },
      { $set: { linkFinalization: "provisional", linkInstanceId: instance } },
    );
    const beforeAcknowledgement = await sendReply();
    assert.equal(!beforeAcknowledgement.ok && beforeAcknowledgement.code, "author_activation_pending");

    const acknowledged = await acknowledge(instance);
    assert.equal(acknowledged.ok, true, JSON.stringify(acknowledged));
    assert.equal((await linkFor())?.linkFinalization, "confirmed");
    assert.deepEqual((await grants().findOne({ participantId: MEMBER }))?.capabilities, ["author"]);

    const accepted = await sendReply();
    assert.equal(accepted.ok, true, JSON.stringify(accepted));
    const repeated = await acknowledge(instance);
    assert.equal(repeated.ok && repeated.idempotent, true);
    assert.equal((await linkFor())?.linkFinalization, "confirmed");
  });
});

function assertLocalReplSetUri(value: string): void {
  assert.ok(value.startsWith("mongodb://"), "Only a local mongodb:// URI is allowed.");
  const authority = value.slice("mongodb://".length).split("/")[0] ?? "";
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

function linkAudits() {
  return getMongoCollection<Document>(MONGO_COLLECTIONS.externalAuthorLinkAudit);
}

function messages() {
  return getMongoCollection<IntegrityMediaAuthorMessageRecord>(MONGO_COLLECTIONS.integrityMediaAuthorMessages);
}

function messageAudits() {
  return getMongoCollection<Document>(MONGO_COLLECTIONS.integrityMediaAuthorMessageAudit);
}

function grants() {
  return getMongoCollection<Document>(MONGO_COLLECTIONS.blogCapabilityGrants);
}

async function linkFor(): Promise<ExternalAuthorLinkRecord | null> {
  return links().findOne({ source: INTEGRITY_MEDIA_SOURCE, externalAuthorId: AUTHOR }, { projection: { _id: 0 } });
}

async function inboundMessages(): Promise<IntegrityMediaAuthorMessageRecord[]> {
  return messages().find({ direction: "im_to_hu" }, { projection: { _id: 0 } }).toArray();
}

function confirmedLink(): ExternalAuthorLinkRecord {
  return {
    source: INTEGRITY_MEDIA_SOURCE,
    externalAuthorId: AUTHOR,
    memberId: MEMBER,
    state: "linked",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-02T00:00:00.000Z",
    confirmedAt: "2026-01-02T00:00:00.000Z",
    disconnectedAt: null,
    collaborationStatus: "active",
    authorActivationPending: false,
    linkRevision: REVISION,
    linkInstanceId: INSTANCE,
    linkFinalization: "confirmed",
  };
}

function outboundMessage(): IntegrityMediaAuthorMessageRecord {
  const now = "2026-01-03T00:00:00.000Z";
  return {
    messageId: OUTBOUND_MESSAGE,
    destination: INTEGRITY_MEDIA_SOURCE,
    actorMemberId: ADMIN_MEMBER,
    recipientMemberId: MEMBER,
    recipientExternalAuthorId: AUTHOR,
    direction: "hu_to_im",
    kind: "chat",
    category: "notification",
    title: "",
    body: "Outbound message before the race.",
    cta: null,
    linkRevision: REVISION,
    status: "delivered",
    attemptCount: 1,
    lastAttemptAt: now,
    nextAttemptAt: null,
    deliveredAt: now,
    lastErrorCode: null,
    createdAt: now,
    updatedAt: now,
  };
}

function recoveryResult(): ExternalAuthorLinkResultRecord {
  return {
    resultCode: RESULT_CODE,
    source: INTEGRITY_MEDIA_SOURCE,
    attemptState: `hur1_reply_state_${RUN}`,
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

function recoveryRequest() {
  return {
    resultCode: RESULT_CODE,
    externalAuthorId: AUTHOR,
    huTarget: "staging",
    expectedHuMemberId: MEMBER,
    expectedHuLinkRevision: REVISION,
    expectedHuLinkInstanceId: INSTANCE,
    recoveryId: RECOVERY_ID,
  };
}

function nextTimestamp(): string {
  timestampOffset += 1;
  return String(Math.floor(Date.now() / 1000) - (timestampOffset % 240));
}

async function sendReply(
  overrides: { messageId?: string; linkRevision?: number; replyToMessageId?: string } = {},
) {
  const messageId = overrides.messageId ?? randomUUID();
  const linkRevision = overrides.linkRevision ?? REVISION;
  const replyToMessageId = overrides.replyToMessageId ?? "";
  const body = "A reply from the Integrity Media author.";
  const timestamp = nextTimestamp();
  const signature = signIntegrityMediaAuthorReply(
    SECRET,
    buildIntegrityMediaAuthorReplyCanonical({
      timestamp,
      messageId,
      authorId: AUTHOR,
      memberId: MEMBER,
      linkRevision,
      replyToMessageId,
      contentSha256: hashIntegrityMediaAuthorReplyContent(body),
    }),
  );
  return acceptIntegrityMediaAuthorReply({
    messageId,
    authorId: AUTHOR,
    memberId: MEMBER,
    linkRevision,
    ...(replyToMessageId ? { replyToMessageId } : {}),
    body,
    timestamp,
    signature,
    secret: SECRET,
  });
}

async function acknowledge(instance: string) {
  const eventId = randomUUID();
  const timestamp = nextTimestamp();
  return acknowledgeIntegrityMediaLink({
    eventId,
    externalAuthorId: AUTHOR,
    memberId: MEMBER,
    linkRevision: REVISION,
    linkInstanceId: instance,
    timestamp,
    signature: signIntegrityMediaLinkRedeem(
      SECRET,
      buildIntegrityMediaLinkAcknowledgePayload({
        timestamp,
        eventId,
        externalAuthorId: AUTHOR,
        memberId: MEMBER,
        linkRevision: REVISION,
        linkInstanceId: instance,
      }),
    ),
    secret: SECRET,
  });
}

/**
 * Runs the coordinated part of a race. The paused reply is always released,
 * and on failure the reply and any child are settled before the next test,
 * so a failed assertion cannot leave the in-process lock held.
 */
async function raceGuard<T extends { result: Promise<unknown> }>(
  pause: Gate,
  reply: Promise<unknown>,
  body: () => Promise<T>,
): Promise<T> {
  let started: T | undefined;
  try {
    started = await body();
    return started;
  } catch (error) {
    pause.release();
    await Promise.allSettled([reply, started?.result ?? Promise.resolve()]);
    await waitForChildren();
    throw error;
  } finally {
    insertGate = null;
    replyTargetGate = null;
    pause.release();
  }
}

async function waitForChildren(): Promise<void> {
  await Promise.all(
    [...children].map(
      (child) =>
        new Promise<void>((resolve) => {
          if (child.exitCode !== null) {
            resolve();
            return;
          }
          child.once("exit", () => resolve());
          setTimeout(() => {
            child.kill("SIGKILL");
            resolve();
          }, 15_000);
        }),
    ),
  );
}

function gate(): Gate {
  let reach!: () => void;
  const reached = new Promise<void>((resolve) => {
    reach = resolve;
  });
  let release!: () => void;
  const released = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { reached, released, release, reach };
}

/** A separate Node process running one real store or service operation against the same replica set. */
function startChild(command: Record<string, unknown>): {
  ready: Promise<void>;
  result: Promise<unknown>;
  settled(): boolean;
} {
  const child = spawn(
    process.execPath,
    ["--import", "tsx", CHILD_SCRIPT, JSON.stringify({ ...command, uri, database: DATABASE })],
    { cwd: API_ROOT, env: { PATH: process.env.PATH ?? "", NODE_TEST_ENV: "true" } },
  );
  children.add(child);
  let settled = false;
  let stdout = "";
  let stderr = "";
  let resolveReady!: () => void;
  const ready = new Promise<void>((resolve) => {
    resolveReady = resolve;
  });
  const result = new Promise<unknown>((resolve, reject) => {
    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
      if (stdout.includes("READY\n")) {
        resolveReady();
      }
      const match = /RESULT (.*)\n/.exec(stdout);
      if (match && !settled) {
        settled = true;
        resolve(JSON.parse(match[1]!));
      }
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    child.on("exit", (code) => {
      children.delete(child);
      if (!settled) {
        settled = true;
        reject(new Error(`child exited ${code} without a result: ${stderr.slice(-2000)}`));
      }
    });
  });
  return {
    ready: withTimeout(ready, "the child process did not become ready", 20_000),
    result,
    settled: () => settled,
  };
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function withTimeout(promise: Promise<void>, message: string, ms = 10_000): Promise<void> {
  let timer: NodeJS.Timeout | undefined;
  try {
    await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(message)), ms);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
