import type { CanonicalDomainEventEnvelope } from "./domain-event.js";
import { DOMAIN_EVENT_SCHEMA_VERSION } from "./domain-event.js";

export class EventSerializationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EventSerializationError";
  }
}

export function serializeDomainEventEnvelope(
  envelope: CanonicalDomainEventEnvelope,
): string {
  return JSON.stringify(envelope);
}

export function deserializeDomainEventEnvelope(
  serialized: string,
): CanonicalDomainEventEnvelope {
  let parsed: unknown;

  try {
    parsed = JSON.parse(serialized);
  } catch {
    throw new EventSerializationError("Outbox envelope is not valid JSON.");
  }

  return validateCanonicalDomainEventEnvelope(parsed);
}

export function validateCanonicalDomainEventEnvelope(
  value: unknown,
): CanonicalDomainEventEnvelope {
  if (!value || typeof value !== "object") {
    throw new EventSerializationError("Envelope must be an object.");
  }

  const envelope = value as Record<string, unknown>;

  assertRequiredString(envelope, "eventId");
  assertRequiredString(envelope, "eventName");
  assertRequiredString(envelope, "aggregateType");
  assertRequiredString(envelope, "aggregateId");

  if (!envelope.payload || typeof envelope.payload !== "object" || Array.isArray(envelope.payload)) {
    throw new EventSerializationError("Envelope payload must be an object.");
  }

  if (!envelope.metadata || typeof envelope.metadata !== "object" || Array.isArray(envelope.metadata)) {
    throw new EventSerializationError("Envelope metadata must be an object.");
  }

  const metadata = envelope.metadata as Record<string, unknown>;
  assertRequiredString(metadata, "correlationId");
  assertIsoTimestamp(metadata, "occurredAt");

  if (metadata.causationId !== null && typeof metadata.causationId !== "string") {
    throw new EventSerializationError("metadata.causationId must be a string or null.");
  }

  if (metadata.actorId !== null && typeof metadata.actorId !== "string") {
    throw new EventSerializationError("metadata.actorId must be a string or null.");
  }

  if (metadata.schemaVersion !== DOMAIN_EVENT_SCHEMA_VERSION) {
    throw new EventSerializationError(
      `Unsupported metadata.schemaVersion: ${String(metadata.schemaVersion)}.`,
    );
  }

  return {
    eventId: String(envelope.eventId),
    eventName: String(envelope.eventName),
    aggregateType: String(envelope.aggregateType),
    aggregateId: String(envelope.aggregateId),
    payload: envelope.payload as Record<string, unknown>,
    metadata: {
      correlationId: String(metadata.correlationId),
      causationId: (metadata.causationId as string | null) ?? null,
      actorId: (metadata.actorId as string | null) ?? null,
      schemaVersion: DOMAIN_EVENT_SCHEMA_VERSION,
      occurredAt: String(metadata.occurredAt),
    },
  };
}

function assertRequiredString(record: Record<string, unknown>, field: string): void {
  if (typeof record[field] !== "string" || record[field] === "") {
    throw new EventSerializationError(`Envelope ${field} must be a non-empty string.`);
  }
}

function assertIsoTimestamp(record: Record<string, unknown>, field: string): void {
  assertRequiredString(record, field);
  const timestamp = Date.parse(String(record[field]));

  if (Number.isNaN(timestamp)) {
    throw new EventSerializationError(`Envelope metadata.${field} must be a valid ISO timestamp.`);
  }
}
