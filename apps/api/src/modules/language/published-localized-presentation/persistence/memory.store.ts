/**
 * Reset 02 — in-memory persistence for PublishedLocalizedPresentation.
 * Direct keyed lookup only — no corpus scan on read.
 */

import type { PublishedLocalizedPresentationRecord } from "@hu/types";

/** Current PUBLISHED pointer per entity+locale (at most one). */
const currentByKey = new Map<string, PublishedLocalizedPresentationRecord>();

/** All snapshots by snapshotId (history + building + failed). */
const bySnapshotId = new Map<string, PublishedLocalizedPresentationRecord>();

/** Optional unrelated corpus ballast for load-complexity tests (never scanned on read). */
const ballastCountRef = { count: 0 };

export function publishedLocalizationEntityKey(input: {
  readonly entityType: string;
  readonly entityId: string;
  readonly locale: string;
}): string {
  return `${input.entityType}::${input.entityId}::${input.locale.toLowerCase()}`;
}

export function resetPublishedLocalizedPresentationMemoryStoreForTests(): void {
  currentByKey.clear();
  bySnapshotId.clear();
  ballastCountRef.count = 0;
}

/** Test-only: record that N unrelated rows exist without allocating N presentation trees. */
export function seedPublishedLocalizationBallastCountForTests(count: number): void {
  ballastCountRef.count = count;
}

export function getPublishedLocalizationBallastCountForTests(): number {
  return ballastCountRef.count;
}

export function getPublishedLocalizationMemoryStoreStatsForTests(): {
  readonly currentCount: number;
  readonly snapshotCount: number;
  readonly ballastCount: number;
} {
  return {
    currentCount: currentByKey.size,
    snapshotCount: bySnapshotId.size,
    ballastCount: ballastCountRef.count,
  };
}

export function putPublishedSnapshotMemory(
  record: PublishedLocalizedPresentationRecord,
): PublishedLocalizedPresentationRecord {
  bySnapshotId.set(record.snapshotId, record);
  return record;
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
 * Atomic memory publish: replace current pointer + supersede previous.
 * JS is single-threaded; this critical section is synchronous and race-free
 * for in-process callers.
 *
 * RESET 05D.7 — contentRevision CAS only within the same canonicalVersion.
 */
export function publishAtomicMemory(input: {
  readonly candidate: PublishedLocalizedPresentationRecord;
}): {
  readonly ok: true;
  readonly record: PublishedLocalizedPresentationRecord;
  readonly supersededSnapshotId?: string;
  readonly idempotent: boolean;
} | {
  readonly ok: false;
  readonly reason: "STALE_REVISION";
  readonly staleForensics?: {
    readonly STALE_WORK_VERSION: string;
    readonly STALE_CURRENT_SOURCE_VERSION: string;
    readonly STALE_BOUNDARY: string;
    readonly STALE_AUTHORITY: string;
    readonly STALE_WORK_CONTENT_REVISION: number;
    readonly STALE_EXISTING_CONTENT_REVISION: number;
  };
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
        return {
          ok: false,
          reason: "STALE_REVISION",
          staleForensics: {
            STALE_WORK_VERSION: input.candidate.identity.canonicalVersion,
            STALE_CURRENT_SOURCE_VERSION: existing.identity.canonicalVersion,
            STALE_BOUNDARY: "publish_cas_content_revision",
            STALE_AUTHORITY: "publishAtomicMemory",
            STALE_WORK_CONTENT_REVISION: input.candidate.contentRevision,
            STALE_EXISTING_CONTENT_REVISION: existing.contentRevision,
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
