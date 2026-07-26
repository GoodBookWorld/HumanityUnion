/**
 * Canonical domain event model for Humanity Union MVP civic infrastructure.
 * Event names must match engineering/CANONICAL_EVENT_CATALOGUE.md exactly.
 */

export const DOMAIN_EVENT_SCHEMA_VERSION = "1.0" as const;

export type DomainEventSchemaVersion = typeof DOMAIN_EVENT_SCHEMA_VERSION;

/** Cross-cutting metadata carried on every domain event. */
export interface EventMetadata {
  correlationId: string;
  causationId: string | null;
  actorId: string | null;
  schemaVersion: DomainEventSchemaVersion;
  occurredAt: string;
}

/** Immutable domain fact raised by an owning aggregate after invariant-safe change. */
export interface DomainEvent<TPayload extends Record<string, unknown> = Record<string, unknown>> {
  eventId: string;
  eventName: string;
  aggregateType: string;
  aggregateId: string;
  payload: TPayload;
  metadata: EventMetadata;
}

/** Wire/storage representation — serialized envelope persisted in the outbox. */
export interface CanonicalDomainEventEnvelope<
  TPayload extends Record<string, unknown> = Record<string, unknown>,
> {
  eventId: string;
  eventName: string;
  aggregateType: string;
  aggregateId: string;
  payload: TPayload;
  metadata: EventMetadata;
}
