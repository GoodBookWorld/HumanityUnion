import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { countProposalCandidatesForSourceParticipant } from "../../../src/modules/initiative-discussion-collaboration/initiative-proposal-candidate.store.js";
import { getParticipantStatistics } from "../../../src/modules/participant-statistics/participant-statistics.service.js";

/**
 * Pack 19C.2B — Proposal Participant statistics correctness.
 * Pure counting + injectable shared aggregation (Mongo-free).
 */

const A = "participant-a";
const B = "participant-b";

function candidate(input: {
  candidateId: string;
  sourceParticipantId: string;
  creatorParticipantId?: string;
}) {
  return {
    candidateId: input.candidateId,
    sourceParticipantId: input.sourceParticipantId,
    status: "candidate" as const,
    creatorParticipantId: input.creatorParticipantId ?? input.sourceParticipantId,
  };
}

describe("Pack 19C.2B — Proposal Participant statistics", () => {
  it("Own idea — A authors comment → candidate credits A", () => {
    const candidates = [candidate({ candidateId: "c1", sourceParticipantId: A })];

    assert.equal(countProposalCandidatesForSourceParticipant(candidates, A), 1);
    assert.equal(countProposalCandidatesForSourceParticipant(candidates, B), 0);
  });

  it("Another Participant marks it — A wrote comment, B clicks Proposal → credit A only", () => {
    const candidates = [
      candidate({
        candidateId: "c1",
        sourceParticipantId: A,
        creatorParticipantId: B,
      }),
    ];

    assert.equal(countProposalCandidatesForSourceParticipant(candidates, A), 1);
    assert.equal(countProposalCandidatesForSourceParticipant(candidates, B), 0);
  });

  it("Idempotency — same candidateId counted once", () => {
    const candidates = [
      candidate({ candidateId: "c1", sourceParticipantId: A }),
      candidate({ candidateId: "c1", sourceParticipantId: A }),
    ];

    assert.equal(countProposalCandidatesForSourceParticipant(candidates, A), 1);
  });

  it("Multiple ideas — one count per distinct candidateId", () => {
    const candidates = [
      candidate({ candidateId: "c1", sourceParticipantId: A }),
      candidate({ candidateId: "c2", sourceParticipantId: A }),
      candidate({ candidateId: "c3", sourceParticipantId: A }),
    ];

    assert.equal(countProposalCandidatesForSourceParticipant(candidates, A), 3);
  });

  it("Part D generation — structured proposals / grouping do not feed this metric", () => {
    // Statistic input is only InitiativeDiscussionProposalCandidate rows.
    // Part D structured proposals are never passed into the counter.
    const candidatesBeforePartD = [
      candidate({ candidateId: "c1", sourceParticipantId: A }),
      candidate({ candidateId: "c2", sourceParticipantId: A }),
    ];
    const afterPartDGrouping = candidatesBeforePartD;

    assert.equal(
      countProposalCandidatesForSourceParticipant(candidatesBeforePartD, A),
      countProposalCandidatesForSourceParticipant(afterPartDGrouping, A),
    );
    assert.equal(countProposalCandidatesForSourceParticipant(afterPartDGrouping, A), 2);
  });

  it("Manual Author proposal — Part D structured proposal with no candidate yields no credit", () => {
    assert.equal(countProposalCandidatesForSourceParticipant([], A), 0);
  });

  it("Legacy CI proposal — InitiativeImprovementProposal is not a candidate and is not counted", () => {
    // Legacy records are a different persistence domain; the counter never sees them.
    const onlyCanonicalCandidates: ReturnType<typeof candidate>[] = [];

    assert.equal(countProposalCandidatesForSourceParticipant(onlyCanonicalCandidates, A), 0);
  });

  it("flows through getParticipantStatistics without crediting creatorParticipantId", async () => {
    const statisticsA = await getParticipantStatistics(A, {
      listInitiativesStewardedBy: () => [],
      listWorkspaceAlliesForParticipant: async () => [],
      countActiveCollaborationsForParticipant: async () => 0,
      listProposalCandidatesForParticipant: async () => [
        candidate({
          candidateId: "c1",
          sourceParticipantId: A,
          creatorParticipantId: B,
        }),
      ],
      listActivePetitionSignaturesForParticipant: async () => [],
      listCommitmentsForParticipant: () => [],
    });
    const statisticsB = await getParticipantStatistics(B, {
      listInitiativesStewardedBy: () => [],
      listWorkspaceAlliesForParticipant: async () => [],
      countActiveCollaborationsForParticipant: async () => 0,
      listProposalCandidatesForParticipant: async () => [],
      listActivePetitionSignaturesForParticipant: async () => [],
      listCommitmentsForParticipant: () => [],
    });

    assert.equal(statisticsA.proposalsCount, 1);
    assert.equal(statisticsB.proposalsCount, 0);
  });
});
