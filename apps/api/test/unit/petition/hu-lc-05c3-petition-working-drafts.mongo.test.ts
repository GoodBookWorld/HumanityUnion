/**
 * HU-LC-05C.3 — independent Petition drafts keyed by draftId (many per
 * Initiative), steward-only, separate from the legacy one-draft store.
 *
 * Real Express router + auth middleware over a process-owned single-node
 * MongoMemoryReplSet (one hu_test_ database, dropped afterwards).
 */
process.env.NODE_TEST_ENV = "true";
process.env.INITIATIVE_PERSISTENCE = "memory";
process.env.JWT_ACCESS_SECRET = "hu-lc-05c3-test-access-secret-0123456789abcdef";
process.env.JWT_REFRESH_SECRET = "hu-lc-05c3-test-refresh-secret-0123456789abcdef";
process.env.AUTH_BOOTSTRAP_FALLBACK = "false";

import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { after, before, describe, it } from "node:test";

import express from "express";
import { MongoMemoryReplSet } from "mongodb-memory-server-core";
import type { Initiative, PetitionState } from "@hu/types";

import type * as AuthTokens from "../../../src/modules/auth/auth-tokens.js";
import type * as DraftRepository from "../../../src/modules/initiative-petition-drafts/petition-working-draft.repository.js";
import type * as MongoCollections from "../../../src/infrastructure/mongodb/mongo-collections.js";
import type * as MongoDatabase from "../../../src/infrastructure/mongodb/mongo-database.js";
import type * as PetitionStore from "../../../src/modules/petition/petition.store.js";
import type * as PetitionTestHelpers from "./petition-test-helpers.js";

const RUN = randomBytes(4).toString("hex");
const DATABASE = `hu_test_petition_drafts_${RUN}`;
const STEWARD = { userId: `user-lc05c3-steward-${RUN}`, memberId: `member-lc05c3-steward-${RUN}` };
const OTHER = { userId: `user-lc05c3-other-${RUN}`, memberId: `member-lc05c3-other-${RUN}` };
const DISABLED = { userId: `user-lc05c3-disabled-${RUN}`, memberId: STEWARD.memberId };

/** Loaded after the environment above is set; persistence adapters bind at import. */
type Mods = {
  tokens: typeof AuthTokens;
  repository: typeof DraftRepository;
  store: typeof PetitionStore;
  helpers: typeof PetitionTestHelpers;
  database: typeof MongoDatabase;
  collections: typeof MongoCollections;
};

type Caller = "anonymous" | "invalid" | "disabled" | "other" | "steward";
type Draft = {
  draftId: string;
  initiativeId: string;
  authorId: string;
  title: string;
  recipients: string[];
  derivedFromPetitionId: string | null;
  createdAt: string;
  updatedAt: string;
};

let mods: Mods;
let replSet: MongoMemoryReplSet | null = null;
let server: Server | null = null;
let baseUrl = "";
let connected = false;
let initiativeCounter = 0;

function tokenFor(user: { userId: string; memberId: string }): string {
  return mods.tokens.createAccessToken({
    sub: user.userId,
    memberId: user.memberId,
    role: "member",
    displayName: "LC-05C.3 Test",
    email: `${user.userId}@example.test`,
  });
}

function headersFor(caller: Caller): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const user = { disabled: DISABLED, other: OTHER, steward: STEWARD }[caller as string];
  if (caller === "invalid") {
    headers.Authorization = "Bearer not-a-real-token";
  } else if (user) {
    headers.Authorization = `Bearer ${tokenFor(user)}`;
  }
  return headers;
}

async function call(
  method: "GET" | "POST" | "PATCH" | "DELETE",
  path: string,
  caller: Caller,
  body?: unknown,
): Promise<{ status: number; message: string; data: unknown }> {
  const response = await fetch(`${baseUrl}/api/v1/initiative-petitions${path}`, {
    method,
    headers: headersFor(caller),
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const json = (await response.json().catch(() => ({}))) as { message?: string; data?: unknown };
  return { status: response.status, message: json.message ?? "", data: json.data ?? null };
}

async function createInitiative(stewardId = STEWARD.memberId): Promise<string> {
  initiativeCounter += 1;
  const initiativeId = `initiative-lc05c3-${initiativeCounter}-${RUN}`;
  const initiatives = await import("../../../src/modules/initiatives/initiative.store.js");
  const now = new Date().toISOString();
  initiatives.createInitiative({
    initiativeId,
    stewardId,
    title: `LC-05C.3 fixture ${initiativeCounter}`,
    description: "Fixture Initiative for independent Petition drafts.",
    status: "implementation",
    lifecyclePhase: "projected",
    lifecycleProfile: "STANDARD",
    visibility: { policy: "public" },
    metadata: { activityArea: "Environment", communitySlug: "fixture-community" },
    timeline: [],
    createdAt: now,
    updatedAt: now,
  } as unknown as Initiative);
  return initiativeId;
}

async function createDraft(initiativeId: string, body: unknown = {}): Promise<Draft> {
  const result = await call("POST", `/initiative/${initiativeId}/drafts`, "steward", body);
  assert.equal(result.status, 201, result.message);
  return result.data as Draft;
}

async function getDraft(initiativeId: string, draftId: string): Promise<Draft | null> {
  const result = await call("GET", `/initiative/${initiativeId}/drafts/${draftId}`, "steward");
  return result.status === 200 ? (result.data as Draft) : null;
}

async function seedPetition(initiativeId: string, status: PetitionState): Promise<string> {
  const petitionId = `petition-lc05c3-${status.toLowerCase()}-${randomBytes(3).toString("hex")}`;
  const decisionId = `decision-${petitionId}`;
  await mods.helpers.seedApprovedDecision(decisionId, initiativeId);
  await mods.store.createPetition(
    mods.helpers.buildFixturePetition({ petitionId, decisionId, initiativeId }),
  );
  if (status !== "Draft") {
    await mods.store.preparePetition(petitionId);
    await mods.store.publishPetition(petitionId);
    await mods.store.openPetition(petitionId);
  }
  return petitionId;
}

describe("HU-LC-05C.3 — independent Petition drafts", () => {
  before(async () => {
    const isolation =
      await import("../../../src/infrastructure/mongodb/explicit-isolated-mongo-test.js");
    const connection = await import("../../../src/infrastructure/mongodb/mongo-connection.js");
    const database = await import("../../../src/infrastructure/mongodb/mongo-database.js");
    const indexes = await import("../../../src/infrastructure/mongodb/mongo-indexes.js");

    replSet = await MongoMemoryReplSet.create({
      replSet: { count: 1, storageEngine: "wiredTiger" },
    });
    const uri = replSet.getUri(DATABASE);
    assert.match(new URL(uri.replace(/^mongodb:/, "http:")).hostname, /^(127\.0\.0\.1|localhost)$/);
    isolation.assertExplicitIsolatedMongoTestTarget({ uri, database: DATABASE });
    isolation.lockExplicitIsolatedMongoTestConfig({ uri, database: DATABASE });
    await connection.connectMongoClient();
    connected = true;
    assert.equal(database.getMongoDatabase().databaseName, DATABASE);
    await indexes.ensureMongoIndexes();

    const gate = await import("../../../src/modules/auth/auth-active-account-gate.js");
    gate.setAuthUserLookupOverrideForTests(
      async (userId: string) =>
        ({ id: userId, status: userId === DISABLED.userId ? "disabled" : "active" }) as never,
    );

    mods = {
      tokens: await import("../../../src/modules/auth/auth-tokens.js"),
      repository:
        await import("../../../src/modules/initiative-petition-drafts/petition-working-draft.repository.js"),
      store: await import("../../../src/modules/petition/petition.store.js"),
      helpers: await import("./petition-test-helpers.js"),
      database,
      collections: await import("../../../src/infrastructure/mongodb/mongo-collections.js"),
    };

    const { petitionWorkingDraftRouter } =
      await import("../../../src/modules/initiative-petition-drafts/index.js");
    const app = express();
    app.use(express.json());
    app.use("/api/v1/initiative-petitions", petitionWorkingDraftRouter);
    await new Promise<void>((resolve) => {
      server = app.listen(0, "127.0.0.1", () => resolve());
    });
    baseUrl = `http://127.0.0.1:${(server!.address() as AddressInfo).port}`;
  });

  after(async () => {
    const gate = await import("../../../src/modules/auth/auth-active-account-gate.js");
    gate.setAuthUserLookupOverrideForTests(null);
    await new Promise<void>((resolve) => (server ? server.close(() => resolve()) : resolve()));
    const connection = await import("../../../src/infrastructure/mongodb/mongo-connection.js");
    try {
      if (connected && mods.database.getMongoDatabase().databaseName === DATABASE) {
        await mods.database.getMongoDatabase().dropDatabase();
      }
    } finally {
      if (connected) {
        await connection.disconnectMongoClient();
      }
      await replSet?.stop({ doCleanup: true });
    }
  });

  it("multiple drafts under one Initiative, each with its own draftId", async () => {
    const initiativeId = await createInitiative();
    const created = [
      await createDraft(initiativeId),
      await createDraft(initiativeId),
      await createDraft(initiativeId),
    ];

    assert.equal(new Set(created.map((draft) => draft.draftId)).size, 3);
    for (const draft of created) {
      assert.equal(draft.initiativeId, initiativeId);
      assert.equal(draft.authorId, STEWARD.memberId);
      assert.equal(draft.title, "");
      assert.deepEqual(draft.recipients, []);
      assert.equal(draft.derivedFromPetitionId, null);
    }

    const listed = await call("GET", `/initiative/${initiativeId}/drafts`, "steward");
    assert.equal(listed.status, 200, listed.message);
    assert.deepEqual(
      (listed.data as Draft[]).map((draft) => draft.draftId),
      created.map((draft) => draft.draftId),
    );
  });

  it("updating one draft leaves the others untouched", async () => {
    const initiativeId = await createInitiative();
    const a = await createDraft(initiativeId);
    const b = await createDraft(initiativeId);

    const updated = await call(
      "PATCH",
      `/initiative/${initiativeId}/drafts/${a.draftId}`,
      "steward",
      {
        title: "Petition A",
        publicSummary: "Summary A",
        keyArguments: ["First"],
        recipients: ["  City Council  ", "", "Mayor"],
      },
    );
    assert.equal(updated.status, 200, updated.message);
    const savedA = updated.data as Draft;
    assert.equal(savedA.title, "Petition A");
    assert.deepEqual(savedA.recipients, ["City Council", "Mayor"]);
    assert.ok(savedA.updatedAt >= a.updatedAt);
    assert.deepEqual(await getDraft(initiativeId, b.draftId), b);
  });

  it("identity fields cannot be changed through an update", async () => {
    const initiativeId = await createInitiative();
    const draft = await createDraft(initiativeId);
    const result = await call(
      "PATCH",
      `/initiative/${initiativeId}/drafts/${draft.draftId}`,
      "steward",
      {
        title: "Kept",
        draftId: "hijacked",
        initiativeId: "other-initiative",
        authorId: OTHER.memberId,
        derivedFromPetitionId: "petition-x",
        createdAt: "2000-01-01T00:00:00.000Z",
      },
    );
    assert.equal(result.status, 200, result.message);
    const saved = (await getDraft(initiativeId, draft.draftId))!;
    assert.equal(saved.title, "Kept");
    assert.equal(saved.draftId, draft.draftId);
    assert.equal(saved.initiativeId, initiativeId);
    assert.equal(saved.authorId, STEWARD.memberId);
    assert.equal(saved.derivedFromPetitionId, null);
    assert.equal(saved.createdAt, draft.createdAt);
  });

  it("deleting one draft leaves the others", async () => {
    const initiativeId = await createInitiative();
    const a = await createDraft(initiativeId);
    const b = await createDraft(initiativeId);

    const deleted = await call(
      "DELETE",
      `/initiative/${initiativeId}/drafts/${a.draftId}`,
      "steward",
    );
    assert.equal(deleted.status, 200, deleted.message);
    assert.equal(await getDraft(initiativeId, a.draftId), null);
    assert.deepEqual(await getDraft(initiativeId, b.draftId), b);
    assert.equal(
      (await call("DELETE", `/initiative/${initiativeId}/drafts/${a.draftId}`, "steward")).status,
      404,
    );
  });

  describe("steward authorization", () => {
    const routes = (initiativeId: string, draftId: string) =>
      [
        ["GET", `/initiative/${initiativeId}/drafts`, undefined],
        ["POST", `/initiative/${initiativeId}/drafts`, {}],
        ["GET", `/initiative/${initiativeId}/drafts/${draftId}`, undefined],
        ["PATCH", `/initiative/${initiativeId}/drafts/${draftId}`, { title: "Changed" }],
        ["DELETE", `/initiative/${initiativeId}/drafts/${draftId}`, undefined],
      ] as const;

    for (const [caller, expected] of [
      ["anonymous", 401],
      ["invalid", 401],
      ["other", 403],
    ] as Array<[Caller, number]>) {
      it(`${caller} is rejected with ${expected} on every route and nothing changes`, async () => {
        const initiativeId = await createInitiative();
        const draft = await createDraft(initiativeId);
        for (const [method, path, body] of routes(initiativeId, draft.draftId)) {
          const result = await call(method, path, caller, body);
          assert.equal(result.status, expected, `${method} ${path}: ${result.message}`);
        }
        const listed = await call("GET", `/initiative/${initiativeId}/drafts`, "steward");
        assert.deepEqual(listed.data, [draft]);
      });
    }

    it("a disabled steward account cannot create, update or delete", async () => {
      const initiativeId = await createInitiative();
      const draft = await createDraft(initiativeId);
      for (const [method, path, body] of routes(initiativeId, draft.draftId).filter(
        ([method]) => method !== "GET",
      )) {
        const result = await call(method, path, "disabled", body);
        assert.equal(result.status, 403, `${method} ${path}: ${result.message}`);
      }
      assert.deepEqual(await getDraft(initiativeId, draft.draftId), draft);
    });

    it("the bootstrap fallback never authorizes draft access", async () => {
      const initiativeId = await createInitiative();
      process.env.AUTH_BOOTSTRAP_FALLBACK = "true";
      try {
        const result = await call("POST", `/initiative/${initiativeId}/drafts`, "anonymous", {});
        assert.equal(result.status, 401, result.message);
      } finally {
        process.env.AUTH_BOOTSTRAP_FALLBACK = "false";
      }
    });
  });

  it("a draft is reachable only through its own Initiative", async () => {
    const owner = await createInitiative();
    const otherOfSameSteward = await createInitiative();
    const otherStewards = await createInitiative(OTHER.memberId);
    const draft = await createDraft(owner);

    for (const [initiativeId, caller] of [
      [otherOfSameSteward, "steward"],
      [otherStewards, "other"],
    ] as Array<[string, Caller]>) {
      for (const [method, body] of [
        ["GET", undefined],
        ["PATCH", { title: "Cross" }],
        ["DELETE", undefined],
      ] as const) {
        const result = await call(
          method,
          `/initiative/${initiativeId}/drafts/${draft.draftId}`,
          caller,
          body,
        );
        assert.equal(result.status, 404, `${caller} ${method}: ${result.message}`);
      }
      const listed = await call("GET", `/initiative/${initiativeId}/drafts`, caller);
      assert.deepEqual(listed.data, []);
    }
    assert.deepEqual(await getDraft(owner, draft.draftId), draft);
  });

  it("drafts persist in MongoDB, not in process memory", async () => {
    const initiativeId = await createInitiative();
    const draft = await createDraft(initiativeId);
    await call("PATCH", `/initiative/${initiativeId}/drafts/${draft.draftId}`, "steward", {
      title: "Durable",
    });

    const stored = await mods.database
      .getMongoCollection(mods.collections.MONGO_COLLECTIONS.initiativePetitionWorkingDrafts)
      .findOne({ draftId: draft.draftId }, { projection: { _id: 0 } });
    assert.equal(stored?.title, "Durable");
    assert.equal(stored?.initiativeId, initiativeId);
    assert.deepEqual(
      await mods.repository.findPetitionWorkingDraft(initiativeId, draft.draftId),
      stored,
    );
  });

  it("draftId is unique at the storage level", async () => {
    const initiativeId = await createInitiative();
    const draft = await createDraft(initiativeId);
    await assert.rejects(
      () =>
        mods.repository.insertPetitionWorkingDraft({
          ...(draft as unknown as Parameters<typeof mods.repository.insertPetitionWorkingDraft>[0]),
          initiativeId: `initiative-other-${RUN}`,
        }),
      /already exists/,
    );
    const matching = await mods.database
      .getMongoCollection(mods.collections.MONGO_COLLECTIONS.initiativePetitionWorkingDrafts)
      .countDocuments({ draftId: draft.draftId });
    assert.equal(matching, 1);
  });

  describe("published Petitions and the legacy draft store are untouched", () => {
    it("derivedFromPetitionId accepts only this Initiative's published Petitions", async () => {
      const initiativeId = await createInitiative();
      const published = await seedPetition(initiativeId, "Open");
      const unpublished = await seedPetition(initiativeId, "Draft");
      const foreign = await seedPetition(await createInitiative(), "Open");
      const before = JSON.stringify(await mods.store.getPetition(published));

      const derived = await createDraft(initiativeId, { derivedFromPetitionId: published });
      assert.equal(derived.derivedFromPetitionId, published);

      for (const petitionId of [unpublished, foreign, `missing-${RUN}`]) {
        const result = await call("POST", `/initiative/${initiativeId}/drafts`, "steward", {
          derivedFromPetitionId: petitionId,
        });
        assert.equal(result.status, 409, `${petitionId}: ${result.message}`);
      }

      await call("PATCH", `/initiative/${initiativeId}/drafts/${derived.draftId}`, "steward", {
        title: "Derived edit",
      });
      await call("DELETE", `/initiative/${initiativeId}/drafts/${derived.draftId}`, "steward");

      const after = JSON.parse(JSON.stringify(await mods.store.getPetition(published)));
      const beforeParsed = JSON.parse(before);
      delete after.outcome?.derivedAt;
      delete beforeParsed.outcome?.derivedAt;
      assert.deepEqual(after, beforeParsed);
    });

    it("the legacy initiative_petition_drafts collection is never read or written", async () => {
      const initiativeId = await createInitiative();
      const legacy = mods.database.getMongoCollection<{
        _id: string;
        initiativeId: string;
        title: string;
      }>(mods.collections.MONGO_COLLECTIONS.initiativePetitionDrafts);
      await legacy.insertOne({ _id: initiativeId, initiativeId, title: "Legacy draft" });
      const before = await legacy.find({}).sort({ _id: 1 }).toArray();

      const draft = await createDraft(initiativeId);
      await call("PATCH", `/initiative/${initiativeId}/drafts/${draft.draftId}`, "steward", {
        title: "New",
      });
      await call("DELETE", `/initiative/${initiativeId}/drafts/${draft.draftId}`, "steward");

      assert.deepEqual(await legacy.find({}).sort({ _id: 1 }).toArray(), before);
    });
  });

  it("invalid content is rejected without a write", async () => {
    const initiativeId = await createInitiative();
    const draft = await createDraft(initiativeId);
    for (const body of [
      { recipients: "City Council" },
      { recipients: [1, 2] },
      { recipients: Array.from({ length: 51 }, (_, index) => `Recipient ${index}`) },
      { keyArguments: "not-an-array" },
      { title: 42 },
    ]) {
      const result = await call(
        "PATCH",
        `/initiative/${initiativeId}/drafts/${draft.draftId}`,
        "steward",
        body,
      );
      assert.equal(result.status, 400, `${JSON.stringify(body)}: ${result.message}`);
    }
    assert.deepEqual(await getDraft(initiativeId, draft.draftId), draft);
  });
});
