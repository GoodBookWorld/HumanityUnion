/**
 * Recovery Task 32 Part 25 (item 29) — narrow reload probe for the
 * Initiative Decision Vote durable event verification script. Run as a
 * fresh OS process (via `runVerificationSubprocess`) so that an outbox
 * record read here can only succeed if it is genuinely durable in Mongo,
 * not merely resident in the parent process's memory. Mirrors
 * `verify-initiative-decision-vote-mongo-persistence-reload.ts` (Recovery
 * Task 31).
 *
 * Usage: tsx verify-initiative-decision-vote-events-reload.ts <outboxId> <expectedEventName> <expectedAggregateId>
 */
import { findOutboxRecordById } from "../infrastructure/outbox/index.js";
import { deserializeDomainEventEnvelope } from "../infrastructure/events/event-serialization.js";
import { connectMongoClient } from "../infrastructure/mongodb/mongo-connection.js";

const outboxId = process.argv[2];
const expectedEventName = process.argv[3];
const expectedAggregateId = process.argv[4];

if (!outboxId || !expectedEventName || !expectedAggregateId) {
  console.error(
    "Usage: verify-initiative-decision-vote-events-reload.ts <outboxId> <expectedEventName> <expectedAggregateId>",
  );
  process.exit(1);
}

await connectMongoClient();

const record = await findOutboxRecordById(outboxId);

if (!record) {
  console.error(`Outbox record "${outboxId}" was not visible to a freshly-started process.`);
  process.exit(1);
}

if (record.eventName !== expectedEventName) {
  console.error(`Expected eventName "${expectedEventName}", found "${record.eventName}".`);
  process.exit(1);
}

if (record.aggregateId !== expectedAggregateId) {
  console.error(`Expected aggregateId "${expectedAggregateId}", found "${record.aggregateId}".`);
  process.exit(1);
}

const envelope = deserializeDomainEventEnvelope(record.envelope);

if (envelope.aggregateId !== expectedAggregateId) {
  console.error("Deserialized envelope aggregateId does not match the stored record's aggregateId.");
  process.exit(1);
}

console.log(`Outbox record "${outboxId}" reloaded and deserialized successfully in a fresh process.`);
// See verify-initiative-decision-vote-mongo-persistence-reload.ts for why
// this short-lived, single-query script exits explicitly rather than
// letting the event loop drain on its own.
process.exit(0);
