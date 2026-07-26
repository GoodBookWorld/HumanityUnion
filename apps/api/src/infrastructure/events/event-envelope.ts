import { randomUUID } from "node:crypto";

import type {
  CanonicalDomainEventEnvelope,
  DomainEvent,
  DomainEventSchemaVersion,
  EventMetadata,
} from "./domain-event.js";
import { DOMAIN_EVENT_SCHEMA_VERSION } from "./domain-event.js";
import { getCorrelationContext } from "../../shared/observability/correlation.js";

export interface CreateDomainEventInput<
  TPayload extends Record<string, unknown> = Record<string, unknown>,
> {
  eventName: string;
  aggregateType: string;
  aggregateId: string;
  payload: TPayload;
  eventId?: string;
  correlationId?: string;
  causationId?: string | null;
  actorId?: string | null;
  occurredAt?: string;
  schemaVersion?: DomainEventSchemaVersion;
}

export function createEventMetadata(
  input: Pick<
    CreateDomainEventInput,
    "correlationId" | "causationId" | "actorId" | "occurredAt" | "schemaVersion"
  >,
): EventMetadata {
  const context = getCorrelationContext();

  return {
    correlationId: input.correlationId ?? context?.correlationId ?? randomUUID(),
    causationId: input.causationId ?? context?.causationId ?? null,
    actorId: input.actorId ?? context?.actorId ?? null,
    schemaVersion: input.schemaVersion ?? DOMAIN_EVENT_SCHEMA_VERSION,
    occurredAt: input.occurredAt ?? new Date().toISOString(),
  };
}

export function createDomainEvent<TPayload extends Record<string, unknown>>(
  input: CreateDomainEventInput<TPayload>,
): DomainEvent<TPayload> {
  const metadata = createEventMetadata(input);

  return {
    eventId: input.eventId ?? randomUUID(),
    eventName: input.eventName,
    aggregateType: input.aggregateType,
    aggregateId: input.aggregateId,
    payload: input.payload,
    metadata,
  };
}

export function toCanonicalEnvelope<TPayload extends Record<string, unknown>>(
  event: DomainEvent<TPayload>,
): CanonicalDomainEventEnvelope<TPayload> {
  return {
    eventId: event.eventId,
    eventName: event.eventName,
    aggregateType: event.aggregateType,
    aggregateId: event.aggregateId,
    payload: event.payload,
    metadata: { ...event.metadata },
  };
}

export function fromCanonicalEnvelope<TPayload extends Record<string, unknown>>(
  envelope: CanonicalDomainEventEnvelope<TPayload>,
): DomainEvent<TPayload> {
  return {
    eventId: envelope.eventId,
    eventName: envelope.eventName,
    aggregateType: envelope.aggregateType,
    aggregateId: envelope.aggregateId,
    payload: envelope.payload,
    metadata: { ...envelope.metadata },
  };
}
