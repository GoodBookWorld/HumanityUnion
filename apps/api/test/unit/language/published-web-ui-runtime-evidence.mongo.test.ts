/**
 * HU-MEM-14C.1B — evidence aggregation against an isolated MongoDB.
 * Compares the aggregation count with the JSON predicate the public route serves.
 */
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { after, before, beforeEach, describe, it } from "node:test";

import {
  Binary,
  BSONRegExp,
  Code,
  Decimal128,
  Double,
  Int32,
  Long,
  MaxKey,
  MinKey,
  ObjectId,
  Timestamp,
  type Document,
} from "mongodb";
import { MongoMemoryReplSet } from "mongodb-memory-server-core";

import {
  assertExplicitIsolatedMongoTestTarget,
  lockExplicitIsolatedMongoTestConfig,
} from "../../../src/infrastructure/mongodb/explicit-isolated-mongo-test.js";
import { MONGO_COLLECTIONS } from "../../../src/infrastructure/mongodb/mongo-collections.js";
import { getLockedMongoConfigForTests } from "../../../src/infrastructure/mongodb/mongo-config.js";
import {
  connectMongoClient,
  disconnectMongoClient,
} from "../../../src/infrastructure/mongodb/mongo-connection.js";
import { getMongoCollection, getMongoDatabase } from "../../../src/infrastructure/mongodb/mongo-database.js";
import { ensureMongoIndexes } from "../../../src/infrastructure/mongodb/mongo-indexes.js";
import { getPublishedWebUiRuntimeCacheSizeForTests } from "../../../src/modules/web-ui-message-packs/published-web-ui-runtime-cache.js";
import {
  buildPublishedWebUiEvidencePipeline,
  getPublishedWebUiRuntimeEvidence,
  getPublishedWebUiRuntimePayload,
  publishedWebUiMessagesTopLevelKeyCount,
  resetWebUiMessagePackStoreForTests,
  setWebUiMessagePackForceMemoryForTests,
  upsertWebUiMessagePack,
} from "../../../src/modules/web-ui-message-packs/web-ui-message-pack.repository.js";

const RUN = randomBytes(4).toString("hex");
const DATABASE = `hu_test_web_ui_evidence_${RUN}`;
const lockedBeforeThisSuite = getLockedMongoConfigForTests();

let replSet: MongoMemoryReplSet | null = null;
let connected = false;

function serializedPredicate(messages: unknown): boolean {
  try {
    const parsed: unknown = JSON.parse(JSON.stringify(messages));
    return parsed != null && typeof parsed === "object" && Object.keys(parsed).length > 0;
  } catch {
    return false;
  }
}

function collectPlan(node: unknown, stages: string[], indexes: string[]): void {
  if (node == null || typeof node !== "object") {
    return;
  }
  if (Array.isArray(node)) {
    for (const entry of node) {
      collectPlan(entry, stages, indexes);
    }
    return;
  }
  const record = node as Record<string, unknown>;
  if (typeof record.stage === "string") {
    stages.push(record.stage);
  }
  if (typeof record.indexName === "string") {
    indexes.push(record.indexName);
  }
  for (const value of Object.values(record)) {
    collectPlan(value, stages, indexes);
  }
}

async function insertRaw(localeKey: string, messages: unknown, status = "published"): Promise<void> {
  await getMongoCollection(MONGO_COLLECTIONS.webUiMessagePacks).insertOne({
    packId: `web-ui-pack-${localeKey}-${randomBytes(2).toString("hex")}`,
    locale: localeKey,
    localeKey,
    revision: 7,
    status,
    messages,
    createdAt: "2026-11-24T00:00:00.000Z",
    updatedAt: "2026-11-24T00:00:00.000Z",
  } as Document);
}

describe("published WEB_UI runtime evidence (MongoDB)", { concurrency: false }, () => {
  if (lockedBeforeThisSuite) {
    it("NOT_RUN_EXTERNAL_MONGO_CONFIGURED", () => {
      assert.notEqual(lockedBeforeThisSuite, null);
    });
    return;
  }

  before(async () => {
    process.env.NODE_TEST_ENV = "true";
    replSet = await MongoMemoryReplSet.create({
      replSet: { count: 1, storageEngine: "wiredTiger" },
    });
    const uri = replSet.getUri(DATABASE);
    assert.match(new URL(uri.replace(/^mongodb:/, "http:")).hostname, /^(127\.0\.0\.1|localhost)$/);
    assertExplicitIsolatedMongoTestTarget({ uri, database: DATABASE });
    lockExplicitIsolatedMongoTestConfig({ uri, database: DATABASE });
    await connectMongoClient();
    connected = true;
    assert.equal(getMongoDatabase().databaseName, DATABASE);
    await ensureMongoIndexes();
    setWebUiMessagePackForceMemoryForTests(false);
  });

  after(async () => {
    resetWebUiMessagePackStoreForTests();
    setWebUiMessagePackForceMemoryForTests(false);
    try {
      if (connected && getMongoDatabase().databaseName === DATABASE) {
        await getMongoDatabase().dropDatabase();
      }
    } finally {
      if (connected) {
        await disconnectMongoClient();
      }
      await replSet?.stop({ doCleanup: true });
    }
  });

  beforeEach(async () => {
    resetWebUiMessagePackStoreForTests();
    setWebUiMessagePackForceMemoryForTests(false);
    await getMongoCollection(MONGO_COLLECTIONS.webUiMessagePacks).deleteMany({});
  });

  async function assertEvidenceMatchesSerializedPack(localeKey: string): Promise<void> {
    const stored = await getMongoCollection(MONGO_COLLECTIONS.webUiMessagePacks).findOne({ localeKey });
    assert.ok(stored);
    const evidence = await getPublishedWebUiRuntimeEvidence(localeKey);
    const eligible = serializedPredicate(stored?.messages);
    if (stored?.status !== "published") {
      assert.equal(evidence, null);
      return;
    }
    assert.ok(evidence);
    assert.equal(evidence?.locale, stored?.locale);
    assert.equal(evidence?.revision, stored?.revision);
    assert.equal(
      evidence.topLevelKeyCount > 0,
      eligible,
      `${localeKey} count=${evidence.topLevelKeyCount} keys=${publishedWebUiMessagesTopLevelKeyCount(stored.messages)}`,
    );
    assert.equal(
      evidence?.topLevelKeyCount,
      publishedWebUiMessagesTopLevelKeyCount(stored?.messages),
    );
    assert.equal(getPublishedWebUiRuntimeCacheSizeForTests(), 0);
    const row = await getMongoCollection(MONGO_COLLECTIONS.webUiMessagePacks)
      .aggregate(buildPublishedWebUiEvidencePipeline(localeKey))
      .next();
    assert.equal(row == null ? false : Object.prototype.hasOwnProperty.call(row, "messages"), false);
  }

  it("uses an existing locale index and does not scan the collection", async () => {
    await insertRaw("uk", { greeting: "Hello" });
    const explained = await getMongoCollection(MONGO_COLLECTIONS.webUiMessagePacks)
      .aggregate(buildPublishedWebUiEvidencePipeline("uk"))
      .explain("executionStats");
    const stages: string[] = [];
    const indexes: string[] = [];
    collectPlan(explained, stages, indexes);
    assert.equal(stages.includes("COLLSCAN"), false);
    assert.equal(stages.includes("IXSCAN"), true);
    assert.ok(
      indexes.includes("web_ui_message_packs_locale_unique") ||
        indexes.includes("web_ui_message_packs_status_locale"),
    );
  });

  it("matches the serialized full-pack predicate for ordinary and malformed documents", async () => {
    const samples: Array<[string, unknown]> = [
      ["obj", { greeting: "Hello", extra: "There" }],
      ["empty", {}],
      ["nested-empty", { common: {} }],
      ["empty-string", { greeting: "" }],
      ["non-string", { count: 4, ready: false, missing: null }],
      ["array", ["one", "two"]],
      ["empty-array", []],
      ["scalar-string", "text"],
      ["scalar-number", 4],
      ["scalar-bool", true],
      ["date", new Date("2026-11-24T00:00:00.000Z")],
      ["object-id", new ObjectId()],
      ["long", Long.fromNumber(12)],
      ["int", new Int32(3)],
      ["double", new Double(1.5)],
      ["decimal", Decimal128.fromString("1.25")],
      ["binary", new Binary(Buffer.from("abc"))],
      ["regex", new BSONRegExp("a", "i")],
      ["code", new Code("return 1")],
      ["timestamp", new Timestamp({ t: 1, i: 1 })],
      ["min-key", new MinKey()],
      ["max-key", new MaxKey()],
    ];
    for (const [localeKey, messages] of samples) {
      await insertRaw(localeKey, messages);
      await assertEvidenceMatchesSerializedPack(localeKey);
    }

    await insertRaw("missing-messages", undefined);
    await getMongoCollection(MONGO_COLLECTIONS.webUiMessagePacks).updateOne(
      { localeKey: "missing-messages" },
      { $unset: { messages: "" } },
    );
    await assertEvidenceMatchesSerializedPack("missing-messages");

    await insertRaw("null-messages", null);
    await assertEvidenceMatchesSerializedPack("null-messages");

    await insertRaw("draft", { greeting: "Hidden" }, "draft");
    assert.equal(await getPublishedWebUiRuntimeEvidence("draft"), null);
    assert.equal(await getPublishedWebUiRuntimePayload("draft"), null);
  });

  it("does not cache an evidence miss and a later full read still serves messages", async () => {
    await upsertWebUiMessagePack({
      locale: "uk",
      status: "published",
      messages: { common: { language: "Language" } },
    });
    const evidence = await getPublishedWebUiRuntimeEvidence("uk");
    assert.equal(evidence?.topLevelKeyCount, 1);
    assert.equal(getPublishedWebUiRuntimeCacheSizeForTests(), 0);
    const full = await getPublishedWebUiRuntimePayload("uk");
    assert.deepEqual(full?.messages, { common: { language: "Language" } });
    assert.equal(full?.revision, evidence?.revision);
    assert.equal(getPublishedWebUiRuntimeCacheSizeForTests(), 1);
    const hit = await getPublishedWebUiRuntimeEvidence("UK");
    assert.equal(hit?.revision, full?.revision);
    assert.equal(hit?.topLevelKeyCount, 1);
    assert.equal(getPublishedWebUiRuntimeCacheSizeForTests(), 1);
  });

  it("keeps one published revision across fallback replacements", async () => {
    const localeKey = "fallback-race";
    await insertRaw(localeKey, "hello");
    const packs = getMongoCollection(MONGO_COLLECTIONS.webUiMessagePacks);
    const decimal = Decimal128.fromString("9.5");
    const transitions: Array<{
      revision: number;
      status: string;
      messages: unknown;
      count: number | null;
    }> = [
      { revision: 8, status: "published", messages: "replaced-scalar", count: 0 },
      { revision: 9, status: "published", messages: { alpha: "one", beta: "two" }, count: 2 },
      {
        revision: 10,
        status: "published",
        messages: decimal,
        count: publishedWebUiMessagesTopLevelKeyCount(decimal),
      },
      { revision: 11, status: "draft", messages: { alpha: "hidden" }, count: null },
      { revision: 12, status: "published", messages: { alpha: "one", beta: "two", gamma: "three" }, count: 3 },
    ];

    for (const state of transitions) {
      await packs.updateOne(
        { localeKey },
        { $set: { revision: state.revision, status: state.status, messages: state.messages } },
      );
      const evidence = await getPublishedWebUiRuntimeEvidence(localeKey);
      if (state.count == null) {
        assert.equal(evidence, null);
        continue;
      }
      assert.equal(evidence?.locale, localeKey);
      assert.equal(evidence?.revision, state.revision);
      assert.equal(evidence?.topLevelKeyCount, state.count);
    }

    const objectRow = await packs.aggregate(buildPublishedWebUiEvidencePipeline(localeKey)).next();
    assert.equal(objectRow?.revision, 12);
    assert.equal(objectRow?.topLevelKeyCount, 3);
    assert.equal(Object.prototype.hasOwnProperty.call(objectRow, "messages"), false);
    assert.equal(Object.prototype.hasOwnProperty.call(objectRow, "fallbackMessages"), false);

    await packs.updateOne(
      { localeKey },
      { $set: { revision: 13, status: "published", messages: decimal } },
    );
    const scalarRow = await packs.aggregate(buildPublishedWebUiEvidencePipeline(localeKey)).next();
    assert.equal(scalarRow?.revision, 13);
    assert.equal(
      publishedWebUiMessagesTopLevelKeyCount(scalarRow?.fallbackMessages),
      publishedWebUiMessagesTopLevelKeyCount(decimal),
    );
    const scalarEvidence = await getPublishedWebUiRuntimeEvidence(localeKey);
    assert.equal(scalarEvidence?.revision, 13);
    assert.equal(scalarEvidence?.topLevelKeyCount, publishedWebUiMessagesTopLevelKeyCount(decimal));

    const rotating = [
      { revision: 20, status: "published", messages: "scalar", count: 0 },
      { revision: 21, status: "published", messages: { left: 1, right: 2 }, count: 2 },
      {
        revision: 22,
        status: "published",
        messages: Decimal128.fromString("3.5"),
        count: publishedWebUiMessagesTopLevelKeyCount(Decimal128.fromString("3.5")),
      },
      { revision: 23, status: "draft", messages: { left: 1 }, count: null as number | null },
    ];
    let cursor = 0;
    let stop = false;
    const writer = (async () => {
      while (!stop) {
        const state = rotating[cursor % rotating.length];
        cursor += 1;
        if (!state) {
          continue;
        }
        await packs.updateOne(
          { localeKey },
          { $set: { revision: state.revision, status: state.status, messages: state.messages } },
        );
      }
    })();
    const reads = await Promise.all(
      Array.from({ length: 24 }, () => getPublishedWebUiRuntimeEvidence(localeKey)),
    );
    stop = true;
    await writer;
    assert.ok(reads.some((evidence) => evidence != null));
    for (const evidence of reads) {
      if (evidence == null) {
        continue;
      }
      const state = rotating.find(
        (item) => item.revision === evidence.revision && item.status === "published",
      );
      assert.ok(state, `revision ${evidence.revision} is not one published snapshot`);
      assert.equal(evidence.topLevelKeyCount, state?.count);
      assert.equal(evidence.locale, localeKey);
    }
  });
});
