export {
  CATALOGUE_EVENTS,
  type CatalogueEventName,
} from "./catalogue-events.js";
export {
  DOMAIN_EVENT_SCHEMA_VERSION,
  type CanonicalDomainEventEnvelope,
  type DomainEvent,
  type DomainEventSchemaVersion,
  type EventMetadata,
} from "./domain-event.js";
export {
  createDomainEvent,
  createEventMetadata,
  fromCanonicalEnvelope,
  toCanonicalEnvelope,
  type CreateDomainEventInput,
} from "./event-envelope.js";
export {
  deserializeDomainEventEnvelope,
  EventSerializationError,
  serializeDomainEventEnvelope,
  validateCanonicalDomainEventEnvelope,
} from "./event-serialization.js";
