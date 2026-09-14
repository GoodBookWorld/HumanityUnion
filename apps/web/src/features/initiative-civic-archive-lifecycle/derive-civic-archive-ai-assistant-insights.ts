import type {
  InitiativeCivicArchiveIntelligenceSnapshot,
  InitiativeCivicArchiveLifecycleDraft,
} from "@hu/types";

import type { CivicArchiveSidebarAdvisory } from "../initiative-lifecycle-stage-workspace/sidebar-advisory-contract";

export interface CivicArchiveAiAssistantInsights {
  readonly sourcesSummary: CivicArchiveSidebarAdvisory;
  readonly completenessWarnings: readonly CivicArchiveSidebarAdvisory[];
  readonly missingFinalFieldWarnings: readonly CivicArchiveSidebarAdvisory[];
  readonly outstandingWorkWarnings: readonly CivicArchiveSidebarAdvisory[];
  readonly neutralityWarnings: readonly CivicArchiveSidebarAdvisory[];
  readonly clarityWarnings: readonly CivicArchiveSidebarAdvisory[];
  /** API opaque consistency warnings — detail/label stay raw. */
  readonly consistencyWarnings: InitiativeCivicArchiveIntelligenceSnapshot["consistencyChecks"];
}

/**
 * Initiative Lifecycle — Part M, Section 4. Advisory-only derived insights —
 * neutral historical language; never praise/blame/success-wash; never edits
 * assembled section bodies or publishes.
 *
 * Pack 02G Task 08E.8f: Web-owned deterministic advisory meaning is encoded as
 * language-neutral descriptors. Completeness counts remain derive-owned.
 * API consistency-check detail and completeness.summary remain opaque/upstream.
 */
export function deriveCivicArchiveAiAssistantInsights(
  snapshot: InitiativeCivicArchiveIntelligenceSnapshot,
  draft: InitiativeCivicArchiveLifecycleDraft | null,
  _lifecycleProfile?: string | null,
): CivicArchiveAiAssistantInsights {
  const completenessWarnings: CivicArchiveSidebarAdvisory[] = [];
  const missingFinalFieldWarnings: CivicArchiveSidebarAdvisory[] = [];
  const outstandingWorkWarnings: CivicArchiveSidebarAdvisory[] = [];
  const neutralityWarnings: CivicArchiveSidebarAdvisory[] = [];
  const clarityWarnings: CivicArchiveSidebarAdvisory[] = [];

  // Public Impact is SOURCE_OPTIONAL; missing PI is incompleteness, not a hard block.

  if (snapshot.officialResponsePackageReference?.outcomeKind === "no_official_response_received") {
    clarityWarnings.push({
      code: "civic_archive.clarity.no_response_outcome",
      severity: "warning",
    });
  }

  if (snapshot.completeness.missingOptionalStages.length > 0) {
    completenessWarnings.push({
      code: "civic_archive.completeness.missing_optional_stages",
      severity: "warning",
      params: {
        stages: snapshot.completeness.missingOptionalStages.join(", "),
      },
    });
  }

  clarityWarnings.push({
    code: "civic_archive.clarity.advisory_only",
    severity: "info",
  });
  if (snapshot.completeness.unresolvedTrackingCount > 0) {
    outstandingWorkWarnings.push({
      code: "civic_archive.outstanding.unresolved_tracking",
      severity: "warning",
      params: { count: snapshot.completeness.unresolvedTrackingCount },
    });
  }

  if (snapshot.completeness.unfinishedCommitmentCount > 0) {
    outstandingWorkWarnings.push({
      code: "civic_archive.outstanding.unfinished_commitments",
      severity: "warning",
      params: { count: snapshot.completeness.unfinishedCommitmentCount },
    });
  }

  if (draft) {
    if (!draft.finalArchiveTitle.trim()) {
      missingFinalFieldWarnings.push({
        code: "civic_archive.fields.title_empty",
        severity: "warning",
        civic: { civicArchiveFieldIds: ["finalArchiveTitle"] },
      });
    }
    if (!draft.finalSummary.trim()) {
      missingFinalFieldWarnings.push({
        code: "civic_archive.fields.summary_empty",
        severity: "warning",
        civic: { civicArchiveFieldIds: ["finalSummary"] },
      });
    }
    if (!draft.lessonsLearned.trim()) {
      missingFinalFieldWarnings.push({
        code: "civic_archive.fields.lessons_empty",
        severity: "warning",
        civic: { civicArchiveFieldIds: ["lessonsLearned"] },
      });
    }
    if (!draft.knowledgeContribution.trim()) {
      missingFinalFieldWarnings.push({
        code: "civic_archive.fields.knowledge_empty",
        severity: "warning",
        civic: { civicArchiveFieldIds: ["knowledgeContribution"] },
      });
    }

    if (draft.sections.length === 0) {
      clarityWarnings.push({
        code: "civic_archive.clarity.no_sections",
        severity: "warning",
      });
    }

    const judgmentWords = /\b(success|failure|failed|succeeded|triumph|disaster|victory)\b/i;
    for (const field of [
      draft.finalSummary,
      draft.lessonsLearned,
      draft.knowledgeContribution,
    ]) {
      if (judgmentWords.test(field)) {
        neutralityWarnings.push({
          code: "civic_archive.neutrality.judgment_wording",
          severity: "warning",
        });
        break;
      }
    }
  }

  const hasPublicImpact = Boolean(snapshot.publicImpactReportReference);
  const hasOfficial = Boolean(snapshot.officialResponsePackageReference);
  const hasTracking = Boolean(snapshot.trackingPackageReference);
  const sourcesSummary: CivicArchiveSidebarAdvisory = {
    code: "civic_archive.sources.summary",
    severity: "info",
    params: {
      hasPublicImpact: hasPublicImpact ? 1 : 0,
      hasOfficial: hasOfficial ? 1 : 0,
      hasTracking: hasTracking ? 1 : 0,
      publishedStageCount: snapshot.completeness.stagesPublished.length,
    },
    civic: {
      ...(snapshot.publicImpactReportReference
        ? { title: snapshot.publicImpactReportReference.label }
        : {}),
      ...(snapshot.officialResponsePackageReference
        ? { subject: snapshot.officialResponsePackageReference.label }
        : {}),
      ...(snapshot.trackingPackageReference
        ? { trackingTitle: snapshot.trackingPackageReference.label }
        : {}),
    },
  };

  return {
    sourcesSummary,
    completenessWarnings,
    missingFinalFieldWarnings,
    outstandingWorkWarnings,
    neutralityWarnings,
    clarityWarnings,
    consistencyWarnings: snapshot.consistencyChecks.filter((check) => check.status === "warning"),
  };
}
