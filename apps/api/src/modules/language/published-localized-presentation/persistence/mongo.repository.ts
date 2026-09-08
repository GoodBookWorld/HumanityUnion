/**
 * Reset 02 / RESET 05D.7 — Mongo persistence for PublishedLocalizedPresentation.
 * Current pointer collection is the only read path for PUBLISHED resolution.
 *
 * RESET 05D.7 — contentRevision CAS applies only within the same canonicalVersion.
 * A newer canonical source version must supersede an older published pointer
 * even when the candidate contentRevision is lower (editorial always uses 1).
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

export type PublishAtomicStaleForensics = {
  readonly STALE_WORK_VERSION: string;
  readonly STALE_CURRENT_SOURCE_VERSION: string;
  readonly STALE_BOUNDARY: string;
  readonly STALE_AUTHORITY: string;
  readonly STALE_WORK_CONTENT_REVISION: number;
  readonly STALE_EXISTING_CONTENT_REVISION: number;
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
    ...(doc.structuralIntegrity
      ? { structuralIntegrity: doc.structuralIntegrity }
      : {}),
    publishedAt: doc.publishedAt,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    failureReasonCodes: doc.failureReasonCodes,
  };
}

function sameCanonicalIdentity(
  a: PublishedLocalizedPresentationRecord["identity"],
  b: PublishedLocalizedPresentationRecord["identity"],
): boolean {
  return (
    a.canonicalVersion === b.canonicalVersion &&
    a.localizationSchemaVersion === b.localizationSchemaVersion
  );
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
  const collection = getMongoCollection(
    MONGO_COLLECTIONS.publishedLocalizedPresentationsHistory,
  );
  await collection.updateOne(
    { snapshotId: record.snapshotId },
    { $set: record },
    { upsert: true },
  );
}

/**
 * Atomic current-pointer publish via compare-and-swap.
 *
 * Same canonicalVersion: CAS on contentRevision (genuine concurrent stale).
 * Different canonicalVersion: new source wins; bump contentRevision past existing.
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
  | {
      readonly ok: false;
      readonly reason: "STALE_REVISION" | "PERSISTENCE_ERROR";
      readonly staleForensics?: PublishAtomicStaleForensics;
    }
> {
  try {
    await ensureMongoReady();
    const collection = getMongoCollection<CurrentDocument>(
      MONGO_COLLECTIONS.publishedLocalizedPresentationsCurrent,
    );
    const locale = String(input.candidate.identity.locale).toLowerCase();
    let publishedDoc = toCurrentDocument({
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
      const sameVersion = sameCanonicalIdentity(
        existing.identity,
        publishedDoc.identity,
      );

      if (sameVersion) {
        if (existing.contentRevision > publishedDoc.contentRevision) {
          return {
            ok: false,
            reason: "STALE_REVISION",
            staleForensics: {
              STALE_WORK_VERSION: publishedDoc.identity.canonicalVersion,
              STALE_CURRENT_SOURCE_VERSION: existing.identity.canonicalVersion,
              STALE_BOUNDARY: "publish_cas_content_revision",
              STALE_AUTHORITY: "publishAtomicMongo",
              STALE_WORK_CONTENT_REVISION: publishedDoc.contentRevision,
              STALE_EXISTING_CONTENT_REVISION: existing.contentRevision,
            },
          };
        }
        if (existing.contentRevision === publishedDoc.contentRevision) {
          return {
            ok: true,
            record: fromCurrentDocument(existing),
            idempotent: true,
          };
        }
      } else {
        // New canonical source must supersede old pointer (05D.7).
        publishedDoc = {
          ...publishedDoc,
          contentRevision:
            Math.max(existing.contentRevision, publishedDoc.contentRevision) + 1,
        };
      }
    }

    const sameVersionFilter =
      existing &&
      sameCanonicalIdentity(existing.identity, publishedDoc.identity);

    const result = await collection.findOneAndUpdate(
      sameVersionFilter
        ? {
            entityType: publishedDoc.entityType,
            entityId: publishedDoc.entityId,
            locale,
            $or: [
              { contentRevision: { $exists: false } },
              { contentRevision: { $lte: publishedDoc.contentRevision } },
            ],
          }
        : {
            entityType: publishedDoc.entityType,
            entityId: publishedDoc.entityId,
            locale,
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
      return {
        ok: false,
        reason: "STALE_REVISION",
        staleForensics: {
          STALE_WORK_VERSION: input.candidate.identity.canonicalVersion,
          STALE_CURRENT_SOURCE_VERSION: input.candidate.identity.canonicalVersion,
          STALE_BOUNDARY: "publish_cas_duplicate_key",
          STALE_AUTHORITY: "publishAtomicMongo",
          STALE_WORK_CONTENT_REVISION: input.candidate.contentRevision,
          STALE_EXISTING_CONTENT_REVISION: input.candidate.contentRevision,
        },
      };
    }
    return { ok: false, reason: "PERSISTENCE_ERROR" };
  }
}
