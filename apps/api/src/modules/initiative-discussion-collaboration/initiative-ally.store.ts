import type { InitiativeAlly, InitiativeAllyStatus } from "@hu/types";

import {
  deleteInitiativeAlliesByInitiativeId,
  deleteInitiativeAlliesByInitiativeIdForTests,
  findInitiativeAllyDocument,
  listActiveInitiativeAllyDocumentsByInitiativeId,
  listInitiativeAllyDocumentsByInitiativeId,
  listInitiativeAllyDocumentsByParticipantId,
  transitionInitiativeAllyStatus,
  upsertInitiativeAllyDocument,
} from "./persistence/initiative-ally.repository.js";
import type { AllyStatusTransitionResult } from "./persistence/initiative-ally.repository.js";

/**
 * Durable Mongo-backed store for Initiative-scoped Ally relationships (UX
 * Evolution Pack 02.1 — Recover Durable Persistence).
 *
 * Exactly one row exists per (initiativeId, participantId) pair — this is
 * what gives the module its "one current Ally relationship per Initiative +
 * Participant" uniqueness rule, now enforced by the database (see
 * `initiative_allies_initiative_participant_unique` in mongo-indexes.ts),
 * not just an in-memory Map key. Collaboration interest, invitations,
 * acceptance, and decline are all status transitions on that one row, never
 * separate documents.
 *
 * This module is a thin facade over `persistence/initiative-ally
 * .repository.ts`, preserving the exact function names the service already
 * depends on (Pack 02) — every function is now `async` since a Mongo read/
 * write cannot be synchronous.
 */

export async function findAlly(
  initiativeId: string,
  participantId: string,
): Promise<InitiativeAlly | null> {
  return findInitiativeAllyDocument(initiativeId, participantId);
}

export async function upsertAlly(ally: InitiativeAlly): Promise<InitiativeAlly> {
  return upsertInitiativeAllyDocument(ally);
}

export async function listAlliesByInitiative(initiativeId: string): Promise<InitiativeAlly[]> {
  return listInitiativeAllyDocumentsByInitiativeId(initiativeId);
}

/** Part 14 read boundary: active Allies by initiativeId, for future widgets. */
export async function listActiveAlliesByInitiative(initiativeId: string): Promise<InitiativeAlly[]> {
  if (process.env.NODE_TEST_ENV === "true") {
    return [];
  }
  return listActiveInitiativeAllyDocumentsByInitiativeId(initiativeId);
}

/**
 * Profile UX Pack 01 — every Ally row for one Participant across ALL
 * Initiatives (Workspace Allies aggregation / "Collaborations" count).
 */
export async function listAlliesByParticipantId(participantId: string): Promise<InitiativeAlly[]> {
  return listInitiativeAllyDocumentsByParticipantId(participantId);
}

/**
 * Profile UX Pack 01 Part 5/6/13 — atomic Accept/Decline compare-and-swap.
 * See `transitionInitiativeAllyStatus` for why this cannot be a blind
 * `$set` upsert.
 */
export async function transitionAllyStatus(input: {
  initiativeId: string;
  participantId: string;
  fromStatus: InitiativeAllyStatus;
  toStatus: InitiativeAllyStatus;
  updatedAt: string;
}): Promise<AllyStatusTransitionResult> {
  return transitionInitiativeAllyStatus(input);
}

/**
 * Test-only, narrowly scoped to one initiative's Allies (Recovery Task 31
 * Part 19 style: exact selector, no delete-all, no wildcard mode). A no-op
 * when MongoDB is not configured.
 */
export async function resetInitiativeAlliesStoreForTests(initiativeId: string): Promise<void> {
  await deleteInitiativeAlliesByInitiativeIdForTests(initiativeId);
}

/**
 * Initiative UX Pack 01.1 Part 5/6 — permanently removes every Ally row for
 * one Initiative. Used exclusively by Draft Initiative deletion.
 */
export async function deleteAlliesByInitiativeId(initiativeId: string): Promise<void> {
  await deleteInitiativeAlliesByInitiativeId(initiativeId);
}
