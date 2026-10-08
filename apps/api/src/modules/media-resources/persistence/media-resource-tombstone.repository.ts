import type { MediaResourceType } from "@hu/types";
import type { Document } from "mongodb";

import { MONGO_COLLECTIONS } from "../../../infrastructure/mongodb/mongo-collections.js";
import { isMongoConfigured } from "../../../infrastructure/mongodb/mongo-config.js";
import { connectMongoClient } from "../../../infrastructure/mongodb/mongo-connection.js";
import { getMongoCollection } from "../../../infrastructure/mongodb/mongo-database.js";
import { mediaResourcePersistenceUsesMemory } from "./media-resource.repository.js";
import {
  getMediaResourceTombstoneMemory,
  recordMediaResourceTombstoneMemory,
  type MediaResourceTombstone,
} from "./media-resource-tombstone.memory.js";

export type { MediaResourceTombstone };

interface MediaResourceTombstoneMongoDocument extends Document {
  resourceType: MediaResourceType;
  id: string;
  deletedAt: string;
  deletedByParticipantId: string | null;
}

function collection() {
  return getMongoCollection<MediaResourceTombstoneMongoDocument>(
    MONGO_COLLECTIONS.mediaResourceTombstones,
  );
}

async function ensureReady(): Promise<void> {
  if (!isMongoConfigured()) {
    throw new Error("MongoDB is not configured.");
  }
  await connectMongoClient();
}

function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: number }).code === 11000
  );
}

export async function getMediaResourceTombstone(input: {
  readonly resourceType: MediaResourceType;
  readonly id: string;
}): Promise<MediaResourceTombstone | null> {
  if (mediaResourcePersistenceUsesMemory()) {
    return getMediaResourceTombstoneMemory(input);
  }

  await ensureReady();
  const document = await collection().findOne({
    resourceType: input.resourceType,
    id: input.id,
  });
  if (!document) return null;
  return {
    resourceType: document.resourceType,
    id: document.id,
    deletedAt: document.deletedAt,
    deletedByParticipantId: document.deletedByParticipantId ?? null,
  };
}

/**
 * Records a hard-delete marker for (resourceType, id).
 * A second record for the same identity leaves the original marker unchanged.
 */
export async function recordMediaResourceTombstone(
  tombstone: MediaResourceTombstone,
): Promise<"recorded" | "exists"> {
  if (mediaResourcePersistenceUsesMemory()) {
    return recordMediaResourceTombstoneMemory(tombstone);
  }

  await ensureReady();
  try {
    await collection().insertOne({
      resourceType: tombstone.resourceType,
      id: tombstone.id,
      deletedAt: tombstone.deletedAt,
      deletedByParticipantId: tombstone.deletedByParticipantId,
    });
    return "recorded";
  } catch (error) {
    if (isDuplicateKeyError(error)) return "exists";
    throw error;
  }
}
