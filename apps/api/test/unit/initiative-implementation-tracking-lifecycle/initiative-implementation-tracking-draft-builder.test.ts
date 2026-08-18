import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { InitiativeImplementationTrackingIntelligenceSnapshot } from "@hu/types";

import { generateImplementationTrackingDraftContent } from "../../../src/modules/initiative-implementation-tracking-lifecycle/initiative-implementation-tracking-draft-builder.js";

function buildSnapshot(
  overrides: Partial<InitiativeImplementationTrackingIntelligenceSnapshot> = {},
): InitiativeImplementationTrackingIntelligenceSnapshot {
  return {
    initiativeId: "initiative-part-j",
    generatedAt: "2026-08-08T00:00:00.000Z",
    initiativeTitle: "Community Compost Network",
    initiativeDescription: "Build neighborhood compost hubs.",
    packageReference: {
      packageId: "commitment-package-1",
      decisionId: "decision-1",
      title: "Implementation Commitments: Community Compost Network",
      summary: "The city will fund neighborhood compost hubs.",
      publishedAt: "2026-08-06T00:00:00.000Z",
      commitmentIds: ["commitment-1", "commitment-2"],
      acceptedCommitmentCount: 2,
    },
    acceptedCommitments: [
      {
        commitmentId: "commitment-1",
        packageId: "commitment-package-1",
        decisionId: "decision-1",
        participantId: "ally-1",
        approvedAction: "Pilot in two districts first",
        commitmentTitle: "Pilot Commitment",
        commitmentSummary: "Ally will pilot the compost hub.",
        proposalStatus: "accepted",
        priority: "High",
        suggestedResponsibleRole: "District Coordinators",
        expectedCompletionDate: "2026-12-01",
        requiredResources: ["Compost bins"],
        relatedRisks: ["Insufficient municipal budget"],
        references: ["session-1"],
        publishedAt: "2026-08-06T00:00:00.000Z",
      },
      {
        commitmentId: "commitment-2",
        packageId: "commitment-package-1",
        decisionId: "decision-1",
        participantId: "ally-2",
        approvedAction: "Publish a community update",
        commitmentTitle: "Update Commitment",
        commitmentSummary: "Ally will publish a community update.",
        proposalStatus: "accepted",
        priority: "Normal",
        suggestedResponsibleRole: "Sustainability Office",
        expectedCompletionDate: null,
        requiredResources: [],
        relatedRisks: [],
        references: [],
        publishedAt: "2026-08-06T00:00:00.000Z",
      },
    ],
    decisionApprovedActions: ["Pilot in two districts first", "Publish a community update"],
    activeAllyCount: 2,
    consistencyChecks: [],
    isCommitmentPackageAvailable: true,
    isEmpty: false,
    ...overrides,
  };
}

describe("generateImplementationTrackingDraftContent (Tracking Candidate Builder)", () => {
  it("titles the draft from the Initiative title", async () => {
    const content = await generateImplementationTrackingDraftContent(buildSnapshot());
    assert.equal(content.title, "Implementation Tracking: Community Compost Network");
  });

  it("builds the summary from the Commitment Package summary", async () => {
    const content = await generateImplementationTrackingDraftContent(buildSnapshot());
    assert.equal(content.summary, "The city will fund neighborhood compost hubs.");
  });

  it("carries the Commitment Package id onto the draft", async () => {
    const content = await generateImplementationTrackingDraftContent(buildSnapshot());
    assert.equal(content.packageId, "commitment-package-1");
  });

  it("generates exactly one Candidate per Accepted Commitment", async () => {
    const content = await generateImplementationTrackingDraftContent(buildSnapshot());
    assert.equal(content.candidates.length, 2);
    assert.equal(content.candidates[0]!.commitmentId, "commitment-1");
    assert.equal(content.candidates[1]!.commitmentId, "commitment-2");
  });

  it("accepted commitments populate assignees and context", async () => {
    const content = await generateImplementationTrackingDraftContent(buildSnapshot());
    assert.equal(content.candidates[0]!.responsibleParticipantId, "ally-1");
    assert.equal(content.candidates[0]!.title, "Pilot in two districts first");
    assert.deepEqual(content.candidates[0]!.obstacles, ["Insufficient municipal budget"]);
    assert.equal(content.candidates[0]!.targetDate, "2026-12-01");
  });

  it("never invents a Commitment beyond the snapshot's own acceptedCommitments list", async () => {
    const content = await generateImplementationTrackingDraftContent(buildSnapshot());
    const acceptedCommitmentIds = new Set(
      buildSnapshot().acceptedCommitments.map((commitment) => commitment.commitmentId),
    );
    for (const candidate of content.candidates) {
      assert.ok(acceptedCommitmentIds.has(candidate.commitmentId));
    }
  });

  it("assigns deterministic candidateIds from index", async () => {
    const content = await generateImplementationTrackingDraftContent(buildSnapshot());
    assert.equal(content.candidates[0]!.candidateId, "tracking-candidate-0");
    assert.equal(content.candidates[1]!.candidateId, "tracking-candidate-1");
  });

  it("initializes every Candidate to Preparation with 0% progress", async () => {
    const content = await generateImplementationTrackingDraftContent(buildSnapshot());
    for (const candidate of content.candidates) {
      assert.equal(candidate.currentStatus, "Preparation");
      assert.equal(candidate.progress, 0);
      assert.equal(candidate.plannedStartDate, null);
      assert.equal(candidate.startedDate, null);
      assert.equal(candidate.completedDate, null);
      assert.deepEqual(candidate.dependencies, []);
      assert.deepEqual(candidate.evidenceReferences, []);
    }
  });

  it("produces byte-identical output for the same snapshot on every call (deterministic)", async () => {
    const snapshot = buildSnapshot();
    const first = await generateImplementationTrackingDraftContent(snapshot);
    const second = await generateImplementationTrackingDraftContent(snapshot);
    assert.deepEqual(first, second);
  });

  it("zero commitments → plan generated from Decision approved actions (Unassigned)", async () => {
    const content = await generateImplementationTrackingDraftContent(
      buildSnapshot({
        acceptedCommitments: [],
        isCommitmentPackageAvailable: false,
        decisionApprovedActions: ["Fund compost bins", "Train volunteers"],
      }),
    );
    assert.equal(content.candidates.length, 2);
    assert.equal(content.candidates[0]!.commitmentId, "");
    assert.equal(content.candidates[0]!.responsibleParticipantId, "");
    assert.equal(content.candidates[0]!.title, "Fund compost bins");
    assert.equal(content.candidates[1]!.title, "Train volunteers");
  });

  it("zero commitments and no Decision actions → seeds Initiative-scope Unassigned milestone", async () => {
    const content = await generateImplementationTrackingDraftContent(
      buildSnapshot({
        packageReference: null,
        acceptedCommitments: [],
        decisionApprovedActions: [],
        isCommitmentPackageAvailable: false,
        isEmpty: false,
      }),
    );
    assert.equal(content.candidates.length, 1);
    assert.equal(content.candidates[0]!.commitmentId, "");
    assert.equal(content.candidates[0]!.responsibleParticipantId, "");
    assert.match(content.candidates[0]!.title, /Community Compost Network/);
    assert.ok(content.candidates[0]!.description.includes("Build neighborhood compost hubs"));
  });
});
