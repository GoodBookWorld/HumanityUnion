# Event Infrastructure

Canonical domain event envelope, serialization, and Catalogue event name constants.

Business modules enqueue events through `infrastructure/outbox` — not by writing directly to MongoDB collections.

## Key paths

- `domain-event.ts` — `DomainEvent`, `EventMetadata`, `CanonicalDomainEventEnvelope`
- `event-envelope.ts` — factory helpers
- `event-serialization.ts` — JSON serialize/deserialize + validation
- `catalogue-events.ts` — exact Catalogue v1.0 event name constants
- `bootstrap-event-infrastructure.ts` — index creation + outbox dispatcher startup

## Related

- `infrastructure/outbox/` — transactional outbox repository and dispatcher
- `infrastructure/integration/event-handler-registry.ts` — idempotent consumer registration
