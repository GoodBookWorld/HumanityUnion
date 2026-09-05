/**
 * Reset 03A.1 — bounded one-entity sample discovery (identity fields only).
 * Never logs participant prose or document bodies.
 */

import type { MediaPlpEntityType } from "@hu/types";
import { MEDIA_PLP_ENTITY_TYPE } from "@hu/types";

import { CIVIC_MEDIA_SELECTION_PRINCIPLES } from "../../civic-media-center/content/sections.js";
import { MONGO_COLLECTIONS } from "../../../infrastructure/mongodb/mongo-collections.js";
import { getMongoCollection } from "../../../infrastructure/mongodb/mongo-database.js";
import { markMediaPlpPreflightSampleDiscovery } from "./counters.js";

export type MediaPlpSampleDiscoveryResult = {
  readonly SAMPLE_FOUND: boolean;
  readonly SAMPLE_ENTITY_TYPE: MediaPlpEntityType;
  readonly SAMPLE_ENTITY_ID: string | null;
};

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

async function samplePublicNews(): Promise<string | null> {
  markMediaPlpPreflightSampleDiscovery();
  const collection = getMongoCollection<{ id?: string }>(
    MONGO_COLLECTIONS.publicNewsArticles,
  );
  const now = new Date().toISOString();
  const doc = await collection.findOne(
    { status: "active", expiresAt: { $gt: now } },
    { projection: { id: 1 }, sort: { publishedAt: -1, id: 1 } },
  );
  const id = asString(doc?.id);
  return id || null;
}

async function sampleTrustedMedia(): Promise<string | null> {
  markMediaPlpPreflightSampleDiscovery();
  const collection = getMongoCollection<{ id?: string }>(
    MONGO_COLLECTIONS.mediaResources,
  );
  const doc = await collection.findOne(
    { resourceType: "TRUSTED_MEDIA", active: true },
    { projection: { id: 1 }, sort: { sortOrder: 1, id: 1 } },
  );
  const id = asString(doc?.id);
  return id || null;
}

function samplePrinciple(): string | null {
  markMediaPlpPreflightSampleDiscovery();
  // First valid canonical principle only — do not enumerate/log the seed.
  const first = CIVIC_MEDIA_SELECTION_PRINCIPLES[0];
  const id = asString(first?.id);
  return id || null;
}

/**
 * Return exactly one public Media entity id for the requested type.
 * Mongo paths use findOne + identity projection (no .toArray / corpus scan).
 */
export async function discoverMediaPlpSampleOne(
  entityType: MediaPlpEntityType,
): Promise<MediaPlpSampleDiscoveryResult> {
  let entityId: string | null = null;
  switch (entityType) {
    case MEDIA_PLP_ENTITY_TYPE.PUBLIC_NEWS:
      entityId = await samplePublicNews();
      break;
    case MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_TRUSTED:
      entityId = await sampleTrustedMedia();
      break;
    case MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_PRINCIPLE:
      entityId = samplePrinciple();
      break;
    default: {
      const _exhaustive: never = entityType;
      void _exhaustive;
      entityId = null;
    }
  }
  return {
    SAMPLE_FOUND: Boolean(entityId),
    SAMPLE_ENTITY_TYPE: entityType,
    SAMPLE_ENTITY_ID: entityId,
  };
}
