/**
 * Recovery Task 33 Part 23 (item 31) — narrow reload probe for the
 * Initiative Decision Vote Participant Action verification script. Run as a
 * fresh OS process (via `runVerificationSubprocess`) so that a Participant
 * Action record read here can only succeed if it is genuinely durable in
 * Mongo, not merely resident in the parent process's memory. Mirrors
 * `verify-initiative-decision-vote-events-reload.ts` (Recovery Task 32).
 *
 * Usage: tsx verify-initiative-decision-vote-participant-actions-reload.ts <sourceEventId> <expectedActionType> <expectedParticipantId>
 */
import { findParticipantActionBySourceEventId } from "../modules/participant-action/infrastructure/participant-action.repository.js";
import { connectMongoClient } from "../infrastructure/mongodb/mongo-connection.js";

const sourceEventId = process.argv[2];
const expectedActionType = process.argv[3];
const expectedParticipantId = process.argv[4];

if (!sourceEventId || !expectedActionType || !expectedParticipantId) {
  console.error(
    "Usage: verify-initiative-decision-vote-participant-actions-reload.ts <sourceEventId> <expectedActionType> <expectedParticipantId>",
  );
  process.exit(1);
}

await connectMongoClient();

const record = await findParticipantActionBySourceEventId(sourceEventId);

if (!record) {
  console.error(`Participant Action for sourceEventId "${sourceEventId}" was not visible to a freshly-started process.`);
  process.exit(1);
}

if (record.actionType !== expectedActionType) {
  console.error(`Expected actionType "${expectedActionType}", found "${record.actionType}".`);
  process.exit(1);
}

if (record.participantId !== expectedParticipantId) {
  console.error(`Expected participantId "${expectedParticipantId}", found "${record.participantId}".`);
  process.exit(1);
}

console.log(
  `Participant Action for sourceEventId "${sourceEventId}" reloaded and validated successfully in a fresh process.`,
);
// See verify-initiative-decision-vote-mongo-persistence-reload.ts for why
// this short-lived, single-query script exits explicitly rather than
// letting the event loop drain on its own.
process.exit(0);
