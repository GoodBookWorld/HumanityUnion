import type { InitiativeCollaborationSession, InitiativeCollaborationSessionAttendance } from "@hu/types";

import { MONGO_COLLECTIONS } from "../../../infrastructure/mongodb/mongo-collections.js";
import { isMongoConfigured } from "../../../infrastructure/mongodb/mongo-config.js";
import { connectMongoClient } from "../../../infrastructure/mongodb/mongo-connection.js";
import { getMongoCollection } from "../../../infrastructure/mongodb/mongo-database.js";
import {
  InitiativeCollaborationSessionPersistenceError,
  InitiativeCollaborationSessionPersistenceUnavailableError,
} from "../initiative-collaboration-sessions.errors.js";
import {
  fromInitiativeCollaborationSessionAttendanceMongoDocument,
  fromInitiativeCollaborationSessionMongoDocument,
  toInitiativeCollaborationSessionAttendanceMongoDocument,
  toInitiativeCollaborationSessionMongoDocument,
  type InitiativeCollaborationSessionAttendanceMongoDocument,
  type InitiativeCollaborationSessionMongoDocument,
} from "./initiative-collaboration-sessions.mongo-document.js";

async function ensureCollaborationSessionsMongoReady(): Promise<void> {
  if (!isMongoConfigured()) {
    throw new InitiativeCollaborationSessionPersistenceUnavailableError();
  }

  await connectMongoClient();
}

function sessionsCollection() {
  return getMongoCollection<InitiativeCollaborationSessionMongoDocument>(
    MONGO_COLLECTIONS.initiativeCollaborationSessions,
  );
}

function attendancesCollection() {
  return getMongoCollection<InitiativeCollaborationSessionAttendanceMongoDocument>(
    MONGO_COLLECTIONS.initiativeCollaborationSessionAttendances,
  );
}

export async function insertCollaborationSessionDocument(
  session: InitiativeCollaborationSession,
): Promise<void> {
  await ensureCollaborationSessionsMongoReady();

  try {
    await sessionsCollection().insertOne(toInitiativeCollaborationSessionMongoDocument(session));
  } catch (error) {
    throw new InitiativeCollaborationSessionPersistenceError("Collaboration Session insert failed.", error);
  }
}

/** Full-record replace — used by edit/reschedule/cancel (Part 5), always via `sessionId` + `initiativeId` together. */
export async function replaceCollaborationSessionDocument(
  session: InitiativeCollaborationSession,
): Promise<void> {
  await ensureCollaborationSessionsMongoReady();

  try {
    await sessionsCollection().replaceOne(
      { sessionId: session.sessionId, initiativeId: session.initiativeId },
      toInitiativeCollaborationSessionMongoDocument(session),
    );
  } catch (error) {
    throw new InitiativeCollaborationSessionPersistenceError("Collaboration Session update failed.", error);
  }
}

export async function findCollaborationSessionById(
  initiativeId: string,
  sessionId: string,
): Promise<InitiativeCollaborationSession | null> {
  await ensureCollaborationSessionsMongoReady();

  const document = await sessionsCollection().findOne({ initiativeId, sessionId });

  return document ? fromInitiativeCollaborationSessionMongoDocument(document) : null;
}

/** Part 4 — every Session for the Initiative; the service layer performs the Upcoming-first / history-ordering and status derivation. */
export async function listCollaborationSessionsByInitiative(
  initiativeId: string,
): Promise<InitiativeCollaborationSession[]> {
  await ensureCollaborationSessionsMongoReady();

  const documents = await sessionsCollection().find({ initiativeId }).sort({ scheduledAtUtc: 1 }).toArray();

  return documents.map((document) => fromInitiativeCollaborationSessionMongoDocument(document));
}

export async function upsertCollaborationSessionAttendanceDocument(
  attendance: InitiativeCollaborationSessionAttendance,
): Promise<void> {
  await ensureCollaborationSessionsMongoReady();

  try {
    await attendancesCollection().updateOne(
      { sessionId: attendance.sessionId, participantId: attendance.participantId },
      { $set: toInitiativeCollaborationSessionAttendanceMongoDocument(attendance) },
      { upsert: true },
    );
  } catch (error) {
    throw new InitiativeCollaborationSessionPersistenceError("Collaboration Session attendance upsert failed.", error);
  }
}

/** Part 6 — one attendance read per session; reused for both the Author's totals/roster and an Ally's own `viewerResponse`. */
export async function listCollaborationSessionAttendanceBySessionId(
  sessionId: string,
): Promise<InitiativeCollaborationSessionAttendance[]> {
  await ensureCollaborationSessionsMongoReady();

  const documents = await attendancesCollection().find({ sessionId }).toArray();

  return documents.map((document) => fromInitiativeCollaborationSessionAttendanceMongoDocument(document));
}

/** Part 14 — one batched read across every Session of an Initiative (never one query per session, avoiding N+1 when building the list view). */
export async function listCollaborationSessionAttendanceByInitiativeId(
  initiativeId: string,
): Promise<InitiativeCollaborationSessionAttendance[]> {
  await ensureCollaborationSessionsMongoReady();

  const documents = await attendancesCollection().find({ initiativeId }).toArray();

  return documents.map((document) => fromInitiativeCollaborationSessionAttendanceMongoDocument(document));
}

/**
 * Initiative UX Pack 01.1 Part 5/6 — production-safe cleanup: removes every
 * Collaboration Session and attendance row for one Initiative. Called when
 * a Draft Initiative that was never published is permanently deleted
 * (session creation is not lifecycle-gated, so an Author can already have
 * Sessions scheduled on a still-Draft Initiative via Initiative Group
 * Chat). Exact `initiativeId` selector only, identical scope to the
 * test-only helper below.
 */
export async function deleteCollaborationSessionDataByInitiativeId(initiativeId: string): Promise<void> {
  if (!isMongoConfigured()) {
    return;
  }

  await connectMongoClient();
  await sessionsCollection().deleteMany({ initiativeId });
  await attendancesCollection().deleteMany({ initiativeId });
}

// --- Narrow test-only cleanup helpers (exact selectors only; no delete-all). ---

export async function deleteCollaborationSessionDataByInitiativeIdForTests(initiativeId: string): Promise<void> {
  await deleteCollaborationSessionDataByInitiativeId(initiativeId);
}
