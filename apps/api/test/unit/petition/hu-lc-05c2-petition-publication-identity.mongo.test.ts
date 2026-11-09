/**
 * HU-LC-05C.2 — every lifecycle Petition publication gets its own permanent
 * petitionId, synthetic Collective Decision, publication event and signatures;
 * duplicate submissions never publish twice or overwrite a Petition.
 *
 * Process-owned single-node MongoMemoryReplSet on 127.0.0.1 and one hu_test_
 * database (dropped afterwards); every other Lifecycle store runs in memory.
 */
process.env.NODE_TEST_ENV = "true";
process.env.INITIATIVE_PERSISTENCE = "memory";
process.env.INITIATIVE_PETITION_DRAFT_PERSISTENCE = "memory";
process.env.INITIATIVE_VERSION_REVISION_PERSISTENCE = "memory";
process.env.NOTIFICATION_PERSISTENCE = "memory";

import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { after, before, describe, it } from "node:test";

import { MongoMemoryReplSet } from "mongodb-memory-server-core";
import type { Initiative, Petition } from "@hu/types";

import type * as CollectiveDecisions from "../../../src/modules/collective-decision/collective-decision.store.js";
import type * as Initiatives from "../../../src/modules/initiatives/initiative.store.js";
import type * as RevisionService from "../../../src/modules/initiative-version-revision/initiative-version-revision.service.js";
import type * as PetitionLifecycle from "../../../src/modules/initiative-petition-lifecycle/initiative-petition-lifecycle.service.js";
import type * as PetitionStore from "../../../src/modules/petition/petition.store.js";
import type * as MongoDatabase from "../../../src/infrastructure/mongodb/mongo-database.js";
import type * as MongoCollections from "../../../src/infrastructure/mongodb/mongo-collections.js";
import type * as PetitionTestHelpers from "./petition-test-helpers.js";

const RUN = randomBytes(4).toString("hex");
const DATABASE = `hu_test_petition_identity_${RUN}`;
const STEWARD = `member-lc05c2-steward-${RUN}`;
const identity = { participantId: STEWARD };

/** Loaded after the environment above is set; persistence adapters bind at import. */
type Mods = {
  lifecycle: typeof PetitionLifecycle;
  store: typeof PetitionStore;
  decisions: typeof CollectiveDecisions;
  initiatives: typeof Initiatives;
  revisions: typeof RevisionService;
  helpers: typeof PetitionTestHelpers;
  database: typeof MongoDatabase;
  collections: typeof MongoCollections;
  signerId: string;
};

let mods: Mods;
let replSet: MongoMemoryReplSet | null = null;
let connected = false;

function createInitiative(label: string): Initiative {
  const now = new Date().toISOString();
  const initiative = mods.initiatives.createInitiative({
    initiativeId: `initiative-lc05c2-${label}-${RUN}`,
    stewardId: STEWARD,
    title: `LC-05C.2 ${label}`,
    description: "Fixture Initiative for Petition publication identity.",
    status: "implementation",
    lifecyclePhase: "projected",
    lifecycleProfile: "STANDARD",
    visibility: { policy: "public" },
    metadata: { activityArea: "Environment", communitySlug: "fixture-community" },
    timeline: [],
    createdAt: now,
    updatedAt: now,
  } as unknown as Initiative);
  mods.revisions.createInitialInitiativeVersionRevision(initiative, STEWARD);
  return initiative;
}

/** Generates and completes the Initiative's working Petition draft; returns its draftId. */
async function prepareDraft(initiativeId: string, title: string): Promise<string> {
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

/** Stored Petition fields (excludes values derived on every read). */
function storedFields(petition: Petition | null) {
  if (!petition) {
    return null;
  }
  const { petitionId, collectiveDecisionId, status, updatedAt, subject, traceability, signatures } =
    petition;
  return { petitionId, collectiveDecisionId, status, updatedAt, subject, traceability, signatures };
}

const activeSigners = (petition: Petition | null) =>
  (petition?.signatures ?? [])
    .filter((signature) => signature.status === "Active")
    .map((signature) => signature.participantId);

async function petitionEvents(initiativeId: string) {
  return mods.database
    .getMongoCollection<{ eventId: string; envelope: string }>(
      mods.collections.MONGO_COLLECTIONS.outbox,
    )
    .find({
      eventId: { $regex: `^initiative-lifecycle-stage-published:${initiativeId}:petition:` },
    })
    .sort({ eventId: 1 })
    .toArray();
}

describe("HU-LC-05C.2 — Petition publication identity", () => {
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

    mods = {
      lifecycle:
        await import("../../../src/modules/initiative-petition-lifecycle/initiative-petition-lifecycle.service.js"),
      store: await import("../../../src/modules/petition/petition.store.js"),
      decisions:
        await import("../../../src/modules/collective-decision/collective-decision.store.js"),
      initiatives: await import("../../../src/modules/initiatives/initiative.store.js"),
      revisions:
        await import("../../../src/modules/initiative-version-revision/initiative-version-revision.service.js"),
      helpers: await import("./petition-test-helpers.js"),
      database,
      collections: await import("../../../src/infrastructure/mongodb/mongo-collections.js"),
      signerId: (await import("../../../src/modules/member/member.sample.js")).sampleMember.id,
    };
  });

  after(async () => {
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

  describe("first, then a second independent Petition", () => {
    let initiativeId = "";
    let first: Petition;
    let second: Petition;
    let firstBeforeSecond: ReturnType<typeof storedFields>;

    it("first publication: permanent ids derived from the draft, own decision, Open", async () => {
      initiativeId = createInitiative("two").initiativeId;
      const draftId = await prepareDraft(initiativeId, "First Petition");
      first = await mods.lifecycle.publishInitiativePetitionStage(identity, initiativeId);

      assert.equal(first.status, "Open");
      assert.equal(first.petitionId, mods.lifecycle.petitionIdForDraft(draftId));
      assert.equal(first.collectiveDecisionId, `decision-${first.petitionId}`);
      assert.equal(
        mods.decisions.getDecision(first.collectiveDecisionId)?.outcome?.outcomeType,
        "Approved",
      );
      assert.ok(first.traceability?.revisionId);
    });

    it("production publication still allows only one Petition per Initiative", async () => {
      await prepareDraft(initiativeId, "Blocked Petition");
      await assert.rejects(
        () => mods.lifecycle.publishInitiativePetitionStage(identity, initiativeId),
        /already been published/,
      );
      assert.equal((await mods.store.listPetitionsByInitiativeId(initiativeId)).length, 1);
    });

    it("second independent publication (test-only path): new ids, first untouched", async () => {
      firstBeforeSecond = storedFields(await mods.store.getPetition(first.petitionId));
      const draftId = await prepareDraft(initiativeId, "Second Petition");
      second = await mods.lifecycle.publishAdditionalInitiativePetitionForTests(
        identity,
        initiativeId,
      );

      assert.equal(second.status, "Open");
      assert.equal(second.petitionId, mods.lifecycle.petitionIdForDraft(draftId));
      assert.notEqual(second.petitionId, first.petitionId);
      assert.notEqual(second.collectiveDecisionId, first.collectiveDecisionId);
      assert.equal(second.subject.title, "Second Petition");
      assert.deepEqual(
        (await mods.store.listPetitionsByInitiativeId(initiativeId)).map(
          (entry) => entry.petitionId,
        ),
        [first.petitionId, second.petitionId],
      );
      assert.deepEqual(
        storedFields(await mods.store.getPetition(first.petitionId)),
        firstBeforeSecond,
      );
    });

    it("signatures stay independent per Petition", async () => {
      await mods.store.signPetition(first.petitionId, mods.signerId);
      assert.deepEqual(activeSigners(await mods.store.getPetition(first.petitionId)), [
        mods.signerId,
      ]);
      assert.deepEqual(activeSigners(await mods.store.getPetition(second.petitionId)), []);

      await mods.store.signPetition(second.petitionId, mods.signerId);
      await mods.store.withdrawPetitionSignature(first.petitionId, mods.signerId);
      assert.deepEqual(activeSigners(await mods.store.getPetition(first.petitionId)), []);
      assert.deepEqual(activeSigners(await mods.store.getPetition(second.petitionId)), [
        mods.signerId,
      ]);
    });

    it("each publication emits its own lifecycle event", async () => {
      const events = await petitionEvents(initiativeId);
      assert.deepEqual(
        events.map((event) => event.eventId),
        [
          `initiative-lifecycle-stage-published:${initiativeId}:petition:1:published`,
          `initiative-lifecycle-stage-published:${initiativeId}:petition:2:published`,
        ],
      );
      assert.match(events[0]!.envelope, new RegExp(first.petitionId));
      assert.match(events[1]!.envelope, new RegExp(second.petitionId));
    });
  });

  describe("duplicate publication protection", () => {
    it("resubmitting a published draft does not publish again", async () => {
      const initiativeId = createInitiative("resubmit").initiativeId;
      await prepareDraft(initiativeId, "Once");
      await mods.lifecycle.publishInitiativePetitionStage(identity, initiativeId);
      await assert.rejects(
        () => mods.lifecycle.publishInitiativePetitionStage(identity, initiativeId),
        /not found/,
      );
      assert.equal((await mods.store.listPetitionsByInitiativeId(initiativeId)).length, 1);
      assert.equal((await petitionEvents(initiativeId)).length, 1);
    });

    it("the same draft submitted twice concurrently publishes exactly one Petition", async () => {
      const initiativeId = createInitiative("concurrent").initiativeId;
      const draftId = await prepareDraft(initiativeId, "Concurrent");
      const results = await Promise.allSettled([
        mods.lifecycle.publishInitiativePetitionStage(identity, initiativeId),
        mods.lifecycle.publishInitiativePetitionStage(identity, initiativeId),
      ]);

      assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
      const petitions = await mods.store.listPetitionsByInitiativeId(initiativeId);
      assert.deepEqual(
        petitions.map((petition) => [petition.petitionId, petition.status]),
        [[mods.lifecycle.petitionIdForDraft(draftId), "Open"]],
      );
      assert.equal((await petitionEvents(initiativeId)).length, 1);
    });

    it("an interrupted publication resumes its own Petition without rewriting it", async () => {
      const initiativeId = createInitiative("resume").initiativeId;
      const draftId = await prepareDraft(initiativeId, "Resumed");
      const petitionId = mods.lifecycle.petitionIdForDraft(draftId);
      const decisionId = `decision-${petitionId}`;
      // State left by a publication that stopped right after creating the Petition.
      await mods.helpers.seedApprovedDecision(decisionId, initiativeId);
      await mods.store.createPetition({
        ...mods.helpers.buildFixturePetition({ petitionId, decisionId, initiativeId }),
        subject: {
          decisionId,
          initiativeId,
          title: "Written at creation",
          summary: "Content from the first attempt.",
        },
      });

      const resumed = await mods.lifecycle.publishInitiativePetitionStage(identity, initiativeId);
      assert.equal(resumed.petitionId, petitionId);
      assert.equal(resumed.status, "Open");
      assert.equal(resumed.subject.title, "Written at creation");
      assert.equal((await mods.store.listPetitionsByInitiativeId(initiativeId)).length, 1);
    });

    it("an unrelated Draft Petition of the Initiative is never reused or modified", async () => {
      const initiativeId = createInitiative("legacy-draft").initiativeId;
      const legacyId = `petition-legacy-draft-${RUN}`;
      await mods.helpers.seedApprovedDecision(`decision-${legacyId}`, initiativeId);
      await mods.store.createPetition(
        mods.helpers.buildFixturePetition({
          petitionId: legacyId,
          decisionId: `decision-${legacyId}`,
          initiativeId,
        }),
      );
      const legacyBefore = storedFields(await mods.store.getPetition(legacyId));

      const draftId = await prepareDraft(initiativeId, "Lifecycle Petition");
      const published = await mods.lifecycle.publishInitiativePetitionStage(identity, initiativeId);

      assert.equal(published.petitionId, mods.lifecycle.petitionIdForDraft(draftId));
      assert.notEqual(published.petitionId, legacyId);
      assert.deepEqual(storedFields(await mods.store.getPetition(legacyId)), legacyBefore);
    });
  });

  it("the test-only publication path refuses to run outside NODE_TEST_ENV", async () => {
    process.env.NODE_TEST_ENV = "false";
    try {
      await assert.rejects(
        () => mods.lifecycle.publishAdditionalInitiativePetitionForTests(identity, "any"),
        /only when NODE_TEST_ENV=true/,
      );
    } finally {
      process.env.NODE_TEST_ENV = "true";
    }
  });
});
