import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { InitiativeLifecycleArchiveDocument } from "@hu/types";
import { INITIATIVE_LIFECYCLE_ARCHIVE_DISCLAIMER } from "@hu/types";

import {
  extractSearchablePdfText,
  generateCivicArchivePdfBuffer,
} from "../../../src/modules/initiative-civic-archive-lifecycle/initiative-civic-archive-pdf-export.service.js";

function buildDocument(): InitiativeLifecycleArchiveDocument {
  return {
    documentKind: "initiative_lifecycle_archive",
    archiveVersionId: "civic-archive-version-1",
    archiveVersion: 1,
    initiativeId: "initiative-part-m",
    initiativeTitle: "Community Compost Network",
    initiativeDescription: "Build neighborhood compost hubs.",
    finalArchiveTitle: "Civic Archive: Community Compost Network",
    finalSummary: "Historical summary.",
    lessonsLearned: "Lessons.",
    knowledgeContribution: "Knowledge.",
    stewardDisplayName: "Steward Verify",
    publishedAt: "2026-08-09T12:00:00.000Z",
    publicUrlPath: "/initiatives/public/initiative-part-m#civic-archive",
    disclaimer: INITIATIVE_LIFECYCLE_ARCHIVE_DISCLAIMER,
    isDraftPreview: false,
    timeline: [
      {
        stageId: "public_impact",
        label: "Public Impact",
        status: "published",
        publishedAt: "2026-08-09T00:00:00.000Z",
        version: 1,
        sectionAnchor: "public_impact",
      },
    ],
    sections: [
      {
        sectionId: "archive_overview",
        title: "Archive Overview",
        body: "Overview body.",
        sourceRecordIds: ["public-impact-report-1"],
        sourceStageId: null,
      },
    ],
    participationStatistics: {
      signatureCount: 1,
      supportCount: 1,
      reactionCount: 0,
      activeAllyCount: 1,
    },
    completeness: {
      stagesFound: ["public_impact"],
      stagesPublished: ["public_impact"],
      missingOptionalStages: [],
      unresolvedTrackingCount: 0,
      unfinishedCommitmentCount: 0,
      missingEvidenceCount: 0,
      officialResponseCount: 1,
      publicImpactAvailable: true,
      traceabilityComplete: true,
      summaryDescriptors: [],
      summary: "Ready.",
    },
    traceability: null,
    citations: ["public-impact-report-1"],
  };
}

describe("generateCivicArchivePdfBuffer", () => {
  it("returns a non-empty PDF buffer containing title/version/date markers", async () => {
    const document = buildDocument();
    const buffer = await generateCivicArchivePdfBuffer(document);

    assert.ok(buffer.length > 100);
    assert.equal(buffer.subarray(0, 4).toString("utf8"), "%PDF");

    const searchable = extractSearchablePdfText(buffer);
    assert.ok(searchable.includes("ARCHIVE_PDF_MARKERS"));
    assert.ok(searchable.includes("Civic Archive: Community Compost Network"));
    assert.ok(searchable.includes("version=1"));
    assert.ok(searchable.includes("2026-08-09T12:00:00.000Z"));
  });

  it("labels draft preview PDFs with the watermark marker", async () => {
    const document = {
      ...buildDocument(),
      isDraftPreview: true,
      archiveVersion: null,
      publishedAt: null,
    };
    const buffer = await generateCivicArchivePdfBuffer(document, { draftWatermark: true });
    const searchable = extractSearchablePdfText(buffer);

    assert.ok(searchable.includes("Draft Preview") || searchable.includes("Not Published"));
    assert.ok(searchable.includes("version=draft"));
  });
});
