import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { InitiativeCivicArchiveIntelligenceSnapshot } from "@hu/types";
import { INITIATIVE_CIVIC_ARCHIVE_SECTION_IDS } from "@hu/types";

import { generateCivicArchiveDraftContent } from "../../../src/modules/initiative-civic-archive-lifecycle/initiative-civic-archive-builder.js";

function buildSnapshot(
  overrides: Partial<InitiativeCivicArchiveIntelligenceSnapshot> = {},
): InitiativeCivicArchiveIntelligenceSnapshot {
  return {
    initiativeId: "initiative-part-m",
    generatedAt: "2026-08-09T00:00:00.000Z",
    initiativeTitle: "Community Compost Network",
    initiativeDescription: "Build neighborhood compost hubs.",
    analysisReference: {
      recordId: "analysis-1",
      label: "Compost analysis",
      summary: "Neighbors need compost hubs.",
      publishedAt: "2026-08-01T00:00:00.000Z",
      version: 1,
    },
    proposalReferences: [
      {
        recordId: "proposal-1",
        label: "Add a composting station",
        summary: "Repeated Ally requests.",
        publishedAt: "2026-08-02T00:00:00.000Z",
        version: null,
      },
    ],
    revisionReference: {
      recordId: "revision-1",
      label: "Community Compost Network",
      summary: "Incorporated composting Proposal.",
      publishedAt: "2026-08-03T00:00:00.000Z",
      version: 1,
    },
    petitionReference: {
      recordId: "petition-1",
      label: "Fund the compost pilot",
      summary: "Ask the city to fund the pilot.",
      publishedAt: "2026-08-04T00:00:00.000Z",
      version: 1,
    },
    decisionSessionReference: {
      recordId: "session-1",
      label: "Compost funding session",
      summary: "Should the city fund the compost pilot?",
      publishedAt: "2026-08-05T00:00:00.000Z",
      version: 1,
    },
    decisionReference: {
      recordId: "decision-1",
      label: "Approve pilot funding",
      summary: "Pilot funding approved.",
      publishedAt: "2026-08-06T00:00:00.000Z",
      version: null,
    },
    commitmentPackageReference: {
      recordId: "commitment-package-1",
      label: "Commitments: Community Compost Network",
      summary: "Two accepted commitments.",
      publishedAt: "2026-08-07T00:00:00.000Z",
      version: null,
    },
    trackingPackageReference: {
      recordId: "tracking-package-1",
      label: "Implementation Tracking: Community Compost Network",
      summary: "Two compost hubs were piloted.",
      publishedAt: "2026-08-08T00:00:00.000Z",
      version: null,
    },
    officialResponsePackageReference: {
      recordId: "official-response-package-1",
      label: "Official Responses: Community Compost Network",
      summary: "City and regional responses recorded.",
      publishedAt: "2026-08-08T12:00:00.000Z",
      version: null,
    },
    publicImpactReportReference: {
      recordId: "public-impact-report-1",
      label: "Public Impact Report: Community Compost Network",
      summary: "Published outcomes summarised.",
      publishedAt: "2026-08-09T00:00:00.000Z",
      version: 1,
    },
    participationStatistics: {
      signatureCount: 3,
      supportCount: 5,
      reactionCount: 2,
      activeAllyCount: 2,
    },
    completeness: {
      stagesFound: [
        "initiative",
        "analysis",
        "proposal",
        "revision",
        "petition",
        "decision_session",
        "collective_decision",
        "commitment",
        "tracking",
        "official_response",
        "public_impact",
      ],
      stagesPublished: [
        "initiative",
        "analysis",
        "proposal",
        "revision",
        "petition",
        "decision_session",
        "collective_decision",
        "commitment",
        "tracking",
        "official_response",
        "public_impact",
      ],
      missingOptionalStages: [],
      unresolvedTrackingCount: 1,
      unfinishedCommitmentCount: 1,
      missingEvidenceCount: 1,
      officialResponseCount: 2,
      publicImpactAvailable: true,
      traceabilityComplete: true,
      summary: "11 Lifecycle stage(s) have published records. Outstanding work remains.",
    },
    timeline: [
      {
        stageId: "analysis",
        label: "Collaborative Analysis",
        status: "published",
        publishedAt: "2026-08-01T00:00:00.000Z",
        version: 1,
        sectionAnchor: "collaborative_analysis",
      },
      {
        stageId: "tracking",
        label: "Implementation Tracking",
        status: "partial",
        publishedAt: "2026-08-08T00:00:00.000Z",
        version: null,
        sectionAnchor: "implementation_tracking",
      },
      {
        stageId: "public_impact",
        label: "Public Impact",
        status: "published",
        publishedAt: "2026-08-09T00:00:00.000Z",
        version: 1,
        sectionAnchor: "public_impact",
      },
    ],
    consistencyChecks: [],
    isPublicImpactReportAvailable: true,
    isEmpty: false,
    ...overrides,
  };
}

describe("generateCivicArchiveDraftContent", () => {
  it("assembles all canonical sections in Part 3 order from published-only sources", () => {
    const content = generateCivicArchiveDraftContent(buildSnapshot());

    assert.deepEqual(
      content.sections.map((section) => section.sectionId),
      [...INITIATIVE_CIVIC_ARCHIVE_SECTION_IDS],
    );
    assert.equal(content.publicImpactReportId, "public-impact-report-1");
    assert.match(content.finalArchiveTitle, /Community Compost Network/);
    assert.ok(
      content.sections
        .find((section) => section.sectionId === "collaborative_analysis")
        ?.sourceRecordIds.includes("analysis-1"),
    );
  });

  it("records missing optional stages honestly without crashing", () => {
    const content = generateCivicArchiveDraftContent(
      buildSnapshot({
        proposalReferences: [],
        petitionReference: null,
        completeness: {
          ...buildSnapshot().completeness,
          missingOptionalStages: ["proposal", "petition"],
        },
      }),
    );

    const proposals = content.sections.find(
      (section) => section.sectionId === "improvement_proposals",
    );
    const petition = content.sections.find(
      (section) => section.sectionId === "petition_and_public_participation",
    );

    assert.ok(proposals?.body.includes("No published"));
    assert.ok(petition?.body.includes("No published"));
  });

  it("keeps incomplete implementation and outstanding work visible", () => {
    const content = generateCivicArchiveDraftContent(buildSnapshot());
    const outstanding = content.sections.find((section) => section.sectionId === "outstanding_work");
    const tracking = content.sections.find(
      (section) => section.sectionId === "implementation_tracking",
    );

    assert.ok(outstanding?.body.includes("remain unresolved"));
    assert.ok(tracking?.body.includes("remain unresolved"));
  });

  it("never requires DM/channel inputs — builder only accepts intelligence snapshot", () => {
    // Conceptual private-exclusion guarantee: the builder signature accepts
    // only InitiativeCivicArchiveIntelligenceSnapshot (published refs).
    const content = generateCivicArchiveDraftContent(buildSnapshot());
    const serialized = JSON.stringify(content);
    assert.equal(serialized.includes("direct-message"), false);
    assert.equal(serialized.includes("channel"), false);
  });
});
