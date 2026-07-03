import type { CommitmentContributionType } from "./contribution-type.js";

/** Presentation-oriented derived summary for workspace and public surfaces. */
export interface ContributionSummary {
  totalActiveDeclarations: number;
  declarationsByType: Record<CommitmentContributionType, number>;
  readinessHeadline: string;
  thresholdProgressSummary: string;
  derivedAt: string;
}
