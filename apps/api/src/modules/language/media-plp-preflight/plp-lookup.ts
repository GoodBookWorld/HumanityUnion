/**
 * Reset 03A — one-entity PLP current-pointer lookup (indexed, read-only).
 * Never scans history. Never logs presentation prose.
 */

import { PUBLISHED_LOCALIZATION_SCHEMA_VERSION } from "@hu/types";

import { MONGO_COLLECTIONS } from "../../../infrastructure/mongodb/mongo-collections.js";
import { getMongoCollection } from "../../../infrastructure/mongodb/mongo-database.js";
import { markMediaPlpPreflightPlpLookup } from "./counters.js";

export type MediaPlpPreflightPlpLookup = {
  readonly PLP_CURRENT_FOUND: boolean;
  readonly PLP_STATE: string | null;
  readonly PLP_CANONICAL_VERSION: string | null;
  readonly PLP_SCHEMA_VERSION: string | null;
  readonly PLP_DOCUMENT_BYTES: number;
  readonly PLP_RECORDS_MATCHED: number;
  readonly identityCollision: boolean;
};

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function documentBytes(value: unknown): number {
  try {
    return Buffer.byteLength(JSON.stringify(value), "utf8");
  } catch {
    return 0;
  }
}

export async function loadMediaPlpPreflightCurrent(input: {
  readonly entityType: string;
  readonly entityId: string;
  readonly locale: string;
}): Promise<MediaPlpPreflightPlpLookup> {
  markMediaPlpPreflightPlpLookup();
  const collection = getMongoCollection<Record<string, unknown>>(
    MONGO_COLLECTIONS.publishedLocalizedPresentationsCurrent,
  );
  const locale = input.locale.toLowerCase();
  const cursor = collection.find(
    {
      entityType: input.entityType,
      entityId: input.entityId,
      locale,
    },
    {
      projection: {
        state: 1,
        identity: 1,
        contentRevision: 1,
        snapshotId: 1,
        publishedAt: 1,
        updatedAt: 1,
      },
      limit: 2,
    },
  );
  const doc = (await cursor.next()) as Record<string, unknown> | null;
  const second = await cursor.next();
  if (second) {
    return {
      PLP_CURRENT_FOUND: false,
      PLP_STATE: null,
      PLP_CANONICAL_VERSION: null,
      PLP_SCHEMA_VERSION: null,
      PLP_DOCUMENT_BYTES: 0,
      PLP_RECORDS_MATCHED: 2,
      identityCollision: true,
    };
  }

  if (!doc) {
    return {
      PLP_CURRENT_FOUND: false,
      PLP_STATE: null,
      PLP_CANONICAL_VERSION: null,
      PLP_SCHEMA_VERSION: null,
      PLP_DOCUMENT_BYTES: 0,
      PLP_RECORDS_MATCHED: 0,
      identityCollision: false,
    };
  }

  const identity =
    doc.identity && typeof doc.identity === "object" && !Array.isArray(doc.identity)
      ? (doc.identity as Record<string, unknown>)
      : {};

  return {
    PLP_CURRENT_FOUND: true,
    PLP_STATE: asString(doc.state) || null,
    PLP_CANONICAL_VERSION: asString(identity.canonicalVersion) || null,
    PLP_SCHEMA_VERSION:
      asString(identity.localizationSchemaVersion) ||
      PUBLISHED_LOCALIZATION_SCHEMA_VERSION,
    PLP_DOCUMENT_BYTES: documentBytes(doc),
    PLP_RECORDS_MATCHED: 1,
    identityCollision: false,
  };
}
