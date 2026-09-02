/**
 * Pack 02G Task 08E.8f — Civic Archive derive emits structured Web advisories.
 * Also preserves SOURCE_OPTIONAL Public Impact behavior from prior Archive tests.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type {
  InitiativeCivicArchiveIntelligenceSnapshot,
  InitiativeCivicArchiveLifecycleDraft,
} from "@hu/types";

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

function draft(
  overrides: Partial<InitiativeCivicArchiveLifecycleDraft> = {},
): InitiativeCivicArchiveLifecycleDraft {
  return {
    draftId: "draft-1",
    initiativeId: "initiative-1",
    authorId: "member-1",
    finalArchiveTitle: "Archive",
    finalSummary: "Summary",
    lessonsLearned: "Lessons",
    knowledgeContribution: "Knowledge",
    sections: [{ sectionId: "overview" } as never],
    timeline: [],
    completeness: emptySnapshot().completeness,
    participationStatistics: emptySnapshot().participationStatistics,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  } as InitiativeCivicArchiveLifecycleDraft;
}

describe("Pack 02G Task 08E.8f — deriveCivicArchiveAiAssistantInsights", () => {
  it("STANDARD does not hard-warn Authors to publish Public Impact first", () => {
    const insights = deriveCivicArchiveAiAssistantInsights(emptySnapshot(), null, "STANDARD");
    assert.equal(
      insights.completenessWarnings.some((warning) =>
        warning.code.includes("public_impact"),
      ),
      false,
    );
  });

  it("PUBLIC_CHOICE does not show Public Impact prerequisite advisories", () => {
    const insights = deriveCivicArchiveAiAssistantInsights(emptySnapshot(), null, "PUBLIC_CHOICE");
    assert.equal(insights.completenessWarnings.length, 0);
    assert.equal(
      insights.clarityWarnings.some((warning) => warning.code.includes("public_impact")),
      false,
    );
  });

  it("always emits advisory-only clarity code; completeness.summary stays unused", () => {
    const insights = deriveCivicArchiveAiAssistantInsights(
      emptySnapshot({
        completeness: {
          ...emptySnapshot().completeness,
          summary: "Domain English completeness.summary must not become an advisory code.",
          missingOptionalStages: ["petition"],
          unresolvedTrackingCount: 2,
          unfinishedCommitmentCount: 1,
        },
      }),
      null,
    );
    assert.equal(insights.clarityWarnings[0]?.code, "civic_archive.clarity.advisory_only");
    assert.equal(
      insights.completenessWarnings[0]?.code,
      "civic_archive.completeness.missing_optional_stages",
    );
    assert.equal(insights.completenessWarnings[0]?.params?.stages, "petition");
    assert.equal(insights.outstandingWorkWarnings[0]?.params?.count, 2);
    assert.equal(insights.outstandingWorkWarnings[1]?.params?.count, 1);
    assert.equal(
      JSON.stringify(insights).includes("Domain English completeness.summary"),
      false,
    );
  });

  it("field empties emit canonical field IDs; neutrality regex preserved", () => {
    const insights = deriveCivicArchiveAiAssistantInsights(
      emptySnapshot(),
      draft({
        finalArchiveTitle: "  ",
        finalSummary: "",
        lessonsLearned: "A victory for the city",
        knowledgeContribution: "",
        sections: [],
      }),
    );
    assert.deepEqual(
      insights.missingFinalFieldWarnings.map((item) => item.code),
      [
        "civic_archive.fields.title_empty",
        "civic_archive.fields.summary_empty",
        "civic_archive.fields.knowledge_empty",
      ],
    );
    assert.deepEqual(insights.missingFinalFieldWarnings[0]?.civic?.civicArchiveFieldIds, [
      "finalArchiveTitle",
    ]);
    assert.equal(insights.neutralityWarnings[0]?.code, "civic_archive.neutrality.judgment_wording");
    assert.equal(insights.clarityWarnings.some((w) => w.code === "civic_archive.clarity.no_sections"), true);
  });

  it("passes through API consistency detail without rewriting", () => {
    const insights = deriveCivicArchiveAiAssistantInsights(
      emptySnapshot({
        consistencyChecks: [
          {
            checkId: "tracking-resolved",
            label: "API",
            status: "warning",
            detail: "Opaque Archive consistency detail.",
            params: {},
          },
        ],
      }),
      null,
    );
    assert.equal(insights.consistencyWarnings[0]?.detail, "Opaque Archive consistency detail.");
  });
});
