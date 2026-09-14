import type {
  InitiativePublicImpactIntelligenceSnapshot,
  InitiativePublicImpactLifecycleDraft,
  InitiativePublicImpactReportSectionId,
} from "@hu/types";

import type {
  PublicImpactSidebarAdvisory,
  PublicImpactSidebarSectionId,
} from "../initiative-lifecycle-stage-workspace/sidebar-advisory-contract";

export interface PublicImpactAiAssistantInsights {
  readonly sourcesSummary: PublicImpactSidebarAdvisory;
  readonly missingEvidenceWarnings: readonly PublicImpactSidebarAdvisory[];
  readonly unsupportedConclusionWarnings: readonly PublicImpactSidebarAdvisory[];
  readonly inconsistentStatsWarnings: readonly PublicImpactSidebarAdvisory[];
  readonly duplicatedClaimWarnings: readonly PublicImpactSidebarAdvisory[];
  readonly missingInstitutionOutcomeWarnings: readonly PublicImpactSidebarAdvisory[];
  readonly clarityWarnings: readonly PublicImpactSidebarAdvisory[];
  readonly advisoryNotes: readonly PublicImpactSidebarAdvisory[];
  /** API opaque consistency warnings — detail/label stay raw. */
  readonly consistencyWarnings: InitiativePublicImpactIntelligenceSnapshot["consistencyChecks"];
}

function sectionCivic(section: {
  title: string;
  sectionId: InitiativePublicImpactReportSectionId;
}): PublicImpactSidebarAdvisory["civic"] {
  const title = section.title.trim();
  if (title) {
    return { title };
  }
  return { publicImpactSectionId: section.sectionId as PublicImpactSidebarSectionId };
}

/**
 * Initiative Lifecycle — Part L, Section 9. Advisory-only derived
 * insights — never itself judges success/failure, never invents
 * achievements, and never edits section bodies. AI cannot publish or
 * advance Lifecycle. Missing evidence yields uncertainty warnings, not
 * invent-or-block instructions.
 *
 * Pack 02G Task 08E.8f: Web-owned deterministic advisory meaning is encoded as
 * language-neutral descriptors. Statistics comparisons remain derive-owned.
 * API consistency-check detail remains opaque.
 */
export function derivePublicImpactAiAssistantInsights(
  snapshot: InitiativePublicImpactIntelligenceSnapshot,
  draft: InitiativePublicImpactLifecycleDraft | null,
): PublicImpactAiAssistantInsights {
  const missingEvidenceWarnings: PublicImpactSidebarAdvisory[] = [];
  const unsupportedConclusionWarnings: PublicImpactSidebarAdvisory[] = [];
  const inconsistentStatsWarnings: PublicImpactSidebarAdvisory[] = [];
  const duplicatedClaimWarnings: PublicImpactSidebarAdvisory[] = [];
  const missingInstitutionOutcomeWarnings: PublicImpactSidebarAdvisory[] = [];
  const clarityWarnings: PublicImpactSidebarAdvisory[] = [];
  const advisoryNotes: PublicImpactSidebarAdvisory[] = [];

  if (!snapshot.officialResponsePackageReference) {
    missingEvidenceWarnings.push({
      code: "public_impact.evidence.package_required",
      severity: "warning",
    });
  } else if (snapshot.officialResponsePackageReference.outcomeKind === "no_official_response_received") {
    advisoryNotes.push({
      code: "public_impact.note.no_response_outcome",
      severity: "info",
    });
  }

  if (snapshot.evidenceItems.length === 0) {
    missingEvidenceWarnings.push({
      code: "public_impact.evidence.none_visible",
      severity: "warning",
    });
  }

  if (
    snapshot.officialResponsePackageReference?.outcomeKind !== "no_official_response_received" &&
    snapshot.officialResponseSummaries.some(
      (response) => !response.institution.trim() && !response.organization.trim(),
    )
  ) {
    missingInstitutionOutcomeWarnings.push({
      code: "public_impact.institution.missing_name",
      severity: "warning",
    });
  }

  if (
    snapshot.officialResponsePackageReference?.outcomeKind !== "no_official_response_received" &&
    snapshot.officialResponseSummaries.some((response) => !response.summary.trim())
  ) {
    missingInstitutionOutcomeWarnings.push({
      code: "public_impact.institution.missing_summary",
      severity: "warning",
    });
  }

  if (snapshot.completedCommitmentCount === 0 && snapshot.trackingRecords.every((t) => t.status !== "completed")) {
    advisoryNotes.push({
      code: "public_impact.note.low_completion",
      severity: "info",
    });
  }

  if (draft) {
    if (draft.sections.length === 0) {
      clarityWarnings.push({
        code: "public_impact.clarity.no_sections",
        severity: "warning",
      });
    }

    for (const section of draft.sections) {
      if (section.body.trim() && section.evidenceReferences.length === 0) {
        unsupportedConclusionWarnings.push({
          code: "public_impact.conclusion.unsupported",
          severity: "warning",
          civic: sectionCivic(section),
        });
      }

      if (
        (section.sectionId === "executive_summary" || section.sectionId === "evidence") &&
        !section.body.trim()
      ) {
        missingEvidenceWarnings.push({
          code: "public_impact.evidence.section_empty",
          severity: "warning",
          civic: sectionCivic(section),
        });
      }
    }

    const bodyCounts = new Map<string, number>();
    for (const section of draft.sections) {
      const key = section.body.trim().toLowerCase();
      if (!key) {
        continue;
      }
      bodyCounts.set(key, (bodyCounts.get(key) ?? 0) + 1);
    }
    for (const [body, count] of bodyCounts) {
      if (count > 1) {
        duplicatedClaimWarnings.push({
          code: "public_impact.claims.duplicated",
          severity: "warning",
          params: { count },
          civic: {
            excerpt: `${body.slice(0, 48)}${body.length > 48 ? "…" : ""}`,
          },
        });
      }
    }

    const stats = draft.participationStatistics;
    const snapshotStats = snapshot.participationStatistics;
    if (
      stats.signatureCount !== snapshotStats.signatureCount ||
      stats.supportCount !== snapshotStats.supportCount ||
      stats.reactionCount !== snapshotStats.reactionCount ||
      stats.activeAllyCount !== snapshotStats.activeAllyCount
    ) {
      inconsistentStatsWarnings.push({
        code: "public_impact.stats.inconsistent",
        severity: "warning",
      });
    }

    if (!draft.title.trim()) {
      clarityWarnings.push({
        code: "public_impact.clarity.title_empty",
        severity: "warning",
        civic: { publicImpactFieldIds: ["title"] },
      });
    }

    const judgmentWords = /\b(success|failure|failed|succeeded|triumph|disaster)\b/i;
    for (const section of draft.sections) {
      if (judgmentWords.test(section.body)) {
        clarityWarnings.push({
          code: "public_impact.clarity.judgment_wording",
          severity: "warning",
          civic: sectionCivic(section),
        });
      }
    }
  }

  advisoryNotes.push({
    code: "public_impact.note.advisory_only",
    severity: "info",
  });

  const hasOfficial = Boolean(snapshot.officialResponsePackageReference);
  const noResponseOutcome =
    snapshot.officialResponsePackageReference?.outcomeKind === "no_official_response_received";
  const hasTracking = Boolean(snapshot.trackingPackageReference);
  const sourcesSummary: PublicImpactSidebarAdvisory = {
    code: "public_impact.sources.summary",
    severity: "info",
    params: {
      hasOfficial: hasOfficial ? 1 : 0,
      noResponseOutcome: noResponseOutcome ? 1 : 0,
      hasTracking: hasTracking ? 1 : 0,
      evidenceCount: snapshot.evidenceItems.length,
      activeAllyCount: snapshot.participationStatistics.activeAllyCount,
    },
    civic: {
      ...(snapshot.officialResponsePackageReference
        ? { title: snapshot.officialResponsePackageReference.title }
        : {}),
      ...(snapshot.trackingPackageReference
        ? { trackingTitle: snapshot.trackingPackageReference.title }
        : {}),
    },
  };

  return {
    sourcesSummary,
    missingEvidenceWarnings,
    unsupportedConclusionWarnings,
    inconsistentStatsWarnings,
    duplicatedClaimWarnings,
    missingInstitutionOutcomeWarnings,
    clarityWarnings,
    advisoryNotes,
    consistencyWarnings: snapshot.consistencyChecks.filter((check) => check.status === "warning"),
  };
}
