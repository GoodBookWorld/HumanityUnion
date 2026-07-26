import { randomUUID } from "node:crypto";

import type { ProposalRecord } from "../../proposal/domain/proposal.types.js";
import {
  DECISION_AGGREGATE_VERSION_INITIAL,
  DECISION_STATUSES,
  type DecisionRecord,
} from "./decision.types.js";
import { DecisionProposalNotSubmittedError } from "./decision.errors.js";

export function buildDecisionAggregateForCreate(input: {
  proposal: ProposalRecord;
  occurredAt?: string;
}): DecisionRecord {
  if (input.proposal.status !== "submitted") {
    throw new DecisionProposalNotSubmittedError();
  }

  const timestamp = input.occurredAt ?? new Date().toISOString();

  return {
    decisionId: randomUUID(),
    proposalId: input.proposal.proposalId,
    activityId: input.proposal.activityId,
    creatorMemberId: input.proposal.creatorMemberId,
    title: input.proposal.title,
    status: DECISION_STATUSES[0],
    visibility: input.proposal.visibility,
    aggregateVersion: DECISION_AGGREGATE_VERSION_INITIAL,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}
