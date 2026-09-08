/**
 * Reset 02 / RESET 05D.7 / RESET 05D.8 — Mongo persistence for PublishedLocalizedPresentation.
 * Current pointer collection is the only read path for PUBLISHED resolution.
 *
 * RESET 05D.7 — contentRevision CAS applies only within the same canonicalVersion.
 * A newer canonical source version must supersede an older published pointer
 * even when the candidate contentRevision is lower (editorial always uses 1).
 *
 * RESET 05D.8 — every STALE_REVISION carries structured origin metadata;
 * history duplicate-key must not masquerade as CAS stale.
 */

import type { PublishedLocalizedPresentationRecord } from "@hu/types";

import { MONGO_COLLECTIONS } from "../../../../infrastructure/mongodb/mongo-collections.js";
import { isMongoConfigured } from "../../../../infrastructure/mongodb/mongo-config.js";
import { connectMongoClient } from "../../../../infrastructure/mongodb/mongo-connection.js";
import { getMongoCollection } from "../../../../infrastructure/mongodb/mongo-database.js";
import {
  buildPublishCasContentRevisionStale,
  buildPublishCasDuplicateKeyStale,
  type PlpStructuredStaleDetail,
} from "../universal/plp-stale-result.js";

type CurrentDocument = PublishedLocalizedPresentationRecord & {
  readonly entityType: string;
  readonly entityId: string;
  readonly locale: string;
  readonly _id?: unknown;
};

export type PublishAtomicStaleForensics = {
  readonly STALE_ORIGIN_ID: string;
  readonly STALE_WORK_VERSION: string;
  readonly STALE_CURRENT_SOURCE_VERSION: string;
  readonly STALE_BOUNDARY: string;
  readonly STALE_AUTHORITY: string;
  readonly STALE_WORK_CONTENT_REVISION: number;
  readonly STALE_EXISTING_CONTENT_REVISION: number;
  readonly STALE_CANDIDATE_VERSION?: string;
  readonly STALE_EXISTING_SNAPSHOT_VERSION?: string;
};

function toStaleForensics(
  detail: PlpStructuredStaleDetail,
): PublishAtomicStaleForensics {
  return {
    STALE_ORIGIN_ID: detail.originId,
    STALE_WORK_VERSION: detail.workCanonicalVersion,
    STALE_CURRENT_SOURCE_VERSION: detail.currentSourceCanonicalVersion,
    STALE_BOUNDARY: detail.boundary,
    STALE_AUTHORITY: detail.authority,
    STALE_WORK_CONTENT_REVISION: detail.candidateContentRevision ?? 0,
    STALE_EXISTING_CONTENT_REVISION: detail.existingContentRevision ?? 0,
    ...(detail.candidateCanonicalVersion
      ? { STALE_CANDIDATE_VERSION: detail.candidateCanonicalVersion }
      : {}),
    ...(detail.existingSnapshotCanonicalVersion
      ? {
          STALE_EXISTING_SNAPSHOT_VERSION:
            detail.existingSnapshotCanonicalVersion,
        }
      : {}),
  };
}

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

async function putHistoryIdempotent(
  record: PublishedLocalizedPresentationRecord,
): Promise<void> {
  try {
    await putPublishedSnapshotHistoryMongo(record);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    // History unique(snapshotId): duplicate is idempotent, not CAS stale.
    if (message.includes("E11000") || message.includes("duplicate key")) {
      return;
    }
    throw error;
  }
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
      readonly reason: "STALE_REVISION";
      readonly staleForensics: PublishAtomicStaleForensics;
      readonly staleDetail: PlpStructuredStaleDetail;
    }
  | {
      readonly ok: false;
      readonly reason: "PERSISTENCE_ERROR";
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
          const detail = buildPublishCasContentRevisionStale({
            authority: "publishAtomicMongo",
            workCanonicalVersion: publishedDoc.identity.canonicalVersion,
            existingSnapshotCanonicalVersion: existing.identity.canonicalVersion,
            candidateContentRevision: publishedDoc.contentRevision,
            existingContentRevision: existing.contentRevision,
          });
          return {
            ok: false,
            reason: "STALE_REVISION",
            staleDetail: detail,
            staleForensics: toStaleForensics(detail),
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
        // New canonical source must supersede old pointer (05D.7 / 05D.8).
        publishedDoc = {
          ...publishedDoc,
          contentRevision:
            Math.max(existing.contentRevision, publishedDoc.contentRevision) + 1,
        };
      }
    }

    const sameVersionFilter =
      existing != null &&
      sameCanonicalIdentity(existing.identity, publishedDoc.identity);

    const filter = sameVersionFilter
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
        };

    // RESET 05D.8 — never upsert when a current row exists: a lost same-version
    // CAS race must not insert a duplicate and then mis-map E11000 as bare stale.
    const result = await collection.findOneAndUpdate(
      filter,
      { $set: publishedDoc },
      { upsert: existing == null, returnDocument: "before" },
    );

    if (sameVersionFilter && existing && result == null) {
      const latest = await collection.findOne(
        {
          entityType: publishedDoc.entityType,
          entityId: publishedDoc.entityId,
          locale,
        },
        { projection: { _id: 0 } },
      );
      const detail = buildPublishCasContentRevisionStale({
        authority: "publishAtomicMongo",
        workCanonicalVersion: publishedDoc.identity.canonicalVersion,
        existingSnapshotCanonicalVersion:
          latest?.identity.canonicalVersion ??
          existing.identity.canonicalVersion,
        candidateContentRevision: publishedDoc.contentRevision,
        existingContentRevision:
          latest?.contentRevision ?? existing.contentRevision,
      });
      return {
        ok: false,
        reason: "STALE_REVISION",
        staleDetail: detail,
        staleForensics: toStaleForensics(detail),
      };
    }

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
      await putHistoryIdempotent(superseded);
      supersededSnapshotId = superseded.snapshotId;
    }

    await putHistoryIdempotent(fromCurrentDocument(publishedDoc));

    return {
      ok: true,
      record: fromCurrentDocument(publishedDoc),
      supersededSnapshotId,
      idempotent: false,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("E11000") || message.includes("duplicate key")) {
      let existingSnapshotCanonicalVersion: string | null = null;
      let existingContentRevision: number | null = null;
      try {
        await ensureMongoReady();
        const collection = getMongoCollection<CurrentDocument>(
          MONGO_COLLECTIONS.publishedLocalizedPresentationsCurrent,
        );
        const latest = await collection.findOne(
          {
            entityType: input.candidate.identity.entityType,
            entityId: input.candidate.identity.entityId,
            locale: String(input.candidate.identity.locale).toLowerCase(),
          },
          { projection: { _id: 0 } },
        );
        if (latest) {
          existingSnapshotCanonicalVersion = latest.identity.canonicalVersion;
          existingContentRevision = latest.contentRevision;
        }
      } catch {
        // best-effort forensics only
      }
      const detail = buildPublishCasDuplicateKeyStale({
        candidateCanonicalVersion: input.candidate.identity.canonicalVersion,
        existingSnapshotCanonicalVersion,
        candidateContentRevision: input.candidate.contentRevision,
        existingContentRevision,
      });
      return {
        ok: false,
        reason: "STALE_REVISION",
        staleDetail: detail,
        staleForensics: toStaleForensics(detail),
      };
    }
    return { ok: false, reason: "PERSISTENCE_ERROR" };
  }
}
