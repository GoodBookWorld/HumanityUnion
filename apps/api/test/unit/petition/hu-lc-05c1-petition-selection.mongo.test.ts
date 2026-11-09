/**
 * HU-LC-05C.1 — deterministic Petition selection, stored references and each
 * Petition's own Revision context.
 *
 * Process-owned single-node MongoMemoryReplSet on 127.0.0.1 and one hu_test_
 * database (dropped afterwards); every other Lifecycle store runs in memory.
 */
process.env.NODE_TEST_ENV = "true";
process.env.INITIATIVE_PERSISTENCE = "memory";
process.env.INITIATIVE_PETITION_DRAFT_PERSISTENCE = "memory";
process.env.INITIATIVE_VERSION_REVISION_PERSISTENCE = "memory";
process.env.INITIATIVE_DECISION_SESSION_DRAFT_PERSISTENCE = "memory";
process.env.DECISION_SESSION_PERSISTENCE = "memory";
process.env.NOTIFICATION_PERSISTENCE = "memory";

import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { after, before, describe, it } from "node:test";

import { MongoMemoryReplSet } from "mongodb-memory-server-core";
import type { Initiative, PetitionState, PetitionTraceability } from "@hu/types";

import type * as DecisionSessionLifecycle from "../../../src/modules/initiative-decision-session-lifecycle/initiative-decision-session-lifecycle.service.js";
import type * as DecisionSessionDrafts from "../../../src/modules/initiative-decision-session-lifecycle/initiative-decision-session-draft.store.js";
import type * as Initiatives from "../../../src/modules/initiatives/initiative.store.js";
import type * as Revisions from "../../../src/modules/initiative-version-revision/initiative-version-revision.store.js";
import type * as RevisionService from "../../../src/modules/initiative-version-revision/initiative-version-revision.service.js";
import type * as Selection from "../../../src/modules/petition/initiative-petition-selection.js";
import type * as PetitionStore from "../../../src/modules/petition/petition.store.js";
import type * as Projection from "../../../src/modules/petition/public-petition.projection.js";
import type * as PetitionTestHelpers from "./petition-test-helpers.js";

const RUN = randomBytes(4).toString("hex");
const DATABASE = `hu_test_petition_select_${RUN}`;
const STEWARD = `member-lc05c1-steward-${RUN}`;

/** Loaded after the environment above is set; persistence adapters bind at import. */
type Mods = {
  store: typeof PetitionStore;
  selection: typeof Selection;
  helpers: typeof PetitionTestHelpers;
  initiatives: typeof Initiatives;
  revisions: typeof Revisions;
  revisionService: typeof RevisionService;
  projection: typeof Projection;
  ds: typeof DecisionSessionLifecycle;
  dsDrafts: typeof DecisionSessionDrafts;
};

let mods: Mods;
let replSet: MongoMemoryReplSet | null = null;
let connected = false;
let sequence = 0;

const identity = { participantId: STEWARD };

function createInitiative(label: string): Initiative {
  const now = new Date().toISOString();
  return mods.initiatives.createInitiative({
    initiativeId: `initiative-lc05c1-${label}-${RUN}`,
    stewardId: STEWARD,
    title: `LC-05C.1 ${label}`,
    description: "Fixture Initiative for deterministic Petition selection.",
    status: "implementation",
    lifecyclePhase: "projected",
    lifecycleProfile: "STANDARD",
    visibility: { policy: "public" },
    metadata: { activityArea: "Environment", communitySlug: "fixture-community" },
    timeline: [],
    createdAt: now,
    updatedAt: now,
  } as unknown as Initiative);
}

/** Creates a Petition (ids sort in creation order) and advances it to `status`. */
async function seedPetition(
  initiativeId: string,
  status: PetitionState,
  traceability: PetitionTraceability | null = null,
): Promise<string> {
  sequence += 1;
  const petitionId = `petition-lc05c1-${String(sequence).padStart(3, "0")}-${RUN}`;
  const decisionId = `decision-${petitionId}`;
  await mods.helpers.seedApprovedDecision(decisionId, initiativeId);
  await mods.store.createPetition({
    ...mods.helpers.buildFixturePetition({ petitionId, decisionId, initiativeId }),
    traceability,
  });
  const steps: Array<[PetitionState, (id: string) => Promise<unknown>]> = [
    ["Ready", mods.store.preparePetition],
    ["Published", mods.store.publishPetition],
    ["Open", mods.store.openPetition],
  ];
  for (const [reached, step] of steps) {
    if (status === "Draft") {
      break;
    }
    await step(petitionId);
    if (reached === status) {
      break;
    }
  }
  return petitionId;
}

describe("HU-LC-05C.1 — deterministic Petition selection", () => {
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
      store: await import("../../../src/modules/petition/petition.store.js"),
      selection: await import("../../../src/modules/petition/initiative-petition-selection.js"),
      helpers: await import("./petition-test-helpers.js"),
      initiatives: await import("../../../src/modules/initiatives/initiative.store.js"),
      revisions:
        await import("../../../src/modules/initiative-version-revision/initiative-version-revision.store.js"),
      revisionService:
        await import("../../../src/modules/initiative-version-revision/initiative-version-revision.service.js"),
      projection: await import("../../../src/modules/petition/public-petition.projection.js"),
      ds: await import("../../../src/modules/initiative-decision-session-lifecycle/initiative-decision-session-lifecycle.service.js"),
      dsDrafts:
        await import("../../../src/modules/initiative-decision-session-lifecycle/initiative-decision-session-draft.store.js"),
    };
  });

  after(async () => {
    const connection = await import("../../../src/infrastructure/mongodb/mongo-connection.js");
    const database = await import("../../../src/infrastructure/mongodb/mongo-database.js");
    try {
      if (connected && database.getMongoDatabase().databaseName === DATABASE) {
        await database.getMongoDatabase().dropDatabase();
      }
    } finally {
      if (connected) {
        await connection.disconnectMongoClient();
      }
      await replSet?.stop({ doCleanup: true });
    }
  });

  describe("listPetitionsByInitiativeId and the compatibility lookup", () => {
    it("lists every Petition of the Initiative oldest first, the same on every call", async () => {
      const initiative = createInitiative("order");
      const ids = [
        await seedPetition(initiative.initiativeId, "Open"),
        await seedPetition(initiative.initiativeId, "Draft"),
        await seedPetition(initiative.initiativeId, "Published"),
      ];
      const other = createInitiative("order-other");
      await seedPetition(other.initiativeId, "Open");

      const first = (await mods.store.listPetitionsByInitiativeId(initiative.initiativeId)).map(
        (petition) => petition.petitionId,
      );
      const second = (await mods.store.listPetitionsByInitiativeId(initiative.initiativeId)).map(
        (petition) => petition.petitionId,
      );
      assert.deepEqual(first, ids);
      assert.deepEqual(second, ids);
    });

    it("getPetitionByInitiativeId prefers the newest published Petition, else the newest", async () => {
      const initiative = createInitiative("compat");
      const published = await seedPetition(initiative.initiativeId, "Open");
      await seedPetition(initiative.initiativeId, "Draft");
      assert.equal(
        (await mods.store.getPetitionByInitiativeId(initiative.initiativeId))?.petitionId,
        published,
      );

      const draftsOnly = createInitiative("compat-drafts");
      await seedPetition(draftsOnly.initiativeId, "Draft");
      const newestDraft = await seedPetition(draftsOnly.initiativeId, "Ready");
      assert.equal(
        (await mods.store.getPetitionByInitiativeId(draftsOnly.initiativeId))?.petitionId,
        newestDraft,
      );
    });
  });

  describe("selectInitiativePetition", () => {
    it("no eligible Petition → none (unpublished Petitions do not count)", async () => {
      const initiative = createInitiative("none");
      await seedPetition(initiative.initiativeId, "Ready");
      assert.deepEqual(
        await mods.selection.selectInitiativePetition({ initiativeId: initiative.initiativeId }),
        { kind: "none" },
      );
    });

    it("exactly one eligible Petition → selected automatically", async () => {
      const initiative = createInitiative("one");
      await seedPetition(initiative.initiativeId, "Draft");
      const only = await seedPetition(initiative.initiativeId, "Open");
      const selection = await mods.selection.selectInitiativePetition({
        initiativeId: initiative.initiativeId,
      });
      assert.equal(selection.kind, "selected");
      assert.equal(mods.selection.selectedPetitionOrNull(selection)?.petitionId, only);
    });

    it("several eligible Petitions → selection required, never a silent pick", async () => {
      const initiative = createInitiative("many");
      const a = await seedPetition(initiative.initiativeId, "Open");
      const b = await seedPetition(initiative.initiativeId, "Published");
      const selection = await mods.selection.selectInitiativePetition({
        initiativeId: initiative.initiativeId,
      });
      assert.deepEqual(selection, { kind: "selection_required", candidatePetitionIds: [a, b] });
      assert.equal(mods.selection.selectedPetitionOrNull(selection), null);
      assert.throws(
        () => mods.selection.requireResolvedPetitionSelection(selection),
        mods.selection.PetitionSelectionRequiredError,
      );
    });

    it("a stored reference is authoritative even when several are eligible", async () => {
      const initiative = createInitiative("stored");
      const a = await seedPetition(initiative.initiativeId, "Open");
      await seedPetition(initiative.initiativeId, "Open");
      const selection = await mods.selection.selectInitiativePetition({
        initiativeId: initiative.initiativeId,
        petitionId: a,
      });
      assert.equal(mods.selection.selectedPetitionOrNull(selection)?.petitionId, a);
    });

    it("missing, foreign or unpublished stored references are unavailable, not replaced", async () => {
      const initiative = createInitiative("unavailable");
      await seedPetition(initiative.initiativeId, "Open");
      const unpublished = await seedPetition(initiative.initiativeId, "Ready");
      const foreign = await seedPetition(createInitiative("foreign").initiativeId, "Open");

      for (const petitionId of [`missing-${RUN}`, foreign, unpublished]) {
        const selection = await mods.selection.selectInitiativePetition({
          initiativeId: initiative.initiativeId,
          petitionId,
        });
        assert.deepEqual(selection, { kind: "reference_unavailable", petitionId });
        assert.throws(
          () => mods.selection.requireResolvedPetitionSelection(selection),
          mods.selection.PetitionReferenceUnavailableError,
        );
      }
    });

    it("inherited references follow the upstream record, including its absence", async () => {
      const initiative = createInitiative("inherited");
      const a = await seedPetition(initiative.initiativeId, "Open");
      await seedPetition(initiative.initiativeId, "Open");
      const pick = (upstream: { petitionId: string | null } | null) =>
        mods.selection.selectInheritedInitiativePetition({
          initiativeId: initiative.initiativeId,
          upstream,
        });

      assert.equal(
        mods.selection.selectedPetitionOrNull(await pick({ petitionId: a }))?.petitionId,
        a,
      );
      assert.deepEqual(await pick({ petitionId: null }), { kind: "none" });
      assert.equal((await pick(null)).kind, "selection_required");
    });

    it("selection never changes Petitions or signatures", async () => {
      const initiative = createInitiative("readonly");
      const a = await seedPetition(initiative.initiativeId, "Open");
      await seedPetition(initiative.initiativeId, "Open");
      // Stored fields only; `outcome.derivedAt` is computed on every read.
      const stored = async () =>
        JSON.stringify(
          (await mods.store.listPetitionsByInitiativeId(initiative.initiativeId)).map(
            ({ petitionId, status, updatedAt, subject, traceability, signatures }) => ({
              petitionId,
              status,
              updatedAt,
              subject,
              traceability,
              signatures,
            }),
          ),
        );
      const before = await stored();
      await mods.selection.selectInitiativePetition({ initiativeId: initiative.initiativeId });
      await mods.selection.selectInitiativePetition({
        initiativeId: initiative.initiativeId,
        petitionId: a,
      });
      assert.equal(await stored(), before);
    });
  });

  describe("Decision Session uses and validates its stored Petition", () => {
    it("one eligible Petition is linked automatically on generate", async () => {
      const initiative = createInitiative("ds-one");
      const only = await seedPetition(initiative.initiativeId, "Open");
      const draft = await mods.ds.generateInitiativeDecisionSessionDraft(
        identity,
        initiative.initiativeId,
      );
      assert.equal(draft.petitionId, only);
    });

    it("several eligible Petitions require an explicit choice", async () => {
      const initiative = createInitiative("ds-many");
      await seedPetition(initiative.initiativeId, "Open");
      const chosen = await seedPetition(initiative.initiativeId, "Open");

      await assert.rejects(
        () => mods.ds.generateInitiativeDecisionSessionDraft(identity, initiative.initiativeId),
        mods.selection.PetitionSelectionRequiredError,
      );
      const draft = await mods.ds.generateInitiativeDecisionSessionDraft(
        identity,
        initiative.initiativeId,
        { petitionId: chosen },
      );
      assert.equal(draft.petitionId, chosen);
      await assert.rejects(
        () =>
          mods.ds.generateInitiativeDecisionSessionDraft(identity, initiative.initiativeId, {
            petitionId: `missing-${RUN}`,
          }),
        mods.selection.PetitionReferenceUnavailableError,
      );
    });

    it("no eligible Petition keeps the existing Petition-less draft", async () => {
      const initiative = createInitiative("ds-none");
      const draft = await mods.ds.generateInitiativeDecisionSessionDraft(
        identity,
        initiative.initiativeId,
      );
      assert.equal(draft.petitionId, null);
    });

    it("publish keeps a valid stored Petition even after another is published", async () => {
      const initiative = createInitiative("ds-publish");
      const stored = await seedPetition(initiative.initiativeId, "Open");
      const draft = await mods.ds.generateInitiativeDecisionSessionDraft(
        identity,
        initiative.initiativeId,
      );
      assert.equal(draft.petitionId, stored);
      await seedPetition(initiative.initiativeId, "Open");

      const session = await mods.ds.publishInitiativeDecisionSessionStage(
        identity,
        initiative.initiativeId,
      );
      assert.equal(session.traceability?.petitionId, stored);
    });

    it("publish rejects a stored Petition that is no longer available", async () => {
      const initiative = createInitiative("ds-missing");
      await seedPetition(initiative.initiativeId, "Open");
      await mods.ds.generateInitiativeDecisionSessionDraft(identity, initiative.initiativeId);
      mods.dsDrafts.updateInitiativeDecisionSessionDraft(initiative.initiativeId, {
        petitionId: `missing-${RUN}`,
      } as never);

      await assert.rejects(
        () => mods.ds.publishInitiativeDecisionSessionStage(identity, initiative.initiativeId),
        /no longer available/,
      );
    });
  });

  describe("Petition Revision context", () => {
    async function initiativeWithTwoRevisions(label: string) {
      const initiative = createInitiative(label);
      const v1 = mods.revisionService.createInitialInitiativeVersionRevision(initiative, STEWARD);
      const v2 = mods.revisions.createRevision({
        ...structuredClone(v1),
        revisionId: `${v1.revisionId}-v2`,
        version: 2,
        revisionSummary: "Second published version.",
      });
      return { initiative, v1, v2 };
    }

    const traceabilityFor = (revision: { revisionId: string; version: number }) => ({
      revisionId: revision.revisionId,
      revisionVersion: revision.version,
      proposalIds: [],
      analysisId: null,
      analysisVersion: null,
    });

    it("a traced Petition shows the Revision it was published from, not the latest", async () => {
      const { initiative, v1, v2 } = await initiativeWithTwoRevisions("rev-traced");
      assert.equal(mods.revisions.getCurrentPublishedVersion(initiative.initiativeId), v2.version);
      const petitionId = await seedPetition(initiative.initiativeId, "Open", traceabilityFor(v1));
      const projection = await mods.projection.toPublicPetitionProjection(
        (await mods.store.getPetition(petitionId))!,
      );
      assert.equal(projection?.relatedRevisionContext?.revisionId, v1.revisionId);
      assert.equal(projection?.relatedRevisionContext?.version, 1);
    });

    it("a Petition without Traceability keeps the current-Revision fallback", async () => {
      const { initiative, v2 } = await initiativeWithTwoRevisions("rev-legacy");
      const petitionId = await seedPetition(initiative.initiativeId, "Open");
      const projection = await mods.projection.toPublicPetitionProjection(
        (await mods.store.getPetition(petitionId))!,
      );
      assert.equal(projection?.relatedRevisionContext?.revisionId, v2.revisionId);
    });

    it("a traced Revision that no longer exists is not replaced by another", async () => {
      const { initiative } = await initiativeWithTwoRevisions("rev-missing");
      const petitionId = await seedPetition(
        initiative.initiativeId,
        "Open",
        traceabilityFor({ revisionId: `revision-missing-${RUN}`, version: 1 }),
      );
      const projection = await mods.projection.toPublicPetitionProjection(
        (await mods.store.getPetition(petitionId))!,
      );
      assert.equal(projection?.relatedRevisionContext, null);
    });
  });
});
