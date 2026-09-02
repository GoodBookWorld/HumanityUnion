import type {
  InitiativeImplementationTrackingIntelligenceSnapshot,
  InitiativeImplementationTrackingLifecycleDraft,
} from "@hu/types";

import type { ImplementationTrackingSidebarAdvisory } from "../initiative-lifecycle-stage-workspace/sidebar-advisory-contract";

export interface ImplementationTrackingAiAssistantInsights {
  readonly sourcesSummary: ImplementationTrackingSidebarAdvisory;
  /**
   * Unused/unmounted package-bank warnings (INTERNAL_UNUSED presentation debt).
   * Kept as legacy English strings — do not migrate/localize until mounted.
   */
  readonly missingCommitmentPackageWarnings: readonly string[];
  readonly overdueWarnings: readonly ImplementationTrackingSidebarAdvisory[];
  readonly blockedWarnings: readonly ImplementationTrackingSidebarAdvisory[];
  readonly missingEvidenceWarnings: readonly ImplementationTrackingSidebarAdvisory[];
  readonly stalledWarnings: readonly ImplementationTrackingSidebarAdvisory[];
  readonly timelineConflictWarnings: readonly ImplementationTrackingSidebarAdvisory[];
  readonly clarityWarnings: readonly ImplementationTrackingSidebarAdvisory[];
  /** API opaque consistency warnings — detail/label stay raw. */
  readonly consistencyWarnings: InitiativeImplementationTrackingIntelligenceSnapshot["consistencyChecks"];
}

const TODAY_ISO = () => new Date().toISOString().slice(0, 10);

/**
 * Initiative Lifecycle — Part J, Section 4. Advisory-only derived
 * insights — never itself changes a Candidate's progress, status, or
 * dates. Every field it inspects mirrors what the Author (in the
 * Editor) or the responsible Participant (in the Progress Inbox) can
 * already see and edit directly.
 *
 * Pack 02G Task 08E.8e: Web-owned deterministic advisory meaning is encoded as
 * language-neutral descriptors. Date/overdue/stalled computations remain
 * derive-owned. API consistency-check detail remains opaque.
 * missingCommitmentPackageWarnings remains an unmounted legacy English bank.
 */
export function deriveImplementationTrackingAiAssistantInsights(
  snapshot: InitiativeImplementationTrackingIntelligenceSnapshot,
  draft: InitiativeImplementationTrackingLifecycleDraft | null,
): ImplementationTrackingAiAssistantInsights {
  const missingCommitmentPackageWarnings: string[] = [];
  const overdueWarnings: ImplementationTrackingSidebarAdvisory[] = [];
  const blockedWarnings: ImplementationTrackingSidebarAdvisory[] = [];
  const missingEvidenceWarnings: ImplementationTrackingSidebarAdvisory[] = [];
  const stalledWarnings: ImplementationTrackingSidebarAdvisory[] = [];
  const timelineConflictWarnings: ImplementationTrackingSidebarAdvisory[] = [];
  const clarityWarnings: ImplementationTrackingSidebarAdvisory[] = [];

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
      overdueWarnings.push({
        code: "implementation_tracking.overdue.count",
        severity: "warning",
        params: { count: overdue.length },
      });
    }

    const blocked = draft.candidates.filter((candidate) => candidate.obstacles.length > 0);
    if (blocked.length > 0) {
      blockedWarnings.push({
        code: "implementation_tracking.blocked.count",
        severity: "warning",
        params: { count: blocked.length },
      });
    }

    const missingEvidence = draft.candidates.filter(
      (candidate) => candidate.progress >= 100 && candidate.evidenceReferences.length === 0,
    );
    if (missingEvidence.length > 0) {
      missingEvidenceWarnings.push({
        code: "implementation_tracking.evidence.missing_at_complete",
        severity: "warning",
        params: { count: missingEvidence.length },
      });
    }

    const stalled = draft.candidates.filter(
      (candidate) => candidate.progress === 0 && candidate.currentStatus === "Preparation",
    );
    if (stalled.length > 0) {
      stalledWarnings.push({
        code: "implementation_tracking.stalled.not_started",
        severity: "warning",
        params: { count: stalled.length },
      });
    }

    const missingTargetDate = draft.candidates.filter((candidate) => !candidate.targetDate);
    if (missingTargetDate.length > 0) {
      timelineConflictWarnings.push({
        code: "implementation_tracking.timeline.missing_target_date",
        severity: "warning",
        params: { count: missingTargetDate.length },
      });
    }

    const unassigned = draft.candidates.filter((candidate) => !candidate.responsibleParticipantId.trim());
    if (unassigned.length > 0) {
      clarityWarnings.push({
        code: "implementation_tracking.clarity.unassigned",
        severity: "warning",
        params: { count: unassigned.length },
      });
    }

    if (!draft.title.trim()) {
      clarityWarnings.push({
        code: "implementation_tracking.clarity.title_empty",
        severity: "warning",
        civic: { implementationTrackingFieldIds: ["title"] },
      });
    }

    if (!draft.summary.trim()) {
      clarityWarnings.push({
        code: "implementation_tracking.clarity.summary_empty",
        severity: "warning",
        civic: { implementationTrackingFieldIds: ["summary"] },
      });
    }
  }

  const hasPackage = Boolean(snapshot.packageReference);
  const sourcesSummary: ImplementationTrackingSidebarAdvisory = {
    code: "implementation_tracking.sources.summary",
    severity: "info",
    params: {
      hasPackage: hasPackage ? 1 : 0,
      acceptedCommitmentCount: snapshot.acceptedCommitments.length,
      decisionActionCount: snapshot.decisionApprovedActions.length,
      activeAllyCount: snapshot.activeAllyCount,
    },
    civic: snapshot.packageReference ? { title: snapshot.packageReference.title } : undefined,
  };

  return {
    sourcesSummary,
    missingCommitmentPackageWarnings,
    overdueWarnings,
    blockedWarnings,
    missingEvidenceWarnings,
    stalledWarnings,
    timelineConflictWarnings,
    clarityWarnings,
    consistencyWarnings: snapshot.consistencyChecks.filter((check) => check.status === "warning"),
  };
}
