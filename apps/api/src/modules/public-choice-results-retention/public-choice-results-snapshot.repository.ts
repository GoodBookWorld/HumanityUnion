import { MONGO_COLLECTIONS } from "../../infrastructure/mongodb/mongo-collections.js";
import { isMongoConfigured } from "../../infrastructure/mongodb/mongo-config.js";
import { connectMongoClient } from "../../infrastructure/mongodb/mongo-connection.js";
import { getMongoCollection } from "../../infrastructure/mongodb/mongo-database.js";
import type {
  PublicChoiceResultsSnapshot,
  PublicChoiceResultsSnapshotDocument,
} from "./public-choice-results-snapshot.mongo-document.js";

async function ensureReady(): Promise<void> {
  if (!isMongoConfigured()) {
    throw new Error("MongoDB is not configured.");
  }
  await connectMongoClient();
}

function collection() {
  return getMongoCollection<PublicChoiceResultsSnapshotDocument>(
    MONGO_COLLECTIONS.publicChoiceResultsSnapshots,
  );
}

export async function upsertPublicChoiceResultsSnapshot(
  snapshot: PublicChoiceResultsSnapshot,
): Promise<PublicChoiceResultsSnapshot> {
  await ensureReady();
  await collection().replaceOne({ snapshotId: snapshot.snapshotId }, snapshot, { upsert: true });
  return snapshot;
}

export async function findPublicChoiceResultsSnapshotByDecision(
  decisionId: string,
): Promise<PublicChoiceResultsSnapshot | null> {
  await ensureReady();
  const document = await collection().findOne({ decisionId });
  return document ?? null;
}

export async function findPublicChoiceResultsSnapshotByInitiative(
  initiativeId: string,
): Promise<PublicChoiceResultsSnapshot | null> {
  await ensureReady();
  const document = await collection().findOne({ initiativeId }, { sort: { frozenAt: -1 } });
  return document ?? null;
}

export async function deletePublicChoiceResultsSnapshotsByInitiative(
  initiativeId: string,
): Promise<number> {
  await ensureReady();
  const result = await collection().deleteMany({ initiativeId });
  return result.deletedCount ?? 0;
}

export async function listExpiredPublicChoiceResultsSnapshots(
  nowIso: string,
): Promise<PublicChoiceResultsSnapshot[]> {
  await ensureReady();
  return collection().find({ expiresAt: { $lte: nowIso } }).toArray();
}
