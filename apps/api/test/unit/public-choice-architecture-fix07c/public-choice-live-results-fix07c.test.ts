/**
 * Public Choice Fix 07C — four-surface live aggregate sync + open/final authority.
 * Uses the process-isolated hu_test_* Mongo database (runner drop guaranteed).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import type { Initiative, InitiativeCollectiveDecision, Member } from "@hu/types";
import { percentageOfTotal } from "@hu/types";

import { isMongoAvailableForTests, skipIfMongoUnavailable } from "../../helpers/test-env.js";
import { connectMongoClient, disconnectMongoClient } from "../../../src/infrastructure/mongodb/mongo-connection.js";
import { ensureMongoIndexes } from "../../../src/infrastructure/mongodb/mongo-indexes.js";
import { resolveMongoConfig } from "../../../src/infrastructure/mongodb/mongo-config.js";
import {
  dropIsolatedTestDatabase,
  TEST_DATABASE_ENV_VAR,
} from "../../../scripts/test-mongo-isolation.js";
import {
  castOrUpdateInitiativeDecisionVote,
  castOrUpdateVisitorInitiativeDecisionVote,
  computePublicChoiceBallotAggregatesForDecision,
  recallInitiativeDecisionVote,
} from "../../../src/modules/initiative-decision-vote/initiative-decision-vote.service.js";
import {
  deleteVotesByDecisionIdForTests,
  listVotesForDecision,
} from "../../../src/modules/initiative-decision-vote/initiative-decision-vote.store.js";
import { listEffectiveVotesForDecision } from "../../../src/modules/initiative-decision-vote/list-effective-decision-votes.js";
import { buildBallotAggregates } from "../../../src/modules/initiative-decision-vote/initiative-decision-vote-ballot-aggregates.js";
import { createPublicChoiceCandidateForInitiative } from "../../../src/modules/public-choice-candidate/public-choice-candidate.service.js";
import { deletePublicChoiceCandidatesByInitiativeForTests } from "../../../src/modules/public-choice-candidate/persistence/public-choice-candidate.repository.js";
import {
  toPublicInitiativeCollectiveDecisionListItem,
  toPublicInitiativeCollectiveDecisionProjection,
} from "../../../src/modules/initiative-collective-decision/public-initiative-collective-decision.projection.js";
import { createInitiative, deleteInitiative } from "../../../src/modules/initiatives/initiative.store.js";
import type { RequestIdentity } from "../../../src/modules/initiatives/identity/request-identity.types.js";
import { seedMember } from "../../../src/modules/member/member.store.js";
import { deleteParticipationAreasByParticipantIdForTests } from "../../../src/modules/participation-area/participation-area.store.js";

if (!isMongoAvailableForTests()) {
  skipIfMongoUnavailable();
}

const dir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(dir, "../../../../../");
const testRunId = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;

const steward: RequestIdentity = { participantId: `fix07c-author-${testRunId}` };
const participant: RequestIdentity = { participantId: `fix07c-participant-${testRunId}` };
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

function buildMember(id: string): Member {
  return {
    id,
    profile: {
      displayName: id,
      uniqueName: id.replace(/[^a-z0-9]/gi, "-"),
      languages: ["en"],
    },
    status: "active",
    verificationLevel: "email",
    roles: ["member"],
    fair: { personal: 0, community: 0, regional: 0, global: 0 },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function buildPublicChoiceInitiative(initiativeId: string): Initiative {
  const now = new Date().toISOString();
  return {
    initiativeId,
    stewardId: steward.participantId,
    createdAt: now,
    updatedAt: now,
    title: "Fix 07C Election",
    description: "Four-surface sync",
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
      startDate: new Date(Date.now() - 86_400_000).toISOString().slice(0, 10),
      completionDate: new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10),
    },
    revisions: [],
    contributions: [],
    timeline: [],
  };
}

function buildOpenDecision(input: {
  decisionId: string;
  initiativeId: string;
}): InitiativeCollectiveDecision {
  return {
    decisionId: input.decisionId,
    initiativeId: input.initiativeId,
    decisionSessionId: null,
    stewardId: steward.participantId,
    sequenceNumber: 1,
    participationScope: "world",
    status: "opened",
    question: "Public Choice election: Fix 07C Election",
    openedAt: new Date(Date.now() - 60_000).toISOString(),
    closesAt: new Date(Date.now() + 3_600_000).toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function tally(
  aggregates: Awaited<ReturnType<typeof computePublicChoiceBallotAggregatesForDecision>>,
  candidateId: string,
): number {
  if (aggregates.ballotMode !== "SELECT_ONE_CANDIDATE") {
    return -1;
  }
  return aggregates.candidates.find((row) => row.candidateId === candidateId)?.count ?? 0;
}

function percent(
  aggregates: Awaited<ReturnType<typeof computePublicChoiceBallotAggregatesForDecision>>,
  candidateId: string,
): number {
  if (aggregates.ballotMode !== "SELECT_ONE_CANDIDATE") {
    return -1;
  }
  return aggregates.candidates.find((row) => row.candidateId === candidateId)?.percentage ?? -1;
}

before(async () => {
  await connectMongoClient();
  await ensureMongoIndexes();
  seedMember(buildMember(steward.participantId));
  seedMember(buildMember(participant.participantId));
  deleteParticipationAreasByParticipantIdForTests(steward.participantId);
  deleteParticipationAreasByParticipantIdForTests(participant.participantId);
});

after(async () => {
  for (const decisionId of trackedDecisionIds) {
    await deleteVotesByDecisionIdForTests(decisionId);
  }
  for (const initiativeId of trackedInitiativeIds) {
    await deletePublicChoiceCandidatesByInitiativeForTests(initiativeId);
    try {
      deleteInitiative(initiativeId);
    } catch {
      // already gone
    }
  }
  deleteParticipationAreasByParticipantIdForTests(steward.participantId);
  deleteParticipationAreasByParticipantIdForTests(participant.participantId);

  const isolatedName = process.env[TEST_DATABASE_ENV_VAR]?.trim();
  const uri = process.env.MONGODB_URI?.trim();
  if (isolatedName?.startsWith("hu_test_") && uri) {
    try {
      await dropIsolatedTestDatabase({ databaseName: isolatedName, uri });
    } catch {
      // best-effort drop; runner also drops owned DB
    }
  }
  await disconnectMongoClient();
});

describe("Public Choice Fix 07C — isolation + source contracts", () => {
  it("runs against isolated hu_test_* database (runner drop guaranteed)", () => {
    const configured = process.env[TEST_DATABASE_ENV_VAR] ?? resolveMongoConfig().database;
    assert.match(configured, /^hu_test_[a-zA-Z0-9_]+$/);
    assert.notEqual(configured, "humanity_union_dev");
    assert.notEqual(configured, "humanity_union_staging");
  });

  it("OPEN live aggregate path prefers Decision Vote → ballotAggregates (not frozen snapshot)", () => {
    const projection = readRepo(
      "apps/api/src/modules/initiative-collective-decision/public-initiative-collective-decision.projection.ts",
    );
    assert.match(projection, /async function buildPublicChoiceBallotFields/);
    assert.match(projection, /computePublicChoiceBallotAggregatesForDecision/);
    assert.match(projection, /listEffectiveVotesForDecision|computePublicChoiceBallotAggregatesForDecision/);
    assert.match(projection, /Prefer frozen Final Results snapshot/);
    assert.match(projection, /!votingOpen/);
    assert.match(projection, /findPublicChoiceResultsSnapshotByDecision/);
  });

  it("PUBLIC_CHOICE experience does not surface /collective-decisions/public/ hrefs", () => {
    const experience = readRepo(
      "apps/api/src/modules/initiatives/public-initiative-experience.service.ts",
    );
    assert.match(experience, /isPublicChoiceLifecycle/);
    assert.match(
      experience,
      /\/initiatives\/public\/\$\{encodeURIComponent\(initiativeId\)\}\/election/,
    );
    assert.match(
      experience,
      /publicHref: isPublicChoiceLifecycle[\s\S]*\/initiatives\/public\/[\s\S]*:[\s\S]*\/collective-decisions\/public\//,
    );
  });
});

describe("Public Choice Fix 07C — four-surface aggregate agreement", () => {
  it("zero votes → Visitor A → Participant B → Author A → Recall B stay synchronized", async () => {
    const initiativeId = trackInitiative(`initiative-fix07c-${testRunId}`);
    const decisionId = trackDecision(`collective-decision-fix07c-${testRunId}`);
    const initiative = buildPublicChoiceInitiative(initiativeId);
    createInitiative(initiative);

    const candidateA = await createPublicChoiceCandidateForInitiative(steward, initiativeId, {
      name: "Candidate A",
    });
    const candidateB = await createPublicChoiceCandidateForInitiative(steward, initiativeId, {
      name: "Candidate B",
    });
    const candidateC = await createPublicChoiceCandidateForInitiative(steward, initiativeId, {
      name: "Candidate C",
    });
    const candidateIds = [
      candidateA.candidateId,
      candidateB.candidateId,
      candidateC.candidateId,
    ] as const;

    const decision = buildOpenDecision({ decisionId, initiativeId });
    const deps = {
      getDecision: (id: string) => (id === decisionId ? decision : null),
      getInitiative: (id: string) => (id === initiativeId ? initiative : null),
    };

    async function surfaceSnapshot() {
      const votes = await listEffectiveVotesForDecision(decisionId);
      const fromVotes = buildBallotAggregates({
        ballotMode: "SELECT_ONE_CANDIDATE",
        votes,
        candidateIds,
      });
      const fromService = await computePublicChoiceBallotAggregatesForDecision(
        decisionId,
        initiative,
      );
      const listItem = await toPublicInitiativeCollectiveDecisionListItem(decision);
      const detail = await toPublicInitiativeCollectiveDecisionProjection(decision);

      assert.equal(fromVotes.ballotMode, "SELECT_ONE_CANDIDATE");
      assert.equal(fromService.ballotMode, "SELECT_ONE_CANDIDATE");
      assert.equal(listItem.ballotAggregates?.ballotMode, "SELECT_ONE_CANDIDATE");
      assert.equal(detail.ballotAggregates?.ballotMode, "SELECT_ONE_CANDIDATE");

      // Four surfaces: Overview / Sidebar / CD / Election all read these aggregates.
      assert.deepEqual(fromService, fromVotes);
      assert.deepEqual(listItem.ballotAggregates, fromService);
      assert.deepEqual(detail.ballotAggregates, fromService);

      return fromService;
    }

    const zero = await surfaceSnapshot();
    assert.equal(zero.ballotMode, "SELECT_ONE_CANDIDATE");
    assert.equal(zero.totalEffectiveVoters, 0);
    assert.equal(tally(zero, candidateA.candidateId), 0);
    assert.equal(tally(zero, candidateB.candidateId), 0);
    assert.equal(tally(zero, candidateC.candidateId), 0);
    assert.equal(percent(zero, candidateA.candidateId), 0);
    assert.equal(zero.participationBreakdown.visitors, 0);
    assert.equal(zero.participationBreakdown.participants, 0);
    assert.equal(zero.participationBreakdown.members, 0);

    const visitorKey = `visitorfix07c${testRunId}`.slice(0, 32);
    await castOrUpdateVisitorInitiativeDecisionVote(
      visitorKey,
      decisionId,
      { choice: "candidate", candidateId: candidateA.candidateId },
      deps,
    );

    const afterVisitor = await surfaceSnapshot();
    assert.equal(tally(afterVisitor, candidateA.candidateId), 1);
    assert.equal(tally(afterVisitor, candidateB.candidateId), 0);
    assert.equal(afterVisitor.totalEffectiveVoters, 1);
    assert.equal(percent(afterVisitor, candidateA.candidateId), 100);
    assert.equal(afterVisitor.participationBreakdown.visitors, 1);
    assert.equal(afterVisitor.participationBreakdown.participants, 0);
    assert.equal(afterVisitor.participationBreakdown.totalEffectiveVoters, 1);

    await castOrUpdateInitiativeDecisionVote(
      participant,
      decisionId,
      { choice: "candidate", candidateId: candidateB.candidateId },
      deps,
    );

    const afterParticipant = await surfaceSnapshot();
    assert.equal(tally(afterParticipant, candidateA.candidateId), 1);
    assert.equal(tally(afterParticipant, candidateB.candidateId), 1);
    assert.equal(afterParticipant.totalEffectiveVoters, 2);
    assert.equal(percent(afterParticipant, candidateA.candidateId), 50);
    assert.equal(percent(afterParticipant, candidateB.candidateId), 50);
    assert.equal(afterParticipant.participationBreakdown.visitors, 1);
    assert.equal(afterParticipant.participationBreakdown.participants, 1);

    await castOrUpdateInitiativeDecisionVote(
      steward,
      decisionId,
      { choice: "candidate", candidateId: candidateA.candidateId },
      deps,
    );

    const afterAuthor = await surfaceSnapshot();
    assert.equal(tally(afterAuthor, candidateA.candidateId), 2);
    assert.equal(tally(afterAuthor, candidateB.candidateId), 1);
    assert.equal(afterAuthor.totalEffectiveVoters, 3);
    assert.equal(percent(afterAuthor, candidateA.candidateId), percentageOfTotal(2, 3));
    assert.equal(afterAuthor.participationBreakdown.visitors, 1);
    // Author without active_member membership is Participant (mutually exclusive with Member).
    assert.equal(afterAuthor.participationBreakdown.participants, 2);
    assert.equal(afterAuthor.participationBreakdown.members, 0);
    assert.equal(
      afterAuthor.participationBreakdown.visitors +
        afterAuthor.participationBreakdown.participants +
        afterAuthor.participationBreakdown.members,
      3,
    );

    await recallInitiativeDecisionVote(participant, decisionId, deps);

    const afterRecall = await surfaceSnapshot();
    assert.equal(tally(afterRecall, candidateA.candidateId), 2);
    assert.equal(tally(afterRecall, candidateB.candidateId), 0);
    assert.equal(afterRecall.totalEffectiveVoters, 2);
    assert.equal(percent(afterRecall, candidateA.candidateId), 100);
    assert.equal(percent(afterRecall, candidateB.candidateId), 0);
    assert.equal(afterRecall.participationBreakdown.visitors, 1);
    assert.equal(
      afterRecall.participationBreakdown.participants +
        afterRecall.participationBreakdown.members,
      1,
    );

    // Ranking: highest first, stable candidateId tie-break among equals.
    assert.equal(afterRecall.ballotMode, "SELECT_ONE_CANDIDATE");
    const ranked = afterRecall.candidates;
    assert.ok(ranked[0]);
    assert.equal(ranked[0]!.candidateId, candidateA.candidateId);
    assert.equal(ranked[0]!.rank, 1);

    const durable = await listVotesForDecision(decisionId);
    assert.ok(durable.length >= 2);
  });
});
