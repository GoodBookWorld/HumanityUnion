import { randomUUID } from "node:crypto";

import { CATALOGUE_EVENTS } from "../../../infrastructure/events/catalogue-events.js";
import { createDomainEvent } from "../../../infrastructure/events/event-envelope.js";
import type { DomainEvent } from "../../../infrastructure/events/domain-event.js";
import { DECISION_AGGREGATE_TYPE, type DecisionRecord } from "./decision.types.js";

export interface DecisionOpenedPayload extends Record<string, unknown> {
  decisionId: string;
  proposalId: string;
  activityId: string;
  creatorMemberId: string;
  title: string;
  status: DecisionRecord["status"];
  visibility: DecisionRecord["visibility"];
  aggregateVersion: number;
  createdAt: string;
}

export function buildDecisionOpenedEventId(decisionId: string): string {
  return `decision-opened:${decisionId}`;
}

export function createDecisionOpenedEvent(input: {
  decision: DecisionRecord;
  correlationId?: string;
  actorId?: string | null;
}): DomainEvent<DecisionOpenedPayload> {
  return createDomainEvent({
    eventId: buildDecisionOpenedEventId(input.decision.decisionId),
    eventName: CATALOGUE_EVENTS.decisionOpened,
    aggregateType: DECISION_AGGREGATE_TYPE,
    aggregateId: input.decision.decisionId,
    payload: {
      decisionId: input.decision.decisionId,
      proposalId: input.decision.proposalId,
      activityId: input.decision.activityId,
      creatorMemberId: input.decision.creatorMemberId,
      title: input.decision.title,
      status: input.decision.status,
      visibility: input.decision.visibility,
      aggregateVersion: input.decision.aggregateVersion,
      createdAt: input.decision.createdAt,
    },
    correlationId: input.correlationId ?? randomUUID(),
    actorId: input.actorId ?? input.decision.creatorMemberId,
    occurredAt: input.decision.createdAt,
  });
}
