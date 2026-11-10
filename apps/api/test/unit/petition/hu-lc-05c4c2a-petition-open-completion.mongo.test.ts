/**
 * HU-LC-05C.4C.2A — a working-draft Petition whose publication committed is
 * opened durably by the outbox consumer of its publication event, even when
 * the API process stopped before opening it; no author retry is needed.
 *
 * Process-owned single-node MongoMemoryReplSet (one hu_test_ database, dropped
 * afterwards); the outbox dispatcher is run explicitly, as after a restart.
 */
process.env.NODE_TEST_ENV = "true";
process.env.INITIATIVE_PERSISTENCE = "memory";
process.env.INITIATIVE_PETITION_DRAFT_PERSISTENCE = "memory";
process.env.INITIATIVE_VERSION_REVISION_PERSISTENCE = "memory";
process.env.NOTIFICATION_PERSISTENCE = "memory";
process.env.JWT_ACCESS_SECRET = "hu-lc-05c4c2a-test-access-secret-0123456789abcdef";
process.env.JWT_REFRESH_SECRET = "hu-lc-05c4c2a-test-refresh-secret-0123456789abcdef";
process.env.AUTH_BOOTSTRAP_FALLBACK = "false";

import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { after, afterEach, before, describe, it } from "node:test";

import express from "express";
import { MongoMemoryReplSet } from "mongodb-memory-server-core";
import type { Initiative, Petition } from "@hu/types";

import type * as AuthTokens from "../../../src/modules/auth/auth-tokens.js";
import type * as MongoCollections from "../../../src/infrastructure/mongodb/mongo-collections.js";
import type * as MongoDatabase from "../../../src/infrastructure/mongodb/mongo-database.js";
import type * as OutboxDispatcher from "../../../src/infrastructure/outbox/outbox.dispatcher.js";
import type * as Initiatives from "../../../src/modules/initiatives/initiative.store.js";
import type * as OpenCompletion from "../../../src/modules/initiative-petition-lifecycle/initiative-petition-open-completion.consumer.js";
import type * as PetitionLifecycle from "../../../src/modules/initiative-petition-lifecycle/initiative-petition-lifecycle.service.js";
import type * as RevisionService from "../../../src/modules/initiative-version-revision/initiative-version-revision.service.js";
import type * as SlotService from "../../../src/modules/initiative-petition-slots/petition-slot.service.js";
import type * as PetitionStore from "../../../src/modules/petition/petition.store.js";
import type * as PetitionTestHelpers from "./petition-test-helpers.js";

const RUN = randomBytes(4).toString("hex");
const DATABASE = `hu_test_petition_open_${RUN}`;
const STEWARD = { userId: `user-lc05c4c2a-${RUN}`, memberId: `member-lc05c4c2a-${RUN}` };
const identity = { participantId: STEWARD.memberId };
let notificationConsumerId = "";

/** Loaded after the environment above is set; persistence adapters bind at import. */
type Mods = {
  tokens: typeof AuthTokens;
  store: typeof PetitionStore;
  lifecycle: typeof PetitionLifecycle;
  openCompletion: typeof OpenCompletion;
  initiatives: typeof Initiatives;
  revisions: typeof RevisionService;
  slots: typeof SlotService;
  dispatcher: typeof OutboxDispatcher;
  helpers: typeof PetitionTestHelpers;
  database: typeof MongoDatabase;
  collections: typeof MongoCollections;
  signerId: string;
};

type Draft = { draftId: string };

let mods: Mods;
let replSet: MongoMemoryReplSet | null = null;
let server: Server | null = null;
let baseUrl = "";
let connected = false;
let counter = 0;

async function call(method: "POST" | "PATCH", path: string, body?: unknown) {
  const token = mods.tokens.createAccessToken({
    sub: STEWARD.userId,
    memberId: STEWARD.memberId,
    role: "member",
    displayName: "LC-05C.4C.2A Test",
    email: `${STEWARD.userId}@example.test`,
  });
  const response = await fetch(`${baseUrl}/api/v1/initiative-petitions${path}`, {
    method,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const json = (await response.json().catch(() => ({}))) as { message?: string; data?: unknown };
  return { status: response.status, message: json.message ?? "", data: json.data ?? null };
}

function createInitiative(): string {
  counter += 1;
  const now = new Date().toISOString();
  const initiative = mods.initiatives.createInitiative({
    initiativeId: `initiative-lc05c4c2a-${counter}-${RUN}`,
    stewardId: STEWARD.memberId,
    title: `Open completion ${counter}`,
    description: "Fixture Initiative for durable Petition opening.",
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

async function readyDraft(initiativeId: string): Promise<Draft> {
  const created = await call("POST", `/initiative/${initiativeId}/drafts`);
  assert.equal(created.status, 201, created.message);
  const draftId = (created.data as Draft).draftId;
  const generated = await call("POST", `/initiative/${initiativeId}/drafts/${draftId}/generate`);
  assert.equal(generated.status, 200, generated.message);
  return { draftId };
}

const publishPath = (initiativeId: string, draftId: string) =>
  `/initiative/${initiativeId}/drafts/${draftId}/publish`;

/** Publication commits, then the process "stops" before opening the Petition. */
async function crashAfterCommit(initiativeId: string): Promise<string> {
  const draft = await readyDraft(initiativeId);
  mods.slots.setPetitionSlotFaultForTests("crash-after-finalize");
  try {
    assert.notEqual((await call("POST", publishPath(initiativeId, draft.draftId))).status, 200);
  } finally {
    mods.slots.setPetitionSlotFaultForTests(null);
  }
  const petitionId = `petition-${draft.draftId}`;
  assert.equal((await mods.store.getPetition(petitionId))?.status, "Published");
  return petitionId;
}

async function petitionEvents(initiativeId: string) {
  return mods.database
    .getMongoCollection<{ eventId: string; status: string }>(
      mods.collections.MONGO_COLLECTIONS.outbox,
    )
    .find({
      eventId: { $regex: `^initiative-lifecycle-stage-published:${initiativeId}:petition:` },
    })
    .toArray();
}

async function processedClaims(eventId: string) {
  return mods.database
    .getMongoCollection<{ consumerId: string; status: string }>(
      mods.collections.MONGO_COLLECTIONS.processedEvents,
    )
    .find({ eventId }, { projection: { _id: 0, consumerId: 1, status: 1 } })
    .sort({ consumerId: 1 })
    .toArray();
}

async function slotOf(petitionId: string) {
  return mods.database
    .getMongoCollection<{ state: string; publicationVersion?: number }>(
      mods.collections.MONGO_COLLECTIONS.initiativePetitionSlots,
    )
    .findOne({ petitionId }, { projection: { _id: 0, state: 1, publicationVersion: 1 } });
}

function storedFields(petition: Petition | null) {
  if (!petition) {
    return null;
  }
  const { petitionId, status, updatedAt, subject, traceability, signatures, policy } = petition;
  return { petitionId, status, updatedAt, subject, traceability, signatures, policy };
}

describe("HU-LC-05C.4C.2A — durable Petition open completion", () => {
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
      openCompletion:
        await import("../../../src/modules/initiative-petition-lifecycle/initiative-petition-open-completion.consumer.js"),
      initiatives: await import("../../../src/modules/initiatives/initiative.store.js"),
      revisions:
        await import("../../../src/modules/initiative-version-revision/initiative-version-revision.service.js"),
      slots:
        await import("../../../src/modules/initiative-petition-slots/petition-slot.service.js"),
      dispatcher: await import("../../../src/infrastructure/outbox/outbox.dispatcher.js"),
      helpers: await import("./petition-test-helpers.js"),
      database,
      collections: await import("../../../src/infrastructure/mongodb/mongo-collections.js"),
      signerId: (await import("../../../src/modules/member/member.sample.js")).sampleMember.id,
    };

    // The same consumers the API registers at boot.
    const lifecycleStage = await import("../../../src/shared/initiative-lifecycle-stage/index.js");
    lifecycleStage.registerInitiativeLifecycleStageHandlers();
    notificationConsumerId = (
      await import("../../../src/shared/initiative-lifecycle-stage/initiative-lifecycle-stage-notification.consumer.js")
    ).INITIATIVE_LIFECYCLE_STAGE_NOTIFICATION_CONSUMER_ID;
    mods.openCompletion.registerInitiativePetitionOpenCompletionHandler();

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

  afterEach(() => {
    mods.slots.setPetitionSlotFaultForTests(null);
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

  it("A/B/C/E — after a crash right after commit, the dispatcher opens the Petition with no author retry", async () => {
    const initiativeId = createInitiative();
    const petitionId = await crashAfterCommit(initiativeId);
    const pending = await petitionEvents(initiativeId);
    assert.deepEqual(
      pending.map((event) => event.status),
      ["pending"],
    );

    // After restart: boot recovery / the safety sweep dispatch pending events.
    await mods.dispatcher.dispatchOutboxOnceForTests();

    const petition = await mods.store.getPetition(petitionId);
    assert.equal(petition?.status, "Open");
    assert.ok(petition?.policy.endorsementPeriod.opensAt);
    const events = await petitionEvents(initiativeId);
    assert.deepEqual(
      events.map((event) => event.status),
      ["published"],
    );
    assert.deepEqual(await slotOf(petitionId), { state: "published", publicationVersion: 1 });
    assert.deepEqual(await processedClaims(events[0]!.eventId), [
      { consumerId: notificationConsumerId, status: "completed" },
      {
        consumerId: mods.openCompletion.INITIATIVE_PETITION_OPEN_COMPLETION_CONSUMER_ID,
        status: "completed",
      },
    ]);
  });

  it("D — a redelivered event changes nothing and notifies nobody twice", async () => {
    const initiativeId = createInitiative();
    const petitionId = await crashAfterCommit(initiativeId);
    await mods.dispatcher.dispatchOutboxOnceForTests();
    const opened = storedFields(await mods.store.getPetition(petitionId));
    const [event] = await petitionEvents(initiativeId);

    // Simulate redelivery (e.g. a crash before the outbox row was marked published).
    await mods.database
      .getMongoCollection(mods.collections.MONGO_COLLECTIONS.outbox)
      .updateOne({ eventId: event!.eventId }, { $set: { status: "pending" } });
    await mods.dispatcher.dispatchOutboxOnceForTests();

    assert.deepEqual(storedFields(await mods.store.getPetition(petitionId)), opened);
    const claims = await processedClaims(event!.eventId);
    assert.equal(claims.length, 2);
    assert.ok(claims.every((claim) => claim.status === "completed"));
    assert.equal((await petitionEvents(initiativeId)).length, 1);
  });

  it("F — signatures remain isolated per Petition after recovery", async () => {
    const initiativeId = createInitiative();
    const recovered = await crashAfterCommit(initiativeId);
    await mods.dispatcher.dispatchOutboxOnceForTests();
    const other = await readyDraft(initiativeId);
    const second = (await call("POST", publishPath(initiativeId, other.draftId))).data as Petition;
    assert.equal(second.status, "Open");

    await mods.store.signPetition(recovered, mods.signerId);
    const active = (petition: Petition | null) =>
      (petition?.signatures ?? []).filter((signature) => signature.status === "Active").length;
    assert.equal(active(await mods.store.getPetition(recovered)), 1);
    assert.equal(active(await mods.store.getPetition(second.petitionId)), 0);
  });

  it("G — concurrent recovery and a concurrent author retry are safe", async () => {
    const initiativeId = createInitiative();
    const petitionId = await crashAfterCommit(initiativeId);
    const [event] = await petitionEvents(initiativeId);
    const draftId = petitionId.replace(/^petition-/, "");

    const outcomes = await Promise.all([
      ...Array.from({ length: 5 }, () =>
        mods.lifecycle.completeWorkingDraftPetitionOpening({
          initiativeId,
          petitionId,
          publicationVersion: 1,
        }),
      ),
      call("POST", publishPath(initiativeId, draftId)).then((result) => {
        assert.equal(result.status, 200, result.message);
        return "retried";
      }),
    ]);
    assert.ok(outcomes.every((outcome) => ["opened", "already_open", "retried"].includes(outcome)));

    const petition = await mods.store.getPetition(petitionId);
    assert.equal(petition?.status, "Open");
    await mods.dispatcher.dispatchOutboxOnceForTests();
    assert.deepEqual(
      storedFields(await mods.store.getPetition(petitionId)),
      storedFields(petition),
    );
    assert.equal((await petitionEvents(initiativeId)).length, 1);
    assert.equal((await processedClaims(event!.eventId)).length, 2);
  });

  it("H — an Open Petition is left unchanged, including a legacy-published one", async () => {
    const initiativeId = createInitiative();
    const draft = await readyDraft(initiativeId);
    const published = (await call("POST", publishPath(initiativeId, draft.draftId)))
      .data as Petition;
    assert.equal(published.status, "Open");
    const before = storedFields(await mods.store.getPetition(published.petitionId));
    await mods.dispatcher.dispatchOutboxOnceForTests();
    assert.deepEqual(storedFields(await mods.store.getPetition(published.petitionId)), before);

    const legacyInitiative = createInitiative();
    await mods.lifecycle.generateInitiativePetitionDraft(identity, legacyInitiative);
    const legacy = await mods.lifecycle.publishInitiativePetitionStage(identity, legacyInitiative);
    const legacyBefore = storedFields(await mods.store.getPetition(legacy.petitionId));
    await mods.dispatcher.dispatchOutboxOnceForTests();
    assert.deepEqual(storedFields(await mods.store.getPetition(legacy.petitionId)), legacyBefore);
    assert.equal(
      await mods.lifecycle.completeWorkingDraftPetitionOpening({
        initiativeId: legacyInitiative,
        petitionId: legacy.petitionId,
        publicationVersion: 1,
      }),
      "not_applicable",
    );
  });

  it("I — never opens a Petition that was not published through its slot", async () => {
    const initiativeId = createInitiative();
    const draft = await readyDraft(initiativeId);
    mods.slots.setPetitionSlotFaultForTests("crash-after-prepare");
    assert.notEqual((await call("POST", publishPath(initiativeId, draft.draftId))).status, 200);
    mods.slots.setPetitionSlotFaultForTests(null);
    const readyId = `petition-${draft.draftId}`;
    assert.equal((await mods.store.getPetition(readyId))?.status, "Ready");
    assert.deepEqual(await petitionEvents(initiativeId), []);

    assert.equal(
      await mods.lifecycle.completeWorkingDraftPetitionOpening({
        initiativeId,
        petitionId: readyId,
        publicationVersion: 1,
      }),
      "not_applicable",
    );
    assert.equal((await mods.store.getPetition(readyId))?.status, "Ready");

    // A Published Petition outside the working-draft contract is not opened either.
    const otherInitiative = createInitiative();
    const seededId = `petition-lc05c4c2a-seeded-${RUN}`;
    await mods.helpers.seedApprovedDecision(`decision-${seededId}`, otherInitiative);
    await mods.store.createPetition(
      mods.helpers.buildFixturePetition({
        petitionId: seededId,
        decisionId: `decision-${seededId}`,
        initiativeId: otherInitiative,
      }),
    );
    await mods.store.preparePetition(seededId);
    await mods.store.publishPetitionForTests(seededId);
    assert.equal(
      await mods.lifecycle.completeWorkingDraftPetitionOpening({
        initiativeId: otherInitiative,
        petitionId: seededId,
        publicationVersion: 1,
      }),
      "not_applicable",
    );
    assert.equal((await mods.store.getPetition(seededId))?.status, "Published");

    // A forged version never matches the slot.
    const committed = await crashAfterCommit(createInitiative());
    const committedInitiative = (await mods.store.getPetition(committed))!.subject.initiativeId;
    assert.equal(
      await mods.lifecycle.completeWorkingDraftPetitionOpening({
        initiativeId: committedInitiative,
        petitionId: committed,
        publicationVersion: 99,
      }),
      "not_applicable",
    );
    assert.equal((await mods.store.getPetition(committed))?.status, "Published");
  });
});
