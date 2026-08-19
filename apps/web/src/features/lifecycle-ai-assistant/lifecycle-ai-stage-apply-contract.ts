import type { InitiativeLifecycleProfile, InitiativeLifecycleStageId } from "@hu/types";

/**
 * Lifecycle Staging Fix 03B — one shared Apply field contract per Author stage.
 * Editors reuse these keys; forbidden keys are never writable via AI Apply.
 */

export const PUBLIC_CHOICE_AI_APPLY_STAGE_IDS = [
  "collective_decision",
  "archive",
] as const satisfies readonly InitiativeLifecycleStageId[];

export type LifecycleAiApplyStageId =
  | "analysis"
  | "proposal"
  | "petition"
  | "decision_session"
  | "collective_decision"
  | "commitment"
  | "tracking"
  | "official_response"
  | "public_impact"
  | "archive";

export interface LifecycleAiStageApplyContract {
  readonly stageId: LifecycleAiApplyStageId;
  /** Flat string fields the Author form may receive via Apply. */
  readonly knownKeys: readonly string[];
  /** Never written by Apply (votes, assignees, historical bodies, etc.). */
  readonly forbiddenKeys: readonly string[];
  /** Whole-document advisory without section ids lands here only as last resort. */
  readonly fallbackKey: string;
  /** Package-level keys for candidate-collection stages. */
  readonly packageKeys?: readonly string[];
  /** Per-candidate keys (first candidate receives whole-doc candidate fields). */
  readonly candidateKeys?: readonly string[];
}

const CONTRACTS: Record<LifecycleAiApplyStageId, LifecycleAiStageApplyContract> = {
  analysis: {
    stageId: "analysis",
    knownKeys: [
      "title",
      "summary",
      "supportingEvidence",
      "risks",
      "openQuestions",
      "suggestedImprovements",
      "references",
    ],
    forbiddenKeys: [],
    fallbackKey: "summary",
  },
  proposal: {
    stageId: "proposal",
    knownKeys: [
      "title",
      "summary",
      "description",
      "reason",
      "expectedImprovement",
      "supportingSources",
      "relatedDiscussionReferences",
    ],
    forbiddenKeys: ["proposalId", "status", "sourceCommentIds", "groupId"],
    fallbackKey: "summary",
  },
  petition: {
    stageId: "petition",
    knownKeys: [
      "title",
      "publicSummary",
      "requestStatement",
      "expectedOutcome",
      "supportingContext",
      "keyArguments",
    ],
    forbiddenKeys: ["draftId", "revisionId", "analysisId", "proposalIds"],
    fallbackKey: "publicSummary",
  },
  decision_session: {
    stageId: "decision_session",
    knownKeys: [
      "title",
      "decisionQuestion",
      "decisionContext",
      "objectives",
      "options",
      "supportingArguments",
      "risks",
      "dependencies",
      "requiredResources",
      "suggestedTimeline",
      "suggestedParticipants",
      "suggestedResponsibleRoles",
      "unresolvedQuestions",
    ],
    forbiddenKeys: ["participantSignatures", "memberSignatures", "visitorSignals"],
    fallbackKey: "decisionContext",
  },
  collective_decision: {
    stageId: "collective_decision",
    knownKeys: [
      "title",
      "decisionSummary",
      "approvedActions",
      "rejectedAlternatives",
      "responsibleRoles",
      "implementationPriorities",
      "implementationTimeline",
      "decisionRationale",
      "decisionRisks",
      "successCriteria",
      "requiredResources",
      "supportingReferences",
    ],
    forbiddenKeys: [
      "votingOutcome",
      "votingOutcomeSummary",
      "participantSignatures",
      "memberSignatures",
      "voteTotals",
    ],
    fallbackKey: "decisionSummary",
  },
  commitment: {
    stageId: "commitment",
    knownKeys: [
      "title",
      "summary",
      "description",
      "suggestedResponsibleRole",
      "suggestedTimeline",
      "priority",
      "requiredResources",
      "relatedRisks",
      "references",
    ],
    forbiddenKeys: ["proposedParticipantId", "candidateId", "approvedAction"],
    fallbackKey: "summary",
    packageKeys: ["title", "summary"],
    candidateKeys: [
      "description",
      "suggestedResponsibleRole",
      "suggestedTimeline",
      "priority",
      "requiredResources",
      "relatedRisks",
      "references",
    ],
  },
  tracking: {
    stageId: "tracking",
    knownKeys: [
      "title",
      "summary",
      "milestoneTitle",
      "description",
      "currentStatus",
      "progress",
      "plannedStartDate",
      "targetDate",
      "dependencies",
      "obstacles",
      "evidenceReferences",
      "notes",
    ],
    forbiddenKeys: ["responsibleParticipantId", "candidateId", "commitmentId"],
    fallbackKey: "summary",
    packageKeys: ["title", "summary"],
    candidateKeys: [
      "milestoneTitle",
      "description",
      "currentStatus",
      "progress",
      "plannedStartDate",
      "targetDate",
      "dependencies",
      "obstacles",
      "evidenceReferences",
      "notes",
    ],
  },
  official_response: {
    stageId: "official_response",
    knownKeys: [
      "title",
      "summary",
      "noResponseNote",
      "institution",
      "organization",
      "subject",
      "responseSummary",
      "notes",
      "links",
    ],
    forbiddenKeys: [
      "documentIds",
      "verificationStatus",
      "outcomeKind",
      "candidateId",
      "officialBody",
    ],
    fallbackKey: "summary",
    packageKeys: ["title", "summary", "noResponseNote"],
    candidateKeys: ["institution", "organization", "subject", "responseSummary", "notes", "links"],
  },
  public_impact: {
    stageId: "public_impact",
    knownKeys: [
      "title",
      "executive_summary",
      "objectives",
      "implemented_actions",
      "completed_commitments",
      "implementation_progress",
      "official_responses",
      "community_participation",
      "outstanding_issues",
      "lessons_learned",
      "evidence",
      "impact_references",
    ],
    forbiddenKeys: [],
    fallbackKey: "executive_summary",
  },
  archive: {
    stageId: "archive",
    knownKeys: ["finalArchiveTitle", "finalSummary", "lessonsLearned", "knowledgeContribution"],
    forbiddenKeys: ["sections", "timeline", "completeness", "participationStatistics"],
    fallbackKey: "finalSummary",
  },
};

export function getLifecycleAiStageApplyContract(
  stageId: string,
): LifecycleAiStageApplyContract | null {
  if (stageId in CONTRACTS) {
    return CONTRACTS[stageId as LifecycleAiApplyStageId];
  }
  return null;
}

export function isLifecycleAiApplyStageAllowedForProfile(
  stageId: string,
  profile: InitiativeLifecycleProfile | string | null | undefined,
): boolean {
  const contract = getLifecycleAiStageApplyContract(stageId);
  if (!contract) {
    return false;
  }

  if (profile === "PUBLIC_CHOICE") {
    return (PUBLIC_CHOICE_AI_APPLY_STAGE_IDS as readonly string[]).includes(stageId);
  }

  return true;
}

export function formatKnownSectionIdsForPrompt(stageId: string): string | null {
  const contract = getLifecycleAiStageApplyContract(stageId);
  if (!contract) {
    return null;
  }
  return contract.knownKeys.join(", ");
}
