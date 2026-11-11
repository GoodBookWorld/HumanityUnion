/**
 * HU-LC-05C.4C.6M — other public lifecycle projections that show a Petition's
 * title or summary (Decision Session, Civic Archive, Implementation Commitment,
 * Implementation) never expose raw `{lifecycleStage:...}` tokens, while the
 * stored Petition keeps its tokens, identity and signatures.
 *
 * Process-owned single-node MongoMemoryReplSet (one hu_test_ database, dropped
 * afterwards); projections are called directly on real store records.
 */
process.env.NODE_TEST_ENV = "true";
process.env.INITIATIVE_PERSISTENCE = "memory";
process.env.INITIATIVE_PETITION_DRAFT_PERSISTENCE = "memory";
process.env.INITIATIVE_VERSION_REVISION_PERSISTENCE = "memory";
process.env.NOTIFICATION_PERSISTENCE = "memory";
process.env.PETITION_VISITOR_SIGNAL_PERSISTENCE = "memory";

import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { after, before, describe, it } from "node:test";

import type { Collection, Document } from "mongodb";
import { MongoMemoryReplSet } from "mongodb-memory-server-core";
import {
  getInitiativeLifecycleStageDefinition,
  type DecisionSession,
  type Initiative,
  type PublicCivicArchiveRecord,
} from "@hu/types";

import type * as PetitionStore from "../../../src/modules/petition/petition.store.js";

const RUN = randomBytes(4).toString("hex");
const DATABASE = `hu_test_pet_lc_stage_${RUN}`;
const RAW_TOKEN = /\{lifecycleStage:/;
const INITIATIVE_ID = `initiative-6m-public-${RUN}`;
const SIGNER = { userId: `user-6m-signer-${RUN}`, memberId: `member-6m-signer-${RUN}` };

const STORED_TITLE = "{lifecycleStage:petition}: Clean Rivers";
const STORED_SUMMARY =
  "Built from the {lifecycleStage:analysis} and the accepted {lifecycleStage:proposal}.";

const label = (stageId: "analysis" | "proposal" | "petition"): string => {
  const definition = getInitiativeLifecycleStageDefinition(stageId);
  assert.ok(definition?.label, `registry label for ${stageId}`);
  return definition.label;
};
const PRESENTED_TITLE = (): string => `${label("petition")}: Clean Rivers`;
const PRESENTED_SUMMARY = (): string =>
  `Built from the ${label("analysis")} and the accepted ${label("proposal")}.`;

let store: typeof PetitionStore;
let petitions: () => Collection<Document>;
let replSet: MongoMemoryReplSet | null = null;
let connected = false;
let petitionId = "";
let decisionId = "";
let commitmentId = "";
let implementationId = "";

function assertNoRawTokens(value: unknown, where: string): void {
  assert.equal(RAW_TOKEN.test(JSON.stringify(value)), false, `${where} exposes a raw token`);
}

describe("HU-LC-05C.4C.6M — lifecycle projections present Petition tokens", () => {
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

    const initiatives = await import("../../../src/modules/initiatives/initiative.store.js");
    const now = new Date().toISOString();
    initiatives.createInitiative({
      initiativeId: INITIATIVE_ID,
      stewardId: `member-6m-steward-${RUN}`,
      title: "6M public Initiative",
      description: "Fixture Initiative for lifecycle Petition tokens.",
      status: "implementation",
      lifecyclePhase: "projected",
      lifecycleProfile: "STANDARD",
      visibility: { policy: "public" },
      metadata: { activityArea: "Environment", communitySlug: "fixture-community" },
      timeline: [],
      createdAt: now,
      updatedAt: now,
    } as unknown as Initiative);

    const memberPersistence =
      await import("../../../src/modules/member/infrastructure/member.persistence.js");
    await database
      .getMongoDatabase()
      .collection("members")
      .insertOne(
        memberPersistence.toMemberMongoDocument(
          memberPersistence.buildNewPersistedMember({
            memberId: SIGNER.memberId,
            identityId: SIGNER.userId,
            displayName: "6M signer",
            uniqueName: SIGNER.memberId,
          }),
        ),
      );

    store = await import("../../../src/modules/petition/petition.store.js");
    petitions = () => database.getMongoDatabase().collection("petitions");
    const helpers = await import("./petition-test-helpers.js");

    petitionId = `petition-6m-${RUN}`;
    decisionId = `decision-${petitionId}`;
    await helpers.seedApprovedDecision(decisionId, INITIATIVE_ID);
    const fixture = helpers.buildFixturePetition({
      petitionId,
      decisionId,
      initiativeId: INITIATIVE_ID,
    });
    await store.createPetition({
      ...fixture,
      subject: { ...fixture.subject, title: STORED_TITLE, summary: STORED_SUMMARY },
    });
    await store.preparePetition(petitionId);
    await store.publishPetitionForTests(petitionId);
    await store.openPetition(petitionId);
    await store.signPetition(petitionId, SIGNER.memberId, "Public");

    const commitments =
      await import("../../../src/modules/implementation-commitment/implementation-commitment.store.js");
    commitmentId = `commitment-6m-${RUN}`;
    await commitments.createImplementationCommitment({
      implementationCommitmentId: commitmentId,
      initiativeId: INITIATIVE_ID,
      collectiveDecisionId: decisionId,
      petitionId,
      subjectTitle: "6M commitment",
      subjectSummary: "Commitment fallback summary.",
    });

    const implementations =
      await import("../../../src/modules/implementation/implementation.store.js");
    implementationId = `implementation-6m-${RUN}`;
    await implementations.createImplementation({
      implementationId,
      initiativeId: INITIATIVE_ID,
      collectiveDecisionId: decisionId,
      petitionId,
      implementationCommitmentId: commitmentId,
      subjectTitle: "6M implementation",
      subjectSummary: "Implementation fallback summary.",
    });
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

  it("public Decision Session related Petition title has no raw tokens", async () => {
    const { toPublicDecisionSessionProjection } =
      await import("../../../src/modules/decision-session/public-decision-session.projection.js");
    const now = new Date().toISOString();
    const projection = await toPublicDecisionSessionProjection({
      sessionId: `session-6m-${RUN}`,
      initiativeId: INITIATIVE_ID,
      initiativeVersion: 1,
      title: "6M session",
      purpose: "Decide on clean rivers.",
      decisionQuestion: "Adopt the plan?",
      status: "published",
      opensAt: now,
      closesAt: now,
      stewardId: `member-6m-steward-${RUN}`,
      publishedAt: now,
      updatedAt: now,
      packageReferences: { revisionIds: [], analysisIds: [], proposalIds: [], petitionId },
    } as unknown as DecisionSession);

    assertNoRawTokens(projection, "Decision Session");
    assert.equal(projection.relatedPetitionContext?.petitionId, petitionId);
    assert.equal(projection.relatedPetitionContext?.title, PRESENTED_TITLE());
  });

  it("public Civic Archive Petition record has no raw tokens", async () => {
    const { toCivicArchiveLifecycleRecord } =
      await import("../../../src/modules/public-civic-archive/public-civic-archive-lifecycle.projection.js");
    const now = new Date().toISOString();
    const record = await toCivicArchiveLifecycleRecord({
      archiveRecordId: `archive-6m-${RUN}`,
      initiativeId: INITIATIVE_ID,
      title: "6M archive",
      summary: "Archived Initiative.",
      country: "",
      region: "",
      community: "fixture-community",
      activityArea: "Environment",
      implementationPeriod: "",
      archivedAt: now,
      updatedAt: now,
      references: { decisionId: "", commitmentId: "", trackingId: "", impactId: "" },
    } as unknown as PublicCivicArchiveRecord);

    assert.ok(record, "archive lifecycle record");
    assertNoRawTokens(record, "Civic Archive");
    const petitionEntry = record.stages
      .flatMap((stage) => stage.records)
      .find((entry) => entry.entityId === petitionId);
    assert.ok(petitionEntry, "Petition child record");
    assert.equal(petitionEntry.title, PRESENTED_TITLE());
    assert.equal(petitionEntry.summary, PRESENTED_SUMMARY());
  });

  it("public Implementation Commitment and Implementation Petition references have no raw tokens", async () => {
    const commitments =
      await import("../../../src/modules/implementation-commitment/implementation-commitment.store.js");
    const implementations =
      await import("../../../src/modules/implementation/implementation.store.js");
    const { toPublicImplementationCommitmentProjection } =
      await import("../../../src/modules/implementation-commitment/public-implementation-commitment.projection.js");
    const { toPublicImplementationProjection } =
      await import("../../../src/modules/implementation/public-implementation.projection.js");

    const commitment = await toPublicImplementationCommitmentProjection(
      commitments.getImplementationCommitment(commitmentId)!,
    );
    assert.ok(commitment);
    assertNoRawTokens(commitment, "Implementation Commitment");
    assert.equal(commitment.petitionReference.summaryStatement, PRESENTED_SUMMARY());

    const implementation = await toPublicImplementationProjection(
      implementations.getImplementation(implementationId)!,
    );
    assert.ok(implementation);
    assertNoRawTokens(implementation, "Implementation");
    assert.equal(implementation.petitionReference.summaryStatement, PRESENTED_SUMMARY());
  });

  it("stored Petition keeps its tokens, identity and signatures", async () => {
    const stored = await petitions().findOne({ petitionId }, { projection: { _id: 0 } });
    assert.ok(stored);
    assert.equal(stored.petitionId, petitionId);
    assert.equal(stored.status, "Open");
    assert.equal((stored.subject as { title: string }).title, STORED_TITLE);
    assert.equal((stored.subject as { summary: string }).summary, STORED_SUMMARY);

    const petition = await store.getPetition(petitionId);
    assert.deepEqual(
      petition?.signatures.map((signature) => [signature.participantId, signature.status]),
      [[SIGNER.memberId, "Active"]],
    );
  });
});
