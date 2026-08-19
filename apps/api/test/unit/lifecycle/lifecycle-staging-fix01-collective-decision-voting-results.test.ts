/**
 * LIFECYCLE STAGING FIX 01 — Collective Decision Voting Results
 *
 * Proves canonical Initiative Decision Votes reach CD public presentation.
 * Mongo-gated for cast→aggregate path; pure/offline for zero-vote + wiring.
 */

process.env.NODE_TEST_ENV = "true";
process.env.INITIATIVE_COLLECTIVE_DECISION_PERSISTENCE = "memory";
process.env.INITIATIVE_PERSISTENCE = "memory";

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { after, describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  buildTransparentCollectiveDecisionResults,
  createEmptyInitiativeDecisionVoteAggregates,
} from "@hu/types";

import { isMongoAvailableForTests } from "../../helpers/test-env.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));

const {
  castOrChangeInitiativeDecisionVote,
  deleteVotesByDecisionIdForTests,
  listVotesForDecision,
} = await import(
  "../../../src/modules/initiative-decision-vote/initiative-decision-vote.store.js"
);
const {
  assertUnweightedVoteCounts,
  computeInitiativeDecisionVoteAggregates,
} = await import(
  "../../../src/modules/initiative-decision-vote/initiative-decision-vote-aggregates.js"
);
const { buildPublicCollectiveDecisionResults } = await import(
  "../../../src/modules/initiative-collective-decision/initiative-collective-decision-results.js"
);
const {
  createDecision,
  deleteDecisionsByStewardIdForTests,
  getDecisionById,
  updateDecision,
} = await import(
  "../../../src/modules/initiative-collective-decision/initiative-collective-decision.store.js"
);
const { toPublicInitiativeCollectiveDecisionProjection } = await import(
  "../../../src/modules/initiative-collective-decision/public-initiative-collective-decision.projection.js"
);
const { buildInitiativeLifecycleStageAdapterResult } = await import(
  "../../../src/modules/initiatives/initiative-lifecycle-stage-adapter.js"
);
const { createInitiative, deleteInitiative } = await import(
  "../../../src/modules/initiatives/initiative.store.js"
);

describe("Lifecycle Staging Fix 01 — CD Voting Results (offline contracts)", () => {
  it("listVotesForDecision is the canonical store read (no NODE_TEST_ENV empty short-circuit)", () => {
    const storeSource = readFileSync(
      path.resolve(
        HERE,
        "../../../src/modules/initiative-decision-vote/initiative-decision-vote.store.ts",
      ),
      "utf8",
    );
    const fnStart = storeSource.indexOf("export async function listVotesForDecision");
    assert.ok(fnStart >= 0);
    const fnBody = storeSource.slice(fnStart, fnStart + 450);
    assert.equal(fnBody.includes('NODE_TEST_ENV === "true"'), false);
    assert.equal(fnBody.includes("return [];"), false);
    assert.match(fnBody, /listInitiativeDecisionVotesByDecision/);
  });

  it("zero aggregates map to honest empty Voting Results statistics (not an error)", () => {
    const results = buildTransparentCollectiveDecisionResults({
      status: "closed",
      aggregates: createEmptyInitiativeDecisionVoteAggregates(),
    });
    assert.equal(results.statistics.totalVotesCast, 0);
    assert.equal(results.statistics.supportCount, 0);
    assert.equal(results.statistics.doNotSupportCount, 0);
    assert.equal(results.statistics.abstainCount, 0);
    assert.match(results.outcomeSummary, /Inconclusive/i);
  });

  it("unavailable vote substrate yields empty aggregates without throwing", async () => {
    const previousUri = process.env.MONGODB_URI;
    delete process.env.MONGODB_URI;
    try {
      const aggregates = await computeInitiativeDecisionVoteAggregates(
        "fix01-missing-mongo-decision",
      );
      assert.equal(aggregates.total.totalVotes, 0);
      const results = await buildPublicCollectiveDecisionResults({
        decisionId: "fix01-missing-mongo-decision",
        initiativeId: "fix01-initiative",
        decisionSessionId: null,
        stewardId: "steward",
        sequenceNumber: 1,
        participationScope: "open",
        status: "closed",
        question: "Q?",
        closesAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } as never);
      assert.equal(results.statistics.totalVotesCast, 0);
    } finally {
      if (previousUri !== undefined) {
        process.env.MONGODB_URI = previousUri;
      }
    }
  });

  it("does not introduce a parallel vote model in CD results / PublicResult", () => {
    const resultsSrc = readFileSync(
      path.resolve(
        HERE,
        "../../../src/modules/initiative-collective-decision/initiative-collective-decision-results.ts",
      ),
      "utf8",
    );
    assert.match(resultsSrc, /computeInitiativeDecisionVoteAggregates/);

    const publicResult = readFileSync(
      path.resolve(
        HERE,
        "../../../../web/src/features/initiative-collective-decision-lifecycle/components/InitiativeCollectiveDecisionPublicResult.tsx",
      ),
      "utf8",
    );
    assert.match(publicResult, /Voting Results/);
    assert.match(publicResult, /projection\.statistics/);
    assert.match(publicResult, /getPublicInitiativeCollectiveDecisionOrThrow/);
  });

  it("opened CD adapter exposes publishedRecordId for Voting Results mount (memory decisions)", async () => {
    const initiativeId = `fix01-opened-adapter-${Date.now()}`;
    const decisionId = `fix01-opened-decision-${Date.now()}`;
    const now = new Date().toISOString();
    const stewardId = "fix01-adapter-steward";

    createInitiative({
      initiativeId,
      stewardId,
      title: "Fix 01 Open Adapter",
      description: "Fixture",
      status: "implementation",
      lifecyclePhase: "projected",
      lifecycleProfile: "STANDARD",
      visibility: { policy: "public" },
      metadata: {
        activityArea: "Environment",
        communitySlug: "fixture",
        category: "Environment",
      },
      timeline: [],
      createdAt: now,
      updatedAt: now,
    } as never);

    createDecision({
      decisionId,
      initiativeId,
      decisionSessionId: null,
      stewardId,
      sequenceNumber: 1,
      participationScope: "open",
      status: "opened",
      question: "Open window?",
      openedAt: now,
      closesAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      createdAt: now,
      updatedAt: now,
    });

    try {
      const adapter = await buildInitiativeLifecycleStageAdapterResult("collective_decision", {
        initiativeId,
        stewardId,
        title: "Fix 01 Open Adapter",
        description: "Fixture",
        status: "implementation",
        lifecyclePhase: "projected",
        lifecycleProfile: "STANDARD",
        visibility: { policy: "public" },
        metadata: {
          activityArea: "Environment",
          communitySlug: "fixture",
          category: "Environment",
        },
        timeline: [],
        createdAt: now,
        updatedAt: now,
      } as never);

      assert.equal(adapter.publishedRecordId, decisionId);
      assert.equal(adapter.hasPublicResult, true);
      assert.equal(adapter.presentationStatus, "ready_for_review");
    } finally {
      deleteDecisionsByStewardIdForTests(stewardId);
      deleteInitiative(initiativeId);
    }
  });
});

describe("Lifecycle Staging Fix 01 — CD Voting Results (Mongo when available)", () => {
  const runId = Date.now();
  const initiativeId = `fix01-vote-init-${runId}`;
  const decisionId = `fix01-vote-decision-${runId}`;
  const participantA = `fix01-voter-a-${runId}`;
  const participantB = `fix01-voter-b-${runId}`;
  const stewardId = `fix01-vote-steward-${runId}`;

  after(async () => {
    if (!isMongoAvailableForTests()) {
      return;
    }
    try {
      await deleteVotesByDecisionIdForTests(decisionId);
    } catch {
      // ignore cleanup failures
    }
    deleteDecisionsByStewardIdForTests(stewardId);
    deleteInitiative(initiativeId);
  });

  it("stored votes → aggregates → public CD projection; change not double-counted; reload preserves", async (t) => {
    if (!isMongoAvailableForTests()) {
      t.skip("MONGODB_URI not configured");
      return;
    }

    const now = new Date().toISOString();
    createInitiative({
      initiativeId,
      stewardId,
      title: "Fix 01 Voting",
      description: "Fixture",
      status: "implementation",
      lifecyclePhase: "projected",
      lifecycleProfile: "STANDARD",
      visibility: { policy: "public" },
      metadata: {
        activityArea: "Environment",
        communitySlug: "fixture",
        category: "Environment",
      },
      timeline: [],
      createdAt: now,
      updatedAt: now,
    } as never);

    createDecision({
      decisionId,
      initiativeId,
      decisionSessionId: null,
      stewardId,
      sequenceNumber: 1,
      participationScope: "open",
      status: "opened",
      question: "Support the cleanup plan?",
      openedAt: now,
      closesAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      createdAt: now,
      updatedAt: now,
    });

    try {
      await castOrChangeInitiativeDecisionVote({
        decisionId,
        participantId: participantA,
        initiativeId,
        choice: "support",
        transparencyCohort: "verified",
      });
      await castOrChangeInitiativeDecisionVote({
        decisionId,
        participantId: participantB,
        initiativeId,
        choice: "do_not_support",
        transparencyCohort: "unverified",
      });
      await castOrChangeInitiativeDecisionVote({
        decisionId,
        participantId: participantA,
        initiativeId,
        choice: "abstain",
        transparencyCohort: "verified",
      });
    } catch (error) {
      t.skip(
        `Mongo vote substrate unreachable: ${error instanceof Error ? error.message : String(error)}`,
      );
      return;
    }

    const votes = await listVotesForDecision(decisionId);
    assert.equal(votes.length, 2);
    const aggregates = await computeInitiativeDecisionVoteAggregates(decisionId);
    assert.equal(aggregates.total.totalVotes, 2);
    assert.equal(aggregates.total.support, 0);
    assert.equal(aggregates.total.doNotSupport, 1);
    assert.equal(aggregates.total.abstain, 1);
    assert.ok(assertUnweightedVoteCounts(votes, aggregates));

    updateDecision(decisionId, {
      status: "closed",
      closedAt: new Date().toISOString(),
    });

    const decision = getDecisionById(decisionId)!;
    const results = await buildPublicCollectiveDecisionResults(decision);
    assert.equal(results.statistics.totalVotesCast, 2);
    assert.equal(results.statistics.abstainCount, 1);
    assert.equal(results.statistics.doNotSupportCount, 1);

    const projection = await toPublicInitiativeCollectiveDecisionProjection(decision);
    assert.equal(projection.statistics.totalVotesCast, 2);
    assert.equal(projection.statistics.abstainCount, 1);
    assert.match(projection.outcomeSummary, /abstain/i);

    const reloaded = await toPublicInitiativeCollectiveDecisionProjection(
      getDecisionById(decisionId)!,
    );
    assert.deepEqual(reloaded.statistics, projection.statistics);
    assert.equal(reloaded.outcomeSummary, projection.outcomeSummary);

    const adapter = await buildInitiativeLifecycleStageAdapterResult("collective_decision", {
      initiativeId,
      stewardId,
      title: "Fix 01 Voting",
      description: "Fixture",
      status: "implementation",
      lifecyclePhase: "projected",
      lifecycleProfile: "STANDARD",
      visibility: { policy: "public" },
      metadata: {
        activityArea: "Environment",
        communitySlug: "fixture",
        category: "Environment",
      },
      timeline: [],
      createdAt: now,
      updatedAt: now,
    } as never);
    assert.equal(adapter.publishedRecordId, decisionId);
    assert.equal(adapter.hasPublicResult, true);
  });
});
