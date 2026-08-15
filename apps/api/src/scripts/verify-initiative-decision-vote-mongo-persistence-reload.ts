/**
 * Recovery Task 31 Part 21 — narrow reload probe for the Initiative Decision
 * Vote Mongo persistence verification script. Run as a fresh OS process (via
 * `runVerificationSubprocess`) so that a Vote read here can only succeed if
 * the data is genuinely durable in Mongo, not merely resident in the parent
 * process's memory.
 *
 * Usage: tsx verify-initiative-decision-vote-mongo-persistence-reload.ts <voteId> <expectedChoice> <expectedVersion>
 */
import { getVoteById } from "../modules/initiative-decision-vote/initiative-decision-vote.store.js";

const voteId = process.argv[2];
const expectedChoice = process.argv[3];
const expectedVersionArg = process.argv[4];

if (!voteId || !expectedChoice || !expectedVersionArg) {
  console.error(
    "Usage: verify-initiative-decision-vote-mongo-persistence-reload.ts <voteId> <expectedChoice> <expectedVersion>",
  );
  process.exit(1);
}

const expectedVersion = Number.parseInt(expectedVersionArg, 10);

const vote = await getVoteById(voteId);

if (!vote) {
  console.error(`Vote "${voteId}" was not visible to a freshly-started process.`);
  process.exit(1);
}

if (vote.choice !== expectedChoice) {
  console.error(`Expected choice "${expectedChoice}", found "${vote.choice}".`);
  process.exit(1);
}

if (vote.version !== expectedVersion) {
  console.error(`Expected version ${expectedVersion}, found ${vote.version}.`);
  process.exit(1);
}

console.log(`Vote "${voteId}" reloaded successfully in a fresh process.`);
// See verify-collective-decision-public-results-reload.ts for why this
// short-lived, single-query script exits explicitly rather than letting the
// event loop drain on its own (an open Mongo driver session/heartbeat handle
// would otherwise keep the process alive indefinitely).
process.exit(0);
