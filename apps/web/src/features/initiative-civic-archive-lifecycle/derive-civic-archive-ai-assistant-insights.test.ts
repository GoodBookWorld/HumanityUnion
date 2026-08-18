import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { InitiativeCivicArchiveIntelligenceSnapshot } from "@hu/types";

import { deriveCivicArchiveAiAssistantInsights } from "./derive-civic-archive-ai-assistant-insights";

function emptySnapshot(
  overrides: Partial<InitiativeCivicArchiveIntelligenceSnapshot> = {},
): InitiativeCivicArchiveIntelligenceSnapshot {
  return {
    initiativeId: "initiative-1",
    generatedAt: new Date().toISOString(),
    initiativeTitle: "Fixture",
    initiativeDescription: "Fixture",
    publicImpactReportReference: null,
    analysisReference: null,
    proposalReferences: [],
    revisionReference: null,
    petitionReference: null,
    decisionSessionReference: null,
    decisionReference: {
      recordId: "decision-1",
      label: "Collective Decision",
      summary: "Closed",
      publishedAt: new Date().toISOString(),
    },
    commitmentPackageReference: null,
    trackingPackageReference: null,
    officialResponsePackageReference: null,
    consistencyChecks: [],
    completeness: {
      summary: "ok",
      stagesFound: ["initiative", "discussion", "collective_decision"],
      stagesPublished: ["initiative", "discussion", "collective_decision"],
      missingOptionalStages: [],
      unresolvedTrackingCount: 0,
      unfinishedCommitmentCount: 0,
      missingEvidenceCount: 0,
      officialResponseCount: 0,
      publicImpactAvailable: false,
      traceabilityComplete: false,
    },
    participationStatistics: {
      signatureCount: 0,
      supportCount: 0,
      reactionCount: 0,
      activeAllyCount: 0,
    },
    timeline: [],
    isPublicImpactReportAvailable: false,
    isEmpty: true,
    ...overrides,
  } as InitiativeCivicArchiveIntelligenceSnapshot;
}

describe("Step 03 — Civic Archive Public Impact is SOURCE_OPTIONAL", () => {
  it("STANDARD does not hard-warn Authors to publish Public Impact first", () => {
    const insights = deriveCivicArchiveAiAssistantInsights(emptySnapshot(), null, "STANDARD");
    assert.equal(
      insights.completenessWarnings.some((warning) =>
        warning.includes("Public Impact Report before generating the Civic Archive"),
      ),
      false,
    );
  });

  it("PUBLIC_CHOICE does not show Public Impact prerequisite copy", () => {
    const insights = deriveCivicArchiveAiAssistantInsights(emptySnapshot(), null, "PUBLIC_CHOICE");
    assert.equal(
      insights.completenessWarnings.some((warning) => warning.includes("Public Impact")),
      false,
      `unexpected Public Impact copy: ${insights.completenessWarnings.join(" | ")}`,
    );
  });

  it("PUBLIC_CHOICE Archive is available after Collective Decision without Public Impact", () => {
    const insights = deriveCivicArchiveAiAssistantInsights(
      emptySnapshot({
        isPublicImpactReportAvailable: false,
        isEmpty: true,
      }),
      null,
      "PUBLIC_CHOICE",
    );
    assert.equal(insights.completenessWarnings.length, 0);
    assert.ok(
      insights.clarityWarnings.some((warning) =>
        warning.includes("cannot publish Civic Archive or close the Initiative Lifecycle"),
      ),
    );
  });

  it("backend-aligned PUBLIC_CHOICE snapshot with isEmpty false stays free of PI blockers", () => {
    const insights = deriveCivicArchiveAiAssistantInsights(
      emptySnapshot({
        isPublicImpactReportAvailable: false,
        isEmpty: false,
        completeness: {
          summary: "Public Impact is not required on Public Choice — Collective Decision completion is sufficient.",
          stagesFound: ["initiative", "discussion", "collective_decision"],
          stagesPublished: ["initiative", "discussion", "collective_decision"],
          missingOptionalStages: [],
          unresolvedTrackingCount: 0,
          unfinishedCommitmentCount: 0,
          missingEvidenceCount: 0,
          officialResponseCount: 0,
          publicImpactAvailable: false,
          traceabilityComplete: true,
        },
      }),
      null,
      "PUBLIC_CHOICE",
    );
    assert.equal(insights.completenessWarnings.length, 0);
    assert.equal(
      insights.clarityWarnings.some((warning) => warning.includes("Public Impact")),
      false,
    );
  });
});
