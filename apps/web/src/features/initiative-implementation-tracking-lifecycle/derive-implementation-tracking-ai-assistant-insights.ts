import type {
  InitiativeImplementationTrackingIntelligenceSnapshot,
  InitiativeImplementationTrackingLifecycleDraft,
} from "@hu/types";

export interface ImplementationTrackingAiAssistantInsights {
  sourcesUsedSummary: string;
  missingCommitmentPackageWarnings: string[];
  overdueWarnings: string[];
  blockedWarnings: string[];
  missingEvidenceWarnings: string[];
  stalledWarnings: string[];
  timelineConflictWarnings: string[];
  clarityWarnings: string[];
}

const TODAY_ISO = () => new Date().toISOString().slice(0, 10);

/**
 * Initiative Lifecycle — Part J, Section 4. Advisory-only derived
 * insights — never itself changes a Candidate's progress, status, or
 * dates. Every field it inspects mirrors what the Author (in the
 * Editor) or the responsible Participant (in the Progress Inbox) can
 * already see and edit directly.
 */
export function deriveImplementationTrackingAiAssistantInsights(
  snapshot: InitiativeImplementationTrackingIntelligenceSnapshot,
  draft: InitiativeImplementationTrackingLifecycleDraft | null,
): ImplementationTrackingAiAssistantInsights {
  const missingCommitmentPackageWarnings: string[] = [];
  const overdueWarnings: string[] = [];
  const blockedWarnings: string[] = [];
  const missingEvidenceWarnings: string[] = [];
  const stalledWarnings: string[] = [];
  const timelineConflictWarnings: string[] = [];
  const clarityWarnings: string[] = [];

  if (!snapshot.packageReference) {
    missingCommitmentPackageWarnings.push(
      "No Commitment Package yet — Generate still works from Collective Decision / Initiative scope.",
    );
  }

  if (snapshot.acceptedCommitments.length === 0) {
    missingCommitmentPackageWarnings.push(
      "No Accepted Commitments — milestones stay Unassigned until Author assigns responsible parties. AI never auto-assigns Participants.",
    );
  }

  if (draft) {
    if (draft.candidates.length === 0) {
      missingCommitmentPackageWarnings.push(
        "No Tracking milestones yet — generate a draft from Decision / Commitments / Initiative scope.",
      );
    }

    const today = TODAY_ISO();

    const overdue = draft.candidates.filter(
      (candidate) =>
        candidate.targetDate &&
        candidate.targetDate < today &&
        candidate.currentStatus !== "Completed" &&
        candidate.progress < 100,
    );
    if (overdue.length > 0) {
      overdueWarnings.push(`${overdue.length} milestone(s) are past their target date — review dates.`);
    }

    const blocked = draft.candidates.filter((candidate) => candidate.obstacles.length > 0);
    if (blocked.length > 0) {
      blockedWarnings.push(`${blocked.length} milestone(s) list unresolved risks/obstacles.`);
    }

    const missingEvidence = draft.candidates.filter(
      (candidate) => candidate.progress >= 100 && candidate.evidenceReferences.length === 0,
    );
    if (missingEvidence.length > 0) {
      missingEvidenceWarnings.push(
        `${missingEvidence.length} milestone(s) report 100% progress with no evidence yet.`,
      );
    }

    const stalled = draft.candidates.filter(
      (candidate) => candidate.progress === 0 && candidate.currentStatus === "Preparation",
    );
    if (stalled.length > 0) {
      stalledWarnings.push(`${stalled.length} milestone(s) have not been started yet.`);
    }

    const missingTargetDate = draft.candidates.filter((candidate) => !candidate.targetDate);
    if (missingTargetDate.length > 0) {
      timelineConflictWarnings.push(
        `${missingTargetDate.length} milestone(s) have no target date — set dates carefully; AI never finalizes them.`,
      );
    }

    const unassigned = draft.candidates.filter((candidate) => !candidate.responsibleParticipantId.trim());
    if (unassigned.length > 0) {
      clarityWarnings.push(
        `${unassigned.length} milestone(s) are Unassigned — assign only known responsible parties.`,
      );
    }

    if (!draft.title.trim()) {
      clarityWarnings.push("Title is empty — Implementation Tracking should be clearly labeled.");
    }

    if (!draft.summary.trim()) {
      clarityWarnings.push("Summary is empty — restate the implementation intent.");
    }
  }

  for (const check of snapshot.consistencyChecks) {
    if (check.status === "warning") {
      clarityWarnings.push(check.detail);
    }
  }

  const sourcesUsedSummary = [
    snapshot.packageReference ? `Commitment Package "${snapshot.packageReference.title}"` : null,
    `${snapshot.acceptedCommitments.length} Accepted Commitment(s)`,
    `${snapshot.decisionApprovedActions.length} Decision action(s)`,
    `${snapshot.activeAllyCount} Active Ally(ies)`,
  ]
    .filter(Boolean)
    .join(" · ");

  return {
    sourcesUsedSummary: sourcesUsedSummary || "Initiative scope available for automatic plan generation.",
    missingCommitmentPackageWarnings,
    overdueWarnings,
    blockedWarnings,
    missingEvidenceWarnings,
    stalledWarnings,
    timelineConflictWarnings,
    clarityWarnings,
  };
}
