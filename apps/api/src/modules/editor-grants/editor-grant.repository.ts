import type { Collection } from "mongodb";

import type { EditorGrantRecord } from "@hu/types";

import { getMongoCollection } from "../../infrastructure/mongodb/mongo-database.js";
import { MONGO_COLLECTIONS } from "../../infrastructure/mongodb/mongo-collections.js";

function collection(): Collection<EditorGrantRecord> {
  return getMongoCollection(MONGO_COLLECTIONS.editorGrants) as Collection<EditorGrantRecord>;
}

export async function insertEditorGrant(record: EditorGrantRecord): Promise<EditorGrantRecord> {
  await collection().insertOne({ ...record });
  return record;
}

export async function replaceEditorGrant(record: EditorGrantRecord): Promise<EditorGrantRecord> {
  await collection().replaceOne({ editorGrantId: record.editorGrantId }, record, {
    upsert: false,
  });
  return record;
}

export async function findEditorGrantById(
  editorGrantId: string,
): Promise<EditorGrantRecord | null> {
  return collection().findOne({ editorGrantId }, { projection: { _id: 0 } });
}

export async function findEditorGrantByParticipantId(
  participantId: string,
): Promise<EditorGrantRecord | null> {
  return collection().findOne({ participantId }, { projection: { _id: 0 } });
}

export async function listEditorGrants(input: {
  status?: EditorGrantRecord["status"];
  limit: number;
  offset: number;
}): Promise<{ items: EditorGrantRecord[]; total: number; activeCount: number }> {
  const filter = input.status ? { status: input.status } : {};
  const [items, total, activeCount] = await Promise.all([
    collection()
      .find(filter, { projection: { _id: 0 } })
      .sort({ updatedAt: -1 })
      .skip(input.offset)
      .limit(input.limit)
      .toArray(),
    collection().countDocuments(filter),
    collection().countDocuments({ status: "ACTIVE" }),
  ]);
  return { items, total, activeCount };
}

export async function countEditorGrantsByStatus(): Promise<{
  total: number;
  activeCount: number;
  inactiveCount: number;
}> {
  const [total, activeCount] = await Promise.all([
    collection().countDocuments({}),
    collection().countDocuments({ status: "ACTIVE" }),
  ]);
  return {
    total,
    activeCount,
    inactiveCount: Math.max(0, total - activeCount),
  };
}

/** Test cleanup helper — delete by participant id prefix/list. */
export async function deleteEditorGrantsByParticipantIds(
  participantIds: readonly string[],
): Promise<void> {
  if (participantIds.length === 0) {
    return;
  }
  await collection().deleteMany({ participantId: { $in: [...participantIds] } });
}
