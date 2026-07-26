import type { ActivityVisibility } from "../../activity/domain/activity.types.js";

export const PROPOSAL_AGGREGATE_TYPE = "Proposal" as const;
export const PROPOSAL_AGGREGATE_VERSION_INITIAL = 1 as const;
export const PROPOSAL_AGGREGATE_VERSION_SUBMITTED = 2 as const;

export const PROPOSAL_STATUSES = ["draft", "submitted"] as const;

export type ProposalStatus = (typeof PROPOSAL_STATUSES)[number];
export type ProposalDraftStatus = "draft";
export type ProposalSubmittedStatus = "submitted";

export interface ProposalRecord {
  proposalId: string;
  activityId: string;
  discussionId: string | null;
  creatorMemberId: string;
  title: string;
  summary: string;
  proposalText: string;
  status: ProposalStatus;
  visibility: ActivityVisibility;
  aggregateVersion: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProposalDetailDto {
  proposalId: string;
  activityId: string;
  discussionId: string | null;
  creatorMemberId: string;
  title: string;
  summary: string;
  proposalText: string;
  status: ProposalStatus;
  visibility: ActivityVisibility;
  aggregateVersion: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProposalCommandInput {
  activityId: string;
  discussionId?: string;
  title: string;
  summary: string;
  proposalText: string;
}

export interface CreateProposalResult {
  proposal: ProposalDetailDto;
}

export interface SubmitProposalCommandInput {
  proposalId: string;
}

export interface SubmitProposalResult {
  proposal: ProposalDetailDto;
}
