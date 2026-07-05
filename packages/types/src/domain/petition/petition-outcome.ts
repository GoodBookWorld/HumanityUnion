export type PetitionOutcomeId = string;

export type PetitionOutcomeType = "Active" | "ThresholdReached" | "Closed" | "Archived";

export interface PetitionOutcome {
  outcomeId: PetitionOutcomeId;
  outcomeType: PetitionOutcomeType;
  derivedAt: string;
  explanation: string;
}
