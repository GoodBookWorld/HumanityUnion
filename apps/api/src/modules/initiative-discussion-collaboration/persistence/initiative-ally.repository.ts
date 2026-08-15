import { MONGO_COLLECTIONS } from "../../../infrastructure/mongodb/mongo-collections.js";
import { isMongoConfigured } from "../../../infrastructure/mongodb/mongo-config.js";
import { connectMongoClient } from "../../../infrastructure/mongodb/mongo-connection.js";
import { getMongoCollection } from "../../../infrastructure/mongodb/mongo-database.js";

import type { InitiativeAlly, InitiativeAllyStatus } from "@hu/types";

import { InitiativeAllyPersistenceError } from "../initiative-discussion-collaboration.errors.js";
import {
  fromInitiativeAllyMongoDocument,
  toInitiativeAllyMongoDocument,
  type InitiativeAllyMongoDocument,
} from "./initiative-ally.mongo-document.js";

export function isDuplicateInitiativeAllyError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: number }).code === 11_000
  );
}

async function ensureInitiativeAllyMongoReady(): Promise<void> {
  if (!isMongoConfigured()) {
    throw new InitiativeAllyPersistenceError("MongoDB is not configured.");
  }

  await connectMongoClient();
}

function alliesCollection() {
  return getMongoCollection<InitiativeAllyMongoDocument>(MONGO_COLLECTIONS.initiativeAllies);
}

export async function findInitiativeAllyDocument(
  initiativeId: string,
  participantId: string,
): Promise<InitiativeAlly | null> {
  await ensureInitiativeAllyMongoReady();

  const document = await alliesCollection().findOne({ initiativeId, participantId });

  return document ? fromInitiativeAllyMongoDocument(document) : null;
}

const MAX_UPSERT_DUPLICATE_RETRIES = 3;

/**
 * Create-or-replace the single mutable-status row for (initiativeId,
 * participantId). Every Ally state transition (interest, invitation,
 * acceptance, decline) goes through this one atomic
 * `findOneAndUpdate(..., { upsert: true })` — the database, not an
 * application-level check-then-write, is what enforces "at most one
 * document per (initiativeId, participantId)" (see
 * `initiative_allies_initiative_participant_unique` in mongo-indexes.ts).
 *
 * A `findOneAndUpdate` upsert can still surface a duplicate-key error (code
 * 11000) if two callers race to create the *first* row for the same key at
 * the same instant — MongoDB guarantees exactly one of them wins the
 * insert, but the loser sees E11000 rather than being silently retried by
 * the driver. Retrying the identical `findOneAndUpdate` immediately turns
 * that loss into a plain update against the now-existing row, so no caller
 * ever observes a transient race as a hard failure, and no orphan/duplicate
 * document is ever created.
 */
export async function upsertInitiativeAllyDocument(record: InitiativeAlly): Promise<InitiativeAlly> {
  await ensureInitiativeAllyMongoReady();

  for (let attempt = 0; attempt < MAX_UPSERT_DUPLICATE_RETRIES; attempt += 1) {
    try {
      const document = await alliesCollection().findOneAndUpdate(
        { initiativeId: record.initiativeId, participantId: record.participantId },
        { $set: toInitiativeAllyMongoDocument(record) },
        { upsert: true, returnDocument: "after" },
      );

      if (!document) {
        throw new InitiativeAllyPersistenceError("Initiative Ally upsert returned no document.");
      }

      return fromInitiativeAllyMongoDocument(document);
    } catch (error) {
      if (isDuplicateInitiativeAllyError(error) && attempt < MAX_UPSERT_DUPLICATE_RETRIES - 1) {
        continue;
      }

      if (error instanceof InitiativeAllyPersistenceError) {
        throw error;
      }

      throw new InitiativeAllyPersistenceError("Initiative Ally upsert failed.", error);
    }
  }

  throw new InitiativeAllyPersistenceError(
    "Initiative Ally upsert did not converge after repeated concurrent creation attempts.",
  );
}

export async function listInitiativeAllyDocumentsByInitiativeId(
  initiativeId: string,
): Promise<InitiativeAlly[]> {
  await ensureInitiativeAllyMongoReady();

  const documents = await alliesCollection().find({ initiativeId }).toArray();

  return documents.map((document) => fromInitiativeAllyMongoDocument(document));
}

/**
 * Profile UX Pack 01 — the Workspace Allies widget and the "Collaborations"
 * count both need every Ally row for one Participant across ALL
 * Initiatives, not just one. Served by the
 * `initiative_allies_participant_status` index (mongo-indexes.ts).
 */
export async function listInitiativeAllyDocumentsByParticipantId(
  participantId: string,
): Promise<InitiativeAlly[]> {
  await ensureInitiativeAllyMongoReady();

  const documents = await alliesCollection().find({ participantId }).toArray();

  return documents.map((document) => fromInitiativeAllyMongoDocument(document));
}

export interface AllyStatusTransitionResult {
  ally: InitiativeAlly;
  /**
   * True only when THIS call performed the (fromStatus -> toStatus)
   * transition. False when the row had already moved to a different status
   * by the time this call ran (a concurrent Accept/Decline, or a retried
   * request) — callers use this to notify exactly once per real transition,
   * never on an idempotent replay or a lost race.
   */
  transitioned: boolean;
}

/**
 * Profile UX Pack 01 Part 13 — atomic compare-and-swap on the single Ally
 * row, used by Author Accept/Decline. A plain `$set` upsert (as used by
 * `upsertInitiativeAllyDocument`) cannot safely express "only transition if
 * the row is still in `fromStatus`" — two concurrent Accept calls (or a
 * racing Accept and Decline) would otherwise both blindly overwrite the
 * status and both fire a notification. Filtering the `findOneAndUpdate` on
 * `status: fromStatus` makes MongoDB itself pick exactly one winner: the
 * loser's filter no longer matches (the row already moved), so it falls
 * through to the read-only branch below and reports `transitioned: false`
 * with the row's now-current (already-committed) state.
 */
export async function transitionInitiativeAllyStatus(input: {
  initiativeId: string;
  participantId: string;
  fromStatus: InitiativeAllyStatus;
  toStatus: InitiativeAllyStatus;
  updatedAt: string;
}): Promise<AllyStatusTransitionResult> {
  await ensureInitiativeAllyMongoReady();

  const updated = await alliesCollection().findOneAndUpdate(
    {
      initiativeId: input.initiativeId,
      participantId: input.participantId,
      status: input.fromStatus,
    },
    { $set: { status: input.toStatus, updatedAt: input.updatedAt } },
    { returnDocument: "after" },
  );

  if (updated) {
    return { ally: fromInitiativeAllyMongoDocument(updated), transitioned: true };
  }

  const current = await alliesCollection().findOne({
    initiativeId: input.initiativeId,
    participantId: input.participantId,
  });

  if (!current) {
    throw new InitiativeAllyPersistenceError(
      `No Initiative Ally row found for "${input.initiativeId}:${input.participantId}" to transition.`,
    );
  }

  return { ally: fromInitiativeAllyMongoDocument(current), transitioned: false };
}

export async function listActiveInitiativeAllyDocumentsByInitiativeId(
  initiativeId: string,
): Promise<InitiativeAlly[]> {
  await ensureInitiativeAllyMongoReady();

  const documents = await alliesCollection().find({ initiativeId, status: "active" }).toArray();

  return documents.map((document) => fromInitiativeAllyMongoDocument(document));
}

/**
 * Initiative UX Pack 01.1 Part 5/6 — production-safe cleanup: removes every
 * Ally row (interest, invitation, active, declined) for one Initiative.
 * Called when a Draft Initiative that was never published is permanently
 * deleted (Ally invitations are not lifecycle-gated, so a still-Draft
 * Initiative can already have Ally rows). Exact `initiativeId` selector
 * only, identical scope to the test-only helper below.
 */
export async function deleteInitiativeAlliesByInitiativeId(initiativeId: string): Promise<number> {
  if (!isMongoConfigured()) {
    return 0;
  }

  await connectMongoClient();
  const result = await alliesCollection().deleteMany({ initiativeId });

  return result.deletedCount ?? 0;
}

// --- Narrow test-only cleanup helper. Exact selector only; no delete-all,
// no wildcard mode.

export async function deleteInitiativeAlliesByInitiativeIdForTests(
  initiativeId: string,
): Promise<number> {
  return deleteInitiativeAlliesByInitiativeId(initiativeId);
}
