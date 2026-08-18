import type {
  InitiativeCivicArchiveIntelligenceSnapshot,
  InitiativeCivicArchiveLifecycleDraft,
  InitiativeLifecycleProfile,
} from "@hu/types";

import { requiresPublicImpactBeforeCivicArchive } from "../public-initiative-experience/initiative-lifecycle-shell";

export interface CivicArchiveAiAssistantInsights {
  sourcesUsedSummary: string;
  completenessWarnings: string[];
  missingFinalFieldWarnings: string[];
  outstandingWorkWarnings: string[];
  neutralityWarnings: string[];
  clarityWarnings: string[];
}

/**
 * Initiative Lifecycle — Part M, Section 4. Advisory-only derived insights —
 * neutral historical language; never praise/blame/success-wash; never edits
 * assembled section bodies or publishes.
 */
export function deriveCivicArchiveAiAssistantInsights(
  snapshot: InitiativeCivicArchiveIntelligenceSnapshot,
  draft: InitiativeCivicArchiveLifecycleDraft | null,
  lifecycleProfile?: InitiativeLifecycleProfile | string | null,
): CivicArchiveAiAssistantInsights {
  const completenessWarnings: string[] = [];
  const missingFinalFieldWarnings: string[] = [];
  const outstandingWorkWarnings: string[] = [];
  const neutralityWarnings: string[] = [];
  const clarityWarnings: string[] = [];
  const requirePublicImpact = requiresPublicImpactBeforeCivicArchive(lifecycleProfile);

  if (requirePublicImpact && !snapshot.isPublicImpactReportAvailable) {
    completenessWarnings.push(
      "Publish a Public Impact Report before generating the Civic Archive.",
    );
  }

  if (snapshot.officialResponsePackageReference?.outcomeKind === "no_official_response_received") {
    clarityWarnings.push(
      "Official Responses record No official response received — preserve that outcome in the Archive summary.",
    );
  }

  if (snapshot.completeness.missingOptionalStages.length > 0) {
    completenessWarnings.push(
      `Optional stage(s) without published records: ${snapshot.completeness.missingOptionalStages.join(", ")}. Empty optional history is valid and does not block Archive.`,
    );
  }

  clarityWarnings.push(
    "AI is advisory only — it cannot publish Civic Archive or close the Initiative Lifecycle.",
  );
  if (snapshot.completeness.unresolvedTrackingCount > 0) {
    outstandingWorkWarnings.push(
      `${snapshot.completeness.unresolvedTrackingCount} Tracking Record(s) remain unresolved — record them honestly in Outstanding Work.`,
    );
  }

  if (snapshot.completeness.unfinishedCommitmentCount > 0) {
    outstandingWorkWarnings.push(
      `${snapshot.completeness.unfinishedCommitmentCount} Commitment(s) were not marked completed.`,
    );
  }

  if (draft) {
    if (!draft.finalArchiveTitle.trim()) {
      missingFinalFieldWarnings.push("Final archive title is empty — required before publish.");
    }
    if (!draft.finalSummary.trim()) {
      missingFinalFieldWarnings.push("Final summary is empty — required before publish.");
    }
    if (!draft.lessonsLearned.trim()) {
      missingFinalFieldWarnings.push(
        "Lessons learned is empty — optional, but recommended before publish.",
      );
    }
    if (!draft.knowledgeContribution.trim()) {
      missingFinalFieldWarnings.push(
        "Knowledge contribution is empty — optional, but recommended before publish.",
      );
    }

    if (draft.sections.length === 0) {
      clarityWarnings.push("No assembled Archive sections yet — generate from published sources.");
    }

    const judgmentWords = /\b(success|failure|failed|succeeded|triumph|disaster|victory)\b/i;
    for (const field of [
      draft.finalSummary,
      draft.lessonsLearned,
      draft.knowledgeContribution,
    ]) {
      if (judgmentWords.test(field)) {
        neutralityWarnings.push(
          "Final contribution fields use success/failure judgment wording — prefer neutral historical language.",
        );
        break;
      }
    }
  }

  for (const check of snapshot.consistencyChecks) {
    if (check.status === "warning") {
      clarityWarnings.push(check.detail);
    }
  }

  const sourcesUsedSummary = [
    snapshot.publicImpactReportReference
      ? `Public Impact "${snapshot.publicImpactReportReference.label}"`
      : null,
    snapshot.officialResponsePackageReference
      ? `Official Responses "${snapshot.officialResponsePackageReference.label}"`
      : null,
    snapshot.trackingPackageReference
      ? `Tracking "${snapshot.trackingPackageReference.label}"`
      : null,
    `${snapshot.completeness.stagesPublished.length} published stage(s)`,
  ]
    .filter(Boolean)
    .join(" · ");

  return {
    sourcesUsedSummary: sourcesUsedSummary || "No Civic Archive Sources available yet.",
    completenessWarnings,
    missingFinalFieldWarnings,
    outstandingWorkWarnings,
    neutralityWarnings,
    clarityWarnings,
  };
}
