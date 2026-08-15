import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { InitiativeDecisionSessionIntelligenceSnapshot } from "@hu/types";

import { generateDecisionSessionDraftContent } from "../../../src/modules/initiative-decision-session-lifecycle/initiative-decision-session-draft-builder.js";

function buildSnapshot(
  overrides: Partial<InitiativeDecisionSessionIntelligenceSnapshot> = {},
): InitiativeDecisionSessionIntelligenceSnapshot {
  return {
    initiativeId: "initiative-part-g",
    generatedAt: "2026-08-08T00:00:00.000Z",
    initiativeTitle: "Community Compost Network",
    initiativeDescription: "Build neighborhood compost hubs.",
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
      proposalIds: ["proposal-1"],
      analysisId: "analysis-1",
      analysisVersion: 1,
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
    openComments: [],
    allyRecommendations: [
      {
        recommendationId: "rec-1",
        initiativeId: "initiative-part-g",
        authorParticipantId: "ally-1",
        kind: "option",
        title: "Pilot in two districts first",
        body: "Limit the first Collective Decision to two districts.",
        createdAt: "2026-08-02T00:00:00.000Z",
        updatedAt: "2026-08-02T00:00:00.000Z",
      },
    ],
    activeAllyCount: 2,
    consistencyChecks: [],
    isPetitionAvailable: true,
    isEmpty: false,
    ...overrides,
  };
}

describe("generateDecisionSessionDraftContent (Decision Intelligence Builder)", () => {
  it("titles the Decision Session from the Initiative title", async () => {
    const content = await generateDecisionSessionDraftContent(buildSnapshot());
    assert.equal(content.title, "Decision Session: Community Compost Network");
  });

  it("builds the Decision Question from the Published Petition, never inventing a new civic ask", async () => {
    const content = await generateDecisionSessionDraftContent(buildSnapshot());
    assert.match(content.decisionQuestion, /Petition: Community Compost Network/);
  });

  it("includes Petition signature statistics in Supporting Arguments", async () => {
    const content = await generateDecisionSessionDraftContent(buildSnapshot());
    assert.ok(
      content.supportingArguments.some((entry) => entry.includes("Participants: 3")),
      "Supporting Arguments must cite real signature statistics",
    );
  });

  it("surfaces Ally option recommendations as Decision Options without treating them as Author decisions", async () => {
    const content = await generateDecisionSessionDraftContent(buildSnapshot());
    assert.ok(content.options.includes("Pilot in two districts first"));
  });

  it("produces byte-identical output for the same snapshot on every call (deterministic)", async () => {
    const snapshot = buildSnapshot();
    const first = await generateDecisionSessionDraftContent(snapshot);
    const second = await generateDecisionSessionDraftContent(snapshot);
    assert.deepEqual(first, second);
  });

  it("never invents Proposal-backed arguments when no proposals or petition exist", async () => {
    const content = await generateDecisionSessionDraftContent(
      buildSnapshot({
        petitionReference: null,
        proposalReferences: [],
        isPetitionAvailable: false,
        isEmpty: true,
      }),
    );
    assert.equal(
      content.supportingArguments.some((entry) => entry.includes("Improvement Proposal")),
      false,
    );
  });
});
