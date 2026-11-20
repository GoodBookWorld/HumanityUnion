/**
 * HU-RRP-06C — RrpApplicationSubmitted domain event builder.
 * Identifiers only — no DOB, narratives, or funding amounts.
 * Emit/enqueue is owned by the submit transition (not this module alone).
 */
import { CATALOGUE_EVENTS } from "../../infrastructure/events/catalogue-events.js";
import { createDomainEvent } from "../../infrastructure/events/event-envelope.js";
import type { DomainEvent } from "../../infrastructure/events/domain-event.js";

export const RRP_APPLICATION_AGGREGATE_TYPE = "RrpApplication" as const;

export interface RrpApplicationSubmittedPayload extends Record<string, unknown> {
  applicationId: string;
  participantId: string;
  submittedAt: string;
}

/**
 * Stable identity for one submission epoch.
 * Initial submit and each real resubmit use a distinct `submittedAt`.
 */
export function buildRrpApplicationSubmittedEventId(
  applicationId: string,
  submittedAt: string,
): string {
  return `rrp-application-submitted:${applicationId}:${submittedAt}`;
}

export function createRrpApplicationSubmittedEvent(input: {
  applicationId: string;
  participantId: string;
  submittedAt: string;
  actorId?: string | null;
}): DomainEvent<RrpApplicationSubmittedPayload> {
  return createDomainEvent({
    eventId: buildRrpApplicationSubmittedEventId(input.applicationId, input.submittedAt),
    eventName: CATALOGUE_EVENTS.rrpApplicationSubmitted,
    aggregateType: RRP_APPLICATION_AGGREGATE_TYPE,
    aggregateId: input.applicationId,
    actorId: input.actorId ?? input.participantId,
    occurredAt: input.submittedAt,
    payload: {
      applicationId: input.applicationId,
      participantId: input.participantId,
      submittedAt: input.submittedAt,
    },
  });
}
