/**
 * Public Choice Architecture Pack 02B — durable Candidate + Decision Vote
 * persistence / restart certification (Mongo-gated).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import type { Initiative } from "@hu/types";
import { assertDecisionVoteVoterIdentity } from "@hu/types";

import { isMongoAvailableForTests, skipIfMongoUnavailable } from "../../helpers/test-env.js";
import { connectMongoClient } from "../../../src/infrastructure/mongodb/mongo-connection.js";
import { ensureMongoIndexes } from "../../../src/infrastructure/mongodb/mongo-indexes.js";
import {
  castOrChangeInitiativeDecisionVote,
  deleteVotesByDecisionIdForTests,
  getActiveVoteForParticipant,
  getActiveVoteForVisitor,
  listVotesForDecision,
} from "../../../src/modules/initiative-decision-vote/initiative-decision-vote.store.js";
import { listEffectiveVotesForDecision } from "../../../src/modules/initiative-decision-vote/list-effective-decision-votes.js";
import { buildBallotAggregates } from "../../../src/modules/initiative-decision-vote/initiative-decision-vote-ballot-aggregates.js";
import { computeInitiativeDecisionVoteAggregates } from "../../../src/modules/initiative-decision-vote/initiative-decision-vote-aggregates.js";
import {
  createPublicChoiceCandidateForInitiative,
  deletePublicChoiceCandidateForInitiative,
  listPublicChoiceCandidatesForInitiative,
} from "../../../src/modules/public-choice-candidate/public-choice-candidate.service.js";
import {
  deletePublicChoiceCandidatesByInitiativeForTests,
  getPublicChoiceCandidateById,
  listPublicChoiceCandidatesByInitiative,
} from "../../../src/modules/public-choice-candidate/persistence/public-choice-candidate.repository.js";
import { createInitiative, deleteInitiative } from "../../../src/modules/initiatives/initiative.store.js";
import type { RequestIdentity } from "../../../src/modules/initiatives/identity/request-identity.types.js";

if (!isMongoAvailableForTests()) {
  skipIfMongoUnavailable();
}

const dir = path.dirname(fileURLToPath(import.meta.url));
const apiSrc = path.resolve(dir, "../../../src");
const testRunId = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;

const steward: RequestIdentity = { participantId: `pack02b-steward-${testRunId}` };
const trackedDecisionIds: string[] = [];
const trackedInitiativeIds: string[] = [];

function trackDecision(decisionId: string): string {
  trackedDecisionIds.push(decisionId);
  return decisionId;
}

function trackInitiative(initiativeId: string): string {
  trackedInitiativeIds.push(initiativeId);
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
    title: "Pack 02B Election",
    description: "Durable election",
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

function readSrc(relativePath: string): string {
  return readFileSync(path.join(apiSrc, relativePath), "utf8");
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
    try {
      deleteInitiative(initiativeId);
    } catch {
      // initiative may already be gone
    }
  }
});

describe("Public Choice Pack 02B — production authority (no memory merge)", () => {
  it("listEffectiveVotesForDecision has no pack02a merge", () => {
    const source = readSrc("modules/initiative-decision-vote/list-effective-decision-votes.ts");
    assert.match(source, /listVotesForDecision/);
    assert.doesNotMatch(source, /listPack02aVotesForDecision|pack02a-decision-vote\.memory/);
  });

  it("aggregates and public-choice ballot aggregates read durable listEffectiveVotes", () => {
    const aggregates = readSrc("modules/initiative-decision-vote/initiative-decision-vote-aggregates.ts");
    const service = readSrc("modules/initiative-decision-vote/initiative-decision-vote.service.ts");
    assert.match(aggregates, /listEffectiveVotesForDecision/);
    assert.doesNotMatch(aggregates, /listPack02aVotesForDecision/);
    assert.match(service, /listEffectiveVotesForDecision/);
    assert.doesNotMatch(service, /listPack02aVotesForDecision|castOrChangePack02aDecisionVote/);
  });

  it("projection + CD results use repository-backed ballot aggregates", () => {
    const projection = readSrc(
      "modules/initiative-collective-decision/public-initiative-collective-decision.projection.ts",
    );
    const results = readSrc(
      "modules/initiative-collective-decision/initiative-collective-decision-results.ts",
    );
    assert.match(projection, /computePublicChoiceBallotAggregatesForDecision/);
    assert.match(results, /computeInitiativeDecisionVoteAggregates/);
  });
});

describe("Public Choice Pack 02B — Candidate Mongo persistence", () => {
  it("persists candidates and survives reload including campaign URL", async () => {
    const initiativeId = trackInitiative(`pack02b-cand-${testRunId}`);
    createInitiative(buildPublicChoiceInitiative(initiativeId));

    const created = await createPublicChoiceCandidateForInitiative(steward, initiativeId, {
      name: "Candidate A",
      photoUrl: "https://cdn.example.com/a.jpg",
      campaignPageUrl: "https://a.example.com/campaign",
    });

    const reloaded = await getPublicChoiceCandidateById(created.candidateId);
    assert.ok(reloaded);
    assert.equal(reloaded!.name, "Candidate A");
    assert.equal(reloaded!.campaignPageUrl, "https://a.example.com/campaign");
    assert.equal(reloaded!.photoUrl, "https://cdn.example.com/a.jpg");

    const listed = await listPublicChoiceCandidatesByInitiative(initiativeId);
    assert.equal(listed.length, 1);
    assert.equal(listed[0]?.candidateId, created.candidateId);

    const publicList = await listPublicChoiceCandidatesForInitiative(initiativeId);
    assert.equal(publicList.length, 1);
    assert.equal(publicList[0]?.campaignPageUrl, created.campaignPageUrl);
  });
});

describe("Public Choice Pack 02B — Decision Vote durable identity + ballot", () => {
  it("enforces participant/visitor XOR and persists SUPPORT_OPPOSE + SELECT_ONE", async () => {
    assert.throws(
      () =>
        assertDecisionVoteVoterIdentity({
          participantId: "p1",
          visitorKey: "visitor-12345678",
        }),
      /exactly one/,
    );

    const initiativeId = trackInitiative(`pack02b-so-${testRunId}`);
    const decisionId = trackDecision(`pack02b-so-decision-${testRunId}`);
    createInitiative(buildPublicChoiceInitiative(initiativeId, "SUPPORT_OPPOSE"));

    const participantVote = await castOrChangeInitiativeDecisionVote({
      decisionId,
      initiativeId,
      participantId: `participant-so-${testRunId}`,
      choice: "support",
      voterCategory: "participant",
      transparencyCohort: "verified",
    });
    assert.equal(participantVote.choice, "support");
    assert.equal(participantVote.participantId, `participant-so-${testRunId}`);
    assert.equal(participantVote.visitorKey, undefined);

    const visitorVote = await castOrChangeInitiativeDecisionVote({
      decisionId,
      initiativeId,
      visitorKey: `visitor-so-${testRunId}`,
      choice: "abstain",
      voterCategory: "visitor",
      transparencyCohort: "unverified",
    });
    assert.equal(visitorVote.choice, "abstain");
    assert.equal(visitorVote.visitorKey, `visitor-so-${testRunId}`);
    assert.equal(visitorVote.participantId, undefined);

    const reloadedParticipant = await getActiveVoteForParticipant(
      decisionId,
      `participant-so-${testRunId}`,
    );
    const reloadedVisitor = await getActiveVoteForVisitor(decisionId, `visitor-so-${testRunId}`);
    assert.equal(reloadedParticipant?.choice, "support");
    assert.equal(reloadedVisitor?.choice, "abstain");

    const ternary = await computeInitiativeDecisionVoteAggregates(decisionId);
    assert.equal(ternary.total.support, 1);
    assert.equal(ternary.total.abstain, 1);
    assert.equal(ternary.total.totalVotes, 2);
  });

  it("rejects foreign candidateId at service layer via assertCandidateBelongsToInitiative", async () => {
    const initiativeId = trackInitiative(`pack02b-foreign-${testRunId}`);
    createInitiative(buildPublicChoiceInitiative(initiativeId));
    await createPublicChoiceCandidateForInitiative(steward, initiativeId, { name: "Local" });

    const { assertCandidateBelongsToInitiative } = await import(
      "../../../src/modules/public-choice-candidate/public-choice-candidate.service.js"
    );
    await assert.rejects(
      () => assertCandidateBelongsToInitiative(initiativeId, "foreign-candidate-id"),
      /not part of this Public Choice/,
    );
  });

  it("blocks candidate delete when votes exist", async () => {
    const initiativeId = trackInitiative(`pack02b-del-${testRunId}`);
    const decisionId = trackDecision(`pack02b-del-decision-${testRunId}`);
    createInitiative(buildPublicChoiceInitiative(initiativeId));

    const candidate = await createPublicChoiceCandidateForInitiative(steward, initiativeId, {
      name: "Protected",
    });

    await castOrChangeInitiativeDecisionVote({
      decisionId,
      initiativeId,
      participantId: `participant-del-${testRunId}`,
      choice: "candidate",
      candidateId: candidate.candidateId,
      voterCategory: "participant",
      transparencyCohort: "verified",
    });

    await assert.rejects(
      () =>
        deletePublicChoiceCandidateForInitiative(steward, initiativeId, candidate.candidateId),
      /already has votes/,
    );

    const stillThere = await getPublicChoiceCandidateById(candidate.candidateId);
    assert.ok(stillThere);
  });

  it("legacy participant ternary vote remains readable without visitor/candidate fields", async () => {
    const decisionId = trackDecision(`pack02b-legacy-${testRunId}`);
    const initiativeId = `pack02b-legacy-init-${testRunId}`;

    const vote = await castOrChangeInitiativeDecisionVote({
      decisionId,
      initiativeId,
      participantId: `participant-legacy-${testRunId}`,
      choice: "do_not_support",
      transparencyCohort: "verified",
    });

    assert.equal(vote.choice, "do_not_support");
    assert.equal(vote.candidateId, undefined);
    assert.equal(vote.visitorKey, undefined);

    const reloaded = await getActiveVoteForParticipant(
      decisionId,
      `participant-legacy-${testRunId}`,
    );
    assert.deepEqual(reloaded, vote);
  });
});

describe("Public Choice Pack 02B — restart / reload certification", () => {
  it("candidates + participant/visitor SELECT_ONE votes + aggregates survive reload; vote change persists", async () => {
    const initiativeId = trackInitiative(`pack02b-restart-${testRunId}`);
    const decisionId = trackDecision(`pack02b-restart-decision-${testRunId}`);
    createInitiative(buildPublicChoiceInitiative(initiativeId, "SELECT_ONE_CANDIDATE"));

    const candidateA = await createPublicChoiceCandidateForInitiative(steward, initiativeId, {
      name: "A",
      campaignPageUrl: "https://a.example.com/",
    });
    const candidateB = await createPublicChoiceCandidateForInitiative(steward, initiativeId, {
      name: "B",
    });

    await castOrChangeInitiativeDecisionVote({
      decisionId,
      initiativeId,
      participantId: `participant-restart-${testRunId}`,
      choice: "candidate",
      candidateId: candidateA.candidateId,
      voterCategory: "participant",
      transparencyCohort: "verified",
    });

    await castOrChangeInitiativeDecisionVote({
      decisionId,
      initiativeId,
      visitorKey: `visitor-b-${testRunId}`,
      choice: "candidate",
      candidateId: candidateB.candidateId,
      voterCategory: "visitor",
      transparencyCohort: "unverified",
    });

    await castOrChangeInitiativeDecisionVote({
      decisionId,
      initiativeId,
      visitorKey: `visitor-abstain-${testRunId}`,
      choice: "abstain",
      voterCategory: "visitor",
      transparencyCohort: "unverified",
    });

    const candidatesBefore = await listPublicChoiceCandidatesByInitiative(initiativeId);
    const votesBefore = await listEffectiveVotesForDecision(decisionId);
    const aggregatesBefore = buildBallotAggregates({
      ballotMode: "SELECT_ONE_CANDIDATE",
      votes: votesBefore,
      candidateIds: candidatesBefore.map((c) => c.candidateId),
    });

    assert.equal(candidatesBefore.length, 2);
    assert.equal(votesBefore.length, 3);
    assert.equal(aggregatesBefore.ballotMode, "SELECT_ONE_CANDIDATE");
    if (aggregatesBefore.ballotMode === "SELECT_ONE_CANDIDATE") {
      assert.equal(aggregatesBefore.totalEffectiveVoters, 3);
      assert.equal(
        aggregatesBefore.candidates.find((c) => c.candidateId === candidateA.candidateId)?.count,
        1,
      );
      assert.equal(
        aggregatesBefore.candidates.find((c) => c.candidateId === candidateB.candidateId)?.count,
        1,
      );
      assert.equal(aggregatesBefore.abstain, 1);
    }

    // Simulate restart: fresh reads through repository (no in-process cache of vote objects).
    const candidatesAfter = await listPublicChoiceCandidatesByInitiative(initiativeId);
    const votesAfter = await listVotesForDecision(decisionId);
    const aggregatesAfter = buildBallotAggregates({
      ballotMode: "SELECT_ONE_CANDIDATE",
      votes: votesAfter,
      candidateIds: candidatesAfter.map((c) => c.candidateId),
    });

    assert.deepEqual(
      candidatesAfter.map((c) => ({
        candidateId: c.candidateId,
        name: c.name,
        campaignPageUrl: c.campaignPageUrl,
      })),
      candidatesBefore.map((c) => ({
        candidateId: c.candidateId,
        name: c.name,
        campaignPageUrl: c.campaignPageUrl,
      })),
    );
    assert.equal(votesAfter.length, votesBefore.length);
    assert.deepEqual(aggregatesAfter, aggregatesBefore);

    // Change Visitor B → Candidate A
    await castOrChangeInitiativeDecisionVote({
      decisionId,
      initiativeId,
      visitorKey: `visitor-b-${testRunId}`,
      choice: "candidate",
      candidateId: candidateA.candidateId,
      voterCategory: "visitor",
      transparencyCohort: "unverified",
    });

    const votesChanged = await listEffectiveVotesForDecision(decisionId);
    const aggregatesChanged = buildBallotAggregates({
      ballotMode: "SELECT_ONE_CANDIDATE",
      votes: votesChanged,
      candidateIds: candidatesAfter.map((c) => c.candidateId),
    });

    assert.equal(votesChanged.length, 3);
    if (aggregatesChanged.ballotMode === "SELECT_ONE_CANDIDATE") {
      assert.equal(aggregatesChanged.totalEffectiveVoters, 3);
      assert.equal(
        aggregatesChanged.candidates.find((c) => c.candidateId === candidateA.candidateId)?.count,
        2,
      );
      assert.equal(
        aggregatesChanged.candidates.find((c) => c.candidateId === candidateB.candidateId)?.count,
        0,
      );
    }

    const votesReloaded = await listVotesForDecision(decisionId);
    const aggregatesReloaded = buildBallotAggregates({
      ballotMode: "SELECT_ONE_CANDIDATE",
      votes: votesReloaded,
      candidateIds: (await listPublicChoiceCandidatesByInitiative(initiativeId)).map(
        (c) => c.candidateId,
      ),
    });
    assert.deepEqual(aggregatesReloaded, aggregatesChanged);

    const visitorVote = await getActiveVoteForVisitor(decisionId, `visitor-b-${testRunId}`);
    assert.equal(visitorVote?.candidateId, candidateA.candidateId);
  });
});
