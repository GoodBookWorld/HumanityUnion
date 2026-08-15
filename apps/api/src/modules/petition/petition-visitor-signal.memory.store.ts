import { randomUUID } from "node:crypto";

import type { PetitionVisitorSignalRecord } from "@hu/types";

/**
 * Initiative Lifecycle — Part F, Section 7/8 (Representative Signatures).
 * In-memory fallback for {@link recordPetitionVisitorSignalMongo}, mirroring
 * `initiative-revision-reaction.memory.store.ts`'s pattern — one signal per
 * (petitionId, visitorKey) pair, never a `Signature`.
 */
const signalsByPetitionId = new Map<string, Map<string, PetitionVisitorSignalRecord>>();

export function recordPetitionVisitorSignalMemory(input: {
  petitionId: string;
  visitorKey: string;
}): PetitionVisitorSignalRecord {
  const existingForPetition = signalsByPetitionId.get(input.petitionId) ?? new Map();
  const existing = existingForPetition.get(input.visitorKey);

  if (existing) {
    return structuredClone(existing);
  }

  const record: PetitionVisitorSignalRecord = {
    signalId: randomUUID(),
    petitionId: input.petitionId,
    visitorKey: input.visitorKey,
    createdAt: new Date().toISOString(),
  };

  existingForPetition.set(input.visitorKey, record);
  signalsByPetitionId.set(input.petitionId, existingForPetition);

  return structuredClone(record);
}

export function countPetitionVisitorSignalsMemory(petitionId: string): number {
  return signalsByPetitionId.get(petitionId)?.size ?? 0;
}

export function resetPetitionVisitorSignalsMemoryForTests(): void {
  signalsByPetitionId.clear();
}
