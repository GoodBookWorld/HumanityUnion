import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { InitiativeImplementationCommitmentIntelligenceSnapshot } from "@hu/types";

import { generateImplementationCommitmentDraftContent } from "../../../src/modules/initiative-implementation-commitment-lifecycle/initiative-implementation-commitment-draft-builder.js";

function buildSnapshot(
  overrides: Partial<InitiativeImplementationCommitmentIntelligenceSnapshot> = {},
): InitiativeImplementationCommitmentIntelligenceSnapshot {
  return {
    initiativeId: "initiative-part-i",
    generatedAt: "2026-08-08T00:00:00.000Z",
    initiativeTitle: "Community Compost Network",
    initiativeDescription: "Build neighborhood compost hubs.",
    decisionReference: {
      decisionId: "decision-1",
      question: "Should the city fund neighborhood compost hubs?",
      sequenceNumber: 1,
      closedAt: "2026-08-05T00:00:00.000Z",
      title: "Collective Decision: Community Compost Network",
      decisionSummary: "The city will fund neighborhood compost hubs.",
      approvedActions: ["Pilot in two districts first", "Publish a community update"],
      rejectedAlternatives: ["Fund citywide rollout"],
      responsibleRoles: ["Sustainability Office", "District Coordinators"],
      implementationPriorities: ["High", "Normal"],
      implementationTimeline: "Q4 2026 rollout",
      decisionRisks: ["Insufficient municipal budget"],
      successCriteria: ["Success when: Expand compost access"],
      requiredResources: ["Compost bins", "Site coordinators"],
      supportingReferences: ["session-1"],
      decisionSessionId: "session-1",
      decisionSessionVersion: 1,
      petitionId: "petition-1",
      petitionVersion: 1,
      revisionId: "revision-1",
      revisionVersion: 2,
      analysisId: "analysis-1",
      analysisVersion: 1,
      proposalIds: ["proposal-1"],
      participantSignatures: 3,
      memberSignatures: 1,
      visitorSignals: 2,
    },
    activeAllyCount: 2,
    consistencyChecks: [],
    isCollectiveDecisionAvailable: true,
    isEmpty: false,
    ...overrides,
  };
}

describe("generateImplementationCommitmentDraftContent (Commitment Candidate Builder)", () => {
  it("titles the draft from the Initiative title", async () => {
    const content = await generateImplementationCommitmentDraftContent(buildSnapshot());
    assert.equal(content.title, "Implementation Commitments: Community Compost Network");
  });

  it("builds the summary from the Collective Decision summary", async () => {
    const content = await generateImplementationCommitmentDraftContent(buildSnapshot());
    assert.equal(content.summary, "The city will fund neighborhood compost hubs.");
  });

  it("generates exactly one Candidate per Approved Action", async () => {
    const content = await generateImplementationCommitmentDraftContent(buildSnapshot());
    assert.equal(content.candidates.length, 2);
    assert.equal(content.candidates[0]!.approvedAction, "Pilot in two districts first");
    assert.equal(content.candidates[1]!.approvedAction, "Publish a community update");
  });

  it("never invents an Action beyond the Collective Decision's approvedActions list", async () => {
    const content = await generateImplementationCommitmentDraftContent(buildSnapshot());
    const approvedActions = new Set(
      buildSnapshot().decisionReference!.approvedActions,
    );
    for (const candidate of content.candidates) {
      assert.ok(approvedActions.has(candidate.approvedAction));
    }
  });

  it("assigns deterministic candidateIds from index", async () => {
    const content = await generateImplementationCommitmentDraftContent(buildSnapshot());
    assert.equal(content.candidates[0]!.candidateId, "candidate-0");
    assert.equal(content.candidates[1]!.candidateId, "candidate-1");
  });

  it("cycles responsible roles and priorities by index", async () => {
    const content = await generateImplementationCommitmentDraftContent(buildSnapshot());
    assert.equal(content.candidates[0]!.suggestedResponsibleRole, "Sustainability Office");
    assert.equal(content.candidates[1]!.suggestedResponsibleRole, "District Coordinators");
    assert.equal(content.candidates[0]!.priority, "High");
    assert.equal(content.candidates[1]!.priority, "Normal");
  });

  it("carries decision-level requiredResources/relatedRisks onto every Candidate", async () => {
    const content = await generateImplementationCommitmentDraftContent(buildSnapshot());
    for (const candidate of content.candidates) {
      assert.deepEqual(candidate.requiredResources, ["Compost bins", "Site coordinators"]);
      assert.deepEqual(candidate.relatedRisks, ["Insufficient municipal budget"]);
    }
  });

  it("cites the Collective Decision and Action index in references without inventing new ones", async () => {
    const content = await generateImplementationCommitmentDraftContent(buildSnapshot());
    assert.deepEqual(content.candidates[0]!.references, [
      "session-1",
      "Collective Decision decision-1",
      "Action 1",
    ]);
  });

  it("sets every Candidate to draft status with no proposed Participant", async () => {
    const content = await generateImplementationCommitmentDraftContent(buildSnapshot());
    for (const candidate of content.candidates) {
      assert.equal(candidate.status, "draft");
      assert.equal(candidate.proposedParticipantId, null);
    }
  });

  it("produces byte-identical output for the same snapshot on every call (deterministic)", async () => {
    const snapshot = buildSnapshot();
    const first = await generateImplementationCommitmentDraftContent(snapshot);
    const second = await generateImplementationCommitmentDraftContent(snapshot);
    assert.deepEqual(first, second);
  });

  it("never invents any content when no Collective Decision is available", async () => {
    const content = await generateImplementationCommitmentDraftContent(
      buildSnapshot({
        decisionReference: null,
        isCollectiveDecisionAvailable: false,
        isEmpty: true,
      }),
    );
    assert.equal(content.summary, "");
    assert.equal(content.decisionId, null);
    assert.deepEqual(content.candidates, []);
  });

  it("falls back to a default role/priority when the Collective Decision lists none", async () => {
    const content = await generateImplementationCommitmentDraftContent(
      buildSnapshot({
        decisionReference: {
          ...buildSnapshot().decisionReference!,
          responsibleRoles: [],
          implementationPriorities: [],
        },
      }),
    );
    assert.equal(content.candidates[0]!.suggestedResponsibleRole, "Implementation contributor");
    assert.equal(content.candidates[0]!.priority, "Normal");
  });
});
