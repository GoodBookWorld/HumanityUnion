import type { SharedDocumentContextRef } from "@hu/types";

import { MONGO_COLLECTIONS } from "../../../infrastructure/mongodb/mongo-collections.js";
import { isMongoConfigured } from "../../../infrastructure/mongodb/mongo-config.js";
import { connectMongoClient } from "../../../infrastructure/mongodb/mongo-connection.js";
import { getMongoCollection } from "../../../infrastructure/mongodb/mongo-database.js";
import { SharedDocumentPersistenceError, SharedDocumentPersistenceUnavailableError } from "../shared-documents.errors.js";
import {
  fromSharedDocumentMongoDocument,
  toSharedDocumentMongoDocument,
  type SharedDocumentMongoDocument,
  type SharedDocumentRecord,
} from "./shared-documents.mongo-document.js";

async function ensureSharedDocumentsMongoReady(): Promise<void> {
  if (!isMongoConfigured()) {
    throw new SharedDocumentPersistenceUnavailableError();
  }

  await connectMongoClient();
}

function documentsCollection() {
  return getMongoCollection<SharedDocumentMongoDocument>(MONGO_COLLECTIONS.sharedDocuments);
}

export async function insertSharedDocument(record: SharedDocumentRecord): Promise<void> {
  await ensureSharedDocumentsMongoReady();

  try {
    await documentsCollection().insertOne(toSharedDocumentMongoDocument(record));
  } catch (error) {
    throw new SharedDocumentPersistenceError("Shared Document insert failed.", error);
  }
}

export async function findSharedDocumentById(documentId: string): Promise<SharedDocumentRecord | null> {
  await ensureSharedDocumentsMongoReady();

  const document = await documentsCollection().findOne({ documentId });

  return document ? fromSharedDocumentMongoDocument(document) : null;
}

/** Part 9 — marks the current latest version as superseded; used by "replace" immediately before inserting the new version. */
export async function markSharedDocumentSuperseded(documentId: string, supersededAt: string): Promise<void> {
  await ensureSharedDocumentsMongoReady();

  try {
    await documentsCollection().updateOne(
      { documentId },
      { $set: { isLatestVersion: false, supersededAt } },
    );
  } catch (error) {
    throw new SharedDocumentPersistenceError("Shared Document supersede update failed.", error);
  }
}

/** Part 9 — soft-removal; the row (and its version history) remains queryable, but is excluded from every active list/download path. */
export async function markSharedDocumentRemoved(documentId: string, removedAt: string): Promise<void> {
  await ensureSharedDocumentsMongoReady();

  try {
    await documentsCollection().updateOne({ documentId }, { $set: { removedAt } });
  } catch (error) {
    throw new SharedDocumentPersistenceError("Shared Document removal update failed.", error);
  }
}

interface ContextQuery {
  contextType: SharedDocumentContextRef["contextType"];
  conversationId?: string;
  initiativeId?: string;
  sessionId?: string;
  responseId?: string;
}

/** Part 11 — latest, non-removed documents for one context, newest first. Always a single indexed query (Part 15 — never one query per document). */
export async function listLatestSharedDocumentsByContext(query: ContextQuery): Promise<SharedDocumentRecord[]> {
  await ensureSharedDocumentsMongoReady();

  const documents = await documentsCollection()
    .find({ ...query, isLatestVersion: true, removedAt: { $exists: false } })
    .sort({ uploadedAt: -1 })
    .toArray();

  return documents.map((document) => fromSharedDocumentMongoDocument(document));
}

/**
 * Initiative UX Pack 01.1 Part 5/6 — every Shared Document version for one
 * Initiative, across BOTH `collaboration_channel` and every
 * `collaboration_session` context (both store `initiativeId` directly —
 * see `toSharedDocumentMongoDocument`), including already-superseded and
 * already-removed rows. Unlike `listLatestSharedDocumentsByContext`, this
 * intentionally does not filter by `isLatestVersion`/`removedAt`: a
 * "replace" keeps the prior version's file on disk, so permanently
 * deleting a Draft Initiative must find every storageKey ever written for
 * it, not just the currently-visible one, or a file would be orphaned.
 */
export async function listAllSharedDocumentsByInitiativeId(
  initiativeId: string,
): Promise<SharedDocumentRecord[]> {
  if (!isMongoConfigured()) {
    return [];
  }

  await connectMongoClient();

  const documents = await documentsCollection().find({ initiativeId }).toArray();

  return documents.map((document) => fromSharedDocumentMongoDocument(document));
}

/**
 * Initiative UX Pack 01.1 Part 5/6 — production-safe cleanup: removes every
 * Shared Document row (any version, any context) for one Initiative. Call
 * sites must delete the underlying files (via
 * `listAllSharedDocumentsByInitiativeId` + the storage provider) first —
 * this only removes the database rows.
 */
export async function deleteSharedDocumentsByInitiativeId(initiativeId: string): Promise<void> {
  if (!isMongoConfigured()) {
    return;
  }

  await connectMongoClient();
  await documentsCollection().deleteMany({ initiativeId });
}

// --- Narrow test-only cleanup helpers (exact selectors only; no delete-all). ---

export async function deleteSharedDocumentsByContextForTests(query: ContextQuery): Promise<void> {
  if (!isMongoConfigured()) {
    return;
  }

  await connectMongoClient();
  await documentsCollection().deleteMany(query);
}
