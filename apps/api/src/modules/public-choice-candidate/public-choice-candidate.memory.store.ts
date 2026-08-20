import { randomUUID } from "node:crypto";

import type { PublicChoiceCandidate } from "@hu/types";

const candidatesById = new Map<string, PublicChoiceCandidate>();
const idsByInitiative = new Map<string, Set<string>>();

export function resetPublicChoiceCandidatesForTests(): void {
  candidatesById.clear();
  idsByInitiative.clear();
}

export function listPublicChoiceCandidatesByInitiative(
  initiativeId: string,
): PublicChoiceCandidate[] {
  const ids = idsByInitiative.get(initiativeId);
  if (!ids) {
    return [];
  }

  return [...ids]
    .map((id) => candidatesById.get(id))
    .filter((candidate): candidate is PublicChoiceCandidate => Boolean(candidate))
    .sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt.localeCompare(b.createdAt));
}

export function getPublicChoiceCandidateById(
  candidateId: string,
): PublicChoiceCandidate | null {
  return candidatesById.get(candidateId) ?? null;
}

export function insertPublicChoiceCandidate(
  candidate: PublicChoiceCandidate,
): PublicChoiceCandidate {
  candidatesById.set(candidate.candidateId, candidate);
  const set = idsByInitiative.get(candidate.initiativeId) ?? new Set<string>();
  set.add(candidate.candidateId);
  idsByInitiative.set(candidate.initiativeId, set);
  return candidate;
}

export function updatePublicChoiceCandidate(
  candidate: PublicChoiceCandidate,
): PublicChoiceCandidate {
  candidatesById.set(candidate.candidateId, candidate);
  return candidate;
}

export function deletePublicChoiceCandidate(candidateId: string): boolean {
  const existing = candidatesById.get(candidateId);
  if (!existing) {
    return false;
  }

  candidatesById.delete(candidateId);
  idsByInitiative.get(existing.initiativeId)?.delete(candidateId);
  return true;
}

export function createPublicChoiceCandidateId(): string {
  return `pc-candidate-${randomUUID()}`;
}
