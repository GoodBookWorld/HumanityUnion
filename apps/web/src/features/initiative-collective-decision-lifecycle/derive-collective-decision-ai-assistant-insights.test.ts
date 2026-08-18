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
    isEmpty: false,
    ...overrides,
  };
}

describe("Step 03 — Collective Decision Decision Session is SOURCE_OPTIONAL", () => {
  it("STANDARD does not hard-warn Authors to publish Decision Session first", () => {
    const insights = deriveCollectiveDecisionAiAssistantInsights(emptySnapshot(), null, "STANDARD");
    assert.equal(
      insights.missingActionsWarnings.some((warning) =>
        warning.includes("Publish a Decision Session before generating Decision actions"),
      ),
      false,
    );
  });

  it("PUBLIC_CHOICE does not show Decision Session prerequisite copy", () => {
    const insights = deriveCollectiveDecisionAiAssistantInsights(emptySnapshot(), null, "PUBLIC_CHOICE");
    assert.equal(
      insights.missingActionsWarnings.some((warning) => warning.includes("Decision Session")),
      false,
      `unexpected Decision Session copy: ${insights.missingActionsWarnings.join(" | ")}`,
    );
  });

  it("draft copy does not cite Decision Session for rationale/summary when absent", () => {
    const insights = deriveCollectiveDecisionAiAssistantInsights(
      emptySnapshot(),
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
      "STANDARD",
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
