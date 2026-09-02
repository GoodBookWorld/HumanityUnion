/**
 * Pack 02G Task 08E.8d — Decision Session derive emits structured Web advisories.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type {
  InitiativeDecisionSessionDraft,
  InitiativeDecisionSessionIntelligenceSnapshot,
} from "@hu/types";

import { deriveDecisionSessionAiAssistantInsights } from "./derive-decision-session-ai-assistant-insights";

function snapshot(
  overrides: Partial<InitiativeDecisionSessionIntelligenceSnapshot> = {},
): InitiativeDecisionSessionIntelligenceSnapshot {
  return {
    initiativeId: "initiative-1",
    generatedAt: "2026-01-01T00:00:00.000Z",
    initiativeTitle: "Initiative",
    initiativeDescription: "Description",
    petitionReference: null,
    revisionReference: null,
    analysisReference: null,
    proposalReferences: [],
    openComments: [],
    allyRecommendations: [],
    activeAllyCount: 0,
    consistencyChecks: [],
    isPetitionAvailable: false,
    isEmpty: true,
    ...overrides,
  };
}

function draft(overrides: Partial<InitiativeDecisionSessionDraft> = {}): InitiativeDecisionSessionDraft {
  return {
    draftId: "draft-1",
    initiativeId: "initiative-1",
    authorId: "member-1",
    title: "Decision",
    decisionQuestion: "Should the city fund public water filters at transit hubs?",
    decisionContext: "Context",
    objectives: ["Safety"],
    options: ["Yes — fund filters", "No — defer"],
    supportingArguments: ["Public health"],
    risks: ["Cost"],
    dependencies: [],
    requiredResources: [],
    suggestedTimeline: "2026 Q3",
    suggestedParticipants: [],
    suggestedResponsibleRoles: ["City facilities"],
    unresolvedQuestions: [],
    purpose: "Purpose",
    opensAt: "2026-01-01T00:00:00.000Z",
    closesAt: "2026-02-01T00:00:00.000Z",
    petitionId: null,
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

describe("Pack 02G Task 08E.8d — deriveDecisionSessionAiAssistantInsights", () => {
  it("empty sources and petition-required warning", () => {
    const insights = deriveDecisionSessionAiAssistantInsights(snapshot(), null);
    assert.equal(insights.sourcesSummary.code, "decision_session.sources.empty");
    assert.deepEqual(
      insights.missingOptionsWarnings.map((item) => item.code),
      ["decision_session.options.petition_required"],
    );
    assert.equal(insights.clarityWarnings.length, 0);
    assert.equal(insights.consistencyWarnings.length, 0);
  });

  it("sources summary params preserve source selection", () => {
    const insights = deriveDecisionSessionAiAssistantInsights(
      snapshot({
        isEmpty: false,
        isPetitionAvailable: true,
        petitionReference: {
          petitionId: "pet-1",
          title: "Petition title",
          version: 1,
          publishedAt: "2026-01-01T00:00:00.000Z",
          signatureCount: 10,
        } as never,
        revisionReference: { revisionId: "rev-1", version: 2 } as never,
        analysisReference: { analysisId: "a1", title: "Analysis" } as never,
        proposalReferences: [{ proposalId: "p1" } as never],
        allyRecommendations: [{ recommendationId: "r1" } as never],
      }),
      draft(),
    );
    assert.equal(insights.sourcesSummary.code, "decision_session.sources.summary");
    assert.deepEqual(insights.sourcesSummary.params, {
      hasPetition: 1,
      hasRevision: 1,
      revisionVersion: 2,
      hasAnalysis: 1,
      proposalCount: 1,
      allyRecommendationCount: 1,
    });
  });

  it("draft warnings preserve predicates, field IDs, and ordering", () => {
    const insights = deriveDecisionSessionAiAssistantInsights(
      snapshot({ petitionReference: { petitionId: "pet-1" } as never }),
      draft({
        options: ["only-one"],
        supportingArguments: [],
        risks: [],
        suggestedTimeline: "  ",
        suggestedResponsibleRoles: [],
        decisionQuestion: "Too short",
      }),
    );

    assert.deepEqual(
      insights.missingOptionsWarnings.map((item) => item.code),
      ["decision_session.options.need_two"],
    );

    const duplicated = deriveDecisionSessionAiAssistantInsights(
      snapshot({ petitionReference: { petitionId: "pet-1" } as never }),
      draft({ options: ["same", " same "] }),
    );
    assert.deepEqual(
      duplicated.duplicatedOptionsWarnings.map((item) => item.code),
      ["decision_session.options.duplicated"],
    );
    assert.equal(insights.unsupportedArgumentWarnings[0]?.code, "decision_session.arguments.none");
    assert.equal(insights.riskVisibilityWarnings[0]?.code, "decision_session.risks.none");
    assert.deepEqual(
      insights.feasibilityWarnings.map((item) => item.code),
      [
        "decision_session.feasibility.timeline_empty",
        "decision_session.feasibility.roles_none",
      ],
    );
    assert.equal(insights.clarityWarnings[0]?.code, "decision_session.clarity.question_unclear");
    assert.deepEqual(insights.feasibilityWarnings[0]?.civic?.decisionSessionFieldIds, ["timeline"]);
  });

  it("passes through API consistency warning detail without rewriting", () => {
    const detail = "No published Collaborative Analysis is available.";
    const insights = deriveDecisionSessionAiAssistantInsights(
      snapshot({
        consistencyChecks: [
          {
            checkId: "analysis-available",
            label: "Analysis",
            status: "warning",
            detail,
          },
        ],
      }),
      null,
    );
    assert.equal(insights.clarityWarnings.length, 0);
    assert.equal(insights.consistencyWarnings.length, 1);
    assert.equal(insights.consistencyWarnings[0]?.detail, detail);
  });

  it("does not emit English advisory sentences as derive contract", () => {
    const insights = deriveDecisionSessionAiAssistantInsights(snapshot(), draft({ options: [] }));
    const serialized = JSON.stringify(insights);
    assert.doesNotMatch(serialized, /Publish a Petition before generating/);
    assert.doesNotMatch(serialized, /Proposal\(s\)/);
    assert.doesNotMatch(serialized, /No Decision Sources available yet/);
  });
});
