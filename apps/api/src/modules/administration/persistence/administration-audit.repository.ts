import type { AdministrationAuditRecord } from "@hu/types";

import { MONGO_COLLECTIONS } from "../../../infrastructure/mongodb/mongo-collections.js";
import { isMongoConfigured } from "../../../infrastructure/mongodb/mongo-config.js";
import { connectMongoClient } from "../../../infrastructure/mongodb/mongo-connection.js";
import { getMongoCollection } from "../../../infrastructure/mongodb/mongo-database.js";
import { AdministrationAuditImmutableError } from "../administration.errors.js";

interface AdministrationAuditMongoDocument extends AdministrationAuditRecord {
  _id?: string;
}

const memoryAudits: AdministrationAuditRecord[] = [];

async function ensureReady(): Promise<void> {
  if (!isMongoConfigured()) {
    return;
  }
  await connectMongoClient();
}

function collection() {
  return getMongoCollection<AdministrationAuditMongoDocument>(
    MONGO_COLLECTIONS.administrationAuditLog,
  );
}

function fromDoc(doc: AdministrationAuditMongoDocument): AdministrationAuditRecord {
  const { _id: _ignored, ...record } = doc;
  return { ...record };
}

/** Append-only insert. Updates and deletes are rejected. */
export async function appendAdministrationAuditRecord(
  record: AdministrationAuditRecord,
): Promise<AdministrationAuditRecord> {
  await ensureReady();
  if (!isMongoConfigured()) {
    memoryAudits.push({ ...record });
    return { ...record };
  }
  await collection().insertOne({ ...record });
  return { ...record };
}

export async function findAdministrationAuditById(
  auditId: string,
): Promise<AdministrationAuditRecord | null> {
  await ensureReady();
  if (!isMongoConfigured()) {
    return memoryAudits.find((entry) => entry.auditId === auditId) ?? null;
  }
  const doc = await collection().findOne({ auditId });
  return doc ? fromDoc(doc) : null;
}

export async function listAdministrationAuditByTarget(input: {
  targetType: string;
  targetId: string;
  limit?: number;
}): Promise<AdministrationAuditRecord[]> {
  const limit = Math.min(Math.max(input.limit ?? 50, 1), 200);
  await ensureReady();
  if (!isMongoConfigured()) {
    return memoryAudits
      .filter(
        (entry) =>
          entry.targetType === input.targetType && entry.targetId === input.targetId,
      )
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .slice(-limit)
      .map((entry) => ({ ...entry }));
  }
  const docs = await collection()
    .find({ targetType: input.targetType, targetId: input.targetId })
    .sort({ createdAt: 1 })
    .limit(limit)
    .toArray();
  return docs.map(fromDoc);
}

/** Explicitly forbidden — audit is append-only. */
export function rejectAuditMutation(): never {
  throw new AdministrationAuditImmutableError();
}

export function resetAdministrationAuditMemoryForTests(): void {
  memoryAudits.length = 0;
}

export async function deleteAdministrationAuditByActorIdsForTests(
  actorParticipantIds: readonly string[],
): Promise<void> {
  if (actorParticipantIds.length === 0) {
    return;
  }
  const idSet = new Set(actorParticipantIds);
  for (let index = memoryAudits.length - 1; index >= 0; index -= 1) {
    if (idSet.has(memoryAudits[index]!.actorParticipantId)) {
      memoryAudits.splice(index, 1);
    }
  }
  if (!isMongoConfigured()) {
    return;
  }
  await ensureReady();
  await collection().deleteMany({ actorParticipantId: { $in: [...actorParticipantIds] } });
}
