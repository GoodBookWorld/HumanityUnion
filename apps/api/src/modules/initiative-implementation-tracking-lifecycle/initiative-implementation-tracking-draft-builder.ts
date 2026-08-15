import type {
  InitiativeImplementationTrackingCandidate,
  InitiativeImplementationTrackingIntelligenceSnapshot,
} from "@hu/types";

/**
 * Initiative Lifecycle — Part J, Section 3 (Tracking Candidate Builder).
 * Deterministic generation of one Tracking Candidate per Accepted
 * Commitment from the published Commitment Package (Part I). Never
 * invents Commitments beyond the snapshot's own `acceptedCommitments`
 * list; never publishes.
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

const DEFAULT_CURRENT_STATUS = "Preparation";

function generateDeterministicImplementationTrackingDraftContent(
  snapshot: InitiativeImplementationTrackingIntelligenceSnapshot,
): GeneratedImplementationTrackingDraftContent {
  const packageReference = snapshot.packageReference;

  const title = snapshot.initiativeTitle
    ? `Implementation Tracking: ${snapshot.initiativeTitle}`
    : "Implementation Tracking";

  const summary = packageReference?.summary ?? "";

  if (!packageReference || snapshot.acceptedCommitments.length === 0) {
    return { title, summary, packageId: null, candidates: [] };
  }

  const candidates: InitiativeImplementationTrackingCandidate[] = snapshot.acceptedCommitments.map(
    (commitment, index) => ({
      candidateId: `tracking-candidate-${index}`,
      commitmentId: commitment.commitmentId,
      approvedAction: commitment.approvedAction,
      responsibleParticipantId: commitment.participantId,
      currentStatus: DEFAULT_CURRENT_STATUS,
      progress: 0,
      targetDate: commitment.expectedCompletionDate,
      startedDate: null,
      completedDate: null,
      dependencies: [],
      obstacles: [...commitment.relatedRisks],
      evidenceReferences: [],
      notes: "",
    }),
  );

  return {
    title,
    summary,
    packageId: packageReference.packageId,
    candidates,
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
