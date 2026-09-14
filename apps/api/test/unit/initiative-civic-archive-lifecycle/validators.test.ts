import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { InitiativeCivicArchiveLifecycleDraft } from "@hu/types";

import {
  validateInitiativeCivicArchiveLifecycleDraftForPublication,
  validateSaveInitiativeCivicArchiveLifecycleDraftInput,
} from "../../../src/modules/initiative-civic-archive-lifecycle/initiative-civic-archive-lifecycle.validators.js";

function buildDraft(
  overrides: Partial<InitiativeCivicArchiveLifecycleDraft> = {},
): InitiativeCivicArchiveLifecycleDraft {
  return {
    draftId: "draft-1",
    initiativeId: "initiative-part-m",
    authorId: "steward-1",
    finalArchiveTitle: "Civic Archive: Compost",
    finalSummary: "Summary",
    lessonsLearned: "",
    knowledgeContribution: "",
    publicImpactReportId: "public-impact-report-1",
    sections: [
      {
        sectionId: "archive_overview",
        title: "Archive Overview",
        body: "Overview",
        sourceRecordIds: ["public-impact-report-1"],
        sourceStageId: null,
      },
    ],
    timeline: [],
    completeness: {
      stagesFound: [],
      stagesPublished: [],
      missingOptionalStages: [],
      unresolvedTrackingCount: 0,
      unfinishedCommitmentCount: 0,
      missingEvidenceCount: 0,
      officialResponseCount: 0,
      publicImpactAvailable: true,
      traceabilityComplete: true,
      summaryDescriptors: [],
      summary: "",
    },
    participationStatistics: {
      signatureCount: 0,
      supportCount: 0,
      reactionCount: 0,
      activeAllyCount: 0,
    },
    createdAt: "2026-08-09T00:00:00.000Z",
    updatedAt: "2026-08-09T00:00:00.000Z",
    ...overrides,
  };
}

describe("civic archive validators", () => {
  it("allows only final Author fields on save", () => {
    const input = validateSaveInitiativeCivicArchiveLifecycleDraftInput({
      finalArchiveTitle: "Title",
      finalSummary: "Summary",
      lessonsLearned: "Lessons",
      knowledgeContribution: "Knowledge",
    });

    assert.equal(input.finalArchiveTitle, "Title");
    assert.equal(input.finalSummary, "Summary");
  });

  it("rejects save payloads that attempt to mutate assembled sections", () => {
    assert.throws(
      () =>
        validateSaveInitiativeCivicArchiveLifecycleDraftInput({
          finalArchiveTitle: "Title",
          sections: [],
        }),
      /Save supports only/,
    );
  });

  it("requires title, summary, publicImpactReportId, and generated sections for publish", () => {
    assert.throws(
      () =>
        validateInitiativeCivicArchiveLifecycleDraftForPublication(
          buildDraft({ finalArchiveTitle: "" }),
        ),
      /finalArchiveTitle/,
    );
    assert.throws(
      () =>
        validateInitiativeCivicArchiveLifecycleDraftForPublication(buildDraft({ finalSummary: "" })),
      /finalSummary/,
    );
    assert.throws(
      () =>
        validateInitiativeCivicArchiveLifecycleDraftForPublication(
          buildDraft({ publicImpactReportId: null }),
        ),
      /Public Impact Report/,
    );
    assert.throws(
      () =>
        validateInitiativeCivicArchiveLifecycleDraftForPublication(buildDraft({ sections: [] })),
      /must be generated/,
    );

    assert.doesNotThrow(() =>
      validateInitiativeCivicArchiveLifecycleDraftForPublication(buildDraft()),
    );
  });
});
