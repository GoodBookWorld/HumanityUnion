import type { SignalType } from "./signal.js";

export interface ProgressPolicy {
  minimumContributions: number;
  requiredSignalTypes: SignalType[];
  minimumSignals: number;
  minimumParticipantCount: number;
  supportThreshold: number;
  expertReviewRequired: boolean;
  regionalReviewRequired: boolean;
}
