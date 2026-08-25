import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { countActivePetitionSignaturesForParticipant } from "../../../src/modules/petition/petition-signature-statistics.js";
import { getParticipantStatistics } from "../../../src/modules/participant-statistics/participant-statistics.service.js";

/**
 * Pack 19C.2B — Petition Participant statistics correctness.
 * Pure counting + injectable shared aggregation (Mongo-free).
 */

const A = "participant-a";
const B = "participant-b";

function signature(input: {
  petitionId: string;
  memberId: string;
  status: "Active" | "Withdrawn";
}) {
  return input;
}

describe("Pack 19C.2B — Petition Participant statistics", () => {
  it("Active signature — Participant signs Petition → +1", () => {
    const signatures = [signature({ petitionId: "p1", memberId: A, status: "Active" })];

    assert.equal(countActivePetitionSignaturesForParticipant(signatures, A), 1);
  });

  it("Multiple petitions — three distinct Active signatures → +3", () => {
    const signatures = [
      signature({ petitionId: "p1", memberId: A, status: "Active" }),
      signature({ petitionId: "p2", memberId: A, status: "Active" }),
      signature({ petitionId: "p3", memberId: A, status: "Active" }),
    ];

    assert.equal(countActivePetitionSignaturesForParticipant(signatures, A), 3);
  });

  it("Withdraw — Withdrawn signature no longer counts", () => {
    const signatures = [signature({ petitionId: "p1", memberId: A, status: "Withdrawn" })];

    assert.equal(countActivePetitionSignaturesForParticipant(signatures, A), 0);
  });

  it("Re-sign — same petitionId Active again counts once (canonical row reuse)", () => {
    const signatures = [
      signature({ petitionId: "p1", memberId: A, status: "Active" }),
      signature({ petitionId: "p1", memberId: A, status: "Active" }),
    ];

    assert.equal(countActivePetitionSignaturesForParticipant(signatures, A), 1);
  });

  it("Different Participants — A and B each receive +1 on the same Petition", () => {
    const signatures = [
      signature({ petitionId: "p1", memberId: A, status: "Active" }),
      signature({ petitionId: "p1", memberId: B, status: "Active" }),
    ];

    assert.equal(countActivePetitionSignaturesForParticipant(signatures, A), 1);
    assert.equal(countActivePetitionSignaturesForParticipant(signatures, B), 1);
  });

  it("No signature — viewing/participation without Active Signature → no count", () => {
    assert.equal(countActivePetitionSignaturesForParticipant([], A), 0);
  });

  it("flows through getParticipantStatistics", async () => {
    const statistics = await getParticipantStatistics(A, {
      listInitiativesStewardedBy: () => [],
      listWorkspaceAlliesForParticipant: async () => [],
      countActiveCollaborationsForParticipant: async () => 0,
      listProposalCandidatesForParticipant: async () => [],
      listActivePetitionSignaturesForParticipant: async () => [
        signature({ petitionId: "p1", memberId: A, status: "Active" }),
        signature({ petitionId: "p2", memberId: A, status: "Withdrawn" }),
      ],
      listCommitmentsForParticipant: () => [],
    });

    assert.equal(statistics.petitionsCount, 1);
  });
});
