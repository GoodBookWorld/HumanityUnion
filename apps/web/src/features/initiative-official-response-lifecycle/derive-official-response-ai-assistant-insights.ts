import type {
  InitiativeOfficialResponseIntelligenceSnapshot,
  InitiativeOfficialResponseLifecycleDraft,
} from "@hu/types";

import type { OfficialResponseSidebarAdvisory } from "../initiative-lifecycle-stage-workspace/sidebar-advisory-contract";

export interface OfficialResponseAiAssistantInsights {
  readonly sourcesSummary: OfficialResponseSidebarAdvisory;
  /**
   * Unused/unmounted tracking-package bank (INTERNAL_UNUSED presentation debt).
   * Kept as legacy English strings — do not migrate/localize until mounted.
   */
  readonly missingTrackingPackageWarnings: readonly string[];
  readonly incompleteCandidateWarnings: readonly OfficialResponseSidebarAdvisory[];
  readonly duplicateCandidateWarnings: readonly OfficialResponseSidebarAdvisory[];
  readonly missingInstitutionWarnings: readonly OfficialResponseSidebarAdvisory[];
  readonly missingReferenceWarnings: readonly OfficialResponseSidebarAdvisory[];
  readonly unsupportedSummaryWarnings: readonly OfficialResponseSidebarAdvisory[];
  readonly inconsistentDateWarnings: readonly OfficialResponseSidebarAdvisory[];
  readonly clarityWarnings: readonly OfficialResponseSidebarAdvisory[];
  readonly advisoryNotes: readonly OfficialResponseSidebarAdvisory[];
  /** API opaque consistency warnings — detail/label stay raw. */
  readonly consistencyWarnings: InitiativeOfficialResponseIntelligenceSnapshot["consistencyChecks"];
}

const TODAY_ISO = () => new Date().toISOString().slice(0, 10);

/**
 * Initiative Lifecycle — Part K, Section 9. Advisory-only derived
 * insights — never itself changes a Candidate's institution, subject,
 * summary, or verification status, and never invents an institution/
 * organization name or a response that was not entered by the Author.
 * Every field it inspects mirrors what the Author can already see and
 * edit directly in the Editor. AI cannot publish or advance Lifecycle.
 *
 * Pack 02G Task 08E.8f: Web-owned deterministic advisory meaning is encoded as
 * language-neutral descriptors. Date comparisons remain derive-owned.
 * API consistency-check detail remains opaque.
 * missingTrackingPackageWarnings remains an unmounted legacy English bank.
 */
export function deriveOfficialResponseAiAssistantInsights(
  snapshot: InitiativeOfficialResponseIntelligenceSnapshot,
  draft: InitiativeOfficialResponseLifecycleDraft | null,
): OfficialResponseAiAssistantInsights {
  const missingTrackingPackageWarnings: string[] = [];
  const incompleteCandidateWarnings: OfficialResponseSidebarAdvisory[] = [];
  const duplicateCandidateWarnings: OfficialResponseSidebarAdvisory[] = [];
  const missingInstitutionWarnings: OfficialResponseSidebarAdvisory[] = [];
  const missingReferenceWarnings: OfficialResponseSidebarAdvisory[] = [];
  const unsupportedSummaryWarnings: OfficialResponseSidebarAdvisory[] = [];
  const inconsistentDateWarnings: OfficialResponseSidebarAdvisory[] = [];
  const clarityWarnings: OfficialResponseSidebarAdvisory[] = [];
  const advisoryNotes: OfficialResponseSidebarAdvisory[] = [];

  if (!snapshot.trackingPackageReference) {
    missingTrackingPackageWarnings.push(
      "Publish an Implementation Tracking Package before generating Official Responses.",
    );
  }

  if (draft) {
    const isNoResponse = draft.outcomeKind === "no_official_response_received";

    if (isNoResponse) {
      advisoryNotes.push({
        code: "official_response.note.no_response_outcome",
        severity: "info",
      });
      if (!draft.noResponseDetail?.note?.trim()) {
        clarityWarnings.push({
          code: "official_response.clarity.no_response_note",
          severity: "warning",
        });
      }
    } else if (draft.candidates.length === 0) {
      incompleteCandidateWarnings.push({
        code: "official_response.incomplete.no_candidates",
        severity: "warning",
      });
    }

    const today = TODAY_ISO();

    if (!isNoResponse) {
      draft.candidates.forEach((candidate, index) => {
        const subject = candidate.subject.trim();
        const candidateIndex = index + 1;

        if (!candidate.institution.trim() && !candidate.organization.trim()) {
          missingInstitutionWarnings.push(
            subject
              ? {
                  code: "official_response.institution.missing",
                  severity: "warning",
                  civic: { subject },
                }
              : {
                  code: "official_response.institution.missing_untitled",
                  severity: "warning",
                  params: { index: candidateIndex },
                },
          );
        }

        if (!candidate.summary.trim()) {
          incompleteCandidateWarnings.push(
            subject
              ? {
                  code: "official_response.incomplete.summary_empty",
                  severity: "warning",
                  civic: { subject },
                }
              : {
                  code: "official_response.incomplete.summary_empty_untitled",
                  severity: "warning",
                  params: { index: candidateIndex },
                },
          );
        }

        if (candidate.relatedActions.length === 0 && candidate.relatedTrackingIds.length === 0) {
          missingReferenceWarnings.push(
            subject
              ? {
                  code: "official_response.reference.unlinked",
                  severity: "warning",
                  civic: { subject },
                }
              : {
                  code: "official_response.reference.unlinked_untitled",
                  severity: "warning",
                  params: { index: candidateIndex },
                },
          );
        }

        if (candidate.summary.trim() && candidate.relatedTrackingIds.length === 0) {
          unsupportedSummaryWarnings.push(
            subject
              ? {
                  code: "official_response.summary.unsupported",
                  severity: "warning",
                  civic: { subject },
                }
              : {
                  code: "official_response.summary.unsupported_untitled",
                  severity: "warning",
                  params: { index: candidateIndex },
                },
          );
        }

        if (candidate.documentIds.length === 0 && candidate.links.length === 0) {
          missingReferenceWarnings.push(
            subject
              ? {
                  code: "official_response.reference.no_evidence",
                  severity: "warning",
                  civic: { subject },
                }
              : {
                  code: "official_response.reference.no_evidence_untitled",
                  severity: "warning",
                  params: { index: candidateIndex },
                },
          );
        }

        if (candidate.receivedAt && candidate.receivedAt > today) {
          inconsistentDateWarnings.push(
            subject
              ? {
                  code: "official_response.date.future_received",
                  severity: "warning",
                  civic: { subject },
                }
              : {
                  code: "official_response.date.future_received_untitled",
                  severity: "warning",
                  params: { index: candidateIndex },
                },
          );
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
          duplicateCandidateWarnings.push({
            code: "official_response.duplicate.subject",
            severity: "warning",
            params: { count },
            civic: { subject },
          });
        }
      }
    }

    if (!draft.title.trim()) {
      clarityWarnings.push({
        code: "official_response.clarity.title_empty",
        severity: "warning",
        civic: { officialResponseFieldIds: ["title"] },
      });
    }

    if (!draft.summary.trim() && !isNoResponse) {
      clarityWarnings.push({
        code: "official_response.clarity.summary_empty",
        severity: "warning",
        civic: { officialResponseFieldIds: ["summary"] },
      });
    }
  }

  advisoryNotes.push({
    code: "official_response.note.advisory_only",
    severity: "info",
  });

  const hasTracking = Boolean(snapshot.trackingPackageReference);
  const sourcesSummary: OfficialResponseSidebarAdvisory =
    hasTracking || snapshot.trackingRecords.length >= 0
      ? {
          code: "official_response.sources.summary",
          severity: "info",
          params: {
            hasTracking: hasTracking ? 1 : 0,
            trackingRecordCount: snapshot.trackingRecords.length,
            activeAllyCount: snapshot.activeAllyCount,
          },
          civic: snapshot.trackingPackageReference
            ? { title: snapshot.trackingPackageReference.title }
            : undefined,
        }
      : {
          code: "official_response.sources.empty",
          severity: "info",
        };

  return {
    sourcesSummary,
    missingTrackingPackageWarnings,
    incompleteCandidateWarnings,
    duplicateCandidateWarnings,
    missingInstitutionWarnings,
    missingReferenceWarnings,
    unsupportedSummaryWarnings,
    inconsistentDateWarnings,
    clarityWarnings,
    advisoryNotes,
    consistencyWarnings: snapshot.consistencyChecks.filter((check) => check.status === "warning"),
  };
}
