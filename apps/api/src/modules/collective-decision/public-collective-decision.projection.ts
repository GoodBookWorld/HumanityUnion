import type {
  CollectiveDecision,
  PublicCollectiveDecisionProjection,
  PublicDecisionOutcome,
  PublicDecisionResult,
  PublicDecisionSubject,
} from "@hu/types";

import { getInitiativeById } from "../initiatives/initiative.store.js";

function buildDecisionSubject(decision: CollectiveDecision): PublicDecisionSubject {
  if (decision.decisionSubjectType === "Initiative") {
    const initiative = getInitiativeById(decision.decisionSubjectId);

    return {
      subjectType: decision.decisionSubjectType,
      subjectId: decision.decisionSubjectId,
      title: initiative?.title ?? decision.decisionSubjectId,
    };
  }

  return {
    subjectType: decision.decisionSubjectType,
    subjectId: decision.decisionSubjectId,
    title: decision.decisionSubjectId,
  };
}

function buildPublicDecisionResult(decision: CollectiveDecision): PublicDecisionResult | null {
  if (!decision.decisionResult) {
    return null;
  }

  const winningOption = decision.ballot.options.find(
    (option) => option.optionId === decision.decisionResult?.winningOptionId,
  );

  return {
    calculatedAt: decision.decisionResult.calculatedAt,
    optionResults: decision.decisionResult.optionResults.map((result) => {
      const option = decision.ballot.options.find((entry) => entry.optionId === result.optionId);

      return {
        label: option?.label ?? result.optionId,
        count: result.count,
        percentage: result.percentage,
      };
    }),
    winningOptionLabel: winningOption?.label ?? null,
    participationRate: decision.decisionResult.participationRate,
    quorumSatisfied: decision.decisionResult.quorumSatisfied,
    thresholdSatisfied: decision.decisionResult.thresholdSatisfied,
  };
}

function buildPublicOutcome(decision: CollectiveDecision): PublicDecisionOutcome | null {
  if (!decision.outcome) {
    return null;
  }

  return {
    outcomeType: decision.outcome.outcomeType,
    nextLifecycleStage: decision.outcome.nextLifecycleStage,
    explanation: decision.outcome.explanation,
  };
}

export function toPublicCollectiveDecisionProjection(
  decision: CollectiveDecision,
): PublicCollectiveDecisionProjection {
  return {
    decisionId: decision.decisionId,
    decisionSubject: buildDecisionSubject(decision),
    decisionTemplate: decision.decisionMechanism,
    status: decision.status,
    decisionSummary: decision.ballot.question,
    decisionResult: buildPublicDecisionResult(decision),
    outcome: buildPublicOutcome(decision),
    participationStatistics: {
      eligibleParticipantCount: decision.statistics.eligibleParticipantCount,
      submittedDecisionCount: decision.statistics.submittedDecisionCount,
      participationRate: decision.statistics.participationRate,
      completionRate: decision.statistics.completionRate,
      abstentionCount: decision.statistics.abstentionCount,
    },
    completedAt: decision.timeline.completedAt,
  };
}
