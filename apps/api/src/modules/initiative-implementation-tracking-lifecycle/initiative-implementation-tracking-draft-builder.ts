import type {
  InitiativeImplementationTrackingCandidate,
  InitiativeImplementationTrackingIntelligenceSnapshot,
} from "@hu/types";

/**
 * Initiative Lifecycle — Part J, Section 3 (Tracking Candidate Builder).
 *
 * Deterministic plan generation:
 * - Accepted Commitments → one milestone per accepted commitment (assignee known)
 * - Zero accepted → milestones from Collective Decision approved actions and/or
 *   Initiative scope, with Unassigned ownership
 *
 * Never invents volunteers. Never publishes.
 */
export interface GeneratedImplementationTrackingDraftContent {
  readonly title: string;
  readonly summary: string;
  readonly packageId: string | null;
  readonly candidates: readonly InitiativeImplementationTrackingCandidate[];
}

export interface ImplementationTrackingDraftProvider {
  readonly providerId: string;
  generateDraftContent(
    snapshot: InitiativeImplementationTrackingIntelligenceSnapshot,
  ): Promise<GeneratedImplementationTrackingDraftContent>;
}

export const UNASSIGNED_RESPONSIBLE_LABEL = "Unassigned";
const DEFAULT_CURRENT_STATUS = "Preparation";

function buildCandidate(input: {
  index: number;
  commitmentId: string;
  title: string;
  description: string;
  responsibleParticipantId: string;
  targetDate: string | null;
  obstacles: readonly string[];
  notes: string;
}): InitiativeImplementationTrackingCandidate {
  return {
    candidateId: `tracking-candidate-${input.index}`,
    commitmentId: input.commitmentId,
    title: input.title,
    description: input.description,
    approvedAction: input.title,
    responsibleParticipantId: input.responsibleParticipantId,
    currentStatus: DEFAULT_CURRENT_STATUS,
    progress: 0,
    plannedStartDate: null,
    targetDate: input.targetDate,
    startedDate: null,
    completedDate: null,
    dependencies: [],
    obstacles: [...input.obstacles],
    evidenceReferences: [],
    notes: input.notes,
  };
}

function generateDeterministicImplementationTrackingDraftContent(
  snapshot: InitiativeImplementationTrackingIntelligenceSnapshot,
): GeneratedImplementationTrackingDraftContent {
  const packageReference = snapshot.packageReference;

  const title = snapshot.initiativeTitle
    ? `Implementation Tracking: ${snapshot.initiativeTitle}`
    : "Implementation Tracking";

  const summary =
    packageReference?.summary?.trim() ||
    (snapshot.initiativeDescription
      ? `Implementation plan for ${snapshot.initiativeTitle || "this Initiative"}.`
      : "");

  if (snapshot.acceptedCommitments.length > 0) {
    const candidates = snapshot.acceptedCommitments.map((commitment, index) =>
      buildCandidate({
        index,
        commitmentId: commitment.commitmentId,
        title: commitment.approvedAction,
        description: commitment.commitmentSummary || commitment.approvedAction,
        responsibleParticipantId: commitment.participantId ?? "",
        targetDate: commitment.expectedCompletionDate,
        obstacles: commitment.relatedRisks,
        notes: commitment.suggestedResponsibleRole
          ? `Suggested role: ${commitment.suggestedResponsibleRole}`
          : "",
      }),
    );

    return {
      title,
      summary,
      packageId: packageReference?.packageId ?? null,
      candidates,
    };
  }

  // Zero accepted commitments — still generate an editable plan.
  const decisionActions = snapshot.decisionApprovedActions.filter((action) => action.trim().length > 0);

  if (decisionActions.length > 0) {
    const candidates = decisionActions.map((action, index) =>
      buildCandidate({
        index,
        commitmentId: "",
        title: action.trim(),
        description: `Approved Collective Decision action pending assignment. ${UNASSIGNED_RESPONSIBLE_LABEL} until a responsible participant is confirmed.`,
        responsibleParticipantId: "",
        targetDate: null,
        obstacles: [],
        notes: "To be determined — no accepted Implementation Commitment yet.",
      }),
    );

    return {
      title,
      summary:
        summary ||
        "Automatic plan from Collective Decision approved actions. Assignees are Unassigned until commitments are accepted.",
      packageId: packageReference?.packageId ?? null,
      candidates,
    };
  }

  const scopeTitle = snapshot.initiativeTitle.trim()
    ? `Implement: ${snapshot.initiativeTitle.trim()}`
    : "Implement Initiative scope";

  return {
    title,
    summary:
      summary ||
      "Automatic implementation plan generated without accepted commitments. Assignees are Unassigned / To be determined.",
    packageId: packageReference?.packageId ?? null,
    candidates: [
      buildCandidate({
        index: 0,
        commitmentId: "",
        title: scopeTitle,
        description:
          snapshot.initiativeDescription.trim() ||
          "Carry out the Initiative scope. Assignees and dates are To be determined.",
        responsibleParticipantId: "",
        targetDate: null,
        obstacles: [],
        notes: "To be determined — zero accepted Implementation Commitments.",
      }),
    ],
  };
}

export const deterministicImplementationTrackingDraftProvider: ImplementationTrackingDraftProvider = {
  providerId: "deterministic-v1",
  generateDraftContent: (snapshot) =>
    Promise.resolve(generateDeterministicImplementationTrackingDraftContent(snapshot)),
};

export function resolveImplementationTrackingDraftProvider(): ImplementationTrackingDraftProvider {
  return deterministicImplementationTrackingDraftProvider;
}

export async function generateImplementationTrackingDraftContent(
  snapshot: InitiativeImplementationTrackingIntelligenceSnapshot,
): Promise<GeneratedImplementationTrackingDraftContent> {
  const provider = resolveImplementationTrackingDraftProvider();
  return provider.generateDraftContent(snapshot);
}
