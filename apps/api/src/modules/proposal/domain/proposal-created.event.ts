import { randomUUID } from "node:crypto";

import { CATALOGUE_EVENTS } from "../../../infrastructure/events/catalogue-events.js";
import { createDomainEvent } from "../../../infrastructure/events/event-envelope.js";
import type { DomainEvent } from "../../../infrastructure/events/domain-event.js";
import { PROPOSAL_AGGREGATE_TYPE, type ProposalRecord } from "./proposal.types.js";

export interface ProposalCreatedPayload extends Record<string, unknown> {
  proposalId: string;
  activityId: string;
  discussionId: string | null;
  creatorMemberId: string;
  title: string;
  status: ProposalRecord["status"];
  visibility: ProposalRecord["visibility"];
  createdAt: string;
}

export function buildProposalCreatedEventId(proposalId: string): string {
  return `proposal-created:${proposalId}`;
}

export function createProposalCreatedEvent(input: {
  proposal: ProposalRecord;
  correlationId?: string;
  actorId?: string | null;
}): DomainEvent<ProposalCreatedPayload> {
  return createDomainEvent({
    eventId: buildProposalCreatedEventId(input.proposal.proposalId),
    eventName: CATALOGUE_EVENTS.proposalCreated,
    aggregateType: PROPOSAL_AGGREGATE_TYPE,
    aggregateId: input.proposal.proposalId,
    payload: {
      proposalId: input.proposal.proposalId,
      activityId: input.proposal.activityId,
      discussionId: input.proposal.discussionId,
      creatorMemberId: input.proposal.creatorMemberId,
      title: input.proposal.title,
      status: input.proposal.status,
      visibility: input.proposal.visibility,
      createdAt: input.proposal.createdAt,
    },
    correlationId: input.correlationId ?? randomUUID(),
    actorId: input.actorId ?? input.proposal.creatorMemberId,
    occurredAt: input.proposal.createdAt,
  });
}
