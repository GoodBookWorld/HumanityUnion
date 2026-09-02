/**
 * Pack 02G Task 08E.8f — Public Impact derive emits structured Web advisories.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type {
  InitiativePublicImpactIntelligenceSnapshot,
  InitiativePublicImpactLifecycleDraft,
} from "@hu/types";

import { derivePublicImpactAiAssistantInsights } from "./derive-public-impact-ai-assistant-insights";

function snapshot(
  overrides: Partial<InitiativePublicImpactIntelligenceSnapshot> = {},
): InitiativePublicImpactIntelligenceSnapshot {
  return {
    initiativeId: "initiative-1",
    generatedAt: "2026-01-01T00:00:00.000Z",
    initiativeTitle: "Initiative",
    initiativeDescription: "Description",
    officialResponsePackageReference: null,
    trackingPackageReference: null,
    officialResponseSummaries: [],
    trackingRecords: [],
    evidenceItems: [],
    completedCommitmentCount: 0,
    participationStatistics: {
      signatureCount: 0,
      supportCount: 0,
      reactionCount: 0,
      activeAllyCount: 0,
    },
    consistencyChecks: [],
    isOfficialResponsePackageAvailable: false,
    isEmpty: true,
    ...overrides,
  } as InitiativePublicImpactIntelligenceSnapshot;
}

function draft(
  overrides: Partial<InitiativePublicImpactLifecycleDraft> = {},
): InitiativePublicImpactLifecycleDraft {
  return {
    draftId: "draft-1",
    initiativeId: "initiative-1",
    authorId: "member-1",
    title: "Impact",
    sections: [],
    participationStatistics: {
      signatureCount: 0,
      supportCount: 0,
      reactionCount: 0,
      activeAllyCount: 0,
    },
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  } as InitiativePublicImpactLifecycleDraft;
}

describe("Pack 02G Task 08E.8f — derivePublicImpactAiAssistantInsights", () => {
  it("sources summary preserves official/no-response/tracking flags and counts", () => {
    const insights = derivePublicImpactAiAssistantInsights(
      snapshot({
        evidenceItems: [{ evidenceId: "e1" } as never],
        participationStatistics: {
          signatureCount: 1,
          supportCount: 2,
          reactionCount: 3,
          activeAllyCount: 4,
        },
        officialResponsePackageReference: {
          title: "OR Title",
          outcomeKind: "no_official_response_received",
        } as never,
        trackingPackageReference: { title: "Tracking Title" } as never,
      }),
      null,
    );
    assert.equal(insights.sourcesSummary.code, "public_impact.sources.summary");
    assert.deepEqual(insights.sourcesSummary.params, {
      hasOfficial: 1,
      noResponseOutcome: 1,
      hasTracking: 1,
      evidenceCount: 1,
      activeAllyCount: 4,
    });
    assert.equal(insights.sourcesSummary.civic?.title, "OR Title");
    assert.equal(insights.sourcesSummary.civic?.trackingTitle, "Tracking Title");
  });

  it("statistics mismatch predicate unchanged", () => {
    const insights = derivePublicImpactAiAssistantInsights(
      snapshot({
        officialResponsePackageReference: { title: "OR", outcomeKind: "responses_received" } as never,
        participationStatistics: {
          signatureCount: 1,
          supportCount: 0,
          reactionCount: 0,
          activeAllyCount: 0,
        },
      }),
      draft({
        participationStatistics: {
          signatureCount: 9,
          supportCount: 0,
          reactionCount: 0,
          activeAllyCount: 0,
        },
      }),
    );
    assert.equal(insights.inconsistentStatsWarnings[0]?.code, "public_impact.stats.inconsistent");
  });

  it("section empty + unsupported + judgment preserve section civic title/id", () => {
    const insights = derivePublicImpactAiAssistantInsights(
      snapshot({
        officialResponsePackageReference: { title: "OR", outcomeKind: "responses_received" } as never,
        evidenceItems: [{ evidenceId: "e1" } as never],
      }),
      draft({
        sections: [
          {
            sectionId: "executive_summary",
            title: "",
            body: "",
            evidenceReferences: [],
          } as never,
          {
            sectionId: "objectives",
            title: "Civic Section Title",
            body: "Body without evidence about success",
            evidenceReferences: [],
          } as never,
        ],
      }),
    );
    assert.equal(insights.missingEvidenceWarnings[0]?.code, "public_impact.evidence.section_empty");
    assert.equal(
      insights.missingEvidenceWarnings[0]?.civic?.publicImpactSectionId,
      "executive_summary",
    );
    assert.equal(insights.unsupportedConclusionWarnings[0]?.civic?.title, "Civic Section Title");
    assert.equal(insights.clarityWarnings.some((w) => w.code === "public_impact.clarity.judgment_wording"), true);
  });

  it("advisory notes include no-response and advisory-only codes", () => {
    const insights = derivePublicImpactAiAssistantInsights(
      snapshot({
        officialResponsePackageReference: {
          title: "OR",
          outcomeKind: "no_official_response_received",
        } as never,
        completedCommitmentCount: 1,
        trackingRecords: [{ status: "completed" } as never],
      }),
      null,
    );
    assert.deepEqual(
      insights.advisoryNotes.map((item) => item.code),
      ["public_impact.note.no_response_outcome", "public_impact.note.advisory_only"],
    );
  });

  it("passes through API consistency detail without rewriting", () => {
    const insights = derivePublicImpactAiAssistantInsights(
      snapshot({
        consistencyChecks: [
          {
            checkId: "p1",
            label: "API",
            status: "warning",
            detail: "Opaque PI consistency detail.",
          },
        ],
      }),
      draft(),
    );
    assert.equal(insights.consistencyWarnings[0]?.detail, "Opaque PI consistency detail.");
  });
});
