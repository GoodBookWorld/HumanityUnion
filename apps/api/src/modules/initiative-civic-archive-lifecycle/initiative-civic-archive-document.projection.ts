import type {
  CivicArchiveTraceability,
  InitiativeCivicArchiveLifecycleDraft,
  InitiativeCivicArchiveVersion,
  InitiativeLifecycleArchiveDocument,
} from "@hu/types";
import { INITIATIVE_LIFECYCLE_ARCHIVE_DISCLAIMER } from "@hu/types";

import { getInitiativeById } from "../initiatives/initiative.store.js";

function buildCitations(
  sections: InitiativeCivicArchiveLifecycleDraft["sections"] | InitiativeCivicArchiveVersion["sections"],
  traceability: CivicArchiveTraceability | null,
): string[] {
  const fromSections = sections.flatMap((section) => section.sourceRecordIds);
  const fromTrace = traceability
    ? [
        traceability.analysisId,
        ...traceability.proposalIds,
        traceability.revisionId,
        traceability.petitionId,
        traceability.decisionSessionId,
        traceability.decisionId,
        traceability.commitmentPackageId,
        traceability.trackingPackageId,
        traceability.officialResponsePackageId,
        traceability.publicImpactReportId,
        ...traceability.relatedTrackingIds,
        ...traceability.relatedCommitmentIds,
        ...traceability.relatedOfficialResponseIds,
        ...traceability.evidenceReferences,
      ]
    : [];

  return [...new Set([...fromSections, ...fromTrace].filter((value): value is string => Boolean(value)))];
}

function applyAuthorFinalFieldsToSections(
  sections: InitiativeCivicArchiveLifecycleDraft["sections"],
  input: {
    finalSummary: string;
    lessonsLearned: string;
    knowledgeContribution: string;
  },
): InitiativeCivicArchiveLifecycleDraft["sections"] {
  return sections.map((section) => {
    if (section.sectionId === "archive_overview" && input.finalSummary.trim()) {
      return {
        ...section,
        body: [section.body, `Author final summary: ${input.finalSummary.trim()}`]
          .filter(Boolean)
          .join("\n\n"),
      };
    }

    if (section.sectionId === "lessons_learned" && input.lessonsLearned.trim()) {
      return { ...section, body: input.lessonsLearned.trim() };
    }

    if (section.sectionId === "knowledge_contribution" && input.knowledgeContribution.trim()) {
      return { ...section, body: input.knowledgeContribution.trim() };
    }

    return structuredClone(section);
  });
}

/**
 * Initiative Lifecycle — Part M, Section 11. Canonical Archive Document
 * projection — ONE source of truth for web render, PDF, and future formats.
 */
export function buildArchiveDocumentFromDraft(input: {
  draft: InitiativeCivicArchiveLifecycleDraft;
  stewardDisplayName?: string | null;
  traceability?: CivicArchiveTraceability | null;
}): InitiativeLifecycleArchiveDocument {
  const initiative = getInitiativeById(input.draft.initiativeId);
  const sections = applyAuthorFinalFieldsToSections(input.draft.sections, {
    finalSummary: input.draft.finalSummary,
    lessonsLearned: input.draft.lessonsLearned,
    knowledgeContribution: input.draft.knowledgeContribution,
  });
  const publicUrlPath = `/initiatives/public/${encodeURIComponent(input.draft.initiativeId)}#civic-archive`;
  const traceability = input.traceability ?? null;

  return {
    documentKind: "initiative_lifecycle_archive",
    archiveVersionId: null,
    archiveVersion: null,
    initiativeId: input.draft.initiativeId,
    initiativeTitle: initiative?.title ?? "",
    initiativeDescription: initiative?.description ?? "",
    finalArchiveTitle: input.draft.finalArchiveTitle,
    finalSummary: input.draft.finalSummary,
    lessonsLearned: input.draft.lessonsLearned,
    knowledgeContribution: input.draft.knowledgeContribution,
    stewardDisplayName: input.stewardDisplayName ?? null,
    publishedAt: null,
    publicUrlPath,
    disclaimer: INITIATIVE_LIFECYCLE_ARCHIVE_DISCLAIMER,
    isDraftPreview: true,
    timeline: input.draft.timeline.map((entry) => structuredClone(entry)),
    sections,
    participationStatistics: structuredClone(input.draft.participationStatistics),
    completeness: structuredClone(input.draft.completeness),
    traceability,
    citations: buildCitations(sections, traceability),
  };
}

export function buildArchiveDocumentFromVersion(input: {
  version: InitiativeCivicArchiveVersion;
  stewardDisplayName?: string | null;
}): InitiativeLifecycleArchiveDocument {
  const initiative = getInitiativeById(input.version.initiativeId);
  const sections = applyAuthorFinalFieldsToSections(input.version.sections, {
    finalSummary: input.version.finalSummary,
    lessonsLearned: input.version.lessonsLearned,
    knowledgeContribution: input.version.knowledgeContribution,
  });

  return {
    documentKind: "initiative_lifecycle_archive",
    archiveVersionId: input.version.archiveVersionId,
    archiveVersion: input.version.archiveVersion,
    initiativeId: input.version.initiativeId,
    initiativeTitle: initiative?.title ?? "",
    initiativeDescription: initiative?.description ?? "",
    finalArchiveTitle: input.version.finalArchiveTitle,
    finalSummary: input.version.finalSummary,
    lessonsLearned: input.version.lessonsLearned,
    knowledgeContribution: input.version.knowledgeContribution,
    stewardDisplayName: input.stewardDisplayName ?? null,
    publishedAt: input.version.publishedAt,
    publicUrlPath: input.version.publicUrlPath,
    disclaimer: INITIATIVE_LIFECYCLE_ARCHIVE_DISCLAIMER,
    isDraftPreview: false,
    timeline: input.version.timeline.map((entry) => structuredClone(entry)),
    sections,
    participationStatistics: structuredClone(input.version.participationStatistics),
    completeness: structuredClone(input.version.completeness),
    traceability: structuredClone(input.version.traceability),
    citations: buildCitations(sections, input.version.traceability),
  };
}
