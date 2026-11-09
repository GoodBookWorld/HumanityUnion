/**
 * HU-LC-05C.4A.3 — no internal path can make a Petition public without a slot:
 * the store's only Ready → Published transition requires, in the same MongoDB
 * transaction, a published slot of the Petition's own Initiative.
 *
 * Process-owned single-node MongoMemoryReplSet (one hu_test_ database, dropped
 * afterwards) plus the real legacy Petition router.
 */
process.env.NODE_TEST_ENV = "true";
process.env.INITIATIVE_PERSISTENCE = "memory";
process.env.INITIATIVE_PETITION_DRAFT_PERSISTENCE = "memory";
process.env.INITIATIVE_VERSION_REVISION_PERSISTENCE = "memory";
process.env.NOTIFICATION_PERSISTENCE = "memory";
process.env.JWT_ACCESS_SECRET = "hu-lc-05c4a3-test-access-secret-0123456789abcdef";
process.env.JWT_REFRESH_SECRET = "hu-lc-05c4a3-test-refresh-secret-0123456789abcdef";
process.env.AUTH_BOOTSTRAP_FALLBACK = "false";

import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { after, before, describe, it } from "node:test";

import express from "express";
import { MongoMemoryReplSet } from "mongodb-memory-server-core";
import type { Initiative, Petition, PetitionState } from "@hu/types";

import type * as AuthTokens from "../../../src/modules/auth/auth-tokens.js";
import type * as MongoCollections from "../../../src/infrastructure/mongodb/mongo-collections.js";
import type * as MongoDatabase from "../../../src/infrastructure/mongodb/mongo-database.js";
import type * as MongoTransaction from "../../../src/infrastructure/mongodb/mongo-transaction.js";
import type * as Initiatives from "../../../src/modules/initiatives/initiative.store.js";
import type * as PetitionLifecycle from "../../../src/modules/initiative-petition-lifecycle/initiative-petition-lifecycle.service.js";
import type * as RevisionService from "../../../src/modules/initiative-version-revision/initiative-version-revision.service.js";
import type * as SlotService from "../../../src/modules/initiative-petition-slots/petition-slot.service.js";
import type * as PetitionErrors from "../../../src/modules/petition/petition.errors.js";
import type * as PetitionStore from "../../../src/modules/petition/petition.store.js";
import type * as PetitionTestHelpers from "./petition-test-helpers.js";

const RUN = randomBytes(4).toString("hex");
const DATABASE = `hu_test_petition_bypass_${RUN}`;
const STEWARD = { userId: `user-lc05c4a3-steward-${RUN}`, memberId: `member-lc05c4a3-${RUN}` };
const identity = { participantId: STEWARD.memberId };
const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../src");

/** Loaded after the environment above is set; persistence adapters bind at import. */
type Mods = {
  tokens: typeof AuthTokens;
  store: typeof PetitionStore;
  errors: typeof PetitionErrors;
  lifecycle: typeof PetitionLifecycle;
  initiatives: typeof Initiatives;
  revisions: typeof RevisionService;
  slots: typeof SlotService;
  transaction: typeof MongoTransaction;
  helpers: typeof PetitionTestHelpers;
  database: typeof MongoDatabase;
  collections: typeof MongoCollections;
  signerId: string;
};

type Slot = {
  initiativeId: string;
  slotNumber: number;
  state: "draft" | "reserved" | "published";
  petitionId: string | null;
  attemptId: string | null;
};

let mods: Mods;
let replSet: MongoMemoryReplSet | null = null;
let server: Server | null = null;
let baseUrl = "";
let connected = false;
let counter = 0;

function createInitiative(): string {
  counter += 1;
  const now = new Date().toISOString();
  const initiative = mods.initiatives.createInitiative({
    initiativeId: `initiative-lc05c4a3-${counter}-${RUN}`,
    stewardId: STEWARD.memberId,
    title: `LC-05C.4A.3 fixture ${counter}`,
    description: "Fixture Initiative for the Petition publication bypass.",
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

/** A Ready Petition, created exactly as the verification scripts create theirs. */
async function readyPetition(initiativeId: string): Promise<string> {
  counter += 1;
  const petitionId = `petition-lc05c4a3-${counter}-${RUN}`;
  const decisionId = `decision-${petitionId}`;
  await mods.helpers.seedApprovedDecision(decisionId, initiativeId);
  await mods.store.createPetition(
    mods.helpers.buildFixturePetition({ petitionId, decisionId, initiativeId }),
  );
  await mods.store.preparePetition(petitionId);
  return petitionId;
}

async function slotsOf(initiativeId: string): Promise<Slot[]> {
  return mods.database
    .getMongoCollection<Slot>(mods.collections.MONGO_COLLECTIONS.initiativePetitionSlots)
    .find({ initiativeId }, { projection: { _id: 0, createdAt: 0, leaseExpiresAt: 0 } })
    .sort({ slotNumber: 1 })
    .toArray();
}

async function statusOf(petitionId: string): Promise<PetitionState | undefined> {
  return (await mods.store.getPetition(petitionId))?.status;
}

const isPublic = (status: PetitionState) => status !== "Draft" && status !== "Ready";

async function publicCount(initiativeId: string): Promise<number> {
  return (await mods.store.listPetitionsByInitiativeId(initiativeId)).filter((petition) =>
    isPublic(petition.status),
  ).length;
}

function storedFields(petition: Petition | null) {
  if (!petition) {
    return null;
  }
  const { petitionId, collectiveDecisionId, status, updatedAt, subject, traceability, signatures } =
    petition;
  return { petitionId, collectiveDecisionId, status, updatedAt, subject, traceability, signatures };
}

/** Calls the store transition directly, as an internal caller could. */
function publishInOwnTransaction(petitionId: string): Promise<Petition> {
  return mods.transaction.runMongoTransaction((session) =>
    mods.store.publishPetitionInSession(petitionId, session),
  );
}

async function fullInitiativeWithPublished(): Promise<{
  initiativeId: string;
  published: string[];
}> {
  const initiativeId = createInitiative();
  const published: string[] = [];
  for (let index = 0; index < 3; index += 1) {
    const petitionId = await readyPetition(initiativeId);
    await mods.slots.publishPetitionWithinSlotLimit(petitionId);
    await mods.store.openPetition(petitionId);
    published.push(petitionId);
  }
  await mods.store.signPetition(published[0]!, mods.signerId);
  return { initiativeId, published };
}

function sourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const full = path.join(directory, entry);
    return statSync(full).isDirectory() ? sourceFiles(full) : full.endsWith(".ts") ? [full] : [];
  });
}

describe("HU-LC-05C.4A.3 — no Petition publication bypass", () => {
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
      errors: await import("../../../src/modules/petition/petition.errors.js"),
      lifecycle:
        await import("../../../src/modules/initiative-petition-lifecycle/initiative-petition-lifecycle.service.js"),
      initiatives: await import("../../../src/modules/initiatives/initiative.store.js"),
      revisions:
        await import("../../../src/modules/initiative-version-revision/initiative-version-revision.service.js"),
      slots:
        await import("../../../src/modules/initiative-petition-slots/petition-slot.service.js"),
      transaction: await import("../../../src/infrastructure/mongodb/mongo-transaction.js"),
      helpers: await import("./petition-test-helpers.js"),
      database,
      collections: await import("../../../src/infrastructure/mongodb/mongo-collections.js"),
      signerId: (await import("../../../src/modules/member/member.sample.js")).sampleMember.id,
    };

    const petitionRouter = (await import("../../../src/modules/petition/petition.routes.js"))
      .default;
    const app = express();
    app.use(express.json());
    app.use("/api/v1/petitions", petitionRouter);
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

  describe("A — direct store-level publication cannot bypass the limit", () => {
    it("the unguarded store publish no longer exists", () => {
      assert.equal("publishPetition" in mods.store, false);
    });

    it("the store transition refuses a Petition without a published slot", async () => {
      const initiativeId = createInitiative();
      const petitionId = await readyPetition(initiativeId);

      await assert.rejects(
        () => publishInOwnTransaction(petitionId),
        mods.errors.PetitionSlotRequiredError,
      );
      assert.equal(await statusOf(petitionId), "Ready");
      assert.deepEqual(await slotsOf(initiativeId), []);
    });

    it("a reserved (not yet finalized) slot is not enough", async () => {
      const initiativeId = createInitiative();
      const petitionId = await readyPetition(initiativeId);
      const reservation = await mods.slots.reservePetitionPublication(initiativeId, petitionId);
      assert.ok(reservation);

      await assert.rejects(
        () => publishInOwnTransaction(petitionId),
        mods.errors.PetitionSlotRequiredError,
      );
      await assert.rejects(
        () => mods.slots.publishPetitionInPublishedSlot(petitionId),
        mods.errors.PetitionSlotRequiredError,
      );
      assert.equal(await statusOf(petitionId), "Ready");
      assert.equal((await slotsOf(initiativeId))[0]?.state, "reserved");
      await mods.slots.releasePetitionPublicationReservation(reservation);
    });

    it("a published slot recorded under another Initiative is not accepted", async () => {
      const initiativeId = createInitiative();
      const petitionId = await readyPetition(initiativeId);
      await mods.database
        .getMongoCollection(mods.collections.MONGO_COLLECTIONS.initiativePetitionSlots)
        .insertOne({
          initiativeId: `initiative-elsewhere-${RUN}`,
          slotNumber: 1,
          state: "published",
          draftId: null,
          petitionId,
          attemptId: null,
          leaseExpiresAt: null,
          createdAt: new Date().toISOString(),
        });

      await assert.rejects(
        () => publishInOwnTransaction(petitionId),
        mods.errors.PetitionSlotRequiredError,
      );
      assert.equal(await statusOf(petitionId), "Ready");
    });

    it("the test-only seed refuses to run outside NODE_TEST_ENV", async () => {
      const initiativeId = createInitiative();
      const petitionId = await readyPetition(initiativeId);
      process.env.NODE_TEST_ENV = "false";
      try {
        await assert.rejects(
          () => mods.store.publishPetitionForTests(petitionId),
          mods.errors.PetitionSlotRequiredError,
        );
      } finally {
        process.env.NODE_TEST_ENV = "true";
      }
      assert.equal(await statusOf(petitionId), "Ready");
    });
  });

  describe("B/C — authorized publication succeeds with exactly one reservation", () => {
    it("the shared contract publishes a Ready Petition into one published slot", async () => {
      const initiativeId = createInitiative();
      const petitionId = await readyPetition(initiativeId);

      const published = await mods.slots.publishPetitionWithinSlotLimit(petitionId);
      assert.equal(published?.status, "Published");
      const slots = await slotsOf(initiativeId);
      assert.equal(slots.length, 1);
      assert.equal(slots[0]?.state, "published");
      assert.equal(slots[0]?.petitionId, petitionId);
      assert.ok(slots[0]?.attemptId);

      // Publishing again neither publishes twice nor reserves a second slot.
      await assert.rejects(() => mods.slots.publishPetitionWithinSlotLimit(petitionId));
      assert.deepEqual(await slotsOf(initiativeId), slots);
      assert.equal(await mods.slots.publishPetitionWithinSlotLimit(`missing-${RUN}`), null);
    });

    it("the HTTP route and the lifecycle each take exactly one slot", async () => {
      const initiativeId = createInitiative();
      const petitionId = await readyPetition(initiativeId);
      const token = mods.tokens.createAccessToken({
        sub: STEWARD.userId,
        memberId: STEWARD.memberId,
        role: "member",
        displayName: "LC-05C.4A.3 Test",
        email: `${STEWARD.userId}@example.test`,
      });
      const response = await fetch(`${baseUrl}/api/v1/petitions/${petitionId}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: "{}",
      });
      assert.equal(response.status, 200);

      const lifecycleInitiative = createInitiative();
      await mods.lifecycle.generateInitiativePetitionDraft(identity, lifecycleInitiative);
      mods.lifecycle.saveInitiativePetitionDraft(identity, lifecycleInitiative, {
        title: "Lifecycle",
        publicSummary: "Lifecycle — summary.",
        requestStatement: "Please act.",
        expectedOutcome: "Acted on.",
        supportingContext: "Context.",
        keyArguments: ["Argument"],
      });
      const lifecyclePetition = await mods.lifecycle.publishInitiativePetitionStage(
        identity,
        lifecycleInitiative,
      );
      assert.equal(lifecyclePetition.status, "Open");

      for (const [owner, id] of [
        [initiativeId, petitionId],
        [lifecycleInitiative, lifecyclePetition.petitionId],
      ] as const) {
        assert.deepEqual(
          (await slotsOf(owner)).map((slot) => [slot.state, slot.petitionId]),
          [["published", id]],
        );
      }
    });

    it("a failed publication leaves no reservation behind", async () => {
      const initiativeId = createInitiative();
      counter += 1;
      const petitionId = `petition-lc05c4a3-draft-${counter}-${RUN}`;
      await mods.helpers.seedApprovedDecision(`decision-${petitionId}`, initiativeId);
      await mods.store.createPetition(
        mods.helpers.buildFixturePetition({
          petitionId,
          decisionId: `decision-${petitionId}`,
          initiativeId,
        }),
      );

      await assert.rejects(() => mods.slots.publishPetitionWithinSlotLimit(petitionId));
      assert.equal(await statusOf(petitionId), "Draft");
      assert.deepEqual(await slotsOf(initiativeId), []);
    });
  });

  describe("D — concurrent publication remains safe", () => {
    it("same and different Petitions published concurrently through the shared contract", async () => {
      const initiativeId = createInitiative();
      const petitionIds = [
        await readyPetition(initiativeId),
        await readyPetition(initiativeId),
        await readyPetition(initiativeId),
        await readyPetition(initiativeId),
      ];
      const results = await Promise.allSettled([
        ...petitionIds.map((petitionId) => mods.slots.publishPetitionWithinSlotLimit(petitionId)),
        mods.slots.publishPetitionWithinSlotLimit(petitionIds[0]!),
        mods.slots.publishPetitionWithinSlotLimit(petitionIds[0]!),
      ]);

      assert.equal(results.filter((result) => result.status === "fulfilled").length, 3);
      assert.equal(await publicCount(initiativeId), 3);
      const slots = await slotsOf(initiativeId);
      assert.deepEqual(
        slots.map((slot) => slot.state),
        ["published", "published", "published"],
      );
      assert.equal(new Set(slots.map((slot) => slot.petitionId)).size, 3);
    });
  });

  describe("E/F — no fourth public Petition; published data unchanged", () => {
    it("every publication path refuses a fourth Petition and leaves the others untouched", async () => {
      const { initiativeId, published } = await fullInitiativeWithPublished();
      const before = await Promise.all(
        published.map(async (petitionId) => storedFields(await mods.store.getPetition(petitionId))),
      );
      assert.equal(before[0]?.signatures.length, 1);
      const fourth = await readyPetition(initiativeId);

      await assert.rejects(
        () => mods.slots.publishPetitionWithinSlotLimit(fourth),
        mods.slots.PetitionSlotLimitError,
      );
      await assert.rejects(
        () => mods.slots.publishPetitionInPublishedSlot(fourth),
        mods.errors.PetitionSlotRequiredError,
      );
      await assert.rejects(
        () => publishInOwnTransaction(fourth),
        mods.errors.PetitionSlotRequiredError,
      );
      await assert.rejects(
        () => mods.slots.reservePetitionPublication(initiativeId, fourth),
        mods.slots.PetitionSlotLimitError,
      );

      assert.equal(await statusOf(fourth), "Ready");
      assert.equal(await publicCount(initiativeId), 3);
      assert.equal((await slotsOf(initiativeId)).length, 3);
      assert.deepEqual(
        await Promise.all(
          published.map(async (petitionId) =>
            storedFields(await mods.store.getPetition(petitionId)),
          ),
        ),
        before,
      );
    });
  });

  describe("G — internal scripts cannot bypass protection", () => {
    it("no production source publishes outside the slot contract", () => {
      const offenders: string[] = [];
      for (const file of sourceFiles(SRC)) {
        const relative = path.relative(SRC, file);
        const text = readFileSync(file, "utf8");
        if (
          /\bpublishPetitionInSession\b/.test(text) &&
          ![
            "modules/petition/petition.store.ts",
            "modules/initiative-petition-slots/petition-slot.service.ts",
          ].includes(relative)
        ) {
          offenders.push(`${relative}: publishPetitionInSession`);
        }
        if (
          /\bpublishPetitionForTests\b/.test(text) &&
          relative !== "modules/petition/petition.store.ts"
        ) {
          offenders.push(`${relative}: publishPetitionForTests`);
        }
        if (/\bpublishPetition\b/.test(text)) {
          offenders.push(`${relative}: publishPetition`);
        }
      }
      assert.deepEqual(offenders, []);
    });

    it("every verification script publishes through the shared contract", () => {
      for (const script of [
        "verify-petition-signed-event.ts",
        "verify-petition-persistence.ts",
        "verify-participant-action-petition-signed.ts",
        "verify-initiative-lifecycle-revision-e2e.ts",
        "verify-initiative-decision-vote-participant-actions.ts",
      ]) {
        const text = readFileSync(path.join(SRC, "scripts", script), "utf8");
        assert.match(text, /publishPetitionWithinSlotLimit\(petitionId\)/, script);
        assert.match(text, /deleteSlotOfDeletedPetitionForTests\(petitionId\)/, script);
      }
    });

    it("the script publication flow is refused on a full Initiative", async () => {
      const { initiativeId } = await fullInitiativeWithPublished();
      const scriptPetition = await readyPetition(initiativeId);

      await assert.rejects(
        () => mods.slots.publishPetitionWithinSlotLimit(scriptPetition),
        mods.slots.PetitionSlotLimitError,
      );
      assert.equal(await statusOf(scriptPetition), "Ready");
      assert.equal(await publicCount(initiativeId), 3);
    });

    it("script cleanup never releases the slot of an existing Petition", async () => {
      const { initiativeId, published } = await fullInitiativeWithPublished();
      await assert.rejects(
        () => mods.slots.deleteSlotOfDeletedPetitionForTests(published[0]!),
        /existing Petition/,
      );
      assert.equal((await slotsOf(initiativeId)).length, 3);

      await mods.store.deletePetitionsByIdForTests(published[2]!);
      await mods.slots.deleteSlotOfDeletedPetitionForTests(published[2]!);
      assert.deepEqual(
        (await slotsOf(initiativeId)).map((slot) => slot.petitionId),
        published.slice(0, 2),
      );
    });
  });
});
