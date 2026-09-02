import type { InitiativeDecisionSessionIntelligenceSnapshot } from "@hu/types";

import { formatDecisionSessionUnresolvedQuestionFromCheck } from "./initiative-decision-session-unresolved-question.js";

/**
 * Initiative Lifecycle — Part G, Section 3 (Decision Intelligence Builder).
 * Deterministic generation of structured Decision Session draft fields from
 * the Intelligence Snapshot. Never invents facts; never publishes.
 */
export interface GeneratedDecisionSessionDraftContent {
  readonly title: string;
  readonly decisionQuestion: string;
  readonly decisionContext: string;
  readonly objectives: readonly string[];
  readonly options: readonly string[];
  readonly supportingArguments: readonly string[];
  readonly risks: readonly string[];
  readonly dependencies: readonly string[];
  readonly requiredResources: readonly string[];
  readonly suggestedTimeline: string;
  readonly suggestedParticipants: readonly string[];
  readonly suggestedResponsibleRoles: readonly string[];
  readonly unresolvedQuestions: readonly string[];
  readonly purpose: string;
}

export interface DecisionSessionDraftProvider {
  readonly providerId: string;
  generateDraftContent(
    snapshot: InitiativeDecisionSessionIntelligenceSnapshot,
  ): Promise<GeneratedDecisionSessionDraftContent>;
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

function generateDeterministicDecisionSessionDraftContent(
  snapshot: InitiativeDecisionSessionIntelligenceSnapshot,
): GeneratedDecisionSessionDraftContent {
  const title = snapshot.initiativeTitle
    ? `Decision Session: ${snapshot.initiativeTitle}`
    : "Decision Session";

  const decisionQuestion = snapshot.petitionReference
    ? `Should the community proceed with the request in Petition "${snapshot.petitionReference.title}"?`
    : snapshot.initiativeTitle
      ? `Should the community proceed with "${snapshot.initiativeTitle}"?`
      : "What decision should the community take on this Initiative?";

  const contextParts = [
    snapshot.petitionReference
      ? `Published Petition: ${snapshot.petitionReference.summary || snapshot.petitionReference.title}`
      : null,
    snapshot.revisionReference
      ? `Based on Revision v${snapshot.revisionReference.version}: ${snapshot.revisionReference.revisionSummary}`
      : null,
    snapshot.analysisReference
      ? `Collaborative Analysis: ${snapshot.analysisReference.summary}`
      : null,
  ].filter((entry): entry is string => Boolean(entry));

  const objectives = uniqueNonEmpty([
    snapshot.petitionReference
      ? `Respond to the public request in "${snapshot.petitionReference.title}".`
      : "",
    snapshot.revisionReference
      ? `Evaluate adoption of Revision v${snapshot.revisionReference.version}.`
      : "",
    "Prepare a clear, implementable Collective Decision.",
  ]);

  const options = uniqueNonEmpty([
    "Approve and proceed to Collective Decision as prepared.",
    "Approve with modifications identified during this Decision Session.",
    "Decline and return for further Revision or Petition clarification.",
    ...snapshot.allyRecommendations
      .filter((recommendation) => recommendation.kind === "option")
      .map((recommendation) => recommendation.title),
  ]);

  const supportingArguments = uniqueNonEmpty([
    snapshot.petitionReference
      ? `Petition support — Participants: ${snapshot.petitionReference.participantSignatures}, Members: ${snapshot.petitionReference.memberSignatures}, Visitor signals: ${snapshot.petitionReference.visitorSignals}.`
      : "",
    ...snapshot.proposalReferences.map(
      (proposal) => `Improvement Proposal "${proposal.title}": ${proposal.summary}`,
    ),
    ...snapshot.allyRecommendations
      .filter((recommendation) => recommendation.kind === "general")
      .map((recommendation) => `${recommendation.title}: ${recommendation.body}`),
  ]);

  const risks = uniqueNonEmpty([
    ...snapshot.allyRecommendations
      .filter((recommendation) => recommendation.kind === "risk")
      .map((recommendation) => `${recommendation.title}: ${recommendation.body}`),
    snapshot.petitionReference && snapshot.petitionReference.participantSignatures === 0
      ? "Petition currently has no Participant signatures — public mandate may still be forming."
      : "",
    "Implementation feasibility and resource availability remain to be confirmed in Collective Decision.",
  ]);

  const dependencies = uniqueNonEmpty([
    snapshot.petitionReference ? `Published Petition ${snapshot.petitionReference.petitionId}` : "",
    snapshot.revisionReference
      ? `Published Revision v${snapshot.revisionReference.version}`
      : "",
    ...snapshot.proposalReferences.map((proposal) => `Proposal ${proposal.proposalId}`),
  ]);

  const requiredResources = uniqueNonEmpty([
    "Steward facilitation of the Collective Decision window",
    "Active Ally participation during Collective Decision",
    ...snapshot.allyRecommendations
      .filter((recommendation) => recommendation.kind === "implementation_concern")
      .map((recommendation) => recommendation.title),
  ]);

  const timelineRecommendation = snapshot.allyRecommendations.find(
    (recommendation) => recommendation.kind === "timeline",
  );
  const suggestedTimeline = timelineRecommendation
    ? timelineRecommendation.body
    : "Open Collective Decision shortly after this Decision Session is published; close after a defined participation window.";

  const suggestedParticipants = uniqueNonEmpty([
    "Initiative Author (Steward)",
    ...Array.from({ length: Math.min(snapshot.activeAllyCount, 5) }, (_, index) => `Active Ally ${index + 1}`),
    "Eligible Participants and Members for Collective Decision",
  ]);

  const roleRecommendations = snapshot.allyRecommendations.filter(
    (recommendation) => recommendation.kind === "role",
  );
  const suggestedResponsibleRoles = uniqueNonEmpty([
    "Steward — Decision Session Owner",
    "Active Allies — Advisory contributors",
    ...roleRecommendations.map((recommendation) => recommendation.title),
  ]);

  // 08E.9c: draft unresolvedQuestions from semantic checkId/params via an
  // API-owned canonical English adapter — not compatibility `detail`, and
  // not Web localization catalogs.
  const unresolvedQuestions = uniqueNonEmpty([
    ...snapshot.consistencyChecks
      .map((check) => formatDecisionSessionUnresolvedQuestionFromCheck(check) ?? "")
      .filter((question) => question.length > 0),
    snapshot.openComments.length > 0
      ? `${snapshot.openComments.length} open collaboration comment(s) may still contain unresolved concerns.`
      : "",
  ]);

  return {
    title,
    decisionQuestion,
    decisionContext: contextParts.join("\n\n"),
    objectives,
    options,
    supportingArguments,
    risks,
    dependencies,
    requiredResources,
    suggestedTimeline,
    suggestedParticipants,
    suggestedResponsibleRoles,
    unresolvedQuestions,
    purpose: snapshot.petitionReference
      ? `Prepare the Collective Decision based on Petition "${snapshot.petitionReference.title}".`
      : "Prepare the Collective Decision for this Initiative.",
  };
}

export const deterministicDecisionSessionDraftProvider: DecisionSessionDraftProvider = {
  providerId: "deterministic-v1",
  generateDraftContent: (snapshot) =>
    Promise.resolve(generateDeterministicDecisionSessionDraftContent(snapshot)),
};

export function resolveDecisionSessionDraftProvider(): DecisionSessionDraftProvider {
  return deterministicDecisionSessionDraftProvider;
}

export async function generateDecisionSessionDraftContent(
  snapshot: InitiativeDecisionSessionIntelligenceSnapshot,
): Promise<GeneratedDecisionSessionDraftContent> {
  const provider = resolveDecisionSessionDraftProvider();
  return provider.generateDraftContent(snapshot);
}
