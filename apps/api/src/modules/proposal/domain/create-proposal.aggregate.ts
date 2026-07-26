import { randomUUID } from "node:crypto";

import type { ActivityRecord } from "../../activity/domain/activity.types.js";
import {
  PROPOSAL_AGGREGATE_VERSION_INITIAL,
  PROPOSAL_STATUSES,
  type CreateProposalCommandInput,
  type ProposalRecord,
} from "./proposal.types.js";

export function buildProposalAggregateForCreate(input: {
  command: CreateProposalCommandInput;
  creatorMemberId: string;
  activity: ActivityRecord;
  occurredAt?: string;
}): ProposalRecord {
  const timestamp = input.occurredAt ?? new Date().toISOString();

  return {
    proposalId: randomUUID(),
    activityId: input.command.activityId,
    discussionId: input.command.discussionId ?? null,
    creatorMemberId: input.creatorMemberId,
    title: input.command.title,
    summary: input.command.summary,
    proposalText: input.command.proposalText,
    status: PROPOSAL_STATUSES[0],
    visibility: input.activity.visibility,
    aggregateVersion: PROPOSAL_AGGREGATE_VERSION_INITIAL,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}
