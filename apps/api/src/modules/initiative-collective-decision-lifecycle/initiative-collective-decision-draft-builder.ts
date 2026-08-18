import type { InitiativeCollectiveDecisionIntelligenceSnapshot } from "@hu/types";

/**
 * Initiative Lifecycle — Part H, Section 3 (Decision Result Builder).
 * Deterministic generation of structured Collective Decision draft fields
 * from the Intelligence Snapshot. Never invents facts; never publishes.
 */
export interface GeneratedCollectiveDecisionDraftContent {
  readonly title: string;
  readonly decisionSummary: string;
  readonly approvedActions: readonly string[];
  readonly rejectedAlternatives: readonly string[];
  readonly responsibleRoles: readonly string[];
  readonly implementationPriorities: readonly string[];
  readonly implementationTimeline: string;
  readonly decisionRationale: string;
  readonly decisionRisks: readonly string[];
  readonly successCriteria: readonly string[];
  readonly requiredResources: readonly string[];
  readonly supportingReferences: readonly string[];
}

export interface CollectiveDecisionDraftProvider {
  readonly providerId: string;
  generateDraftContent(
    snapshot: InitiativeCollectiveDecisionIntelligenceSnapshot,
  ): Promise<GeneratedCollectiveDecisionDraftContent>;
}

function uniqueNonEmpty(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const trimmed = value.trim();
    if (!trimmed || seen.has(trimmed)) {
      continue;
    }
    seen.add(trimmed);
    result.push(trimmed);
  }

  return result;
}

function generateDeterministicCollectiveDecisionDraftContent(
  snapshot: InitiativeCollectiveDecisionIntelligenceSnapshot,
): GeneratedCollectiveDecisionDraftContent {
  const session = snapshot.decisionSessionReference;

  const title = snapshot.initiativeTitle
    ? `Collective Decision: ${snapshot.initiativeTitle}`
    : "Collective Decision";

  const decisionSummary = session
    ? [session.decisionQuestion, session.purpose].filter((part) => part.trim()).join(" — ")
    : snapshot.initiativeTitle
      ? `Public Choice decision for "${snapshot.initiativeTitle}".`
      : "Public Choice collective decision.";

  const approvedActions =
    session && session.options.length > 0
      ? uniqueNonEmpty([session.options[0]!, ...session.objectives])
      : uniqueNonEmpty([
          snapshot.initiativeTitle
            ? `Advance "${snapshot.initiativeTitle}" as the Public Choice outcome`
            : "Advance the Public Choice outcome",
          ...(session?.objectives ?? []),
        ]);

  const rejectedAlternatives = session ? uniqueNonEmpty(session.options.slice(1)) : [];

  const responsibleRoles = session ? uniqueNonEmpty(session.suggestedResponsibleRoles) : [];

  const implementationPriorities = session ? uniqueNonEmpty(session.objectives) : [];

  const implementationTimeline = session?.suggestedTimeline ?? "";

  const decisionRationale = session
    ? session.supportingArguments.join(" ")
    : snapshot.initiativeTitle
      ? `Author-published Public Choice outcome for "${snapshot.initiativeTitle}" without a Decision Session substrate.`
      : "Author-published Public Choice outcome without a Decision Session substrate.";

  const decisionRisks = session ? uniqueNonEmpty(session.risks) : [];

  const successCriteria = session
    ? uniqueNonEmpty(session.objectives.map((objective) => `Success when: ${objective}`))
    : [];

  const requiredResources = session ? uniqueNonEmpty(session.requiredResources) : [];

  const supportingReferences = uniqueNonEmpty([
    snapshot.petitionReference?.petitionId ?? "",
    snapshot.revisionReference?.revisionId ?? "",
    snapshot.analysisReference?.analysisId ?? "",
    ...snapshot.proposalReferences.map((proposal) => proposal.proposalId),
    session?.sessionId ?? "",
  ]);

  return {
    title,
    decisionSummary,
    approvedActions,
    rejectedAlternatives,
    responsibleRoles,
    implementationPriorities,
    implementationTimeline,
    decisionRationale,
    decisionRisks,
    successCriteria,
    requiredResources,
    supportingReferences,
  };
}

export const deterministicCollectiveDecisionDraftProvider: CollectiveDecisionDraftProvider = {
  providerId: "deterministic-v1",
  generateDraftContent: (snapshot) =>
    Promise.resolve(generateDeterministicCollectiveDecisionDraftContent(snapshot)),
};

export function resolveCollectiveDecisionDraftProvider(): CollectiveDecisionDraftProvider {
  return deterministicCollectiveDecisionDraftProvider;
}

export async function generateCollectiveDecisionDraftContent(
  snapshot: InitiativeCollectiveDecisionIntelligenceSnapshot,
): Promise<GeneratedCollectiveDecisionDraftContent> {
  const provider = resolveCollectiveDecisionDraftProvider();
  return provider.generateDraftContent(snapshot);
}
