/**
 * Pack 02G Task 08E.8e — Implementation Commitment derive emits structured Web advisories.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type {
  InitiativeImplementationCommitmentCandidate,
  InitiativeImplementationCommitmentIntelligenceSnapshot,
  InitiativeImplementationCommitmentLifecycleDraft,
} from "@hu/types";

import { deriveImplementationCommitmentAiAssistantInsights } from "./derive-implementation-commitment-ai-assistant-insights";

function snapshot(
  overrides: Partial<InitiativeImplementationCommitmentIntelligenceSnapshot> = {},
): InitiativeImplementationCommitmentIntelligenceSnapshot {
  return {
    initiativeId: "initiative-1",
    generatedAt: "2026-01-01T00:00:00.000Z",
    initiativeTitle: "Initiative",
    initiativeDescription: "Description",
    decisionReference: null,
    activeAllyCount: 0,
    consistencyChecks: [],
    isCollectiveDecisionAvailable: false,
    isEmpty: true,
    ...overrides,
  };
}

function candidate(
  overrides: Partial<InitiativeImplementationCommitmentCandidate> = {},
): InitiativeImplementationCommitmentCandidate {
  return {
    candidateId: "cand-1",
    approvedAction: "Action A",
    description: "Do the thing",
    suggestedResponsibleRole: "Coordinator",
    suggestedTimeline: "2026 Q2",
    priority: "high",
    requiredResources: ["budget"],
    relatedRisks: ["delay"],
    references: [],
    proposedParticipantId: "member-2",
    status: "draft",
    ...overrides,
  };
}

function draft(
  overrides: Partial<InitiativeImplementationCommitmentLifecycleDraft> = {},
): InitiativeImplementationCommitmentLifecycleDraft {
  return {
    draftId: "draft-1",
    initiativeId: "initiative-1",
    authorId: "member-1",
    title: "Commitments",
    summary: "Summary of intent",
    decisionId: "decision-1",
    candidates: [candidate()],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("Pack 02G Task 08E.8e — deriveImplementationCommitmentAiAssistantInsights", () => {
  it("sources summary params preserve decision + ally count; civic title stays raw", () => {
    const insights = deriveImplementationCommitmentAiAssistantInsights(
      snapshot({
        isEmpty: false,
        isCollectiveDecisionAvailable: true,
        activeAllyCount: 3,
        decisionReference: {
          decisionId: "decision-1",
          title: "Civic Decision Title",
        } as never,
      }),
      null,
    );
    assert.equal(insights.sourcesSummary.code, "implementation_commitment.sources.summary");
    assert.deepEqual(insights.sourcesSummary.params, {
      hasDecision: 1,
      activeAllyCount: 3,
    });
    assert.equal(insights.sourcesSummary.civic?.title, "Civic Decision Title");
    assert.deepEqual(insights.unassignedActionsWarnings.map((item) => item.code), []);
  });

  it("decision-required warning when no decision reference", () => {
    const insights = deriveImplementationCommitmentAiAssistantInsights(snapshot(), null);
    assert.deepEqual(
      insights.unassignedActionsWarnings.map((item) => item.code),
      ["implementation_commitment.unassigned.decision_required"],
    );
  });

  it("assignment/resource/timeline/risk predicates, counts, field IDs, and ordering", () => {
    const insights = deriveImplementationCommitmentAiAssistantInsights(
      snapshot({
        decisionReference: { decisionId: "decision-1", title: "D" } as never,
      }),
      draft({
        title: "  ",
        summary: "",
        candidates: [
          candidate({
            candidateId: "c1",
            proposedParticipantId: null,
            suggestedResponsibleRole: "Lead",
            requiredResources: [],
            suggestedTimeline: "  ",
            relatedRisks: [],
          }),
          candidate({
            candidateId: "c2",
            proposedParticipantId: null,
            suggestedResponsibleRole: "Lead",
            requiredResources: [],
            suggestedTimeline: "",
            relatedRisks: [],
          }),
          candidate({
            candidateId: "c3",
            proposedParticipantId: "p3",
            suggestedResponsibleRole: "Lead",
            requiredResources: ["staff"],
            suggestedTimeline: "soon",
            relatedRisks: ["risk"],
          }),
        ],
      }),
    );

    assert.deepEqual(
      insights.unassignedActionsWarnings.map((item) => item.code),
      ["implementation_commitment.unassigned.missing_participants"],
    );
    assert.equal(insights.unassignedActionsWarnings[0]?.params?.count, 2);

    assert.deepEqual(
      insights.overloadedRoleWarnings.map((item) => item.code),
      ["implementation_commitment.roles.overloaded"],
    );
    assert.equal(insights.overloadedRoleWarnings[0]?.params?.count, 3);
    assert.equal(insights.overloadedRoleWarnings[0]?.civic?.role, "Lead");

    assert.equal(insights.missingResourcesWarnings[0]?.code, "implementation_commitment.resources.missing");
    assert.equal(insights.missingResourcesWarnings[0]?.params?.count, 2);
    assert.equal(insights.emptyTimelineWarnings[0]?.code, "implementation_commitment.timeline.missing");
    assert.equal(insights.emptyTimelineWarnings[0]?.params?.count, 2);
    assert.equal(insights.unresolvedRisksWarnings[0]?.code, "implementation_commitment.risks.missing");
    assert.equal(insights.unresolvedRisksWarnings[0]?.params?.count, 2);

    assert.deepEqual(
      insights.clarityWarnings.map((item) => item.code),
      [
        "implementation_commitment.clarity.title_empty",
        "implementation_commitment.clarity.summary_empty",
      ],
    );
    assert.deepEqual(insights.clarityWarnings[0]?.civic?.implementationCommitmentFieldIds, ["title"]);
    assert.deepEqual(insights.clarityWarnings[1]?.civic?.implementationCommitmentFieldIds, [
      "summary",
    ]);
  });

  it("no_candidates warning when draft has empty candidates", () => {
    const insights = deriveImplementationCommitmentAiAssistantInsights(
      snapshot({ decisionReference: { decisionId: "d1", title: "T" } as never }),
      draft({ candidates: [] }),
    );
    assert.deepEqual(
      insights.unassignedActionsWarnings.map((item) => item.code),
      ["implementation_commitment.unassigned.no_candidates"],
    );
  });

  it("passes through API consistency warning detail without rewriting", () => {
    const insights = deriveImplementationCommitmentAiAssistantInsights(
      snapshot({
        consistencyChecks: [
          {
            checkId: "collective-decision-available",
            label: "API label",
            status: "warning",
            detail: "Opaque API English detail remains raw.",
            params: {},
          },
          {
            checkId: "approved-actions-available",
            label: "ok",
            status: "ok",
            detail: "ignored",
            params: {},
          },
        ],
      }),
      draft(),
    );
    assert.equal(insights.consistencyWarnings.length, 1);
    assert.equal(insights.consistencyWarnings[0]?.detail, "Opaque API English detail remains raw.");
    assert.equal(insights.clarityWarnings.length, 0);
  });
});
