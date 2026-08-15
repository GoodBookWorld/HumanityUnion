/**
 * Recovery Task 24 Part 22 — narrow reload probe for the Petition
 * persistence verification script. Run as a fresh OS process (via
 * `runVerificationSubprocess`) so that a Petition/Signature read here can
 * only succeed if the data is genuinely durable in Mongo, not merely
 * resident in the parent process's memory.
 *
 * Usage: tsx verify-petition-persistence-reload.ts <petitionId> <expectedStatus> [expectedSignatureCount]
 */
import { getPetition } from "../modules/petition/petition.store.js";

const petitionId = process.argv[2];
const expectedStatus = process.argv[3];
const expectedSignatureCountArg = process.argv[4];

if (!petitionId || !expectedStatus) {
  console.error("Usage: verify-petition-persistence-reload.ts <petitionId> <expectedStatus> [expectedSignatureCount]");
  process.exit(1);
}

const petition = await getPetition(petitionId);

if (!petition) {
  console.error(`Petition "${petitionId}" was not visible to a freshly-started process.`);
  process.exit(1);
}

if (petition.status !== expectedStatus) {
  console.error(`Expected status "${expectedStatus}", found "${petition.status}".`);
  process.exit(1);
}

if (expectedSignatureCountArg !== undefined) {
  const expectedSignatureCount = Number.parseInt(expectedSignatureCountArg, 10);

  if (petition.signatures.length !== expectedSignatureCount) {
    console.error(
      `Expected ${expectedSignatureCount} signature(s), found ${petition.signatures.length}.`,
    );
    process.exit(1);
  }
}

console.log(`Petition "${petitionId}" reloaded successfully in a fresh process.`);
// See verify-collective-decision-public-results-reload.ts for why this
// short-lived, single-query script exits explicitly rather than letting the
// event loop drain on its own (an open Mongo driver session/heartbeat
// handle would otherwise keep the process alive indefinitely).
process.exit(0);
