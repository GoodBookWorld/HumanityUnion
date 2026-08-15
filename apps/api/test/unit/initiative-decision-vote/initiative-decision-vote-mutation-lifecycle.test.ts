import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import type { Initiative, InitiativeCollectiveDecision, Member } from "@hu/types";

import { isMongoAvailableForTests, skipIfMongoUnavailable } from "../../helpers/test-env.js";

/**
 * Recovery Task 28 Part 14 — full cast/change/abstain mutation lifecycle,
 * exercised through the REAL service, with a REAL Mongo-backed Member
 * eligibility lookup (per `evaluateVoteEligibility`, which is not
 * dependency-injectable). The Collective Decision and Initiative are
 * supplied via the existing `InitiativeDecisionVoteAncestryDependencies`
 * injection seam (same pattern as the Recovery Task 12 ancestry test file)
 * so this test does not need to run the full
 * Initiative -> Analysis -> Proposal -> Revision -> DecisionSession ->
 * Collective Decision production pipeline.
 *
 * This file is skipped entirely when MONGODB_URI is not configured, per the
 * existing repository convention (see participant-action-repository.test.ts).
 */

if (!isMongoAvailableForTests()) {
  skipIfMongoUnavailable();
}

const testRunId = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
const participantId = `readiness-mutation-voter-${testRunId}`;
const decisionId = `readiness-mutation-decision-${testRunId}`;
const initiativeId = `readiness-mutation-initiative-${testRunId}`;

const fakeInitiative = {
  initiativeId,
  stewardId: "readiness-mutation-steward",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  title: "Readiness Mutation Fixture",
  description: "Fixture initiative for Recovery Task 28.",
  status: "poll",
  lifecyclePhase: "projected",
  visibility: { policy: "public" },
  metadata: {
    category: "environment",
    tags: [],
    region: "Global",
    language: "en",
    communitySlug: "readiness-mutation-community",
    activityArea: "Environment",
  },
  revisions: [],
  contributions: [],
  timeline: [],
} as unknown as Initiative;

function buildOpenDecision(
  overrides: Partial<InitiativeCollectiveDecision> = {},
): InitiativeCollectiveDecision {
  return {
    decisionId,
    initiativeId,
    decisionSessionId: "readiness-mutation-session",
    stewardId: "readiness-mutation-steward",
    sequenceNumber: 1,
    participationScope: "world",
    status: "opened",
    question: "Fixture question?",
    openedAt: new Date(Date.now() - 60_000).toISOString(),
    closesAt: new Date(Date.now() + 3_600_000).toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function buildDeps(decision: InitiativeCollectiveDecision) {
  return {
    getDecision: (id: string) => (id === decisionId ? decision : null),
    getInitiative: (id: string) => (id === initiativeId ? fakeInitiative : null),
  };
}

function buildTestMember(id: string): Member {
  return {
    id,
    profile: {
      displayName: "Readiness Mutation Voter",
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

before(async () => {
  const { connectMongoClient } = await import("../../../src/infrastructure/mongodb/mongo-connection.js");
  const { ensureMongoIndexes } = await import("../../../src/infrastructure/mongodb/mongo-indexes.js");
  const { seedMember } = await import("../../../src/modules/member/member.store.js");
  const { createParticipationArea, deleteParticipationAreasByParticipantIdForTests } =
    await import("../../../src/modules/participation-area/participation-area.store.js");

  await connectMongoClient();
  await ensureMongoIndexes();
  deleteParticipationAreasByParticipantIdForTests(participantId);
  seedMember(buildTestMember(participantId));
  createParticipationArea({
    participantId,
    countrySlug: "canada",
    regionSlug: "british-columbia",
    communitySlug: "readiness-mutation-community",
    verificationStatus: "verified",
  });
});

after(async () => {
  const { deleteVotesByParticipantIdForTests } =
    await import("../../../src/modules/initiative-decision-vote/initiative-decision-vote.store.js");
  const { deleteParticipationAreasByParticipantIdForTests } =
    await import("../../../src/modules/participation-area/participation-area.store.js");

  await deleteVotesByParticipantIdForTests(participantId);
  deleteParticipationAreasByParticipantIdForTests(participantId);
});

describe("Initiative Decision Vote — real mutation lifecycle via the production service (Part 7)", () => {
  it("cast -> change -> change again reuses the same voteId, increments version, and records history for each transition", async () => {
    const { castOrUpdateInitiativeDecisionVote } =
      await import("../../../src/modules/initiative-decision-vote/initiative-decision-vote.service.js");
    const { listVoteHistoryForParticipant, listVotesForDecision } =
      await import("../../../src/modules/initiative-decision-vote/initiative-decision-vote.store.js");

    const decision = buildOpenDecision();
    const deps = buildDeps(decision);
    const identity = { participantId };

    const cast = await castOrUpdateInitiativeDecisionVote(
      identity,
      decisionId,
      { choice: "support" },
      deps,
    );
    assert.equal(cast.choice, "support");
    assert.equal(cast.version, 1);

    const changed = await castOrUpdateInitiativeDecisionVote(
      identity,
      decisionId,
      { choice: "do_not_support" },
      deps,
    );
    assert.equal(changed.voteId, cast.voteId, "vote change reuses the original voteId — it is a mutation, not a new fact");
    assert.equal(changed.choice, "do_not_support");
    assert.equal(changed.version, 2);

    const abstained = await castOrUpdateInitiativeDecisionVote(
      identity,
      decisionId,
      { choice: "abstain" },
      deps,
    );
    assert.equal(abstained.voteId, cast.voteId);
    assert.equal(abstained.version, 3);

    assert.equal(
      (await listVotesForDecision(decisionId)).length,
      1,
      "exactly one Vote row exists for this participant despite three lifecycle transitions",
    );

    const history = await listVoteHistoryForParticipant(decisionId, participantId);
    assert.equal(history.length, 3, "each transition produced one immutable history entry");
    assert.equal(history[0]?.previousChoice, undefined);
    assert.equal(history[0]?.newChoice, "support");
    assert.equal(history[1]?.previousChoice, "support");
    assert.equal(history[1]?.newChoice, "do_not_support");
    assert.equal(history[2]?.previousChoice, "do_not_support");
    assert.equal(history[2]?.newChoice, "abstain");
  });

  it("re-submitting the same choice is a no-op (no version bump, no new history entry)", async () => {
    const { castOrUpdateInitiativeDecisionVote } =
      await import("../../../src/modules/initiative-decision-vote/initiative-decision-vote.service.js");
    const { listVoteHistoryForParticipant } =
      await import("../../../src/modules/initiative-decision-vote/initiative-decision-vote.store.js");

    const decision = buildOpenDecision();
    const deps = buildDeps(decision);
    const identity = { participantId };

    const first = await castOrUpdateInitiativeDecisionVote(
      identity,
      decisionId,
      { choice: "abstain" },
      deps,
    );
    const historyAfterFirst = (await listVoteHistoryForParticipant(decisionId, participantId)).length;

    const repeated = await castOrUpdateInitiativeDecisionVote(
      identity,
      decisionId,
      { choice: "abstain" },
      deps,
    );

    assert.equal(repeated.version, first.version, "identical choice must not bump the version");
    assert.equal(
      (await listVoteHistoryForParticipant(decisionId, participantId)).length,
      historyAfterFirst,
      "identical choice must not append a new history entry",
    );
  });

  it("a closed decision rejects further vote changes even for a participant with an existing vote", async () => {
    const { castOrUpdateInitiativeDecisionVote } =
      await import("../../../src/modules/initiative-decision-vote/initiative-decision-vote.service.js");

    const openDecision = buildOpenDecision();
    const openDeps = buildDeps(openDecision);
    const identity = { participantId };

    await castOrUpdateInitiativeDecisionVote(identity, decisionId, { choice: "support" }, openDeps);

    const closedDecision = buildOpenDecision({ status: "closed" });
    const closedDeps = buildDeps(closedDecision);

    await assert.rejects(
      () =>
        castOrUpdateInitiativeDecisionVote(
          identity,
          decisionId,
          { choice: "do_not_support" },
          closedDeps,
        ),
      /not open for voting/,
    );
  });
});
