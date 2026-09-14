/**
 * Pack 02G Task 08E.8d — Collective Decision derive emits structured Web advisories.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type {
  InitiativeCollectiveDecisionIntelligenceSnapshot,
  InitiativeCollectiveDecisionLifecycleDraft,
} from "@hu/types";

import { deriveCollectiveDecisionAiAssistantInsights } from "./derive-collective-decision-ai-assistant-insights";

function snapshot(
  overrides: Partial<InitiativeCollectiveDecisionIntelligenceSnapshot> = {},
): InitiativeCollectiveDecisionIntelligenceSnapshot {
  return {
    initiativeId: "initiative-1",
    generatedAt: "2026-01-01T00:00:00.000Z",
    initiativeTitle: "Initiative",
    initiativeDescription: "Description",
    decisionSessionReference: null,
    petitionReference: null,
    revisionReference: null,
    analysisReference: null,
    proposalReferences: [],
    consistencyChecks: [],
    isDecisionSessionAvailable: false,
    isEmpty: true,
    ...overrides,
  };
}

function draft(
  overrides: Partial<InitiativeCollectiveDecisionLifecycleDraft> = {},
): InitiativeCollectiveDecisionLifecycleDraft {
  return {
    draftId: "draft-1",
    initiativeId: "initiative-1",
    authorId: "member-1",
    title: "Decision",
    decisionSummary: "Fund public water filters at transit hubs citywide.",
    approvedActions: ["Install filters"],
    rejectedAlternatives: [],
    responsibleRoles: ["City facilities"],
    implementationPriorities: [],
    implementationTimeline: "2026 Q4",
    decisionRationale: "Public health evidence from Analysis",
    decisionRisks: ["Budget"],
    successCriteria: ["Filters installed"],
    requiredResources: [],
    supportingReferences: [],
    participationScope: "community",
    closesAt: "2026-02-01T00:00:00.000Z",
    decisionSessionId: null,
    decisionSessionVersion: null,
    petitionId: null,
    petitionVersion: null,
    revisionId: null,
    revisionVersion: null,
    analysisId: null,
    analysisVersion: null,
    proposalIds: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("Pack 02G Task 08E.8d — deriveCollectiveDecisionAiAssistantInsights", () => {
  it("empty sources with no draft warnings", () => {
    const insights = deriveCollectiveDecisionAiAssistantInsights(snapshot(), null);
    assert.equal(insights.sourcesSummary.code, "collective_decision.sources.empty");
    assert.equal(insights.missingActionsWarnings.length, 0);
    assert.equal(insights.consistencyWarnings.length, 0);
  });

  it("sources summary params preserve source selection", () => {
    const insights = deriveCollectiveDecisionAiAssistantInsights(
      snapshot({
        isEmpty: false,
        decisionSessionReference: { sessionId: "ds-1", title: "Session" } as never,
        petitionReference: { petitionId: "pet-1" } as never,
        revisionReference: { revisionId: "rev-1", version: 4 } as never,
        analysisReference: { analysisId: "a1", title: "Analysis" } as never,
        proposalReferences: [{ proposalId: "p1" } as never, { proposalId: "p2" } as never],
      }),
      draft(),
    );
    assert.equal(insights.sourcesSummary.code, "collective_decision.sources.summary");
    assert.deepEqual(insights.sourcesSummary.params, {
      hasDecisionSession: 1,
      hasPetition: 1,
      hasRevision: 1,
      revisionVersion: 4,
      hasAnalysis: 1,
      proposalCount: 2,
    });
  });

  it("draft warnings preserve predicates, field IDs, and ordering", () => {
    const insights = deriveCollectiveDecisionAiAssistantInsights(
      snapshot(),
      draft({
        approvedActions: ["same", " same "],
        responsibleRoles: [],
        implementationTimeline: "",
        decisionRisks: [],
        successCriteria: [],
        decisionRationale: "  ",
        decisionSummary: "short",
      }),
    );

    assert.deepEqual(
      [
        ...insights.missingActionsWarnings,
        ...insights.duplicatedActionsWarnings,
        ...insights.missingRolesWarnings,
        ...insights.unrealisticTimelineWarnings,
        ...insights.unresolvedRisksWarnings,
        ...insights.missingSuccessCriteriaWarnings,
        ...insights.unsupportedConclusionsWarnings,
        ...insights.clarityWarnings,
      ].map((item) => item.code),
      [
        "collective_decision.actions.duplicated",
        "collective_decision.roles.none",
        "collective_decision.timeline.empty",
        "collective_decision.risks.none",
        "collective_decision.criteria.none",
        "collective_decision.rationale.empty",
        "collective_decision.clarity.summary_unclear",
      ],
    );
    assert.deepEqual(insights.unrealisticTimelineWarnings[0]?.civic?.collectiveDecisionFieldIds, [
      "timeline",
    ]);
  });

  it("passes through API consistency warning detail without rewriting", () => {
    const detail = "The Decision Session has no options recorded.";
    const insights = deriveCollectiveDecisionAiAssistantInsights(
      snapshot({
        consistencyChecks: [
          {
            checkId: "options-available",
            label: "Options",
            status: "warning",
            detail,
            params: {},
          },
        ],
      }),
      null,
    );
    assert.equal(insights.clarityWarnings.length, 0);
    assert.equal(insights.consistencyWarnings[0]?.detail, detail);
  });

  it("does not emit English advisory sentences as derive contract", () => {
    const insights = deriveCollectiveDecisionAiAssistantInsights(
      snapshot(),
      draft({ approvedActions: [] }),
    );
    const serialized = JSON.stringify(insights);
    assert.doesNotMatch(serialized, /Add at least one Approved Action/);
    assert.doesNotMatch(serialized, /Proposal\(s\)/);
    assert.doesNotMatch(serialized, /No Decision Sources available yet/);
  });
});
