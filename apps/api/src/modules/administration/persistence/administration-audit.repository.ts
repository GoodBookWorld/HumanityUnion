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

let forceMemoryForTests = false;

export function setAdministrationAuditForceMemoryForTests(enabled: boolean): void {
  forceMemoryForTests = enabled;
}

function shouldUseMemoryAdapter(): boolean {
  return forceMemoryForTests || !isMongoConfigured();
}

async function ensureReady(): Promise<void> {
  if (shouldUseMemoryAdapter()) {
    return;
  }
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
  if (shouldUseMemoryAdapter()) {
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
  if (shouldUseMemoryAdapter()) {
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
  if (shouldUseMemoryAdapter()) {
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

export interface ListAdministrationAuditForAdminFilter {
  readonly action?: string;
  readonly actions?: readonly string[];
  readonly actorParticipantId?: string;
  readonly from?: string;
  readonly to?: string;
  readonly limit: number;
  readonly offset: number;
  /**
   * When set, load up to this many newest matching rows for in-memory search
   * (bounded scan — not a full-collection regex).
   */
  readonly scanLimit?: number;
}

function matchesAdminFilter(
  entry: AdministrationAuditRecord,
  filter: ListAdministrationAuditForAdminFilter,
): boolean {
  if (filter.action && entry.action !== filter.action) {
    return false;
  }
  if (filter.actions && filter.actions.length > 0 && !filter.actions.includes(entry.action)) {
    return false;
  }
  if (filter.actorParticipantId && entry.actorParticipantId !== filter.actorParticipantId) {
    return false;
  }
  if (filter.from && entry.createdAt < filter.from) {
    return false;
  }
  if (filter.to && entry.createdAt > filter.to) {
    return false;
  }
  return true;
}

function buildMongoFilter(
  filter: ListAdministrationAuditForAdminFilter,
): Record<string, unknown> {
  const query: Record<string, unknown> = {};
  if (filter.action) {
    query.action = filter.action;
  } else if (filter.actions && filter.actions.length > 0) {
    query.action = { $in: [...filter.actions] };
  }
  if (filter.actorParticipantId) {
    query.actorParticipantId = filter.actorParticipantId;
  }
  if (filter.from || filter.to) {
    const createdAt: Record<string, string> = {};
    if (filter.from) {
      createdAt.$gte = filter.from;
    }
    if (filter.to) {
      createdAt.$lte = filter.to;
    }
    query.createdAt = createdAt;
  }
  return query;
}

/**
 * Pack 23E.3 — Admin Audit browser list (newest first, offset pagination).
 * Retention: no TTL; append-only (governance owns long-term policy).
 */
export async function listAdministrationAuditForAdmin(
  filter: ListAdministrationAuditForAdminFilter,
): Promise<{ records: AdministrationAuditRecord[]; total: number }> {
  const limit = Math.min(Math.max(filter.limit, 1), 100);
  const offset = Math.max(filter.offset, 0);
  const scanLimit = filter.scanLimit
    ? Math.min(Math.max(filter.scanLimit, 1), 500)
    : undefined;

  await ensureReady();

  if (shouldUseMemoryAdapter()) {
    const filtered = memoryAudits
      .filter((entry) => matchesAdminFilter(entry, filter))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    if (scanLimit !== undefined) {
      const scanned = filtered.slice(0, scanLimit);
      return { records: scanned, total: scanned.length };
    }
    return {
      records: filtered.slice(offset, offset + limit).map((entry) => ({ ...entry })),
      total: filtered.length,
    };
  }

  const query = buildMongoFilter(filter);
  const cursor = collection().find(query).sort({ createdAt: -1, auditId: -1 });

  if (scanLimit !== undefined) {
    const docs = await cursor.limit(scanLimit).toArray();
    const records = docs.map(fromDoc);
    return { records, total: records.length };
  }

  const [total, docs] = await Promise.all([
    collection().countDocuments(query),
    cursor.skip(offset).limit(limit).toArray(),
  ]);

  return { records: docs.map(fromDoc), total };
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
  if (!isMongoConfigured() || forceMemoryForTests) {
    return;
  }
  await ensureReady();
  await collection().deleteMany({ actorParticipantId: { $in: [...actorParticipantIds] } });
}
