import type { CommitmentContributionType } from "./contribution-type.js";

/** Derived aggregate measure of declared community preparedness. */
export interface CommunityCapacity {
  totalContributions: number;
  contributionsByType: Record<CommitmentContributionType, number>;
  aggregateAvailabilitySummary: string;
  skillCoverageSummary: string;
  derivedAt: string;
}
