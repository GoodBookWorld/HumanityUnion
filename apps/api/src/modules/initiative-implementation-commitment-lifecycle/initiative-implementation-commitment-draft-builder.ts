import type {
  InitiativeImplementationCommitmentCandidate,
  InitiativeImplementationCommitmentIntelligenceSnapshot,
} from "@hu/types";

/**
 * Initiative Lifecycle — Part I, Section 3 (Commitment Candidate Builder).
 * Deterministic generation of one Commitment Candidate per Approved Action
 * from the published Collective Decision. Never invents Actions beyond the
 * Collective Decision's own `approvedActions` list; never publishes.
 */
export interface GeneratedImplementationCommitmentDraftContent {
  readonly title: string;
  readonly summary: string;
  readonly decisionId: string | null;
  readonly candidates: readonly InitiativeImplementationCommitmentCandidate[];
}

export interface ImplementationCommitmentDraftProvider {
  readonly providerId: string;
  generateDraftContent(
    snapshot: InitiativeImplementationCommitmentIntelligenceSnapshot,
  ): Promise<GeneratedImplementationCommitmentDraftContent>;
}

const DEFAULT_RESPONSIBLE_ROLE = "Implementation contributor";
const DEFAULT_PRIORITY = "Normal";

function resolveResponsibleRole(roles: readonly string[], index: number): string {
  if (roles.length === 0) {
    return DEFAULT_RESPONSIBLE_ROLE;
  }

  return roles[index % roles.length] ?? DEFAULT_RESPONSIBLE_ROLE;
}

function resolvePriority(priorities: readonly string[], index: number): string {
  if (priorities.length === 0) {
    return DEFAULT_PRIORITY;
  }

  return priorities[index] ?? priorities[index % priorities.length] ?? DEFAULT_PRIORITY;
}

function generateDeterministicImplementationCommitmentDraftContent(
  snapshot: InitiativeImplementationCommitmentIntelligenceSnapshot,
): GeneratedImplementationCommitmentDraftContent {
  const decision = snapshot.decisionReference;

  const title = snapshot.initiativeTitle
    ? `Implementation Commitments: ${snapshot.initiativeTitle}`
    : "Implementation Commitments";

  const summary = decision?.decisionSummary ?? "";

  if (!decision) {
    return { title, summary, decisionId: null, candidates: [] };
  }

  const candidates: InitiativeImplementationCommitmentCandidate[] = decision.approvedActions.map(
    (action, index) => ({
      candidateId: `candidate-${index}`,
      approvedAction: action,
      description: `Implement: ${action}`,
      suggestedResponsibleRole: resolveResponsibleRole(decision.responsibleRoles, index),
      suggestedTimeline: decision.implementationTimeline,
      priority: resolvePriority(decision.implementationPriorities, index),
      requiredResources: [...decision.requiredResources],
      relatedRisks: [...decision.decisionRisks],
      references: [
        ...decision.supportingReferences,
        `Collective Decision ${decision.decisionId}`,
        `Action ${index + 1}`,
      ],
      proposedParticipantId: null,
      status: "draft",
    }),
  );

  return {
    title,
    summary,
    decisionId: decision.decisionId,
    candidates,
  };
}

export const deterministicImplementationCommitmentDraftProvider: ImplementationCommitmentDraftProvider =
  {
    providerId: "deterministic-v1",
    generateDraftContent: (snapshot) =>
      Promise.resolve(generateDeterministicImplementationCommitmentDraftContent(snapshot)),
  };

export function resolveImplementationCommitmentDraftProvider(): ImplementationCommitmentDraftProvider {
  return deterministicImplementationCommitmentDraftProvider;
}

export async function generateImplementationCommitmentDraftContent(
  snapshot: InitiativeImplementationCommitmentIntelligenceSnapshot,
): Promise<GeneratedImplementationCommitmentDraftContent> {
  const provider = resolveImplementationCommitmentDraftProvider();
  return provider.generateDraftContent(snapshot);
}
