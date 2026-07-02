import type { DecisionOptionId } from "./decision-option.js";

export type DecisionResultId = string;

export interface DecisionOptionResult {
  optionId: DecisionOptionId;
  count: number;
  percentage: number;
}

export interface DecisionResult {
  resultId: DecisionResultId;
  calculatedAt: string;
  optionResults: DecisionOptionResult[];
  winningOptionId: DecisionOptionId | null;
  participationRate: number;
  quorumSatisfied: boolean;
  thresholdSatisfied: boolean;
}
