import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { InitiativeCollectiveDecisionIntelligenceSnapshot } from "@hu/types";

import { deriveCollectiveDecisionAiAssistantInsights } from "./derive-collective-decision-ai-assistant-insights";

function emptySnapshot(
  overrides: Partial<InitiativeCollectiveDecisionIntelligenceSnapshot> = {},
): InitiativeCollectiveDecisionIntelligenceSnapshot {
  return {
    initiativeId: "initiative-1",
    generatedAt: new Date().toISOString(),
    initiativeTitle: "Fixture",
    initiativeDescription: "Fixture",
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

describe("Final Certification Fix 03 — Collective Decision Decision Session prerequisite copy", () => {
  it("STANDARD still warns when Decision Session is missing", () => {
    const insights = deriveCollectiveDecisionAiAssistantInsights(emptySnapshot(), null, "STANDARD");
    assert.ok(
      insights.missingActionsWarnings.some((warning) =>
        warning.includes("Publish a Decision Session before generating Decision actions"),
      ),
    );
  });

  it("PUBLIC_CHOICE does not show Decision Session prerequisite copy", () => {
    const insights = deriveCollectiveDecisionAiAssistantInsights(
      emptySnapshot({ isEmpty: false }),
      null,
      "PUBLIC_CHOICE",
    );
    assert.equal(
      insights.missingActionsWarnings.some((warning) => warning.includes("Decision Session")),
      false,
      `unexpected Decision Session copy: ${insights.missingActionsWarnings.join(" | ")}`,
    );
  });

  it("PUBLIC_CHOICE draft copy does not cite Decision Session for rationale/summary", () => {
    const insights = deriveCollectiveDecisionAiAssistantInsights(
      emptySnapshot({ isEmpty: false }),
      {
        draftId: "d1",
        initiativeId: "initiative-1",
        authorId: "a1",
        title: "PC Decision",
        decisionSummary: "Short",
        approvedActions: ["Advance"],
        rejectedAlternatives: [],
        responsibleRoles: [],
        implementationPriorities: [],
        implementationTimeline: "",
        decisionRationale: "",
        decisionRisks: [],
        successCriteria: [],
        requiredResources: [],
        supportingReferences: [],
        participationScope: "world",
        closesAt: new Date(Date.now() + 86_400_000).toISOString(),
        decisionSessionId: null,
        decisionSessionVersion: null,
        petitionId: null,
        petitionVersion: null,
        revisionId: null,
        revisionVersion: null,
        analysisId: null,
        analysisVersion: null,
        proposalIds: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      "PUBLIC_CHOICE",
    );

    assert.equal(
      insights.unsupportedConclusionsWarnings.some((warning) =>
        warning.includes("Decision Session"),
      ),
      false,
    );
    assert.equal(
      insights.clarityWarnings.some((warning) => warning.includes("Decision Session")),
      false,
    );
    assert.ok(
      insights.unsupportedConclusionsWarnings.some((warning) =>
        warning.includes("upstream sources"),
      ),
    );
  });
});
