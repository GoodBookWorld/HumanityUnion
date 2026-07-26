import { randomUUID } from "node:crypto";

import { CATALOGUE_EVENTS } from "../../../infrastructure/events/catalogue-events.js";
import { createDomainEvent } from "../../../infrastructure/events/event-envelope.js";
import type { DomainEvent } from "../../../infrastructure/events/domain-event.js";
import { PROPOSAL_AGGREGATE_TYPE, type ProposalRecord } from "./proposal.types.js";

export interface ProposalSubmittedPayload extends Record<string, unknown> {
  proposalId: string;
  activityId: string;
  discussionId: string | null;
  creatorMemberId: string;
  title: string;
  status: "submitted";
  visibility: ProposalRecord["visibility"];
  aggregateVersion: number;
  updatedAt: string;
}

export function buildProposalSubmittedEventId(proposalId: string): string {
  return `proposal-submitted:${proposalId}`;
}

export function createProposalSubmittedEvent(input: {
  proposal: ProposalRecord;
  correlationId?: string;
  actorId?: string | null;
}): DomainEvent<ProposalSubmittedPayload> {
  return createDomainEvent({
    eventId: buildProposalSubmittedEventId(input.proposal.proposalId),
    eventName: CATALOGUE_EVENTS.proposalSubmitted,
    aggregateType: PROPOSAL_AGGREGATE_TYPE,
    aggregateId: input.proposal.proposalId,
    payload: {
      proposalId: input.proposal.proposalId,
      activityId: input.proposal.activityId,
      discussionId: input.proposal.discussionId,
      creatorMemberId: input.proposal.creatorMemberId,
      title: input.proposal.title,
      status: "submitted",
      visibility: input.proposal.visibility,
      aggregateVersion: input.proposal.aggregateVersion,
      updatedAt: input.proposal.updatedAt,
    },
    correlationId: input.correlationId ?? randomUUID(),
    actorId: input.actorId ?? input.proposal.creatorMemberId,
    occurredAt: input.proposal.updatedAt,
  });
}
