/**
 * HU-LC-05C.4A — at most three Petition slots per Initiative, shared by working
 * drafts and published Petitions; drafts release theirs on deletion, published
 * Petitions keep theirs; neither publication path can exceed the limit.
 *
 * Real Express routers + auth middleware over a process-owned single-node
 * MongoMemoryReplSet (one hu_test_ database, dropped afterwards).
 */
process.env.NODE_TEST_ENV = "true";
process.env.INITIATIVE_PERSISTENCE = "memory";
process.env.INITIATIVE_PETITION_DRAFT_PERSISTENCE = "memory";
process.env.INITIATIVE_VERSION_REVISION_PERSISTENCE = "memory";
process.env.NOTIFICATION_PERSISTENCE = "memory";
process.env.JWT_ACCESS_SECRET = "hu-lc-05c4a-test-access-secret-0123456789abcdef";
process.env.JWT_REFRESH_SECRET = "hu-lc-05c4a-test-refresh-secret-0123456789abcdef";
process.env.AUTH_BOOTSTRAP_FALLBACK = "false";

import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { after, before, describe, it } from "node:test";

import express from "express";
import { MongoMemoryReplSet } from "mongodb-memory-server-core";
import type { Initiative, Petition, PetitionState } from "@hu/types";

import type * as AuthTokens from "../../../src/modules/auth/auth-tokens.js";
import type * as MongoCollections from "../../../src/infrastructure/mongodb/mongo-collections.js";
import type * as MongoDatabase from "../../../src/infrastructure/mongodb/mongo-database.js";
import type * as Initiatives from "../../../src/modules/initiatives/initiative.store.js";
import type * as PetitionLifecycle from "../../../src/modules/initiative-petition-lifecycle/initiative-petition-lifecycle.service.js";
import type * as RevisionService from "../../../src/modules/initiative-version-revision/initiative-version-revision.service.js";
import type * as SlotRepository from "../../../src/modules/initiative-petition-slots/petition-slot.repository.js";
import type * as SlotService from "../../../src/modules/initiative-petition-slots/petition-slot.service.js";
import type * as PetitionStore from "../../../src/modules/petition/petition.store.js";
import type * as PetitionTestHelpers from "./petition-test-helpers.js";

const RUN = randomBytes(4).toString("hex");
const DATABASE = `hu_test_petition_slots_${RUN}`;
const STEWARD = {
  userId: `user-lc05c4a-steward-${RUN}`,
  memberId: `member-lc05c4a-steward-${RUN}`,
};
const OTHER = { userId: `user-lc05c4a-other-${RUN}`, memberId: `member-lc05c4a-other-${RUN}` };
const identity = { participantId: STEWARD.memberId };

/** Loaded after the environment above is set; persistence adapters bind at import. */
type Mods = {
  tokens: typeof AuthTokens;
  store: typeof PetitionStore;
  lifecycle: typeof PetitionLifecycle;
  initiatives: typeof Initiatives;
  revisions: typeof RevisionService;
  slots: typeof SlotService;
  slotRepository: typeof SlotRepository;
  helpers: typeof PetitionTestHelpers;
  database: typeof MongoDatabase;
  collections: typeof MongoCollections;
  signerId: string;
};

type Caller = "anonymous" | "other" | "steward";
type Draft = { draftId: string; initiativeId: string };
type Slot = {
  initiativeId: string;
  slotNumber: number;
  state: "draft" | "published";
  draftId: string | null;
  petitionId: string | null;
};

let mods: Mods;
let replSet: MongoMemoryReplSet | null = null;
let server: Server | null = null;
let baseUrl = "";
let connected = false;
let counter = 0;

function headersFor(caller: Caller): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const user = caller === "steward" ? STEWARD : caller === "other" ? OTHER : null;
  if (user) {
    headers.Authorization = `Bearer ${mods.tokens.createAccessToken({
      sub: user.userId,
      memberId: user.memberId,
      role: "member",
      displayName: "LC-05C.4A Test",
      email: `${user.userId}@example.test`,
    })}`;
  }
  return headers;
}

async function call(
  method: "GET" | "POST" | "DELETE",
  path: string,
  caller: Caller = "steward",
): Promise<{ status: number; message: string; data: unknown }> {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: headersFor(caller),
    ...(method === "POST" ? { body: "{}" } : {}),
  });
  const json = (await response.json().catch(() => ({}))) as { message?: string; data?: unknown };
  return { status: response.status, message: json.message ?? "", data: json.data ?? null };
}

const draftsPath = (initiativeId: string) =>
  `/api/v1/initiative-petitions/initiative/${initiativeId}/drafts`;

function createInitiative(stewardId = STEWARD.memberId): string {
  counter += 1;
  const now = new Date().toISOString();
  const initiative = mods.initiatives.createInitiative({
    initiativeId: `initiative-lc05c4a-${counter}-${RUN}`,
    stewardId,
    title: `LC-05C.4A fixture ${counter}`,
    description: "Fixture Initiative for Petition slots.",
    status: "implementation",
    lifecyclePhase: "projected",
    lifecycleProfile: "STANDARD",
    visibility: { policy: "public" },
    metadata: { activityArea: "Environment", communitySlug: "fixture-community" },
    timeline: [],
    createdAt: now,
    updatedAt: now,
  } as unknown as Initiative);
  mods.revisions.createInitialInitiativeVersionRevision(initiative, stewardId);
  return initiative.initiativeId;
}

async function createDraft(initiativeId: string): Promise<Draft> {
  const result = await call("POST", draftsPath(initiativeId));
  assert.equal(result.status, 201, result.message);
  return result.data as Draft;
}

async function listDrafts(initiativeId: string): Promise<string[]> {
  const result = await call("GET", draftsPath(initiativeId));
  assert.equal(result.status, 200, result.message);
  return (result.data as Draft[]).map((draft) => draft.draftId);
}

async function slotsOf(initiativeId: string): Promise<Slot[]> {
  return mods.database
    .getMongoCollection<Slot>(mods.collections.MONGO_COLLECTIONS.initiativePetitionSlots)
    .find({ initiativeId }, { projection: { _id: 0, createdAt: 0 } })
    .sort({ slotNumber: 1 })
    .toArray();
}

/** Seeds a Petition directly in the store (no slot), advanced to `status`. */
async function seedPetition(initiativeId: string, status: PetitionState): Promise<string> {
  counter += 1;
  const petitionId = `petition-lc05c4a-${counter}-${RUN}`;
  const decisionId = `decision-${petitionId}`;
  await mods.helpers.seedApprovedDecision(decisionId, initiativeId);
  await mods.store.createPetition(
    mods.helpers.buildFixturePetition({ petitionId, decisionId, initiativeId }),
  );
  if (status !== "Draft") {
    await mods.store.preparePetition(petitionId);
  }
  if (status === "Published" || status === "Open") {
    await mods.store.publishPetitionForTests(petitionId);
  }
  if (status === "Open") {
    await mods.store.openPetition(petitionId);
  }
  return petitionId;
}

/** Stored Petition fields (excludes values derived on every read). */
function storedFields(petition: Petition | null) {
  if (!petition) {
    return null;
  }
  const { petitionId, collectiveDecisionId, status, updatedAt, subject, traceability, signatures } =
    petition;
  return { petitionId, collectiveDecisionId, status, updatedAt, subject, traceability, signatures };
}

async function snapshotPublished(petitionIds: readonly string[]) {
  return Promise.all(
    petitionIds.map(async (petitionId) => storedFields(await mods.store.getPetition(petitionId))),
  );
}

async function outboxEvents(initiativeId: string) {
  return mods.database
    .getMongoCollection(mods.collections.MONGO_COLLECTIONS.outbox)
    .find({ eventId: { $regex: `:${initiativeId}:` } }, { projection: { _id: 0 } })
    .sort({ eventId: 1 })
    .toArray();
}

/** Generates and completes the legacy lifecycle Petition draft; returns its draftId. */
async function prepareLifecycleDraft(initiativeId: string, title: string): Promise<string> {
  const draft = await mods.lifecycle.generateInitiativePetitionDraft(identity, initiativeId);
  mods.lifecycle.saveInitiativePetitionDraft(identity, initiativeId, {
    title,
    publicSummary: `${title} — summary.`,
    requestStatement: "Please act on this request.",
    expectedOutcome: "The request is acted on.",
    supportingContext: "Context.",
    keyArguments: ["Argument"],
  });
  return draft.draftId;
}

describe("HU-LC-05C.4A — atomic Petition slots", () => {
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
      async (userId: string) => ({ id: userId, status: "active" }) as never,
    );

    mods = {
      tokens: await import("../../../src/modules/auth/auth-tokens.js"),
      store: await import("../../../src/modules/petition/petition.store.js"),
      lifecycle:
        await import("../../../src/modules/initiative-petition-lifecycle/initiative-petition-lifecycle.service.js"),
      initiatives: await import("../../../src/modules/initiatives/initiative.store.js"),
      revisions:
        await import("../../../src/modules/initiative-version-revision/initiative-version-revision.service.js"),
      slots:
        await import("../../../src/modules/initiative-petition-slots/petition-slot.service.js"),
      slotRepository:
        await import("../../../src/modules/initiative-petition-slots/petition-slot.repository.js"),
      helpers: await import("./petition-test-helpers.js"),
      database,
      collections: await import("../../../src/infrastructure/mongodb/mongo-collections.js"),
      signerId: (await import("../../../src/modules/member/member.sample.js")).sampleMember.id,
    };

    const { petitionWorkingDraftRouter } =
      await import("../../../src/modules/initiative-petition-drafts/index.js");
    const petitionRouter = (await import("../../../src/modules/petition/petition.routes.js"))
      .default;
    const app = express();
    app.use(express.json());
    app.use("/api/v1/initiative-petitions", petitionWorkingDraftRouter);
    app.use("/api/v1/petitions", petitionRouter);
    await new Promise<void>((resolve) => {
      server = app.listen(0, "127.0.0.1", () => resolve());
    });
    baseUrl = `http://127.0.0.1:${(server!.address() as AddressInfo).port}`;
  });

  after(async () => {
    mods?.slots.setPetitionSlotFaultForTests(null);
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

  describe("working drafts", () => {
    it("three occupied slots are allowed; a fourth draft is rejected with 409", async () => {
      const initiativeId = createInitiative();
      const drafts = [
        await createDraft(initiativeId),
        await createDraft(initiativeId),
        await createDraft(initiativeId),
      ];

      const fourth = await call("POST", draftsPath(initiativeId));
      assert.equal(fourth.status, 409, fourth.message);
      assert.match(fourth.message, /Petition limit reached/);

      assert.deepEqual(
        await listDrafts(initiativeId),
        drafts.map((draft) => draft.draftId),
      );
      assert.deepEqual(
        await slotsOf(initiativeId),
        drafts.map((draft, index) => ({
          initiativeId,
          slotNumber: index + 1,
          state: "draft",
          draftId: draft.draftId,
          petitionId: null,
          attemptId: null,
          leaseExpiresAt: null,
        })),
      );
    });

    it("concurrent creation never exceeds three slots", async () => {
      const initiativeId = createInitiative();
      const results = await Promise.all(
        Array.from({ length: 8 }, () => call("POST", draftsPath(initiativeId))),
      );

      const created = results.filter((result) => result.status === 201);
      assert.equal(created.length, 3, results.map((result) => result.message).join(" | "));
      for (const result of results.filter((entry) => entry.status !== 201)) {
        assert.equal(result.status, 409, result.message);
      }

      const draftIds = await listDrafts(initiativeId);
      const slots = await slotsOf(initiativeId);
      assert.equal(draftIds.length, 3);
      assert.deepEqual(
        slots.map((slot) => slot.slotNumber),
        [1, 2, 3],
      );
      assert.deepEqual(slots.map((slot) => slot.draftId).sort(), [...draftIds].sort());
    });

    it("deleting one draft releases only its slot, which a new draft can reuse", async () => {
      const initiativeId = createInitiative();
      const [a, b, c] = [
        await createDraft(initiativeId),
        await createDraft(initiativeId),
        await createDraft(initiativeId),
      ];

      const deleted = await call("DELETE", `${draftsPath(initiativeId)}/${b!.draftId}`);
      assert.equal(deleted.status, 200, deleted.message);
      assert.deepEqual(await listDrafts(initiativeId), [a!.draftId, c!.draftId]);
      assert.deepEqual(
        (await slotsOf(initiativeId)).map((slot) => [slot.slotNumber, slot.draftId]),
        [
          [1, a!.draftId],
          [3, c!.draftId],
        ],
      );

      const reused = await createDraft(initiativeId);
      assert.deepEqual(
        (await slotsOf(initiativeId)).map((slot) => [slot.slotNumber, slot.draftId]),
        [
          [1, a!.draftId],
          [2, reused.draftId],
          [3, c!.draftId],
        ],
      );
      assert.equal((await call("POST", draftsPath(initiativeId))).status, 409);
    });

    it("concurrent deletion and creation stay within three slots", async () => {
      const initiativeId = createInitiative();
      const drafts = [
        await createDraft(initiativeId),
        await createDraft(initiativeId),
        await createDraft(initiativeId),
      ];

      const results = await Promise.all([
        call("DELETE", `${draftsPath(initiativeId)}/${drafts[0]!.draftId}`),
        call("DELETE", `${draftsPath(initiativeId)}/${drafts[1]!.draftId}`),
        ...Array.from({ length: 4 }, () => call("POST", draftsPath(initiativeId))),
      ]);
      assert.deepEqual(
        results.slice(0, 2).map((result) => result.status),
        [200, 200],
      );

      const draftIds = await listDrafts(initiativeId);
      const slots = await slotsOf(initiativeId);
      assert.ok(draftIds.length <= 3, `${draftIds.length} drafts`);
      assert.deepEqual(slots.map((slot) => slot.draftId).sort(), [...draftIds].sort());
      assert.equal(new Set(slots.map((slot) => slot.slotNumber)).size, slots.length);
    });
  });

  describe("published Petitions", () => {
    it("existing published Petitions are counted before a new draft is allowed", async () => {
      const initiativeId = createInitiative();
      const published = [
        await seedPetition(initiativeId, "Open"),
        await seedPetition(initiativeId, "Published"),
      ];
      const unpublished = await seedPetition(initiativeId, "Ready");
      await mods.store.signPetition(published[0]!, mods.signerId);
      const before = await snapshotPublished([...published, unpublished]);
      const eventsBefore = await outboxEvents(initiativeId);

      const draft = await createDraft(initiativeId);
      const blocked = await call("POST", draftsPath(initiativeId));
      assert.equal(blocked.status, 409, blocked.message);

      assert.deepEqual(
        (await slotsOf(initiativeId)).map((slot) => [slot.state, slot.petitionId ?? slot.draftId]),
        [
          ["published", published[0]],
          ["published", published[1]],
          ["draft", draft.draftId],
        ],
      );
      assert.deepEqual(await snapshotPublished([...published, unpublished]), before);
      assert.deepEqual(await outboxEvents(initiativeId), eventsBefore);
    });

    it("three published Petitions leave no slot for a draft", async () => {
      const initiativeId = createInitiative();
      for (let index = 0; index < 3; index += 1) {
        await seedPetition(initiativeId, "Open");
      }
      const result = await call("POST", draftsPath(initiativeId));
      assert.equal(result.status, 409, result.message);
      assert.deepEqual(await listDrafts(initiativeId), []);
    });

    it("published slots are never released", async () => {
      const initiativeId = createInitiative();
      const petitionId = await seedPetition(initiativeId, "Open");
      const draft = await createDraft(initiativeId);
      const slotsBefore = await slotsOf(initiativeId);

      // Not a draft id: the published slot cannot be removed through draft deletion.
      const asDraft = await call("DELETE", `${draftsPath(initiativeId)}/${petitionId}`);
      assert.equal(asDraft.status, 404, asDraft.message);
      await mods.slots.recoverExpiredPetitionReservations(initiativeId);
      assert.equal(await mods.slotRepository.deleteDraftPetitionSlot(initiativeId, petitionId), 0);
      await call("DELETE", `${draftsPath(initiativeId)}/${draft.draftId}`);

      assert.deepEqual(
        (await slotsOf(initiativeId)).map((slot) => [slot.state, slot.petitionId]),
        [["published", petitionId]],
      );
      assert.deepEqual(slotsBefore[0], (await slotsOf(initiativeId))[0]);
    });
  });

  describe("legacy publication cannot bypass the limit", () => {
    it("POST /api/v1/petitions/:id/publish is rejected with 409 when every slot is taken", async () => {
      const initiativeId = createInitiative();
      const ready = await seedPetition(initiativeId, "Ready");
      const drafts = [
        await createDraft(initiativeId),
        await createDraft(initiativeId),
        await createDraft(initiativeId),
      ];

      const blocked = await call("POST", `/api/v1/petitions/${ready}/publish`);
      assert.equal(blocked.status, 409, blocked.message);
      assert.match(blocked.message, /Petition limit reached/);
      assert.equal((await mods.store.getPetition(ready))?.status, "Ready");
      assert.ok(!(await slotsOf(initiativeId)).some((slot) => slot.petitionId === ready));

      await call("DELETE", `${draftsPath(initiativeId)}/${drafts[0]!.draftId}`);
      const published = await call("POST", `/api/v1/petitions/${ready}/publish`);
      assert.equal(published.status, 200, published.message);
      assert.equal((await mods.store.getPetition(ready))?.status, "Published");
      assert.deepEqual(
        (await slotsOf(initiativeId)).map((slot) => [slot.slotNumber, slot.state]),
        [
          [1, "published"],
          [2, "draft"],
          [3, "draft"],
        ],
      );
      assert.equal((await call("POST", draftsPath(initiativeId))).status, 409);
    });

    it("the legacy route counts already-published Petitions", async () => {
      const initiativeId = createInitiative();
      const open = [
        await seedPetition(initiativeId, "Open"),
        await seedPetition(initiativeId, "Open"),
        await seedPetition(initiativeId, "Open"),
      ];
      const ready = await seedPetition(initiativeId, "Ready");
      const before = await snapshotPublished(open);

      const blocked = await call("POST", `/api/v1/petitions/${ready}/publish`);
      assert.equal(blocked.status, 409, blocked.message);
      assert.equal((await mods.store.getPetition(ready))?.status, "Ready");
      assert.deepEqual(await snapshotPublished(open), before);
    });

    it("a publish that fails after reserving releases the reservation", async () => {
      const initiativeId = createInitiative();
      const draftStatus = await seedPetition(initiativeId, "Draft");
      const result = await call("POST", `/api/v1/petitions/${draftStatus}/publish`);
      assert.notEqual(result.status, 200, result.message);
      assert.equal((await mods.store.getPetition(draftStatus))?.status, "Draft");
      assert.deepEqual(await slotsOf(initiativeId), []);
    });

    it("an unauthorized or cross-steward publish reserves nothing", async () => {
      const initiativeId = createInitiative();
      const ready = await seedPetition(initiativeId, "Ready");
      for (const [caller, expected] of [
        ["anonymous", 401],
        ["other", 403],
      ] as Array<[Caller, number]>) {
        const result = await call("POST", `/api/v1/petitions/${ready}/publish`, caller);
        assert.equal(result.status, expected, result.message);
      }
      assert.equal((await mods.store.getPetition(ready))?.status, "Ready");
      assert.deepEqual(await slotsOf(initiativeId), []);
    });

    it("lifecycle publication takes a slot and is rejected when none is free", async () => {
      const initiativeId = createInitiative();
      const drafts = [await createDraft(initiativeId), await createDraft(initiativeId)];
      await prepareLifecycleDraft(initiativeId, "First Petition");
      const first = await mods.lifecycle.publishInitiativePetitionStage(identity, initiativeId);
      assert.equal(first.status, "Open");
      assert.deepEqual(
        (await slotsOf(initiativeId)).map((slot) => [slot.state, slot.petitionId ?? slot.draftId]),
        [
          ["draft", drafts[0]!.draftId],
          ["draft", drafts[1]!.draftId],
          ["published", first.petitionId],
        ],
      );
      const before = await snapshotPublished([first.petitionId]);
      const eventsBefore = await outboxEvents(initiativeId);

      const blockedDraftId = await prepareLifecycleDraft(initiativeId, "Over the limit");
      await assert.rejects(
        () => mods.lifecycle.publishAdditionalInitiativePetitionForTests(identity, initiativeId),
        /Petition limit reached/,
      );
      assert.equal(
        await mods.store.getPetition(mods.lifecycle.petitionIdForDraft(blockedDraftId)),
        null,
      );
      assert.equal((await slotsOf(initiativeId)).length, 3);
      assert.deepEqual(await snapshotPublished([first.petitionId]), before);
      assert.deepEqual(await outboxEvents(initiativeId), eventsBefore);
    });

    it("the single-Petition publication guard is unchanged", async () => {
      const initiativeId = createInitiative();
      await prepareLifecycleDraft(initiativeId, "First");
      await mods.lifecycle.publishInitiativePetitionStage(identity, initiativeId);
      await prepareLifecycleDraft(initiativeId, "Second");
      await assert.rejects(
        () => mods.lifecycle.publishInitiativePetitionStage(identity, initiativeId),
        /already been published/,
      );
      assert.equal((await slotsOf(initiativeId)).length, 1);
    });
  });

  describe("transaction rollback", () => {
    it("a failure after the slot insert leaves neither the slot nor the draft", async () => {
      const initiativeId = createInitiative();
      const kept = await createDraft(initiativeId);
      mods.slots.setPetitionSlotFaultForTests("after-draft-slot");
      try {
        const result = await call("POST", draftsPath(initiativeId));
        assert.match(result.message, /Injected Petition slot fault/);
        assert.notEqual(result.status, 201);
      } finally {
        mods.slots.setPetitionSlotFaultForTests(null);
      }
      assert.deepEqual(await listDrafts(initiativeId), [kept.draftId]);
      assert.deepEqual(
        (await slotsOf(initiativeId)).map((slot) => slot.draftId),
        [kept.draftId],
      );
    });

    it("a failure after the draft delete restores both the draft and its slot", async () => {
      const initiativeId = createInitiative();
      const draft = await createDraft(initiativeId);
      const slotsBefore = await slotsOf(initiativeId);
      mods.slots.setPetitionSlotFaultForTests("after-draft-delete");
      try {
        const result = await call("DELETE", `${draftsPath(initiativeId)}/${draft.draftId}`);
        assert.match(result.message, /Injected Petition slot fault/);
      } finally {
        mods.slots.setPetitionSlotFaultForTests(null);
      }
      assert.deepEqual(await listDrafts(initiativeId), [draft.draftId]);
      assert.deepEqual(await slotsOf(initiativeId), slotsBefore);
    });
  });

  describe("authorization and Initiative isolation", () => {
    it("non-stewards cannot create or delete drafts and occupy no slot", async () => {
      const initiativeId = createInitiative();
      const draft = await createDraft(initiativeId);
      for (const [caller, expected] of [
        ["anonymous", 401],
        ["other", 403],
      ] as Array<[Caller, number]>) {
        assert.equal((await call("POST", draftsPath(initiativeId), caller)).status, expected);
        assert.equal(
          (await call("DELETE", `${draftsPath(initiativeId)}/${draft.draftId}`, caller)).status,
          expected,
        );
      }
      assert.deepEqual(
        (await slotsOf(initiativeId)).map((slot) => slot.draftId),
        [draft.draftId],
      );
    });

    it("slots are counted per Initiative and cannot be released from another", async () => {
      const full = createInitiative();
      const sibling = createInitiative();
      const drafts = [await createDraft(full), await createDraft(full), await createDraft(full)];
      const slotsBefore = await slotsOf(full);

      const siblingDraft = await createDraft(sibling);
      assert.equal(siblingDraft.initiativeId, sibling);
      const cross = await call("DELETE", `${draftsPath(sibling)}/${drafts[0]!.draftId}`);
      assert.equal(cross.status, 404, cross.message);

      assert.deepEqual(await slotsOf(full), slotsBefore);
      assert.equal((await call("POST", draftsPath(full))).status, 409);
      assert.deepEqual(
        (await slotsOf(sibling)).map((slot) => slot.draftId),
        [siblingDraft.draftId],
      );
    });
  });

  describe("storage constraints", () => {
    it("indexes allow one occupant per slot and one slot per draft or Petition", async () => {
      const initiativeId = createInitiative();
      const draft = await createDraft(initiativeId);
      const base = {
        initiativeId,
        attemptId: null,
        leaseExpiresAt: null,
        createdAt: new Date().toISOString(),
      };

      for (const slot of [
        { ...base, slotNumber: 1, state: "draft", draftId: `draft-x-${RUN}`, petitionId: null },
        { ...base, slotNumber: 2, state: "draft", draftId: draft.draftId, petitionId: null },
      ] as const) {
        await assert.rejects(
          () => mods.slotRepository.insertPetitionSlot(slot),
          (error: unknown) => mods.slotRepository.isDuplicateKeyError(error),
        );
      }

      const petitionId = `petition-x-${RUN}`;
      await mods.slotRepository.insertPetitionSlot({
        ...base,
        slotNumber: 2,
        state: "published",
        draftId: null,
        petitionId,
      });
      await assert.rejects(
        () =>
          mods.slotRepository.insertPetitionSlot({
            ...base,
            initiativeId: `initiative-elsewhere-${RUN}`,
            slotNumber: 1,
            state: "published",
            draftId: null,
            petitionId,
          }),
        (error: unknown) => mods.slotRepository.isDuplicateKeyError(error),
      );
      assert.equal((await slotsOf(initiativeId)).length, 2);
    });
  });
});
