export type OutcomeId = string;

export type OutcomeType = "Approved" | "Rejected" | "Selected" | "Prioritized";

export interface Outcome {
  outcomeId: OutcomeId;
  outcomeType: OutcomeType;
  createdAt: string;
  nextLifecycleStage: string;
  explanation: string;
}
