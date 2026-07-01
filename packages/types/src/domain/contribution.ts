import type { MemberId } from "./member.js";
import type { ContributionId } from "./initiative.js";

export type ContributionType =
  | "Evidence"
  | "Question"
  | "Alternative"
  | "Clarification"
  | "Reference"
  | "ExpertOpinion"
  | "SummaryProposal"
  | "Correction";

export interface Contribution {
  contributionId: ContributionId;
  authorId: MemberId;
  contributionType: ContributionType;
  title: string;
  content: string;
  relatedContributionId?: ContributionId;
  metadata: Record<string, unknown>;
  createdAt: string;
}
