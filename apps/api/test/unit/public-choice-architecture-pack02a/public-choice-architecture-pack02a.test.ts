/**
 * Public Choice Architecture Pack 02A — focused behavioral contracts.
 * Candidate domain, ballot modes, visitor identity, effective-vote aggregation.
 */
process.env.NODE_TEST_ENV = "true";
process.env.INITIATIVE_PERSISTENCE = "memory";
process.env.INITIATIVE_COLLECTIVE_DECISION_PERSISTENCE = "memory";

import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import {
  assertDecisionVoteVoterIdentity,
  validateVotePayloadForBallotMode,
} from "@hu/types";

import {
  aggregateSelectOneVotes,
  aggregateSupportOpposeVotes,
  buildBallotAggregates,
} from "../../../src/modules/initiative-decision-vote/initiative-decision-vote-ballot-aggregates.js";
import {
  castOrChangePack02aDecisionVote,
  listPack02aVotesForDecision,
  resetPack02aDecisionVoteMemoryForTests,
} from "../../../src/modules/initiative-decision-vote/pack02a-decision-vote.memory.js";
import {
  assertCandidateBelongsToInitiative,
  createPublicChoiceCandidateForInitiative,
  deletePublicChoiceCandidateForInitiative,
  updatePublicChoiceCandidateForInitiative,
} from "../../../src/modules/public-choice-candidate/public-choice-candidate.service.js";
import { resetPublicChoiceCandidatesForTests } from "../../../src/modules/public-choice-candidate/public-choice-candidate.memory.store.js";
import { deletePublicChoiceCandidatesByInitiativeForTests } from "../../../src/modules/public-choice-candidate/persistence/public-choice-candidate.repository.js";
import {
  validateCreateInitiativeDraftInput,
} from "../../../src/modules/initiatives/initiative.validators.js";
import {
  createInitiative,
  deleteInitiative,
} from "../../../src/modules/initiatives/initiative.store.js";
import type { Initiative } from "@hu/types";
import type { RequestIdentity } from "../../../src/modules/initiatives/identity/request-identity.types.js";
import { isMongoConfigured } from "../../../src/infrastructure/mongodb/mongo-config.js";

const steward: RequestIdentity = { participantId: "pack02a-steward" };
const pack02aInitiativeIds: string[] = [];

function trackPack02aInitiative(initiativeId: string): string {
  pack02aInitiativeIds.push(initiativeId);
  return initiativeId;
}

function buildPublicChoiceInitiative(
  initiativeId: string,
  ballotMode: "SUPPORT_OPPOSE" | "SELECT_ONE_CANDIDATE" = "SELECT_ONE_CANDIDATE",
): Initiative {
  const now = new Date().toISOString();
  return {
    initiativeId,
    stewardId: steward.participantId,
    createdAt: now,
    updatedAt: now,
    title: "Pack 02A Election",
    description: "Election description",
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
      ballotMode,
    },
    revisions: [],
    contributions: [],
    timeline: [],
  };
}

afterEach(async () => {
  resetPack02aDecisionVoteMemoryForTests();
  resetPublicChoiceCandidatesForTests();
  if (isMongoConfigured()) {
    for (const initiativeId of pack02aInitiativeIds.splice(0)) {
      await deletePublicChoiceCandidatesByInitiativeForTests(initiativeId);
    }
  } else {
    pack02aInitiativeIds.length = 0;
  }
});

describe("Public Choice Architecture Pack 02A — Candidate domain", () => {
  it("Candidate is Initiative-owned (not civic root) with name/photo/campaign URL", async () => {
    const initiativeId = trackPack02aInitiative("pack02a-cand-init-1");
    createInitiative(buildPublicChoiceInitiative(initiativeId));
    try {
      const created = await createPublicChoiceCandidateForInitiative(steward, initiativeId, {
        name: "Ada",
        photoUrl: "https://cdn.example.com/ada.jpg",
        campaignPageUrl: "https://ada.example.com/campaign",
      });

      assert.equal(created.initiativeId, initiativeId);
      assert.equal(created.name, "Ada");
      assert.equal(created.photoUrl, "https://cdn.example.com/ada.jpg");
      assert.match(created.campaignPageUrl ?? "", /^https:\/\//);
      assert.equal("createdAt" in created, false);
      assert.equal("updatedAt" in created, false);

      const updated = await updatePublicChoiceCandidateForInitiative(
        steward,
        initiativeId,
        created.candidateId,
        { name: "Ada Lovelace" },
      );
      assert.equal(updated.name, "Ada Lovelace");

      await deletePublicChoiceCandidateForInitiative(steward, initiativeId, created.candidateId);
    } finally {
      deleteInitiative(initiativeId);
    }
  });

  it("rejects invalid campaign URL and foreign candidates", async () => {
    const initiativeId = trackPack02aInitiative("pack02a-cand-init-2");
    createInitiative(buildPublicChoiceInitiative(initiativeId));
    try {
      await assert.rejects(
        () =>
          createPublicChoiceCandidateForInitiative(steward, initiativeId, {
            name: "Bad",
            campaignPageUrl: "javascript:alert(1)",
          }),
        /http or https/,
      );

      await assert.rejects(
        () => assertCandidateBelongsToInitiative(initiativeId, "missing-candidate"),
        /not part of this Public Choice/,
      );
    } finally {
      deleteInitiative(initiativeId);
    }
  });
});

describe("Public Choice Architecture Pack 02A — ballot modes", () => {
  it("persists SUPPORT_OPPOSE / SELECT_ONE_CANDIDATE on PUBLIC_CHOICE create", () => {
    const support = validateCreateInitiativeDraftInput({
      title: "Election",
      description: "Desc",
      lifecycleProfile: "PUBLIC_CHOICE",
      countrySlug: "ca",
      participationScope: "country",
      ballotMode: "SUPPORT_OPPOSE",
    });
    assert.equal(support.ballotMode, "SUPPORT_OPPOSE");

    const select = validateCreateInitiativeDraftInput({
      title: "Election",
      description: "Desc",
      lifecycleProfile: "PUBLIC_CHOICE",
      countrySlug: "ca",
      participationScope: "country",
      ballotMode: "SELECT_ONE_CANDIDATE",
    });
    assert.equal(select.ballotMode, "SELECT_ONE_CANDIDATE");

    assert.throws(
      () =>
        validateCreateInitiativeDraftInput({
          title: "Standard",
          description: "Desc",
          lifecycleProfile: "STANDARD",
          activityArea: "Education",
          ballotMode: "SUPPORT_OPPOSE",
        }),
      /ballotMode is only valid for PUBLIC_CHOICE/,
    );
  });

  it("validates vote payloads per ballot mode", () => {
    assert.equal(
      validateVotePayloadForBallotMode("SUPPORT_OPPOSE", { choice: "support" }).ok,
      true,
    );
    assert.equal(
      validateVotePayloadForBallotMode("SUPPORT_OPPOSE", {
        choice: "candidate",
        candidateId: "c1",
      }).ok,
      false,
    );
    assert.equal(
      validateVotePayloadForBallotMode("SELECT_ONE_CANDIDATE", {
        choice: "candidate",
        candidateId: "c1",
      }).ok,
      true,
    );
    assert.equal(
      validateVotePayloadForBallotMode("SELECT_ONE_CANDIDATE", { choice: "abstain" }).ok,
      true,
    );
    assert.equal(
      validateVotePayloadForBallotMode("SELECT_ONE_CANDIDATE", { choice: "support" }).ok,
      false,
    );
  });
});

describe("Public Choice Architecture Pack 02A — voter identity + effective votes", () => {
  it("XOR identity: participant OR visitor, never both", () => {
    assert.throws(
      () =>
        assertDecisionVoteVoterIdentity({
          participantId: "p1",
          visitorKey: "visitor-12345678",
        }),
      /exactly one/,
    );
    assert.doesNotThrow(() => assertDecisionVoteVoterIdentity({ participantId: "p1" }));
    assert.doesNotThrow(() =>
      assertDecisionVoteVoterIdentity({ visitorKey: "visitor-12345678" }),
    );
  });

  it("visitor vote works; duplicate does not multiply; change replaces", () => {
    const decisionId = "pack02a-decision-v1";
    const initiativeId = "pack02a-init-v1";

    const first = castOrChangePack02aDecisionVote({
      decisionId,
      initiativeId,
      visitorKey: "visitor-abcdef12",
      choice: "support",
      voterCategory: "visitor",
      transparencyCohort: "unverified",
    });
    assert.equal(first.choice, "support");
    assert.equal(listPack02aVotesForDecision(decisionId).length, 1);

    castOrChangePack02aDecisionVote({
      decisionId,
      initiativeId,
      visitorKey: "visitor-abcdef12",
      choice: "support",
      voterCategory: "visitor",
      transparencyCohort: "unverified",
    });
    assert.equal(listPack02aVotesForDecision(decisionId).length, 1);

    const changed = castOrChangePack02aDecisionVote({
      decisionId,
      initiativeId,
      visitorKey: "visitor-abcdef12",
      choice: "do_not_support",
      voterCategory: "visitor",
      transparencyCohort: "unverified",
    });
    assert.equal(changed.choice, "do_not_support");
    assert.equal(listPack02aVotesForDecision(decisionId).length, 1);
  });

  it("A→B candidate move and Candidate→Abstain preserve total effective voters", () => {
    const decisionId = "pack02a-decision-sel";
    const initiativeId = "pack02a-init-sel";
    const candidateIds = ["cand-a", "cand-b"];

    castOrChangePack02aDecisionVote({
      decisionId,
      initiativeId,
      participantId: "participant-1",
      choice: "candidate",
      candidateId: "cand-a",
      voterCategory: "participant",
      transparencyCohort: "verified",
    });

    let aggregates = aggregateSelectOneVotes(
      listPack02aVotesForDecision(decisionId),
      candidateIds,
    );
    assert.equal(aggregates.totalEffectiveVoters, 1);
    assert.equal(aggregates.candidates.find((c) => c.candidateId === "cand-a")?.count, 1);

    castOrChangePack02aDecisionVote({
      decisionId,
      initiativeId,
      participantId: "participant-1",
      choice: "candidate",
      candidateId: "cand-b",
      voterCategory: "participant",
      transparencyCohort: "verified",
    });

    aggregates = aggregateSelectOneVotes(listPack02aVotesForDecision(decisionId), candidateIds);
    assert.equal(aggregates.totalEffectiveVoters, 1);
    assert.equal(aggregates.candidates.find((c) => c.candidateId === "cand-a")?.count, 0);
    assert.equal(aggregates.candidates.find((c) => c.candidateId === "cand-b")?.count, 1);

    castOrChangePack02aDecisionVote({
      decisionId,
      initiativeId,
      participantId: "participant-1",
      choice: "abstain",
      voterCategory: "participant",
      transparencyCohort: "verified",
    });

    aggregates = aggregateSelectOneVotes(listPack02aVotesForDecision(decisionId), candidateIds);
    assert.equal(aggregates.totalEffectiveVoters, 1);
    assert.equal(aggregates.abstain, 1);
    assert.equal(aggregates.candidates.find((c) => c.candidateId === "cand-b")?.count, 0);
  });

  it("zero votes valid; SUPPORT_OPPOSE aggregates; history not double counted", () => {
    const empty = buildBallotAggregates({
      ballotMode: "SUPPORT_OPPOSE",
      votes: [],
      candidateIds: [],
    });
    assert.equal(empty.ballotMode, "SUPPORT_OPPOSE");
    if (empty.ballotMode === "SUPPORT_OPPOSE") {
      assert.equal(empty.total.totalVotes, 0);
      assert.equal(empty.participationBreakdown.totalEffectiveVoters, 0);
    }

    const decisionId = "pack02a-decision-so";
    castOrChangePack02aDecisionVote({
      decisionId,
      initiativeId: "i1",
      participantId: "p1",
      choice: "support",
      voterCategory: "member",
      transparencyCohort: "verified",
    });
    castOrChangePack02aDecisionVote({
      decisionId,
      initiativeId: "i1",
      participantId: "p1",
      choice: "abstain",
      voterCategory: "member",
      transparencyCohort: "verified",
    });

    const votes = listPack02aVotesForDecision(decisionId);
    assert.equal(votes.length, 1);
    const aggregates = aggregateSupportOpposeVotes(votes);
    assert.equal(aggregates.total.totalVotes, 1);
    assert.equal(aggregates.total.abstain, 1);
    assert.equal(aggregates.total.support, 0);
    assert.equal(aggregates.participationBreakdown.members, 1);
    assert.equal(aggregates.participationBreakdown.participants, 0);
  });
});

describe("Public Choice Architecture Pack 02A — VISITOR_TO_PARTICIPANT gap", () => {
  it("documents VISITOR_TO_PARTICIPANT_VOTE_RECONCILIATION_GAP=YES (no auto-merge)", () => {
    const decisionId = "pack02a-recon-decision";
    castOrChangePack02aDecisionVote({
      decisionId,
      initiativeId: "i-recon",
      visitorKey: "visitor-same-person",
      choice: "support",
      voterCategory: "visitor",
      transparencyCohort: "unverified",
    });
    castOrChangePack02aDecisionVote({
      decisionId,
      initiativeId: "i-recon",
      participantId: "participant-same-person",
      choice: "do_not_support",
      voterCategory: "participant",
      transparencyCohort: "verified",
    });

    const votes = listPack02aVotesForDecision(decisionId);
    assert.equal(votes.length, 2);
    assert.ok(votes.some((v) => v.visitorKey === "visitor-same-person"));
    assert.ok(votes.some((v) => v.participantId === "participant-same-person"));
  });
});

describe("Public Choice candidate election semantics — voter categories", () => {
  it("Member does not also increment Participant; ranking/ties derived", () => {
    const decisionId = "pack02a-cat-decision";
    const initiativeId = "pack02a-cat-init";
    const candidateIds = ["cand-a", "cand-b", "cand-c"];

    castOrChangePack02aDecisionVote({
      decisionId,
      initiativeId,
      visitorKey: "visitor-cat-0001",
      choice: "candidate",
      candidateId: "cand-a",
      voterCategory: "visitor",
      transparencyCohort: "unverified",
    });
    castOrChangePack02aDecisionVote({
      decisionId,
      initiativeId,
      participantId: "participant-cat-1",
      choice: "candidate",
      candidateId: "cand-a",
      voterCategory: "participant",
      transparencyCohort: "verified",
    });
    castOrChangePack02aDecisionVote({
      decisionId,
      initiativeId,
      participantId: "member-cat-1",
      choice: "candidate",
      candidateId: "cand-b",
      voterCategory: "member",
      transparencyCohort: "verified",
    });
    castOrChangePack02aDecisionVote({
      decisionId,
      initiativeId,
      participantId: "member-cat-2",
      choice: "abstain",
      voterCategory: "member",
      transparencyCohort: "verified",
    });

    const aggregates = aggregateSelectOneVotes(
      listPack02aVotesForDecision(decisionId),
      candidateIds,
    );

    assert.equal(aggregates.totalEffectiveVoters, 4);
    assert.equal(aggregates.participationBreakdown.visitors, 1);
    assert.equal(aggregates.participationBreakdown.participants, 1);
    assert.equal(aggregates.participationBreakdown.members, 2);
    assert.equal(
      aggregates.participationBreakdown.visitors +
        aggregates.participationBreakdown.participants +
        aggregates.participationBreakdown.members,
      aggregates.totalEffectiveVoters,
    );

    const a = aggregates.candidates.find((c) => c.candidateId === "cand-a");
    const b = aggregates.candidates.find((c) => c.candidateId === "cand-b");
    assert.equal(a?.count, 2);
    assert.equal(a?.rank, 1);
    assert.equal(b?.count, 1);
    assert.equal(b?.rank, 2);
    assert.equal(aggregates.abstain, 1);
    assert.ok(aggregates.abstainPercentage > 0);
  });

  it("tied candidates share rank and next rank skips", () => {
    const decisionId = "pack02a-tie-decision";
    const initiativeId = "pack02a-tie-init";
    const candidateIds = ["cand-a", "cand-b", "cand-c"];

    for (const [participantId, candidateId] of [
      ["p1", "cand-a"],
      ["p2", "cand-b"],
      ["p3", "cand-c"],
    ] as const) {
      castOrChangePack02aDecisionVote({
        decisionId,
        initiativeId,
        participantId,
        choice: "candidate",
        candidateId,
        voterCategory: "participant",
        transparencyCohort: "verified",
      });
    }

    // Make A and B tie at 2 each; C stays at 1 → ranks 1,1,3
    castOrChangePack02aDecisionVote({
      decisionId,
      initiativeId,
      participantId: "p4",
      choice: "candidate",
      candidateId: "cand-a",
      voterCategory: "participant",
      transparencyCohort: "verified",
    });
    castOrChangePack02aDecisionVote({
      decisionId,
      initiativeId,
      participantId: "p5",
      choice: "candidate",
      candidateId: "cand-b",
      voterCategory: "member",
      transparencyCohort: "verified",
    });

    const aggregates = aggregateSelectOneVotes(
      listPack02aVotesForDecision(decisionId),
      candidateIds,
    );
    const a = aggregates.candidates.find((c) => c.candidateId === "cand-a");
    const b = aggregates.candidates.find((c) => c.candidateId === "cand-b");
    const c = aggregates.candidates.find((c) => c.candidateId === "cand-c");
    assert.equal(a?.rank, 1);
    assert.equal(b?.rank, 1);
    assert.equal(a?.isTie, true);
    assert.equal(b?.isTie, true);
    assert.equal(c?.rank, 3);
    assert.equal(c?.isTie, false);
  });
});
