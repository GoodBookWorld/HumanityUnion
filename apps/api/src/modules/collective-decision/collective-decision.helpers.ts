import type {
  CollectiveDecision,
  CollectiveDecisionStatus,
  DecisionResult,
  DecisionStatistics,
  EligibilityRules,
  Member,
  Outcome,
  ParticipantDecision,
  VerificationLevel,
} from "@hu/types";

import { getMemberById } from "../member/member.store.js";

const ALLOWED_TRANSITIONS: Record<CollectiveDecisionStatus, CollectiveDecisionStatus[]> = {
  Draft: ["Scheduled", "Cancelled"],
  Scheduled: ["Active", "Cancelled"],
  Active: ["Closed"],
  Closed: ["Completed"],
  Completed: ["Archived"],
  Archived: [],
  Cancelled: [],
};

const VERIFICATION_LEVEL_RANK: Record<VerificationLevel, number> = {
  none: 0,
  email: 1,
  identity: 2,
  institution: 3,
  trusted: 4,
};

export function cloneCollectiveDecision(decision: CollectiveDecision): CollectiveDecision {
  return structuredClone(decision);
}

export function assertValidTransition(
  currentStatus: CollectiveDecisionStatus,
  nextStatus: CollectiveDecisionStatus,
): void {
  const allowed = ALLOWED_TRANSITIONS[currentStatus];

  if (!allowed.includes(nextStatus)) {
    throw new Error(`Transition from "${currentStatus}" to "${nextStatus}" is not allowed.`);
  }
}

export function verificationLevelMeets(
  required: VerificationLevel,
  actual: VerificationLevel,
): boolean {
  return VERIFICATION_LEVEL_RANK[actual] >= VERIFICATION_LEVEL_RANK[required];
}

export function isMemberEligible(member: Member, rules: EligibilityRules): boolean {
  if (rules.membershipRequired && member.status !== "active") {
    return false;
  }

  if (
    rules.verificationLevelRequired !== null &&
    !verificationLevelMeets(rules.verificationLevelRequired, member.verificationLevel)
  ) {
    return false;
  }

  if (rules.regionRequired !== null && member.profile.region !== rules.regionRequired) {
    return false;
  }

  if (rules.organizationRequired !== null) {
    return false;
  }

  return true;
}

export function isParticipantEligible(participantId: string, rules: EligibilityRules): boolean {
  const member = getMemberById(participantId);

  if (!member) {
    return false;
  }

  return isMemberEligible(member, rules);
}

export function countEligibleParticipants(rules: EligibilityRules): number {
  const bootstrapMember = getMemberById("member-bootstrap-001");

  if (bootstrapMember && isMemberEligible(bootstrapMember, rules)) {
    return 1;
  }

  return 0;
}

export function getSubmittedParticipantDecisions(
  participantDecisions: ParticipantDecision[],
): ParticipantDecision[] {
  return participantDecisions.filter((decision) => decision.status === "submitted");
}

export function calculateDecisionStatistics(decision: CollectiveDecision): DecisionStatistics {
  const eligibleParticipantCount = countEligibleParticipants(decision.ballot.eligibilityRules);
  const submittedDecisionCount = getSubmittedParticipantDecisions(
    decision.participantDecisions,
  ).length;
  const participationRate =
    eligibleParticipantCount === 0
      ? 0
      : Math.round((submittedDecisionCount / eligibleParticipantCount) * 100);
  const completionRate = participationRate;

  return {
    eligibleParticipantCount,
    submittedDecisionCount,
    participationRate,
    completionRate,
    abstentionCount: 0,
  };
}

export function buildDecisionResult(decision: CollectiveDecision): DecisionResult {
  const submitted = getSubmittedParticipantDecisions(decision.participantDecisions);
  const rules = decision.ballot.decisionRules;
  const eligibleParticipantCount = decision.statistics.eligibleParticipantCount;

  const optionResults = decision.ballot.options.map((option) => {
    const count = submitted.filter((entry) =>
      entry.selectedOptionIds.includes(option.optionId),
    ).length;
    const percentage = submitted.length === 0 ? 0 : Math.round((count / submitted.length) * 100);

    return {
      optionId: option.optionId,
      count,
      percentage,
    };
  });

  const winningOption = optionResults.reduce(
    (best, current) => (current.count > best.count ? current : best),
    optionResults[0] ?? { optionId: "", count: 0, percentage: 0 },
  );

  const participationRate =
    eligibleParticipantCount === 0
      ? 0
      : Math.round((submitted.length / eligibleParticipantCount) * 100);
  const quorumSatisfied = submitted.length >= rules.quorumRequired;
  const approveOption = decision.ballot.options.find((option) => option.value === "Approve");
  const approveResult = optionResults.find((result) => result.optionId === approveOption?.optionId);
  const thresholdSatisfied = (approveResult?.percentage ?? 0) >= rules.approvalThreshold;

  return {
    resultId: `result-${decision.decisionId}`,
    calculatedAt: new Date().toISOString(),
    optionResults,
    winningOptionId: winningOption.count > 0 ? winningOption.optionId : null,
    participationRate,
    quorumSatisfied,
    thresholdSatisfied,
  };
}

export function buildOutcome(decision: CollectiveDecision, result: DecisionResult): Outcome {
  const winningOption = decision.ballot.options.find(
    (option) => option.optionId === result.winningOptionId,
  );
  const approved =
    winningOption?.value === "Approve" && result.quorumSatisfied && result.thresholdSatisfied;

  return {
    outcomeId: `outcome-${decision.decisionId}`,
    outcomeType: approved ? "Approved" : "Rejected",
    createdAt: new Date().toISOString(),
    nextLifecycleStage: approved ? "Petition" : "Archived",
    explanation: approved
      ? "Initiative approved to proceed to the Petition stage."
      : "Initiative did not receive sufficient approval to proceed.",
  };
}

export function assertParticipantDecisionsImmutable(
  existing: ParticipantDecision[],
  proposed: ParticipantDecision[],
): void {
  if (proposed.length < existing.length) {
    throw new Error("Submitted Participant Decisions cannot be removed.");
  }

  for (let index = 0; index < existing.length; index += 1) {
    const existingDecision = existing[index];
    const proposedDecision = proposed[index];

    if (!existingDecision || !proposedDecision) {
      throw new Error("Submitted Participant Decisions cannot be removed.");
    }

    if (
      existingDecision.participantDecisionId !== proposedDecision.participantDecisionId ||
      existingDecision.participantId !== proposedDecision.participantId ||
      existingDecision.ballotId !== proposedDecision.ballotId ||
      JSON.stringify(existingDecision.selectedOptionIds) !==
        JSON.stringify(proposedDecision.selectedOptionIds) ||
      existingDecision.submittedAt !== proposedDecision.submittedAt ||
      existingDecision.status !== proposedDecision.status
    ) {
      throw new Error(
        `Participant Decision "${existingDecision.participantDecisionId}" is immutable.`,
      );
    }
  }
}
