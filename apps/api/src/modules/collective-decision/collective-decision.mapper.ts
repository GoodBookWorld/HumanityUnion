import type {
  CollectiveDecision,
  DecisionResult,
  Outcome,
} from "@hu/types";

export function mapCollectiveDecisionResponse(
  decision: CollectiveDecision,
): CollectiveDecision {
  return structuredClone(decision);
}

export function mapCollectiveDecisionListResponse(
  decisions: CollectiveDecision[],
): CollectiveDecision[] {
  return decisions.map((decision) => mapCollectiveDecisionResponse(decision));
}

export function mapDecisionResultResponse(result: DecisionResult): DecisionResult {
  return structuredClone(result);
}

export function mapOutcomeResponse(outcome: Outcome): Outcome {
  return structuredClone(outcome);
}
