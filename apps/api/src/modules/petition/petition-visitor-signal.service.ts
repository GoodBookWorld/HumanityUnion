import type { PetitionVisitorSignalRecord } from "@hu/types";

import {
  isEngagementMongoMode,
  PETITION_VISITOR_SIGNAL_PERSISTENCE_KEY,
} from "../../infrastructure/mongodb/resolve-engagement-persistence.js";
import {
  countPetitionVisitorSignalsMemory,
  recordPetitionVisitorSignalMemory,
  resetPetitionVisitorSignalsMemoryForTests,
} from "./petition-visitor-signal.memory.store.js";
import {
  countPetitionVisitorSignalsMongo,
  recordPetitionVisitorSignalMongo,
} from "./petition-visitor-signal.mongo.repository.js";

/**
 * Initiative Lifecycle — Part F, Section 7/8 (Representative Signatures).
 *
 * "May be supported by: Participants, Members, Visitors. Display three
 * independent counters representing civic participation only, never
 * describing them as legally binding." This service is the Visitors
 * counter's sole source of truth — a lightweight, cookie-scoped signal
 * that never becomes a `Signature` and is never merged into
 * `SupportMetrics`.
 */
function isMongoMode(): boolean {
  return isEngagementMongoMode(PETITION_VISITOR_SIGNAL_PERSISTENCE_KEY);
}

export async function recordPetitionVisitorSignal(input: {
  petitionId: string;
  visitorKey: string;
}): Promise<PetitionVisitorSignalRecord> {
  if (isMongoMode()) {
    return recordPetitionVisitorSignalMongo(input);
  }

  return recordPetitionVisitorSignalMemory(input);
}

export async function countPetitionVisitorSignals(petitionId: string): Promise<number> {
  if (isMongoMode()) {
    return countPetitionVisitorSignalsMongo(petitionId);
  }

  return countPetitionVisitorSignalsMemory(petitionId);
}

export function resetPetitionVisitorSignalsForTests(): void {
  resetPetitionVisitorSignalsMemoryForTests();
}
