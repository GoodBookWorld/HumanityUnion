/**
 * Durable WEB_UI activation checkpoint + batch repository (Mongo + memory).
 */

import type {
  WebUiActivationBatchPhase,
  WebUiActivationBatchRecord,
  WebUiActivationCheckpointRecord,
} from "@hu/types";

import { MONGO_COLLECTIONS } from "../../infrastructure/mongodb/mongo-collections.js";
import { isMongoConfigured } from "../../infrastructure/mongodb/mongo-config.js";
import { connectMongoClient } from "../../infrastructure/mongodb/mongo-connection.js";
import { getMongoCollection } from "../../infrastructure/mongodb/mongo-database.js";
import {
  getWebUiActivationBatchMemory,
  getWebUiActivationCheckpointByJobMemory,
  getWebUiActivationCheckpointMemory,
  listIncompleteWebUiActivationCheckpointsMemory,
  listWebUiActivationBatchesMemory,
  resetWebUiActivationCheckpointMemoryForTests,
  upsertWebUiActivationBatchMemory,
  upsertWebUiActivationCheckpointMemory,
} from "./web-ui-activation-checkpoint.memory.store.js";

let forceMemoryForTests = false;

export function setWebUiActivationCheckpointForceMemoryForTests(enabled: boolean): void {
  forceMemoryForTests = enabled;
}

export function resetWebUiActivationCheckpointStoreForTests(): void {
  resetWebUiActivationCheckpointMemoryForTests();
}

function shouldUseMemoryAdapter(): boolean {
  return forceMemoryForTests || !isMongoConfigured();
}

async function ensureMongoReady(): Promise<void> {
  await connectMongoClient();
}

type CheckpointDoc = WebUiActivationCheckpointRecord & { _id?: unknown };
type BatchDoc = WebUiActivationBatchRecord & {
  _id?: unknown;
  batchKey: string;
};

function checkpointCollection() {
  return getMongoCollection<CheckpointDoc>(
    MONGO_COLLECTIONS.languageActivationWebUiCheckpoints,
  );
}

function batchCollection() {
  return getMongoCollection<BatchDoc>(MONGO_COLLECTIONS.languageActivationWebUiBatches);
}

function toBatchKey(
  checkpointId: string,
  phase: WebUiActivationBatchPhase,
  batchId: string,
): string {
  return `${checkpointId}::${phase}::${batchId}`;
}

export async function upsertWebUiActivationCheckpoint(
  record: WebUiActivationCheckpointRecord,
): Promise<WebUiActivationCheckpointRecord> {
  if (shouldUseMemoryAdapter()) {
    return upsertWebUiActivationCheckpointMemory(record);
  }
  await ensureMongoReady();
  await checkpointCollection().updateOne(
    { checkpointId: record.checkpointId },
    { $set: { ...record } },
    { upsert: true },
  );
  return record;
}

export async function getWebUiActivationCheckpoint(
  checkpointId: string,
): Promise<WebUiActivationCheckpointRecord | null> {
  if (shouldUseMemoryAdapter()) {
    return getWebUiActivationCheckpointMemory(checkpointId);
  }
  await ensureMongoReady();
  const doc = await checkpointCollection().findOne({ checkpointId });
  if (!doc) {
    return null;
  }
  const { _id: _ignored, ...rest } = doc;
  return rest;
}

export async function getWebUiActivationCheckpointByJobId(
  jobId: string,
): Promise<WebUiActivationCheckpointRecord | null> {
  if (shouldUseMemoryAdapter()) {
    return getWebUiActivationCheckpointByJobMemory(jobId);
  }
  await ensureMongoReady();
  const doc = await checkpointCollection().findOne(
    { jobId },
    { sort: { updatedAt: -1 } },
  );
  if (!doc) {
    return null;
  }
  const { _id: _ignored, ...rest } = doc;
  return rest;
}

export async function listIncompleteWebUiActivationCheckpoints(): Promise<
  readonly WebUiActivationCheckpointRecord[]
> {
  if (shouldUseMemoryAdapter()) {
    return listIncompleteWebUiActivationCheckpointsMemory();
  }
  await ensureMongoReady();
  const docs = await checkpointCollection()
    .find({
      phase: { $in: ["primary", "quality", "validating", "publishing"] },
    })
    .toArray();
  return docs.map((doc) => {
    const { _id: _ignored, ...rest } = doc;
    return rest;
  });
}

export async function upsertWebUiActivationBatch(
  record: WebUiActivationBatchRecord,
): Promise<WebUiActivationBatchRecord> {
  if (shouldUseMemoryAdapter()) {
    return upsertWebUiActivationBatchMemory(record);
  }
  await ensureMongoReady();
  const batchKey = toBatchKey(record.checkpointId, record.phase, record.batchId);
  await batchCollection().updateOne(
    { batchKey },
    { $set: { ...record, batchKey } },
    { upsert: true },
  );
  return record;
}

export async function getWebUiActivationBatch(input: {
  readonly checkpointId: string;
  readonly batchId: string;
  readonly phase: WebUiActivationBatchPhase;
}): Promise<WebUiActivationBatchRecord | null> {
  if (shouldUseMemoryAdapter()) {
    return getWebUiActivationBatchMemory(input);
  }
  await ensureMongoReady();
  const doc = await batchCollection().findOne({
    batchKey: toBatchKey(input.checkpointId, input.phase, input.batchId),
  });
  if (!doc) {
    return null;
  }
  const { _id: _ignored, batchKey: _key, ...rest } = doc;
  return rest;
}

export async function listWebUiActivationBatches(
  checkpointId: string,
  phase?: WebUiActivationBatchPhase,
): Promise<readonly WebUiActivationBatchRecord[]> {
  if (shouldUseMemoryAdapter()) {
    return listWebUiActivationBatchesMemory(checkpointId, phase);
  }
  await ensureMongoReady();
  const filter =
    phase == null ? { checkpointId } : { checkpointId, phase };
  const docs = await batchCollection().find(filter).toArray();
  return docs.map((doc) => {
    const { _id: _ignored, batchKey: _key, ...rest } = doc;
    return rest;
  });
}

export async function assembleWebUiActivationTranslatedMap(
  checkpointId: string,
): Promise<Record<string, string>> {
  const primary = await listWebUiActivationBatches(checkpointId, "primary");
  const quality = await listWebUiActivationBatches(checkpointId, "quality");
  const out: Record<string, string> = {};
  for (const batch of primary) {
    if (batch.status !== "ok") {
      continue;
    }
    Object.assign(out, batch.values);
  }
  for (const batch of quality) {
    if (batch.status !== "ok") {
      continue;
    }
    Object.assign(out, batch.values);
  }
  return out;
}
