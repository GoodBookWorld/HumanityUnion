import type { MemberId } from "./member.js";
import type { ContributionId } from "./initiative.js";

export type AnalysisSummaryId = string;

export interface AnalysisSummary {
  summaryId: AnalysisSummaryId;
  createdAt: string;
  createdBy: MemberId;
  summaryText: string;
  referencedContributionIds: ContributionId[];
  status: string;
}
