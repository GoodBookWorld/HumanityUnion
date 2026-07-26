import type { Document } from "mongodb";

import type { ActivityVisibility } from "../../activity/domain/activity.types.js";
import type { ProposalDetailDto, ProposalRecord, ProposalStatus } from "../domain/proposal.types.js";

export interface ProposalMongoDocument extends Document {
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

export function toProposalMongoDocument(record: ProposalRecord): ProposalMongoDocument {
  return {
    proposalId: record.proposalId,
    activityId: record.activityId,
    discussionId: record.discussionId,
    creatorMemberId: record.creatorMemberId,
    title: record.title,
    summary: record.summary,
    proposalText: record.proposalText,
    status: record.status,
    visibility: record.visibility,
    aggregateVersion: record.aggregateVersion,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

export function fromProposalMongoDocument(document: ProposalMongoDocument): ProposalRecord {
  return {
    proposalId: document.proposalId,
    activityId: document.activityId,
    discussionId: document.discussionId,
    creatorMemberId: document.creatorMemberId,
    title: document.title,
    summary: document.summary,
    proposalText: document.proposalText,
    status: document.status,
    visibility: document.visibility,
    aggregateVersion: document.aggregateVersion,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
  };
}

export function toProposalDetailDto(record: ProposalRecord): ProposalDetailDto {
  return {
    proposalId: record.proposalId,
    activityId: record.activityId,
    discussionId: record.discussionId,
    creatorMemberId: record.creatorMemberId,
    title: record.title,
    summary: record.summary,
    proposalText: record.proposalText,
    status: record.status,
    visibility: record.visibility,
    aggregateVersion: record.aggregateVersion,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}
