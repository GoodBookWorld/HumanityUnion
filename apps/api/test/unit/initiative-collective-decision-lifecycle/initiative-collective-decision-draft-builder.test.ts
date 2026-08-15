import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { InitiativeCollectiveDecisionIntelligenceSnapshot } from "@hu/types";

import { generateCollectiveDecisionDraftContent } from "../../../src/modules/initiative-collective-decision-lifecycle/initiative-collective-decision-draft-builder.js";

function buildSnapshot(
  overrides: Partial<InitiativeCollectiveDecisionIntelligenceSnapshot> = {},
): InitiativeCollectiveDecisionIntelligenceSnapshot {
  return {
    initiativeId: "initiative-part-h",
    generatedAt: "2026-08-08T00:00:00.000Z",
    initiativeTitle: "Community Compost Network",
    initiativeDescription: "Build neighborhood compost hubs.",
    decisionSessionReference: {
      sessionId: "session-1",
      title: "Decision Session: Community Compost Network",
      decisionQuestion: "Should the city fund neighborhood compost hubs?",
      purpose: "Decide how to proceed with the compost pilot.",
      publishedAt: "2026-08-05T00:00:00.000Z",
      status: "closed",
      version: 1,
      objectives: ["Expand compost access", "Reduce landfill waste"],
      options: ["Pilot in two districts first", "Fund citywide rollout"],
      supportingArguments: ["Petition signatures: Participants: 3, Members: 1, Visitors: 2"],
      risks: ["Insufficient municipal budget"],
      requiredResources: ["Compost bins", "Site coordinators"],
      suggestedTimeline: "Q4 2026 rollout",
      suggestedResponsibleRoles: ["Sustainability Office", "District Coordinators"],
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
    petitionReference: {
      petitionId: "petition-1",
      title: "Petition: Community Compost Network",
      summary: "Call for municipal compost support.",
      publishedAt: "2026-08-01T00:00:00.000Z",
      participantSignatures: 3,
      memberSignatures: 1,
      visitorSignals: 2,
      revisionId: "revision-1",
      revisionVersion: 2,
    },
    revisionReference: {
      revisionId: "revision-1",
      version: 2,
      revisionSummary: "Expanded compost pilot sites.",
      publishedAt: "2026-07-20T00:00:00.000Z",
      title: "Community Compost Network",
      description: "Build neighborhood compost hubs.",
    },
    analysisReference: {
      analysisId: "analysis-1",
      title: "Compost Analysis",
      summary: "Neighbors support a phased rollout.",
      initiativeVersion: 1,
    },
    proposalReferences: [
      {
        proposalId: "proposal-1",
        title: "Add weekend drop-off",
        summary: "Weekend drop-off windows for residents.",
        status: "accepted",
      },
    ],
    consistencyChecks: [],
    isDecisionSessionAvailable: true,
    isEmpty: false,
    ...overrides,
  };
}

describe("generateCollectiveDecisionDraftContent (Decision Result Builder)", () => {
  it("titles the Collective Decision from the Initiative title", async () => {
    const content = await generateCollectiveDecisionDraftContent(buildSnapshot());
    assert.equal(content.title, "Collective Decision: Community Compost Network");
  });

  it("builds decisionSummary from the Decision Session question and purpose", async () => {
    const content = await generateCollectiveDecisionDraftContent(buildSnapshot());
    assert.match(content.decisionSummary, /Should the city fund neighborhood compost hubs\?/);
    assert.match(content.decisionSummary, /Decide how to proceed with the compost pilot\./);
  });

  it("takes the first Decision Session option as an Approved Action, and the rest as Rejected Alternatives", async () => {
    const content = await generateCollectiveDecisionDraftContent(buildSnapshot());
    assert.ok(content.approvedActions.includes("Pilot in two districts first"));
    assert.ok(content.rejectedAlternatives.includes("Fund citywide rollout"));
    assert.equal(content.rejectedAlternatives.includes("Pilot in two districts first"), false);
  });

  it("falls back to a framed proceed action when the Decision Session has no options", async () => {
    const content = await generateCollectiveDecisionDraftContent(
      buildSnapshot({
        decisionSessionReference: {
          ...buildSnapshot().decisionSessionReference!,
          options: [],
        },
      }),
    );
    assert.ok(
      content.approvedActions.includes("Proceed with the Decision Session question as framed."),
    );
  });

  it("derives Success Criteria from Decision Session objectives, prefixed with 'Success when:'", async () => {
    const content = await generateCollectiveDecisionDraftContent(buildSnapshot());
    assert.ok(content.successCriteria.includes("Success when: Expand compost access"));
    assert.ok(content.successCriteria.includes("Success when: Reduce landfill waste"));
  });

  it("cites upstream Lifecycle IDs in Supporting References without inventing new ones", async () => {
    const content = await generateCollectiveDecisionDraftContent(buildSnapshot());
    assert.deepEqual(
      [...content.supportingReferences].sort(),
      ["analysis-1", "petition-1", "proposal-1", "revision-1", "session-1"].sort(),
    );
  });

  it("produces byte-identical output for the same snapshot on every call (deterministic)", async () => {
    const snapshot = buildSnapshot();
    const first = await generateCollectiveDecisionDraftContent(snapshot);
    const second = await generateCollectiveDecisionDraftContent(snapshot);
    assert.deepEqual(first, second);
  });

  it("never invents any content when no Decision Session is available", async () => {
    const content = await generateCollectiveDecisionDraftContent(
      buildSnapshot({
        decisionSessionReference: null,
        isDecisionSessionAvailable: false,
        isEmpty: true,
      }),
    );
    assert.equal(content.decisionSummary, "");
    assert.deepEqual(content.rejectedAlternatives, []);
    assert.deepEqual(content.responsibleRoles, []);
    assert.deepEqual(content.decisionRisks, []);
  });
});
