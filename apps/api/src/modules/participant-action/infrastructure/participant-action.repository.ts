import { MONGO_COLLECTIONS } from "../../../infrastructure/mongodb/mongo-collections.js";
import { isMongoConfigured } from "../../../infrastructure/mongodb/mongo-config.js";
import { connectMongoClient } from "../../../infrastructure/mongodb/mongo-connection.js";
import { getMongoCollection } from "../../../infrastructure/mongodb/mongo-database.js";
import type { ParticipantActionRecord } from "../domain/participant-action.types.js";
import {
  ParticipantActionConflictError,
  ParticipantActionPersistenceError,
} from "../participant-action.errors.js";
import {
  fromParticipantActionMongoDocument,
  toParticipantActionMongoDocument,
  type ParticipantActionMongoDocument,
} from "./participant-action.mongo-document.js";

/**
 * Recovery Task 27 Part 7 — narrow Participant Action repository boundary.
 * No HTTP-oriented search methods, no general update method (Part 13/19).
 */

let forceInsertFailureForTests = false;

/** Test-only hook for Part 12 "Mongo insert failure" failure-semantics coverage. */
export function setForceParticipantActionInsertFailureForTests(enabled: boolean): void {
  forceInsertFailureForTests = enabled;
}

function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: number }).code === 11_000
  );
}

function extractDuplicateKeyPattern(error: unknown): Record<string, unknown> | undefined {
  if (typeof error !== "object" || error === null) {
    return undefined;
  }

  return (error as { keyPattern?: Record<string, unknown> }).keyPattern;
}

/**
 * Recovery Task 33 Part 12 — fixed-order, `recordedAt`-excluded projection
 * used to classify a duplicate-key insert as a compatible (idempotent)
 * replay versus an incompatible invariant conflict. `recordedAt` is the one
 * field expected to legitimately differ between two mapper invocations of
 * the exact same source event (it is a wall-clock projection timestamp, not
 * part of the event's own identity/content), so it is deliberately excluded
 * from the comparison — every other field must match byte-for-byte.
 */
function toComparableParticipantAction(record: ParticipantActionRecord) {
  return {
    participantActionId: record.participantActionId,
    participantId: record.participantId,
    initiativeId: record.initiativeId,
    actionType: record.actionType,
    sourceType: record.sourceType,
    sourceId: record.sourceId,
    sourceEventId: record.sourceEventId,
    sourceEventName: record.sourceEventName,
    sourceEventSchemaVersion: record.sourceEventSchemaVersion,
    occurredAt: record.occurredAt,
    validityStatus: record.validityStatus,
    correlationId: record.correlationId,
    causationId: record.causationId,
    metadata: record.metadata,
  };
}

function isCompatibleParticipantActionDuplicate(
  existing: ParticipantActionRecord,
  incoming: ParticipantActionRecord,
): boolean {
  return (
    JSON.stringify(toComparableParticipantAction(existing)) ===
    JSON.stringify(toComparableParticipantAction(incoming))
  );
}

async function ensureParticipantActionMongoReady(): Promise<void> {
  if (!isMongoConfigured()) {
    throw new ParticipantActionPersistenceError("MongoDB is not configured.");
  }

  await connectMongoClient();
}

function collection() {
  return getMongoCollection<ParticipantActionMongoDocument>(MONGO_COLLECTIONS.participantActions);
}

export type ParticipantActionInsertOutcome = "created" | "idempotent_replay";

/**
 * Recovery Task 27 Part 11 — insert-only, idempotent-on-conflict write. The
 * `unique(sourceEventId)` index (Part 6) is the second, storage-level layer
 * of the dual idempotency protection; the first layer is the dispatcher's
 * existing `processed-events` claim (Part 11).
 *
 * Recovery Task 33 Part 12 — a duplicate-key error is no longer treated as
 * unconditionally idempotent. The already-stored record is re-read and
 * compared field-for-field (`recordedAt` excluded, see
 * `isCompatibleParticipantActionDuplicate`): identical content is a genuine
 * at-least-once replay (`"idempotent_replay"`, unchanged outcome/behavior
 * from Task 27 for every real Petition/Vote replay), while a mismatch is an
 * invariant conflict — `deterministic action ID or sourceEventId collided
 * with genuinely different content` — and is never silently swallowed.
 */
export async function insertParticipantActionIfAbsent(
  record: ParticipantActionRecord,
): Promise<ParticipantActionInsertOutcome> {
  await ensureParticipantActionMongoReady();

  if (forceInsertFailureForTests) {
    throw new ParticipantActionPersistenceError(
      "Forced Participant Action insert failure for tests.",
    );
  }

  try {
    await collection().insertOne(toParticipantActionMongoDocument(record));
    return "created";
  } catch (error) {
    if (!isDuplicateKeyError(error)) {
      throw new ParticipantActionPersistenceError("Participant Action insert failed.", error);
    }

    const keyPattern = extractDuplicateKeyPattern(error);
    const conflictIsOnSourceEventIdOnly =
      keyPattern !== undefined &&
      "sourceEventId" in keyPattern &&
      !("participantActionId" in keyPattern);

    const existingDocument = conflictIsOnSourceEventIdOnly
      ? await collection().findOne({ sourceEventId: record.sourceEventId })
      : await collection().findOne({ participantActionId: record.participantActionId });

    if (!existingDocument) {
      // The unique-index violation was reported but the colliding document
      // is no longer readable (e.g. deleted between the failed insert and
      // this lookup) — never guess; surface as a retryable persistence
      // failure rather than a false idempotent success.
      throw new ParticipantActionPersistenceError(
        "Participant Action insert failed: a duplicate key was reported but no existing record could be read back.",
        error,
      );
    }

    const existing = fromParticipantActionMongoDocument(existingDocument);

    if (isCompatibleParticipantActionDuplicate(existing, record)) {
      return "idempotent_replay";
    }

    throw new ParticipantActionConflictError(
      conflictIsOnSourceEventIdOnly
        ? `Participant Action insert conflict: sourceEventId "${record.sourceEventId}" already has an existing, incompatible Participant Action.`
        : `Participant Action insert conflict: participantActionId "${record.participantActionId}" already has an existing, incompatible Participant Action.`,
    );
  }
}

export async function findParticipantActionById(
  participantActionId: string,
): Promise<ParticipantActionRecord | null> {
  await ensureParticipantActionMongoReady();

  const document = await collection().findOne({ participantActionId });

  return document ? fromParticipantActionMongoDocument(document) : null;
}

export async function findParticipantActionBySourceEventId(
  sourceEventId: string,
): Promise<ParticipantActionRecord | null> {
  await ensureParticipantActionMongoReady();

  const document = await collection().findOne({ sourceEventId });

  return document ? fromParticipantActionMongoDocument(document) : null;
}

/**
 * Recovery Task 27 Part 19 — ordering is `occurredAt` descending with a
 * deterministic `participantActionId` tie-break. Internal read only, not
 * exposed over HTTP.
 */
export async function listParticipantActionsByParticipantId(
  participantId: string,
): Promise<ParticipantActionRecord[]> {
  await ensureParticipantActionMongoReady();

  const documents = await collection()
    .find({ participantId })
    .sort({ occurredAt: -1, participantActionId: 1 })
    .toArray();

  return documents.map((document) => fromParticipantActionMongoDocument(document));
}

export async function listParticipantActionsByInitiativeId(
  initiativeId: string,
): Promise<ParticipantActionRecord[]> {
  await ensureParticipantActionMongoReady();

  const documents = await collection()
    .find({ initiativeId })
    .sort({ occurredAt: -1, participantActionId: 1 })
    .toArray();

  return documents.map((document) => fromParticipantActionMongoDocument(document));
}

export async function countParticipantActionsBySourceEventId(
  sourceEventId: string,
): Promise<number> {
  await ensureParticipantActionMongoReady();

  return collection().countDocuments({ sourceEventId });
}

export async function deleteParticipantActionsBySourceEventIdForTests(
  sourceEventId: string,
): Promise<number> {
  if (!isMongoConfigured()) {
    return 0;
  }

  await connectMongoClient();
  const result = await collection().deleteOne({ sourceEventId });

  return result.deletedCount ?? 0;
}

export async function deleteParticipantActionsByParticipantIdForTests(
  participantId: string,
): Promise<number> {
  if (!isMongoConfigured()) {
    return 0;
  }

  await connectMongoClient();
  const result = await collection().deleteMany({ participantId });

  return result.deletedCount ?? 0;
}

export async function deleteParticipantActionsByInitiativeIdForTests(
  initiativeId: string,
): Promise<number> {
  if (!isMongoConfigured()) {
    return 0;
  }

  await connectMongoClient();
  const result = await collection().deleteMany({ initiativeId });

  return result.deletedCount ?? 0;
}
