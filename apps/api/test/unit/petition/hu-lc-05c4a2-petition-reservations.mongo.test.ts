/**
 * HU-LC-05C.4A.2 — a Petition publication attempt owns its slot reservation
 * (attemptId + lease in MongoDB server time). Only the unexpired owner can make
 * the Petition public, in the transaction that turns the slot `published`;
 * recovery releases expired reservations whose Petition is not public.
 *
 * Real Express routers + auth middleware over a process-owned single-node
 * MongoMemoryReplSet (one hu_test_ database, dropped afterwards).
 */
process.env.NODE_TEST_ENV = "true";
process.env.INITIATIVE_PERSISTENCE = "memory";
process.env.INITIATIVE_PETITION_DRAFT_PERSISTENCE = "memory";
process.env.INITIATIVE_VERSION_REVISION_PERSISTENCE = "memory";
process.env.NOTIFICATION_PERSISTENCE = "memory";
process.env.JWT_ACCESS_SECRET = "hu-lc-05c4a2-test-access-secret-0123456789abcdef";
process.env.JWT_REFRESH_SECRET = "hu-lc-05c4a2-test-refresh-secret-0123456789abcdef";
process.env.AUTH_BOOTSTRAP_FALLBACK = "false";

import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { setTimeout as sleep } from "node:timers/promises";
import { after, afterEach, before, describe, it } from "node:test";

import express from "express";
import { MongoMemoryReplSet } from "mongodb-memory-server-core";
import type { Initiative, Petition, PetitionState } from "@hu/types";

import type * as AuthTokens from "../../../src/modules/auth/auth-tokens.js";
import type * as MongoCollections from "../../../src/infrastructure/mongodb/mongo-collections.js";
import type * as MongoDatabase from "../../../src/infrastructure/mongodb/mongo-database.js";
import type * as Initiatives from "../../../src/modules/initiatives/initiative.store.js";
import type * as PetitionLifecycle from "../../../src/modules/initiative-petition-lifecycle/initiative-petition-lifecycle.service.js";
import type * as RevisionService from "../../../src/modules/initiative-version-revision/initiative-version-revision.service.js";
import type * as SlotService from "../../../src/modules/initiative-petition-slots/petition-slot.service.js";
import type * as PetitionStore from "../../../src/modules/petition/petition.store.js";
import type * as PetitionTestHelpers from "./petition-test-helpers.js";

const RUN = randomBytes(4).toString("hex");
const DATABASE = `hu_test_petition_reservations_${RUN}`;
const STEWARD = { userId: `user-lc05c4a2-steward-${RUN}`, memberId: `member-lc05c4a2-${RUN}` };
const identity = { participantId: STEWARD.memberId };
const SHORT_LEASE_MS = 300;

/** Loaded after the environment above is set; persistence adapters bind at import. */
type Mods = {
  tokens: typeof AuthTokens;
  store: typeof PetitionStore;
  lifecycle: typeof PetitionLifecycle;
  initiatives: typeof Initiatives;
  revisions: typeof RevisionService;
  slots: typeof SlotService;
  helpers: typeof PetitionTestHelpers;
  database: typeof MongoDatabase;
  collections: typeof MongoCollections;
  signerId: string;
};

type Slot = {
  initiativeId: string;
  slotNumber: number;
  state: "draft" | "reserved" | "published";
  draftId: string | null;
  petitionId: string | null;
  attemptId: string | null;
  leaseExpiresAt: Date | null;
};

let mods: Mods;
let replSet: MongoMemoryReplSet | null = null;
let server: Server | null = null;
let baseUrl = "";
let connected = false;
let counter = 0;

async function call(
  method: "GET" | "POST" | "DELETE",
  path: string,
): Promise<{ status: number; message: string; data: unknown }> {
  const token = mods.tokens.createAccessToken({
    sub: STEWARD.userId,
    memberId: STEWARD.memberId,
    role: "member",
    displayName: "LC-05C.4A.2 Test",
    email: `${STEWARD.userId}@example.test`,
  });
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    ...(method === "POST" ? { body: "{}" } : {}),
  });
  const json = (await response.json().catch(() => ({}))) as { message?: string; data?: unknown };
  return { status: response.status, message: json.message ?? "", data: json.data ?? null };
}

const draftsPath = (initiativeId: string) =>
  `/api/v1/initiative-petitions/initiative/${initiativeId}/drafts`;
const publishPath = (petitionId: string) => `/api/v1/petitions/${petitionId}/publish`;

function createInitiative(): string {
  counter += 1;
  const now = new Date().toISOString();
  const initiative = mods.initiatives.createInitiative({
    initiativeId: `initiative-lc05c4a2-${counter}-${RUN}`,
    stewardId: STEWARD.memberId,
    title: `LC-05C.4A.2 fixture ${counter}`,
    description: "Fixture Initiative for Petition reservations.",
    status: "implementation",
    lifecyclePhase: "projected",
    lifecycleProfile: "STANDARD",
    visibility: { policy: "public" },
    metadata: { activityArea: "Environment", communitySlug: "fixture-community" },
    timeline: [],
    createdAt: now,
    updatedAt: now,
  } as unknown as Initiative);
  mods.revisions.createInitialInitiativeVersionRevision(initiative, STEWARD.memberId);
  return initiative.initiativeId;
}

async function createDraft(initiativeId: string): Promise<string> {
  const result = await call("POST", draftsPath(initiativeId));
  assert.equal(result.status, 201, result.message);
  return (result.data as { draftId: string }).draftId;
}

async function slotsOf(initiativeId: string): Promise<Slot[]> {
  return mods.database
    .getMongoCollection<Slot>(mods.collections.MONGO_COLLECTIONS.initiativePetitionSlots)
    .find({ initiativeId }, { projection: { _id: 0, createdAt: 0 } })
    .sort({ slotNumber: 1 })
    .toArray();
}

async function slotOf(petitionId: string): Promise<Slot | null> {
  return mods.database
    .getMongoCollection<Slot>(mods.collections.MONGO_COLLECTIONS.initiativePetitionSlots)
    .findOne({ petitionId }, { projection: { _id: 0, createdAt: 0 } });
}

const isPublic = (status: PetitionState | undefined) =>
  status !== undefined && status !== "Draft" && status !== "Ready";

/** Slots plus public Petitions that hold none; must never exceed three. */
async function occupants(initiativeId: string): Promise<number> {
  const slots = await slotsOf(initiativeId);
  const slotted = new Set(slots.map((slot) => slot.petitionId));
  const unslottedPublic = (await mods.store.listPetitionsByInitiativeId(initiativeId)).filter(
    (petition) => isPublic(petition.status) && !slotted.has(petition.petitionId),
  );
  return slots.length + unslottedPublic.length;
}

async function seedPetition(initiativeId: string, status: PetitionState): Promise<string> {
  counter += 1;
  const petitionId = `petition-lc05c4a2-${counter}-${RUN}`;
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

function storedFields(petition: Petition | null) {
  if (!petition) {
    return null;
  }
  const { petitionId, collectiveDecisionId, status, updatedAt, subject, traceability, signatures } =
    petition;
  return { petitionId, collectiveDecisionId, status, updatedAt, subject, traceability, signatures };
}

async function outboxEventIds(pattern: string): Promise<string[]> {
  const documents = await mods.database
    .getMongoCollection<{ eventId: string }>(mods.collections.MONGO_COLLECTIONS.outbox)
    .find({ eventId: { $regex: pattern } }, { projection: { _id: 0, eventId: 1 } })
    .toArray();
  return documents.map((document) => document.eventId).sort();
}

const stageEvents = (initiativeId: string) =>
  outboxEventIds(`^initiative-lifecycle-stage-published:${initiativeId}:petition:`);
const warmEvents = (petitionId: string) =>
  outboxEventIds(`^content-translation-warm-requested:petition:${petitionId}:`);

async function eventually(check: () => Promise<boolean>, label: string): Promise<void> {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (await check()) {
      return;
    }
    await sleep(20);
  }
  assert.fail(`Timed out waiting for: ${label}`);
}

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

/** Leaves the state of a lifecycle publication whose process stopped at `fault`. */
async function crashLifecyclePublication(
  initiativeId: string,
  fault: "crash-after-reserve" | "crash-after-prepare",
): Promise<string> {
  const draftId = await prepareLifecycleDraft(initiativeId, `Crashed ${fault}`);
  mods.slots.setPetitionSlotFaultForTests(fault);
  try {
    await assert.rejects(
      () => mods.lifecycle.publishInitiativePetitionStage(identity, initiativeId),
      /Simulated publication crash/,
    );
  } finally {
    mods.slots.setPetitionSlotFaultForTests(null);
  }
  return mods.lifecycle.petitionIdForDraft(draftId);
}

describe("HU-LC-05C.4A.2 — Petition publication reservations", () => {
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

  afterEach(() => {
    mods.slots.setPetitionSlotFaultForTests(null);
    mods.slots.setPetitionReservationLeaseMsForTests(null);
    mods.slots.setPetitionFinalizePauseForTests(null);
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

  describe("original rollback race", () => {
    it("A — the original interleaving: a second attempt can neither share nor forge ownership", async () => {
      const initiativeId = createInitiative();
      await createDraft(initiativeId);
      await createDraft(initiativeId);
      const petitionId = await seedPetition(initiativeId, "Ready");

      // Attempt A reserves; attempt B can no longer share A's reservation.
      const a = (await mods.slots.reservePetitionPublication(initiativeId, petitionId))!;
      await assert.rejects(
        () => mods.slots.reservePetitionPublication(initiativeId, petitionId),
        mods.slots.PetitionPublicationInProgressError,
      );
      await assert.rejects(
        () => mods.slots.finalizePetitionPublication({ ...a, attemptId: "forged-attempt" }),
        mods.slots.PetitionReservationLostError,
      );
      assert.equal((await mods.store.getPetition(petitionId))?.status, "Ready");

      // A fails and releases only its own reservation; the Ready Petition is kept.
      await mods.slots.releasePetitionPublicationReservation(a);
      assert.equal(await slotOf(petitionId), null);
      assert.equal((await mods.store.getPetition(petitionId))?.status, "Ready");

      // A new draft takes the freed slot; B's legitimate retry is refused at the limit.
      await createDraft(initiativeId);
      await assert.rejects(
        () => mods.slots.reservePetitionPublication(initiativeId, petitionId),
        mods.slots.PetitionSlotLimitError,
      );
      const retried = await call("POST", publishPath(petitionId));
      assert.equal(retried.status, 409, retried.message);
      assert.equal((await mods.store.getPetition(petitionId))?.status, "Ready");
      assert.equal(await occupants(initiativeId), 3);
    });

    it("B — concurrent lifecycle publications and draft creation never reach four occupants", async () => {
      for (let round = 0; round < 5; round += 1) {
        const initiativeId = createInitiative();
        await createDraft(initiativeId);
        await createDraft(initiativeId);
        await prepareLifecycleDraft(initiativeId, `Race ${round}`);

        await Promise.allSettled([
          mods.lifecycle.publishInitiativePetitionStage(identity, initiativeId),
          mods.lifecycle.publishInitiativePetitionStage(identity, initiativeId),
          call("POST", draftsPath(initiativeId)),
          call("POST", draftsPath(initiativeId)),
        ]);

        assert.ok((await occupants(initiativeId)) <= 3, `round ${round}`);
        const slotted = new Set((await slotsOf(initiativeId)).map((slot) => slot.petitionId));
        for (const petition of await mods.store.listPetitionsByInitiativeId(initiativeId)) {
          if (isPublic(petition.status)) {
            assert.ok(slotted.has(petition.petitionId), `unslotted public ${petition.petitionId}`);
          }
        }
        assert.ok((await stageEvents(initiativeId)).length <= 1);
      }
    });
  });

  describe("concurrent publication", () => {
    it("C — the same Petition published concurrently: exactly one succeeds, the rest get 409", async () => {
      const initiativeId = createInitiative();
      const petitionId = await seedPetition(initiativeId, "Ready");
      const results = await Promise.all(
        Array.from({ length: 5 }, () => call("POST", publishPath(petitionId))),
      );

      assert.equal(results.filter((result) => result.status === 200).length, 1);
      for (const result of results.filter((entry) => entry.status !== 200)) {
        assert.equal(result.status, 409, result.message);
      }
      assert.equal((await mods.store.getPetition(petitionId))?.status, "Published");
      assert.deepEqual(
        (await slotsOf(initiativeId)).map((slot) => [slot.state, slot.petitionId]),
        [["published", petitionId]],
      );
    });

    it("D — different Petitions published concurrently: three succeed, the fourth gets 409", async () => {
      const initiativeId = createInitiative();
      const petitionIds = [
        await seedPetition(initiativeId, "Ready"),
        await seedPetition(initiativeId, "Ready"),
        await seedPetition(initiativeId, "Ready"),
        await seedPetition(initiativeId, "Ready"),
      ];
      const results = await Promise.all(
        petitionIds.map((petitionId) => call("POST", publishPath(petitionId))),
      );

      assert.equal(results.filter((result) => result.status === 200).length, 3);
      for (const result of results.filter((entry) => entry.status !== 200)) {
        assert.equal(result.status, 409, result.message);
      }
      const statuses = await Promise.all(
        petitionIds.map(async (petitionId) => (await mods.store.getPetition(petitionId))?.status),
      );
      assert.equal(statuses.filter((status) => status === "Published").length, 3);
      assert.equal(statuses.filter((status) => status === "Ready").length, 1);
      assert.deepEqual(
        (await slotsOf(initiativeId)).map((slot) => slot.state),
        ["published", "published", "published"],
      );
    });
  });

  describe("crash and recovery", () => {
    it("E — a crash after reservation keeps the slot reserved while the lease is active", async () => {
      const initiativeId = createInitiative();
      const afterReserve = await crashLifecyclePublication(initiativeId, "crash-after-reserve");
      assert.equal(await mods.store.getPetition(afterReserve), null);
      const reserved = (await slotOf(afterReserve))!;
      assert.equal(reserved.state, "reserved");
      assert.ok(reserved.attemptId);
      assert.ok(reserved.leaseExpiresAt instanceof Date);

      // Another request for the same Petition is refused while the lease is active.
      await assert.rejects(
        () => mods.lifecycle.publishInitiativePetitionStage(identity, initiativeId),
        /already being published/,
      );
      await mods.slots.recoverExpiredPetitionReservations(initiativeId);
      assert.deepEqual(await slotOf(afterReserve), reserved);
    });

    it("F — after the lease expires, recovery releases the slot and keeps the Ready Petition", async () => {
      const initiativeId = createInitiative();
      mods.slots.setPetitionReservationLeaseMsForTests(SHORT_LEASE_MS);
      const petitionId = await crashLifecyclePublication(initiativeId, "crash-after-prepare");
      mods.slots.setPetitionReservationLeaseMsForTests(null);
      const before = storedFields(await mods.store.getPetition(petitionId));
      assert.equal(before?.status, "Ready");
      await createDraft(initiativeId);
      await createDraft(initiativeId);
      assert.equal((await call("POST", draftsPath(initiativeId))).status, 409);

      await sleep(SHORT_LEASE_MS * 2);
      // A later request (as after a restart: only persisted state is used) recovers the slot.
      await createDraft(initiativeId);

      assert.equal(await slotOf(petitionId), null);
      assert.deepEqual(storedFields(await mods.store.getPetition(petitionId)), before);
      assert.equal(await occupants(initiativeId), 3);
    });

    it("G — recovery racing with the owner's commit: one wins, never both", async () => {
      // The owner commits while recovery is attempting to release the same slot.
      const initiativeId = createInitiative();
      const petitionId = await seedPetition(initiativeId, "Ready");
      mods.slots.setPetitionReservationLeaseMsForTests(1_000);
      const reservation = (await mods.slots.reservePetitionPublication(initiativeId, petitionId))!;
      mods.slots.setPetitionReservationLeaseMsForTests(null);

      let entered!: () => void;
      const inside = new Promise<void>((resolve) => (entered = resolve));
      let release!: () => void;
      const gate = new Promise<void>((resolve) => (release = resolve));
      mods.slots.setPetitionFinalizePauseForTests(async () => {
        entered();
        await gate;
      });

      const publication = mods.slots.finalizePetitionPublication(reservation);
      await inside;
      mods.slots.setPetitionFinalizePauseForTests(null);
      // Uncommitted: still not public and no side effect yet.
      assert.equal((await mods.store.getPetition(petitionId))?.status, "Ready");
      assert.deepEqual(await warmEvents(petitionId), []);

      await sleep(1_300);
      let recovered = false;
      const recovery = mods.slots
        .recoverExpiredPetitionReservations(initiativeId)
        .then(() => (recovered = true));
      await sleep(300);
      assert.equal(recovered, false, "recovery must wait on the owner's transaction");
      release();

      const published = await publication;
      await recovery;
      assert.equal(published.status, "Published");
      const slot = (await slotOf(petitionId))!;
      assert.equal(slot.state, "published");
      assert.equal(slot.attemptId, reservation.attemptId);
      await eventually(async () => (await warmEvents(petitionId)).length >= 1, "warm event");
    });

    it("G — recovery that wins first leaves the owner unable to publish", async () => {
      const initiativeId = createInitiative();
      const petitionId = await seedPetition(initiativeId, "Ready");
      mods.slots.setPetitionReservationLeaseMsForTests(SHORT_LEASE_MS);
      const reservation = (await mods.slots.reservePetitionPublication(initiativeId, petitionId))!;
      await sleep(SHORT_LEASE_MS * 2);

      await mods.slots.recoverExpiredPetitionReservations(initiativeId);
      await assert.rejects(
        () => mods.slots.finalizePetitionPublication(reservation),
        mods.slots.PetitionReservationLostError,
      );
      assert.equal(await slotOf(petitionId), null);
      assert.equal((await mods.store.getPetition(petitionId))?.status, "Ready");
    });

    it("H — an owner whose lease expired cannot publish, and cannot renew", async () => {
      const initiativeId = createInitiative();
      const petitionId = await seedPetition(initiativeId, "Ready");
      mods.slots.setPetitionReservationLeaseMsForTests(SHORT_LEASE_MS);
      const reservation = (await mods.slots.reservePetitionPublication(initiativeId, petitionId))!;
      await sleep(SHORT_LEASE_MS * 2);

      await assert.rejects(
        () => mods.slots.renewPetitionPublicationReservation(reservation),
        mods.slots.PetitionReservationLostError,
      );
      await assert.rejects(
        () => mods.slots.finalizePetitionPublication(reservation),
        mods.slots.PetitionReservationLostError,
      );
      assert.equal((await mods.store.getPetition(petitionId))?.status, "Ready");
      assert.equal((await slotOf(petitionId))?.state, "reserved");
      assert.deepEqual(await warmEvents(petitionId), []);

      // A new attempt takes the expired reservation over; the old owner stays locked out.
      mods.slots.setPetitionReservationLeaseMsForTests(null);
      const takeover = (await mods.slots.reservePetitionPublication(initiativeId, petitionId))!;
      assert.notEqual(takeover.attemptId, reservation.attemptId);
      await assert.rejects(
        () => mods.slots.finalizePetitionPublication(reservation),
        mods.slots.PetitionReservationLostError,
      );
      assert.equal((await mods.slots.finalizePetitionPublication(takeover)).status, "Published");
    });

    it("I — the active owner publishes atomically, with side effects only after commit", async () => {
      const initiativeId = createInitiative();
      const petitionId = await seedPetition(initiativeId, "Ready");
      const reservation = (await mods.slots.reservePetitionPublication(initiativeId, petitionId))!;
      await mods.slots.renewPetitionPublicationReservation(reservation);

      let observed: { status?: PetitionState; warm: number } | null = null;
      mods.slots.setPetitionFinalizePauseForTests(async () => {
        observed = {
          status: (await mods.store.getPetition(petitionId))?.status,
          warm: (await warmEvents(petitionId)).length,
        };
      });
      const published = await mods.slots.finalizePetitionPublication(reservation);

      assert.deepEqual(observed, { status: "Ready", warm: 0 });
      assert.equal(published.status, "Published");
      assert.deepEqual(await slotOf(petitionId), {
        initiativeId,
        slotNumber: 1,
        state: "published",
        draftId: null,
        petitionId,
        attemptId: reservation.attemptId,
        leaseExpiresAt: null,
      });
      await eventually(async () => (await warmEvents(petitionId)).length === 1, "warm event");

      // An unknown commit outcome is resolved by the slot: a repeat by the owner is a no-op.
      const repeated = await mods.slots.finalizePetitionPublication(reservation);
      assert.equal(repeated.status, "Published");
      assert.equal(repeated.updatedAt, published.updatedAt);
    });

    it("J — published slots are never released", async () => {
      const initiativeId = createInitiative();
      const petitionId = await seedPetition(initiativeId, "Ready");
      const reservation = (await mods.slots.reservePetitionPublication(initiativeId, petitionId))!;
      await mods.slots.finalizePetitionPublication(reservation);
      const before = await slotOf(petitionId);

      await mods.slots.releasePetitionPublicationReservation(reservation);
      await mods.slots.recoverExpiredPetitionReservations(initiativeId);
      assert.equal(await mods.slots.reservePetitionPublication(initiativeId, petitionId), null);
      assert.equal((await call("DELETE", `${draftsPath(initiativeId)}/${petitionId}`)).status, 404);

      assert.deepEqual(await slotOf(petitionId), before);
    });

    it("J — a public Petition holding an expired reservation keeps it as published", async () => {
      const initiativeId = createInitiative();
      const petitionId = await seedPetition(initiativeId, "Ready");
      mods.slots.setPetitionReservationLeaseMsForTests(SHORT_LEASE_MS);
      await mods.slots.reservePetitionPublication(initiativeId, petitionId);
      // Made public outside the reservation contract (e.g. a store-level script).
      await mods.store.publishPetitionForTests(petitionId);
      await sleep(SHORT_LEASE_MS * 2);

      await mods.slots.recoverExpiredPetitionReservations(initiativeId);
      assert.equal((await slotOf(petitionId))?.state, "published");
    });
  });

  describe("retry after interruption", () => {
    it("K/L — a retry after expiry resumes the same Petition: no duplicate Petition or event", async () => {
      const initiativeId = createInitiative();
      mods.slots.setPetitionReservationLeaseMsForTests(SHORT_LEASE_MS);
      const petitionId = await crashLifecyclePublication(initiativeId, "crash-after-prepare");
      mods.slots.setPetitionReservationLeaseMsForTests(null);
      const crashed = (await slotOf(petitionId))!;
      const createdBefore = (await mods.store.getPetition(petitionId))!.collectiveDecisionId;

      await assert.rejects(
        () => mods.lifecycle.publishInitiativePetitionStage(identity, initiativeId),
        /already being published/,
      );
      await sleep(SHORT_LEASE_MS * 2);

      const published = await mods.lifecycle.publishInitiativePetitionStage(identity, initiativeId);
      assert.equal(published.petitionId, petitionId);
      assert.equal(published.status, "Open");
      assert.equal(published.collectiveDecisionId, createdBefore);
      const slot = (await slotOf(petitionId))!;
      assert.equal(slot.state, "published");
      assert.equal(slot.slotNumber, crashed.slotNumber);
      assert.notEqual(slot.attemptId, crashed.attemptId);

      assert.deepEqual(
        (await mods.store.listPetitionsByInitiativeId(initiativeId)).map((petition) => [
          petition.petitionId,
          petition.status,
        ]),
        [[petitionId, "Open"]],
      );
      assert.deepEqual(await stageEvents(initiativeId), [
        `initiative-lifecycle-stage-published:${initiativeId}:petition:1:published`,
      ]);
      await eventually(async () => (await warmEvents(petitionId)).length === 1, "warm event");
    });

    it("K — a retry after recovery released the slot re-reserves and resumes the Petition", async () => {
      const initiativeId = createInitiative();
      mods.slots.setPetitionReservationLeaseMsForTests(SHORT_LEASE_MS);
      const petitionId = await crashLifecyclePublication(initiativeId, "crash-after-prepare");
      mods.slots.setPetitionReservationLeaseMsForTests(null);
      await sleep(SHORT_LEASE_MS * 2);
      await mods.slots.recoverExpiredPetitionReservations(initiativeId);
      assert.equal(await slotOf(petitionId), null);

      const published = await mods.lifecycle.publishInitiativePetitionStage(identity, initiativeId);
      assert.equal(published.petitionId, petitionId);
      assert.equal((await mods.store.listPetitionsByInitiativeId(initiativeId)).length, 1);
      assert.equal((await slotOf(petitionId))?.state, "published");
      assert.equal((await stageEvents(initiativeId)).length, 1);
    });
  });

  describe("published data and the limit", () => {
    it("M — existing signatures and published Petitions are unchanged", async () => {
      const initiativeId = createInitiative();
      const existing = await seedPetition(initiativeId, "Open");
      await mods.store.signPetition(existing, mods.signerId);
      const before = storedFields(await mods.store.getPetition(existing));
      assert.equal(before?.signatures.length, 1);

      const ready = await seedPetition(initiativeId, "Ready");
      mods.slots.setPetitionReservationLeaseMsForTests(SHORT_LEASE_MS);
      const expired = (await mods.slots.reservePetitionPublication(initiativeId, ready))!;
      await sleep(SHORT_LEASE_MS * 2);
      mods.slots.setPetitionReservationLeaseMsForTests(null);
      await mods.slots.recoverExpiredPetitionReservations(initiativeId);
      await assert.rejects(() => mods.slots.finalizePetitionPublication(expired));
      assert.equal((await call("POST", publishPath(ready))).status, 200);

      assert.deepEqual(storedFields(await mods.store.getPetition(existing)), before);
      assert.equal((await slotOf(existing))?.state, "published");
    });

    it("N — published, draft and reserved slots together enforce the three-slot limit", async () => {
      const initiativeId = createInitiative();
      await seedPetition(initiativeId, "Open");
      await createDraft(initiativeId);
      // State of an attempt that stopped after reserving (its lease still active).
      const interrupted = await seedPetition(initiativeId, "Ready");
      await mods.slots.reservePetitionPublication(initiativeId, interrupted);
      assert.equal((await slotOf(interrupted))?.state, "reserved");
      const ready = await seedPetition(initiativeId, "Ready");

      const draft = await call("POST", draftsPath(initiativeId));
      assert.equal(draft.status, 409, draft.message);
      const publish = await call("POST", publishPath(ready));
      assert.equal(publish.status, 409, publish.message);
      assert.equal((await mods.store.getPetition(ready))?.status, "Ready");
      assert.equal(await occupants(initiativeId), 3);
    });
  });
});
