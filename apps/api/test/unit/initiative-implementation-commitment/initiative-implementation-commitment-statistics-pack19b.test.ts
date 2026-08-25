import assert from "node:assert/strict";
import { after, describe, it } from "node:test";

import type { InitiativeImplementationCommitment } from "@hu/types";

import {
  completeInitiativeImplementationCommitment,
} from "../../../src/modules/initiative-implementation-commitment/initiative-implementation-commitment.service.js";
import {
  createCommitment,
  deleteCommitmentsByParticipantIdForTests,
  listCommitmentsByParticipant,
} from "../../../src/modules/initiative-implementation-commitment/initiative-implementation-commitment.store.js";
import {
  computeImplementationCommitmentStatistics,
  isCanonicalAcceptedCommitmentForStatistics,
} from "../../../src/modules/initiative-implementation-commitment/initiative-implementation-commitment-statistics.js";
import {
  acceptInitiativeImplementationCommitment,
  initiateImplementationCommitmentTransfer,
  takeInitiativeImplementationCommitment,
} from "../../../src/modules/initiative-implementation-commitment-lifecycle/initiative-implementation-commitment-lifecycle.service.js";
import {
  getParticipantStatistics,
  type ParticipantStatisticsDependencies,
} from "../../../src/modules/participant-statistics/participant-statistics.service.js";
import { createInitiative, getInitiativeById } from "../../../src/modules/initiatives/initiative.store.js";
import type { Initiative } from "@hu/types";

const STEWARD = "pack19b-steward";
const A = "pack19b-participant-a";
const B = "pack19b-participant-b";
const INITIATIVE_ID = "initiative-pack19b-commitment-stats";

const alwaysExists = async () => true;

/** Commitment-focused stats call — stubs Mongo-backed Proposal/Petition/Ally deps. */
function commitmentStatsDeps(): ParticipantStatisticsDependencies {
  return {
    listInitiativesStewardedBy: () => [],
    listWorkspaceAlliesForParticipant: async () => [],
    countActiveCollaborationsForParticipant: async () => 0,
    listProposalCandidatesForParticipant: async () => [],
    listActivePetitionSignaturesForParticipant: async () => [],
    listCommitmentsForParticipant: listCommitmentsByParticipant,
  };
}

function statsFor(participantId: string) {
  return getParticipantStatistics(participantId, commitmentStatsDeps());
}

function ensureInitiative(): void {
  if (getInitiativeById(INITIATIVE_ID)) {
    return;
  }

  const now = new Date().toISOString();
  createInitiative({
    initiativeId: INITIATIVE_ID,
    stewardId: STEWARD,
    createdAt: now,
    updatedAt: now,
    title: "Pack 19B Statistics Initiative",
    description: "Fixture.",
    status: "poll",
    lifecyclePhase: "projected",
    visibility: { policy: "public" },
    metadata: {
      category: "environment",
      tags: [],
      region: "Global",
      language: "en",
      communitySlug: "test-community",
      activityArea: "Environment",
    },
    revisions: [],
    contributions: [],
    timeline: [],
  } satisfies Initiative);
}

function commitment(
  overrides: Partial<InitiativeImplementationCommitment> = {},
): InitiativeImplementationCommitment {
  const now = new Date().toISOString();

  return {
    commitmentId: `implementation-commitment-pack19b-${Math.random().toString(36).slice(2, 10)}`,
    initiativeId: INITIATIVE_ID,
    decisionId: "decision-pack19b",
    participantId: A,
    commitmentTitle: "Restore habitat corridor",
    commitmentSummary: "Statistics fixture.",
    commitmentScope: "action",
    status: "published",
    publishedAt: now,
    packageId: "package-pack19b",
    approvedAction: "Restore habitat corridor",
    actionIndex: 0,
    proposalStatus: "proposed",
    proposedByParticipantId: STEWARD,
    proposedAt: now,
    acceptedAt: null,
    declinedAt: null,
    pendingProposedParticipantId: null,
    proposalHistory: [],
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe("Pack 19B — Implementation Commitment Participant statistics", () => {
  function cleanup(): void {
    deleteCommitmentsByParticipantIdForTests(A);
    deleteCommitmentsByParticipantIdForTests(B);
    deleteCommitmentsByParticipantIdForTests(STEWARD);
  }

  after(cleanup);

  it("accepted proposal counts; declined and unassigned do not", async () => {
    cleanup();
    ensureInitiative();
    const proposed = createCommitment(commitment({ participantId: A, proposalStatus: "proposed" }));
    createCommitment(
      commitment({
        participantId: null,
        proposalStatus: "unassigned",
      }),
    );
    createCommitment(
      commitment({
        participantId: A,
        proposalStatus: "declined",
        declinedAt: new Date().toISOString(),
      }),
    );

    let stats = await statsFor(A);
    assert.equal(stats.commitmentsAcceptedCount, 0);
    assert.equal(stats.commitmentsActiveCount, 0);
    assert.equal(stats.commitmentsFulfilledCount, 0);

    await acceptInitiativeImplementationCommitment({ participantId: A }, proposed.commitmentId);

    stats = await statsFor(A);
    assert.equal(stats.commitmentsAcceptedCount, 1);
    assert.equal(stats.commitmentsActiveCount, 1);
    assert.equal(stats.commitmentsFulfilledCount, 0);

    const other = await statsFor(B);
    assert.equal(other.commitmentsAcceptedCount, 0);
  });

  it("Take Commitment counts the same as Accept", async () => {
    cleanup();
    ensureInitiative();
    const created = createCommitment(
      commitment({
        participantId: null,
        proposalStatus: "unassigned",
      }),
    );

    await takeInitiativeImplementationCommitment({ participantId: A }, created.commitmentId);
    const stats = await statsFor(A);
    assert.equal(stats.commitmentsAcceptedCount, 1);
    assert.equal(stats.commitmentsActiveCount, 1);
    assert.equal(stats.commitmentsFulfilledCount, 0);
  });

  it("transfer moves accepted/active from A to B; fulfillment credits completer only", async () => {
    cleanup();
    ensureInitiative();
    const created = createCommitment(commitment({ participantId: A }));
    await acceptInitiativeImplementationCommitment({ participantId: A }, created.commitmentId);

    let statsA = await statsFor(A);
    assert.equal(statsA.commitmentsAcceptedCount, 1);
    assert.equal(statsA.commitmentsActiveCount, 1);

    await initiateImplementationCommitmentTransfer(
      { participantId: STEWARD },
      created.commitmentId,
      B,
      { resolveProposedParticipantExists: alwaysExists },
    );

    statsA = await statsFor(A);
    assert.equal(statsA.commitmentsAcceptedCount, 1);
    assert.equal(statsA.commitmentsActiveCount, 1);
    assert.equal((await statsFor(B)).commitmentsAcceptedCount, 0);

    await acceptInitiativeImplementationCommitment({ participantId: B }, created.commitmentId);

    statsA = await statsFor(A);
    const statsB = await statsFor(B);
    assert.equal(statsA.commitmentsAcceptedCount, 0);
    assert.equal(statsA.commitmentsActiveCount, 0);
    assert.equal(statsA.commitmentsFulfilledCount, 0);
    assert.equal(statsB.commitmentsAcceptedCount, 1);
    assert.equal(statsB.commitmentsActiveCount, 1);
    assert.equal(statsB.commitmentsFulfilledCount, 0);

    completeInitiativeImplementationCommitment({ participantId: B }, created.commitmentId);

    assert.equal((await statsFor(A)).commitmentsFulfilledCount, 0);
    const fulfilledB = await statsFor(B);
    assert.equal(fulfilledB.commitmentsAcceptedCount, 1);
    assert.equal(fulfilledB.commitmentsActiveCount, 0);
    assert.equal(fulfilledB.commitmentsFulfilledCount, 1);
  });

  it("pending-transfer completion credits A; B receives no credit", async () => {
    cleanup();
    ensureInitiative();
    const created = createCommitment(commitment({ participantId: A }));
    await acceptInitiativeImplementationCommitment({ participantId: A }, created.commitmentId);
    await initiateImplementationCommitmentTransfer(
      { participantId: STEWARD },
      created.commitmentId,
      B,
      { resolveProposedParticipantExists: alwaysExists },
    );

    completeInitiativeImplementationCommitment({ participantId: A }, created.commitmentId);

    const statsA = await statsFor(A);
    const statsB = await statsFor(B);
    assert.equal(statsA.commitmentsFulfilledCount, 1);
    assert.equal(statsA.commitmentsActiveCount, 0);
    assert.equal(statsB.commitmentsAcceptedCount, 0);
    assert.equal(statsB.commitmentsFulfilledCount, 0);
  });

  it("withdrawn is not active; completed is not active; legacy null proposalStatus excluded", () => {
    const now = new Date().toISOString();
    const rows: InitiativeImplementationCommitment[] = [
      commitment({
        participantId: A,
        proposalStatus: "accepted",
        acceptedAt: now,
        status: "published",
      }),
      commitment({
        participantId: A,
        proposalStatus: "accepted",
        acceptedAt: now,
        status: "withdrawn",
        withdrawnAt: now,
      }),
      commitment({
        participantId: A,
        proposalStatus: "accepted",
        acceptedAt: now,
        status: "completed",
        completedAt: now,
      }),
      commitment({
        participantId: A,
        proposalStatus: null,
        acceptedAt: null,
        status: "published",
      }),
    ];

    const stats = computeImplementationCommitmentStatistics(rows, A);
    assert.equal(stats.accepted, 3);
    assert.equal(stats.active, 1);
    assert.equal(stats.fulfilled, 1);
    assert.equal(isCanonicalAcceptedCommitmentForStatistics(rows[3]!, A), false);
  });

  it("aggregates across multiple Commitments and Initiatives without leaking other Participants", () => {
    const now = new Date().toISOString();
    const rows = [
      commitment({
        initiativeId: "initiative-1",
        participantId: A,
        proposalStatus: "accepted",
        acceptedAt: now,
        status: "published",
      }),
      commitment({
        initiativeId: "initiative-2",
        participantId: A,
        proposalStatus: "accepted",
        acceptedAt: now,
        status: "completed",
        completedAt: now,
      }),
      commitment({
        initiativeId: "initiative-2",
        participantId: B,
        proposalStatus: "accepted",
        acceptedAt: now,
        status: "published",
      }),
    ];

    assert.deepEqual(computeImplementationCommitmentStatistics(rows, A), {
      accepted: 2,
      active: 1,
      fulfilled: 1,
    });
    assert.deepEqual(computeImplementationCommitmentStatistics(rows, B), {
      accepted: 1,
      active: 1,
      fulfilled: 0,
    });
  });
});
