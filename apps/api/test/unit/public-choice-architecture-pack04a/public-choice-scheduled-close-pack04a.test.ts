/**
 * Public Choice Pack 04A — scheduled End-of-Voting auto-close certification.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import type { Initiative, InitiativeCollectiveDecision } from "@hu/types";
import {
  computePublicChoiceResultsExpireAt,
  resolvePublicChoiceElectionVotingStatus,
} from "@hu/types";

import { isMongoAvailableForTests, skipIfMongoUnavailable } from "../../helpers/test-env.js";
import { connectMongoClient } from "../../../src/infrastructure/mongodb/mongo-connection.js";
import { ensureMongoIndexes } from "../../../src/infrastructure/mongodb/mongo-indexes.js";
import {
  closeInitiativeCollectiveDecisionAtScheduledEnd,
  closeOverduePublicChoiceElections,
  closePublicChoiceElectionForInitiative,
} from "../../../src/modules/initiative-collective-decision/initiative-collective-decision.service.js";
import {
  createDecision,
  getDecisionById,
} from "../../../src/modules/initiative-collective-decision/initiative-collective-decision.store.js";
import {
  castOrUpdateInitiativeDecisionVote,
  castOrUpdateVisitorInitiativeDecisionVote,
  recallInitiativeDecisionVote,
} from "../../../src/modules/initiative-decision-vote/initiative-decision-vote.service.js";
import { deleteVotesByDecisionIdForTests } from "../../../src/modules/initiative-decision-vote/initiative-decision-vote.store.js";
import { createInitiative, deleteInitiative } from "../../../src/modules/initiatives/initiative.store.js";
import type { RequestIdentity } from "../../../src/modules/initiatives/identity/request-identity.types.js";
import { findPublicChoiceResultsSnapshotByDecision } from "../../../src/modules/public-choice-results-retention/public-choice-results-snapshot.repository.js";
import { createPublicChoiceCandidateForInitiative } from "../../../src/modules/public-choice-candidate/public-choice-candidate.service.js";
import { deletePublicChoiceCandidatesByInitiativeForTests } from "../../../src/modules/public-choice-candidate/persistence/public-choice-candidate.repository.js";

if (!isMongoAvailableForTests()) {
  skipIfMongoUnavailable();
}

const dir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(dir, "../../../../../");
const testRunId = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;

const steward: RequestIdentity = { participantId: `pack04a-steward-${testRunId}` };
const voter: RequestIdentity = { participantId: `pack04a-voter-${testRunId}` };
const trackedInitiativeIds: string[] = [];
const trackedDecisionIds: string[] = [];

function readRepo(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

function trackInitiative(id: string): string {
  trackedInitiativeIds.push(id);
  return id;
}

function trackDecision(id: string): string {
  trackedDecisionIds.push(id);
  return id;
}

function buildInitiative(initiativeId: string): Initiative {
  const now = new Date().toISOString();
  return {
    initiativeId,
    stewardId: steward.participantId,
    createdAt: now,
    updatedAt: now,
    title: "Pack 04A Election",
    description: "Scheduled close certification",
    status: "discussion",
    lifecyclePhase: "discussion",
    lifecycleProfile: "PUBLIC_CHOICE",
    visibility: { policy: "public" },
    metadata: {
      category: "",
      tags: [],
      region: "",
      language: "en",
      countrySlug: "us",
      communitySlug: "",
      participationScope: "country",
      activityArea: "",
      ballotMode: "SELECT_ONE_CANDIDATE",
    },
    revisions: [],
    contributions: [],
    timeline: [],
  };
}

function buildOpenedDecision(input: {
  initiativeId: string;
  closesAt: string;
  openedAt?: string;
}): InitiativeCollectiveDecision {
  const now = new Date().toISOString();
  const decisionId = trackDecision(`collective-decision-pack04a-${testRunId}-${Math.random().toString(36).slice(2, 7)}`);
  return createDecision({
    decisionId,
    initiativeId: input.initiativeId,
    decisionSessionId: `decision-session-pack04a-${testRunId}-${Math.random().toString(36).slice(2, 7)}`,
    stewardId: steward.participantId,
    sequenceNumber: 1,
    participationScope: "country",
    status: "opened",
    question: "Who should win?",
    closesAt: input.closesAt,
    openedAt: input.openedAt ?? "2020-01-01T00:00:00.000Z",
    createdAt: now,
    updatedAt: now,
  });
}

before(async () => {
  await connectMongoClient();
  await ensureMongoIndexes();
});

after(async () => {
  for (const decisionId of trackedDecisionIds) {
    await deleteVotesByDecisionIdForTests(decisionId);
  }
  for (const initiativeId of trackedInitiativeIds) {
    await deletePublicChoiceCandidatesByInitiativeForTests(initiativeId);
    deleteInitiative(initiativeId);
  }
});

describe("Public Choice Pack 04A — scheduler architecture contracts", () => {
  it("existing retention scheduler owns auto-close tick (no second scheduler)", () => {
    const scheduler = readRepo(
      "apps/api/src/modules/public-choice-results-retention/public-choice-results-retention.scheduler.ts",
    );
    const index = readRepo("apps/api/src/index.ts");
    assert.match(scheduler, /closeOverduePublicChoiceElections/);
    assert.match(scheduler, /cleanupExpiredPublicChoiceResults/);
    assert.match(scheduler, /15 \* 60 \* 1000/);
    assert.match(index, /startPublicChoiceResultsRetentionScheduler/);
    assert.doesNotMatch(index, /startPublicChoice.*Close.*Scheduler/);
  });

  it("canonical close paths share finalizeCollectiveDecisionClose / scheduled end helper", () => {
    const service = readRepo(
      "apps/api/src/modules/initiative-collective-decision/initiative-collective-decision.service.ts",
    );
    assert.match(service, /finalizeCollectiveDecisionClose/);
    assert.match(service, /closeInitiativeCollectiveDecisionAtScheduledEnd/);
    assert.match(service, /closeOverduePublicChoiceElections/);
    assert.match(service, /ensurePublicChoiceResultsFrozenForClosedDecision/);
  });
});

describe("Public Choice Pack 04A — scheduled auto-close behavior", () => {
  it("future End of Voting remains OPEN; overdue closes once with closedAt=closesAt", async () => {
    const initiativeId = trackInitiative(`initiative-pack04a-future-${testRunId}`);
    createInitiative(buildInitiative(initiativeId));

    const futureCloses = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const futureDecision = buildOpenedDecision({
      initiativeId,
      closesAt: futureCloses,
    });

    const before = await closeOverduePublicChoiceElections();
    assert.ok(!before.decisionIds.includes(futureDecision.decisionId));
    assert.equal(getDecisionById(futureDecision.decisionId)?.status, "opened");

    const pastCloses = "2020-06-01T12:00:00.000Z";
    const overdueInitiativeId = trackInitiative(`initiative-pack04a-overdue-${testRunId}`);
    createInitiative(buildInitiative(overdueInitiativeId));
    const overdue = buildOpenedDecision({
      initiativeId: overdueInitiativeId,
      closesAt: pastCloses,
    });

    const first = await closeOverduePublicChoiceElections("2020-06-01T12:00:01.000Z");
    assert.ok(first.decisionIds.includes(overdue.decisionId));
    const closed = getDecisionById(overdue.decisionId);
    assert.equal(closed?.status, "closed");
    assert.equal(closed?.closedAt, pastCloses);

    const status = resolvePublicChoiceElectionVotingStatus({
      decisionStatus: closed?.status,
      openedAt: closed?.openedAt,
      closesAt: closed?.closesAt,
      closedAt: closed?.closedAt,
    });
    assert.equal(status, "CLOSED");

    const snapshot = await findPublicChoiceResultsSnapshotByDecision(overdue.decisionId);
    assert.ok(snapshot);
    assert.equal(snapshot?.votingCloseAt, pastCloses);
    assert.equal(
      snapshot?.expiresAt,
      computePublicChoiceResultsExpireAt(pastCloses),
    );

    const second = await closeOverduePublicChoiceElections("2020-06-01T13:00:00.000Z");
    const again = getDecisionById(overdue.decisionId);
    assert.equal(again?.closedAt, pastCloses);
    const snapshot2 = await findPublicChoiceResultsSnapshotByDecision(overdue.decisionId);
    assert.equal(snapshot2?.snapshotId, snapshot?.snapshotId);
    assert.equal(snapshot2?.expiresAt, snapshot?.expiresAt);
    assert.ok(second.closedCount >= 0);
  });

  it("votes and recall are rejected after auto-close", async () => {
    const initiativeId = trackInitiative(`initiative-pack04a-votes-${testRunId}`);
    createInitiative(buildInitiative(initiativeId));
    const pastCloses = "2021-01-01T00:00:00.000Z";
    const decision = buildOpenedDecision({ initiativeId, closesAt: pastCloses });

    const candidate = await createPublicChoiceCandidateForInitiative(steward, initiativeId, {
      name: "Candidate A",
    });

    await closeInitiativeCollectiveDecisionAtScheduledEnd(
      decision.decisionId,
      "2021-01-01T00:00:01.000Z",
    );

    await assert.rejects(
      () =>
        castOrUpdateInitiativeDecisionVote(voter, decision.decisionId, {
          choice: "candidate",
          candidateId: candidate.candidateId,
        }),
      /not open for voting|voting window has closed/i,
    );

    await assert.rejects(
      () =>
        castOrUpdateVisitorInitiativeDecisionVote(`visitor-${testRunId}xx`, decision.decisionId, {
          choice: "candidate",
          candidateId: candidate.candidateId,
        }),
      /not open for voting|voting window has closed/i,
    );

    await assert.rejects(
      () => recallInitiativeDecisionVote(voter, decision.decisionId),
      /not open for voting|voting window has closed|No vote/i,
    );
  });

  it("manual early close preserves closedAt; later scheduler does not rewrite it", async () => {
    const initiativeId = trackInitiative(`initiative-pack04a-manual-${testRunId}`);
    createInitiative(buildInitiative(initiativeId));
    const futureCloses = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const decision = buildOpenedDecision({ initiativeId, closesAt: futureCloses });

    const closed = await closePublicChoiceElectionForInitiative(steward, initiativeId);
    assert.equal(closed.status, "closed");
    assert.ok(closed.closedAt);
    const manualClosedAt = closed.closedAt;
    assert.notEqual(manualClosedAt, futureCloses);

    await closeOverduePublicChoiceElections(
      new Date(Date.parse(futureCloses) + 60_000).toISOString(),
    );
    const after = getDecisionById(decision.decisionId);
    assert.equal(after?.closedAt, manualClosedAt);
    assert.equal(after?.closesAt, futureCloses);
  });

  it("idempotent scheduled close does not reset closedAt on repeated call", async () => {
    const initiativeId = trackInitiative(`initiative-pack04a-idem-${testRunId}`);
    createInitiative(buildInitiative(initiativeId));
    const pastCloses = "2019-03-01T08:00:00.000Z";
    const decision = buildOpenedDecision({ initiativeId, closesAt: pastCloses });

    const first = await closeInitiativeCollectiveDecisionAtScheduledEnd(
      decision.decisionId,
      "2019-03-01T09:00:00.000Z",
    );
    assert.equal(first?.closedAt, pastCloses);

    const second = await closeInitiativeCollectiveDecisionAtScheduledEnd(
      decision.decisionId,
      "2019-03-02T00:00:00.000Z",
    );
    assert.equal(second?.closedAt, pastCloses);
    assert.equal(second?.status, "closed");
  });

  it("restart/overdue discovery closes opened election whose closesAt already passed", async () => {
    const initiativeId = trackInitiative(`initiative-pack04a-restart-${testRunId}`);
    createInitiative(buildInitiative(initiativeId));
    const pastCloses = "2018-12-31T23:00:00.000Z";
    const decision = buildOpenedDecision({ initiativeId, closesAt: pastCloses });

    // Simulate API restart: decision still opened in store, no in-memory timer.
    assert.equal(getDecisionById(decision.decisionId)?.status, "opened");

    const result = await closeOverduePublicChoiceElections("2019-01-01T00:00:00.000Z");
    assert.ok(result.decisionIds.includes(decision.decisionId));
    assert.equal(getDecisionById(decision.decisionId)?.status, "closed");
  });
});
