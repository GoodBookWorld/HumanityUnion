import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type {
  InitiativeCivicArchiveLifecycleDraft,
  InitiativeCivicArchiveVersion,
} from "@hu/types";
import { INITIATIVE_LIFECYCLE_ARCHIVE_DISCLAIMER } from "@hu/types";

import {
  buildArchiveDocumentFromDraft,
  buildArchiveDocumentFromVersion,
} from "../../../src/modules/initiative-civic-archive-lifecycle/initiative-civic-archive-document.projection.js";

function buildDraft(): InitiativeCivicArchiveLifecycleDraft {
  return {
    draftId: "draft-1",
    initiativeId: "initiative-part-m",
    authorId: "steward-1",
    finalArchiveTitle: "Civic Archive: Compost",
    finalSummary: "Historical summary of published activity.",
    lessonsLearned: "Author lessons.",
    knowledgeContribution: "Author knowledge.",
    publicImpactReportId: "public-impact-report-1",
    sections: [
      {
        sectionId: "archive_overview",
        title: "Archive Overview",
        body: "Assembled overview.",
        sourceRecordIds: ["public-impact-report-1"],
        sourceStageId: null,
      },
      {
        sectionId: "lessons_learned",
        title: "Lessons Learned",
        body: "Generated lessons.",
        sourceRecordIds: ["analysis-1"],
        sourceStageId: null,
      },
      {
        sectionId: "knowledge_contribution",
        title: "Knowledge Contribution",
        body: "Generated knowledge.",
        sourceRecordIds: ["decision-1"],
        sourceStageId: null,
      },
    ],
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
    participationStatistics: {
      signatureCount: 1,
      supportCount: 2,
      reactionCount: 0,
      activeAllyCount: 1,
    },
    createdAt: "2026-08-09T00:00:00.000Z",
    updatedAt: "2026-08-09T00:00:00.000Z",
  };
}

function buildVersion(): InitiativeCivicArchiveVersion {
  const draft = buildDraft();

  return {
    archiveVersionId: "civic-archive-version-1",
    initiativeId: draft.initiativeId,
    stewardId: draft.authorId,
    archiveVersion: 2,
    finalArchiveTitle: draft.finalArchiveTitle,
    finalSummary: draft.finalSummary,
    lessonsLearned: draft.lessonsLearned,
    knowledgeContribution: draft.knowledgeContribution,
    sections: draft.sections,
    timeline: draft.timeline,
    completeness: draft.completeness,
    participationStatistics: draft.participationStatistics,
    publicImpactReportId: draft.publicImpactReportId,
    frozenSourceRecordIds: ["public-impact-report-1", "analysis-1"],
    traceability: {
      analysisId: "analysis-1",
      analysisVersion: 1,
      proposalIds: ["proposal-1"],
      revisionId: "revision-1",
      revisionVersion: 1,
      petitionId: "petition-1",
      petitionVersion: 1,
      decisionSessionId: "session-1",
      decisionSessionVersion: 1,
      decisionId: "decision-1",
      commitmentPackageId: "commitment-package-1",
      trackingPackageId: "tracking-package-1",
      officialResponsePackageId: "official-response-package-1",
      publicImpactReportId: "public-impact-report-1",
      relatedTrackingIds: ["tracking-1"],
      relatedCommitmentIds: ["commitment-1"],
      relatedOfficialResponseIds: ["response-1"],
      evidenceReferences: ["public-impact-report-1"],
    },
    status: "published",
    publishedAt: "2026-08-09T12:00:00.000Z",
    createdAt: "2026-08-09T12:00:00.000Z",
    updatedAt: "2026-08-09T12:00:00.000Z",
    publicUrlPath: "/initiatives/public/initiative-part-m#civic-archive",
  };
}

describe("archive document projection", () => {
  it("builds a draft preview document with disclaimer and isDraftPreview", () => {
    const document = buildArchiveDocumentFromDraft({
      draft: buildDraft(),
      stewardDisplayName: "Steward Verify",
    });

    assert.equal(document.documentKind, "initiative_lifecycle_archive");
    assert.equal(document.isDraftPreview, true);
    assert.equal(document.archiveVersionId, null);
    assert.equal(document.disclaimer, INITIATIVE_LIFECYCLE_ARCHIVE_DISCLAIMER);
    assert.equal(
      document.sections.find((section) => section.sectionId === "lessons_learned")?.body,
      "Author lessons.",
    );
  });

  it("builds a published document with version metadata", () => {
    const document = buildArchiveDocumentFromVersion({
      version: buildVersion(),
      stewardDisplayName: "Steward Verify",
    });

    assert.equal(document.isDraftPreview, false);
    assert.equal(document.archiveVersionId, "civic-archive-version-1");
    assert.equal(document.archiveVersion, 2);
    assert.equal(document.publishedAt, "2026-08-09T12:00:00.000Z");
    assert.equal(document.publicUrlPath, "/initiatives/public/initiative-part-m#civic-archive");
    assert.equal(document.disclaimer, INITIATIVE_LIFECYCLE_ARCHIVE_DISCLAIMER);
    assert.ok(document.citations.includes("public-impact-report-1"));
  });
});
