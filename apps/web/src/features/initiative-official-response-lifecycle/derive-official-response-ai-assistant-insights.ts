import type {
  InitiativeOfficialResponseIntelligenceSnapshot,
  InitiativeOfficialResponseLifecycleDraft,
} from "@hu/types";

export interface OfficialResponseAiAssistantInsights {
  sourcesUsedSummary: string;
  missingTrackingPackageWarnings: string[];
  incompleteCandidateWarnings: string[];
  duplicateCandidateWarnings: string[];
  missingInstitutionWarnings: string[];
  missingReferenceWarnings: string[];
  unsupportedSummaryWarnings: string[];
  inconsistentDateWarnings: string[];
  clarityWarnings: string[];
}

const TODAY_ISO = () => new Date().toISOString().slice(0, 10);

/**
 * Initiative Lifecycle — Part K, Section 9. Advisory-only derived
 * insights — never itself changes a Candidate's institution, subject,
 * summary, or verification status, and never invents an institution/
 * organization name or a response that was not entered by the Author.
 * Every field it inspects mirrors what the Author can already see and
 * edit directly in the Editor.
 */
export function deriveOfficialResponseAiAssistantInsights(
  snapshot: InitiativeOfficialResponseIntelligenceSnapshot,
  draft: InitiativeOfficialResponseLifecycleDraft | null,
): OfficialResponseAiAssistantInsights {
  const missingTrackingPackageWarnings: string[] = [];
  const incompleteCandidateWarnings: string[] = [];
  const duplicateCandidateWarnings: string[] = [];
  const missingInstitutionWarnings: string[] = [];
  const missingReferenceWarnings: string[] = [];
  const unsupportedSummaryWarnings: string[] = [];
  const inconsistentDateWarnings: string[] = [];
  const clarityWarnings: string[] = [];

  if (!snapshot.trackingPackageReference) {
    missingTrackingPackageWarnings.push(
      "Publish an Implementation Tracking Package before generating Official Responses.",
    );
  }

  if (draft) {
    if (draft.candidates.length === 0) {
      incompleteCandidateWarnings.push(
        "No Response Candidates yet — generate a draft from the published Tracking Records.",
      );
    }

    const today = TODAY_ISO();

    draft.candidates.forEach((candidate, index) => {
      const label = candidate.subject.trim() || `Candidate ${index + 1}`;

      if (!candidate.institution.trim() && !candidate.organization.trim()) {
        missingInstitutionWarnings.push(`"${label}" has no institution or organization filled in yet.`);
      }

      if (!candidate.summary.trim()) {
        incompleteCandidateWarnings.push(`"${label}" has no summary yet.`);
      }

      if (candidate.relatedActions.length === 0 && candidate.relatedTrackingIds.length === 0) {
        missingReferenceWarnings.push(`"${label}" is not linked to any Tracking Record or Approved Action.`);
      }

      if (candidate.summary.trim() && candidate.relatedTrackingIds.length === 0) {
        unsupportedSummaryWarnings.push(
          `"${label}" has a summary but no Tracking Record reference to support it.`,
        );
      }

      if (candidate.receivedAt && candidate.receivedAt > today) {
        inconsistentDateWarnings.push(`"${label}" has a received date in the future.`);
      }
    });

    const seenSubjects = new Map<string, number>();
    for (const candidate of draft.candidates) {
      const key = candidate.subject.trim().toLowerCase();
      if (!key) {
        continue;
      }
      seenSubjects.set(key, (seenSubjects.get(key) ?? 0) + 1);
    }
    for (const [subject, count] of seenSubjects) {
      if (count > 1) {
        duplicateCandidateWarnings.push(`${count} Candidates share the subject "${subject}".`);
      }
    }

    if (!draft.title.trim()) {
      clarityWarnings.push("Title is empty — Official Responses should be clearly labeled.");
    }

    if (!draft.summary.trim()) {
      clarityWarnings.push("Summary is empty — restate the Tracking Package's outcome.");
    }
  }

  for (const check of snapshot.consistencyChecks) {
    if (check.status === "warning") {
      clarityWarnings.push(check.detail);
    }
  }

  const sourcesUsedSummary = [
    snapshot.trackingPackageReference ? `Tracking Package "${snapshot.trackingPackageReference.title}"` : null,
    `${snapshot.trackingRecords.length} Tracking Record(s)`,
    `${snapshot.activeAllyCount} Active Ally(ies)`,
  ]
    .filter(Boolean)
    .join(" · ");

  return {
    sourcesUsedSummary: sourcesUsedSummary || "No Official Response Sources available yet.",
    missingTrackingPackageWarnings,
    incompleteCandidateWarnings,
    duplicateCandidateWarnings,
    missingInstitutionWarnings,
    missingReferenceWarnings,
    unsupportedSummaryWarnings,
    inconsistentDateWarnings,
    clarityWarnings,
  };
}
