/**
 * In-memory PublishedLocalizedPresentation store (tests / non-mongo mode).
 *
 * RESET 05D.7 — contentRevision CAS only within the same canonicalVersion.
 * RESET 05D.8 — structured stale origin metadata required on every STALE_REVISION.
 */

import type { PublishedLocalizedPresentationRecord } from "@hu/types";

import {
  buildPublishCasContentRevisionStale,
  type PlpStructuredStaleDetail,
} from "../universal/plp-stale-result.js";

export function publishedLocalizationEntityKey(input: {
  readonly entityType: string;
  readonly entityId: string;
  readonly locale: string;
}): string {
  return `${input.entityType}::${input.entityId}::${String(input.locale).toLowerCase()}`;
}

const bySnapshotId = new Map<string, PublishedLocalizedPresentationRecord>();
const currentByKey = new Map<string, PublishedLocalizedPresentationRecord>();
let ballastCount = 0;

export function resetPublishedLocalizedPresentationMemoryStoreForTests(): void {
  bySnapshotId.clear();
  currentByKey.clear();
  ballastCount = 0;
}

export function seedPublishedLocalizationBallastCountForTests(count: number): void {
  ballastCount = Math.max(0, Math.trunc(count));
}

export function getPublishedLocalizationBallastCountForTests(): number {
  return ballastCount;
}

export function getPublishedLocalizationMemoryStoreStatsForTests(): {
  readonly snapshotCount: number;
  readonly currentCount: number;
  readonly ballastCount: number;
} {
  return {
    snapshotCount: bySnapshotId.size,
    currentCount: currentByKey.size,
    ballastCount,
  };
}

export function putPublishedSnapshotMemory(
  record: PublishedLocalizedPresentationRecord,
): void {
  bySnapshotId.set(record.snapshotId, record);
}

export function findPublishedSnapshotByIdMemory(
  snapshotId: string,
): PublishedLocalizedPresentationRecord | null {
  return bySnapshotId.get(snapshotId) ?? null;
}

export function findCurrentPublishedMemory(input: {
  readonly entityType: string;
  readonly entityId: string;
  readonly locale: string;
}): PublishedLocalizedPresentationRecord | null {
  const key = publishedLocalizationEntityKey(input);
  const current = currentByKey.get(key);
  if (!current || current.state !== "PUBLISHED") {
    return null;
  }
  return current;
}

/**
 * JS is single-threaded; this critical section is synchronous and race-free
 * for in-process callers.
 *
 * RESET 05D.7 — contentRevision CAS only within the same canonicalVersion.
 */
export function publishAtomicMemory(input: {
  readonly candidate: PublishedLocalizedPresentationRecord;
}):
  | {
      readonly ok: true;
      readonly record: PublishedLocalizedPresentationRecord;
      readonly supersededSnapshotId?: string;
      readonly idempotent: boolean;
    }
  | {
      readonly ok: false;
      readonly reason: "STALE_REVISION";
      readonly staleForensics: {
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
      readonly staleDetail: PlpStructuredStaleDetail;
    } {
  const key = publishedLocalizationEntityKey({
    entityType: input.candidate.identity.entityType,
    entityId: input.candidate.identity.entityId,
    locale: String(input.candidate.identity.locale),
  });
  const existing = currentByKey.get(key);

  let candidateRevision = input.candidate.contentRevision;

  if (existing && existing.state === "PUBLISHED") {
    const sameVersion =
      existing.identity.canonicalVersion ===
        input.candidate.identity.canonicalVersion &&
      existing.identity.localizationSchemaVersion ===
        input.candidate.identity.localizationSchemaVersion;

    if (sameVersion) {
      if (existing.contentRevision > input.candidate.contentRevision) {
        const detail = buildPublishCasContentRevisionStale({
          authority: "publishAtomicMemory",
          workCanonicalVersion: input.candidate.identity.canonicalVersion,
          existingSnapshotCanonicalVersion: existing.identity.canonicalVersion,
          candidateContentRevision: input.candidate.contentRevision,
          existingContentRevision: existing.contentRevision,
        });
        return {
          ok: false,
          reason: "STALE_REVISION",
          staleDetail: detail,
          staleForensics: {
            STALE_ORIGIN_ID: detail.originId,
            STALE_WORK_VERSION: detail.workCanonicalVersion,
            STALE_CURRENT_SOURCE_VERSION: detail.currentSourceCanonicalVersion,
            STALE_BOUNDARY: detail.boundary,
            STALE_AUTHORITY: detail.authority,
            STALE_WORK_CONTENT_REVISION: detail.candidateContentRevision ?? 0,
            STALE_EXISTING_CONTENT_REVISION: detail.existingContentRevision ?? 0,
            STALE_CANDIDATE_VERSION: detail.candidateCanonicalVersion,
            STALE_EXISTING_SNAPSHOT_VERSION:
              detail.existingSnapshotCanonicalVersion,
          },
        };
      }
      if (existing.contentRevision === input.candidate.contentRevision) {
        return {
          ok: true,
          record: existing,
          idempotent: true,
        };
      }
    } else {
      candidateRevision =
        Math.max(existing.contentRevision, input.candidate.contentRevision) + 1;
    }
  }

  let supersededSnapshotId: string | undefined;
  if (existing && existing.state === "PUBLISHED") {
    const superseded: PublishedLocalizedPresentationRecord = {
      ...existing,
      state: "SUPERSEDED",
      updatedAt: new Date().toISOString(),
    };
    bySnapshotId.set(superseded.snapshotId, superseded);
    supersededSnapshotId = superseded.snapshotId;
  }

  const published: PublishedLocalizedPresentationRecord = {
    ...input.candidate,
    contentRevision: candidateRevision,
    state: "PUBLISHED",
    publishedAt: input.candidate.publishedAt ?? new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  bySnapshotId.set(published.snapshotId, published);
  currentByKey.set(key, published);

  return {
    ok: true,
    record: published,
    supersededSnapshotId,
    idempotent: false,
  };
}
