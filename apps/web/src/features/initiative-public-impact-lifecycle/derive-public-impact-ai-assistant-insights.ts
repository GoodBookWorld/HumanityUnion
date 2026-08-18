import type {
  InitiativePublicImpactIntelligenceSnapshot,
  InitiativePublicImpactLifecycleDraft,
} from "@hu/types";

export interface PublicImpactAiAssistantInsights {
  sourcesUsedSummary: string;
  missingEvidenceWarnings: string[];
  unsupportedConclusionWarnings: string[];
  inconsistentStatsWarnings: string[];
  duplicatedClaimWarnings: string[];
  missingInstitutionOutcomeWarnings: string[];
  clarityWarnings: string[];
  advisoryNotes: string[];
}

/**
 * Initiative Lifecycle — Part L, Section 9. Advisory-only derived
 * insights — never itself judges success/failure, never invents
 * achievements, and never edits section bodies. AI cannot publish or
 * advance Lifecycle. Missing evidence yields uncertainty warnings, not
 * invent-or-block instructions.
 */
export function derivePublicImpactAiAssistantInsights(
  snapshot: InitiativePublicImpactIntelligenceSnapshot,
  draft: InitiativePublicImpactLifecycleDraft | null,
): PublicImpactAiAssistantInsights {
  const missingEvidenceWarnings: string[] = [];
  const unsupportedConclusionWarnings: string[] = [];
  const inconsistentStatsWarnings: string[] = [];
  const duplicatedClaimWarnings: string[] = [];
  const missingInstitutionOutcomeWarnings: string[] = [];
  const clarityWarnings: string[] = [];
  const advisoryNotes: string[] = [];

  if (!snapshot.officialResponsePackageReference) {
    missingEvidenceWarnings.push(
      "Publish an Official Response Package before generating Public Impact.",
    );
  } else if (snapshot.officialResponsePackageReference.outcomeKind === "no_official_response_received") {
    advisoryNotes.push(
      "Official Responses published No official response received — treat that as a factual outcome. Do not invent institutional replies.",
    );
  }

  if (snapshot.evidenceItems.length === 0) {
    missingEvidenceWarnings.push(
      "No evidence references are visible yet from Tracking or Official Responses — keep uncertainty explicit; do not fabricate evidence. This does not block Publish.",
    );
  }

  if (
    snapshot.officialResponsePackageReference?.outcomeKind !== "no_official_response_received" &&
    snapshot.officialResponseSummaries.some(
      (response) => !response.institution.trim() && !response.organization.trim(),
    )
  ) {
    missingInstitutionOutcomeWarnings.push(
      "One or more Official Responses still lack an institution or organization name.",
    );
  }

  if (
    snapshot.officialResponsePackageReference?.outcomeKind !== "no_official_response_received" &&
    snapshot.officialResponseSummaries.some((response) => !response.summary.trim())
  ) {
    missingInstitutionOutcomeWarnings.push(
      "One or more Official Responses still lack an outcome summary.",
    );
  }

  if (snapshot.completedCommitmentCount === 0 && snapshot.trackingRecords.every((t) => t.status !== "completed")) {
    advisoryNotes.push(
      "Little or no measurable completion is visible — a valid Author conclusion may be: no measurable impact yet, implementation incomplete, or outcome not achieved.",
    );
  }

  if (draft) {
    if (draft.sections.length === 0) {
      clarityWarnings.push("No Report sections yet — generate a draft from published sources.");
    }

    for (const section of draft.sections) {
      const label = section.title || section.sectionId;

      if (section.body.trim() && section.evidenceReferences.length === 0) {
        unsupportedConclusionWarnings.push(
          `"${label}" has a body but no evidence reference — unsupported conclusions should be removed or cited.`,
        );
      }

      if (
        (section.sectionId === "executive_summary" || section.sectionId === "evidence") &&
        !section.body.trim()
      ) {
        missingEvidenceWarnings.push(`"${label}" is empty — publish requires a non-empty body.`);
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
        duplicatedClaimWarnings.push(
          `${count} sections share the same body text starting "${body.slice(0, 48)}${body.length > 48 ? "…" : ""}".`,
        );
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
      inconsistentStatsWarnings.push(
        "Draft participation statistics differ from the current intelligence snapshot — regenerate or reconcile before publishing.",
      );
    }

    if (!draft.title.trim()) {
      clarityWarnings.push("Title is empty — Public Impact Reports should be clearly labeled.");
    }

    const judgmentWords = /\b(success|failure|failed|succeeded|triumph|disaster)\b/i;
    for (const section of draft.sections) {
      if (judgmentWords.test(section.body)) {
        clarityWarnings.push(
          `"${section.title || section.sectionId}" uses success/failure judgment wording — prefer neutral factual summaries.`,
        );
      }
    }
  }

  for (const check of snapshot.consistencyChecks) {
    if (check.status === "warning") {
      clarityWarnings.push(check.detail);
    }
  }

  advisoryNotes.push(
    "AI suggestions are advisory only — separate confirmed facts from assumptions. AI cannot invent results, publish, or advance Lifecycle.",
  );

  const officialLabel = snapshot.officialResponsePackageReference
    ? snapshot.officialResponsePackageReference.outcomeKind === "no_official_response_received"
      ? `Official Responses "${snapshot.officialResponsePackageReference.title}" (No official response received)`
      : `Official Responses "${snapshot.officialResponsePackageReference.title}"`
    : null;

  const sourcesUsedSummary = [
    officialLabel,
    snapshot.trackingPackageReference
      ? `Tracking Package "${snapshot.trackingPackageReference.title}"`
      : null,
    `${snapshot.evidenceItems.length} evidence reference(s)`,
    `${snapshot.participationStatistics.activeAllyCount} Active Ally(ies)`,
  ]
    .filter(Boolean)
    .join(" · ");

  return {
    sourcesUsedSummary: sourcesUsedSummary || "No Public Impact Sources available yet.",
    missingEvidenceWarnings,
    unsupportedConclusionWarnings,
    inconsistentStatsWarnings,
    duplicatedClaimWarnings,
    missingInstitutionOutcomeWarnings,
    clarityWarnings,
    advisoryNotes,
  };
}
