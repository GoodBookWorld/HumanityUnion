/**
 * Reset 02 — Mongo persistence for PublishedLocalizedPresentation (narrow projections).
 * Current pointer collection is the only read path for PUBLISHED resolution.
 */

import type { PublishedLocalizedPresentationRecord } from "@hu/types";

import { MONGO_COLLECTIONS } from "../../../../infrastructure/mongodb/mongo-collections.js";
import { isMongoConfigured } from "../../../../infrastructure/mongodb/mongo-config.js";
import { connectMongoClient } from "../../../../infrastructure/mongodb/mongo-connection.js";
import { getMongoCollection } from "../../../../infrastructure/mongodb/mongo-database.js";

type CurrentDocument = PublishedLocalizedPresentationRecord & {
  readonly entityType: string;
  readonly entityId: string;
  readonly locale: string;
  readonly _id?: unknown;
};

async function ensureMongoReady(): Promise<void> {
  if (!isMongoConfigured()) {
    throw new Error("MongoDB is not configured for published localized presentations.");
  }
  await connectMongoClient();
}

function toCurrentDocument(
  record: PublishedLocalizedPresentationRecord,
): Omit<CurrentDocument, "_id"> {
  return {
    ...record,
    entityType: record.identity.entityType,
    entityId: record.identity.entityId,
    locale: String(record.identity.locale).toLowerCase(),
  };
}

function fromCurrentDocument(doc: CurrentDocument): PublishedLocalizedPresentationRecord {
  return {
    snapshotId: doc.snapshotId,
    identity: doc.identity,
    state: doc.state,
    contentRevision: doc.contentRevision,
    presentation: doc.presentation,
    provenance: doc.provenance,
    seo: doc.seo,
    ...(doc.contentIntegrity ? { contentIntegrity: doc.contentIntegrity } : {}),
    publishedAt: doc.publishedAt,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    failureReasonCodes: doc.failureReasonCodes,
  };
}

export async function findCurrentPublishedMongo(input: {
  readonly entityType: string;
  readonly entityId: string;
  readonly locale: string;
}): Promise<PublishedLocalizedPresentationRecord | null> {
  await ensureMongoReady();
  const collection = getMongoCollection<CurrentDocument>(
    MONGO_COLLECTIONS.publishedLocalizedPresentationsCurrent,
  );
  const doc = await collection.findOne(
    {
      entityType: input.entityType,
      entityId: input.entityId,
      locale: input.locale.toLowerCase(),
      state: "PUBLISHED",
    },
    {
      projection: { _id: 0 },
    },
  );
  if (!doc) {
    return null;
  }
  return fromCurrentDocument(doc);
}

export async function putPublishedSnapshotHistoryMongo(
  record: PublishedLocalizedPresentationRecord,
): Promise<void> {
  await ensureMongoReady();
  const collection = getMongoCollection<PublishedLocalizedPresentationRecord>(
    MONGO_COLLECTIONS.publishedLocalizedPresentationsHistory,
  );
  await collection.updateOne(
    { snapshotId: record.snapshotId },
    { $set: record },
    { upsert: true },
  );
}

/**
 * Atomic current-pointer publish via compare-and-swap on contentRevision.
 * Unique index on (entityType, entityId, locale) prevents dual PUBLISHED rows.
 */
export async function publishAtomicMongo(input: {
  readonly candidate: PublishedLocalizedPresentationRecord;
}): Promise<
  | {
      readonly ok: true;
      readonly record: PublishedLocalizedPresentationRecord;
      readonly supersededSnapshotId?: string;
      readonly idempotent: boolean;
    }
  | { readonly ok: false; readonly reason: "STALE_REVISION" | "PERSISTENCE_ERROR" }
> {
  try {
    await ensureMongoReady();
    const collection = getMongoCollection<CurrentDocument>(
      MONGO_COLLECTIONS.publishedLocalizedPresentationsCurrent,
    );
    const locale = String(input.candidate.identity.locale).toLowerCase();
    const publishedDoc = toCurrentDocument({
      ...input.candidate,
      state: "PUBLISHED",
      publishedAt: input.candidate.publishedAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const existing = await collection.findOne(
      {
        entityType: publishedDoc.entityType,
        entityId: publishedDoc.entityId,
        locale,
      },
      { projection: { _id: 0 } },
    );

    if (existing) {
      if (existing.contentRevision > publishedDoc.contentRevision) {
        return { ok: false, reason: "STALE_REVISION" };
      }
      if (
        existing.contentRevision === publishedDoc.contentRevision &&
        existing.identity.canonicalVersion === publishedDoc.identity.canonicalVersion &&
        existing.identity.localizationSchemaVersion ===
          publishedDoc.identity.localizationSchemaVersion
      ) {
        return {
          ok: true,
          record: fromCurrentDocument(existing),
          idempotent: true,
        };
      }
    }

    const result = await collection.findOneAndUpdate(
      {
        entityType: publishedDoc.entityType,
        entityId: publishedDoc.entityId,
        locale,
        $or: [
          { contentRevision: { $exists: false } },
          { contentRevision: { $lte: publishedDoc.contentRevision } },
        ],
      },
      { $set: publishedDoc },
      { upsert: true, returnDocument: "before" },
    );

    const previous =
      result && typeof result === "object" && "snapshotId" in result
        ? fromCurrentDocument(result as CurrentDocument)
        : existing
          ? fromCurrentDocument(existing)
          : null;

    let supersededSnapshotId: string | undefined;
    if (
      previous &&
      previous.state === "PUBLISHED" &&
      previous.snapshotId !== publishedDoc.snapshotId &&
      !(
        previous.contentRevision === publishedDoc.contentRevision &&
        previous.identity.canonicalVersion === publishedDoc.identity.canonicalVersion
      )
    ) {
      const superseded = {
        ...previous,
        state: "SUPERSEDED" as const,
        updatedAt: new Date().toISOString(),
      };
      await putPublishedSnapshotHistoryMongo(superseded);
      supersededSnapshotId = superseded.snapshotId;
    }

    await putPublishedSnapshotHistoryMongo(fromCurrentDocument(publishedDoc));

    return {
      ok: true,
      record: fromCurrentDocument(publishedDoc),
      supersededSnapshotId,
      idempotent: false,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("E11000") || message.includes("duplicate key")) {
      return { ok: false, reason: "STALE_REVISION" };
    }
    return { ok: false, reason: "PERSISTENCE_ERROR" };
  }
}
