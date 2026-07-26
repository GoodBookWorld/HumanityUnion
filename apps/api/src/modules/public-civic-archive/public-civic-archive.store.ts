import type { PublicCivicArchiveRecord } from "@hu/types";

import { resolvePublicCivicArchivePersistenceAdapter } from "./persistence/resolve-public-civic-archive-persistence.js";
import { snapshotFromArchiveRecords } from "./persistence/public-civic-archive-persistence.types.js";
import { isPublicVerificationFixtureRecord } from "./public-civic-archive-fixture-guard.js";

export interface PublicCivicArchiveUpdate {
  title?: string;
  summary?: string;
  lessonsLearned?: PublicCivicArchiveRecord["lessonsLearned"];
  knowledgeContribution?: PublicCivicArchiveRecord["knowledgeContribution"];
  status?: PublicCivicArchiveRecord["status"];
  archivedVersion?: number;
  archivedAt?: string;
  verification?: PublicCivicArchiveRecord["verification"];
  country?: string;
  region?: string;
  community?: string;
  activityArea?: string;
}

const persistence = resolvePublicCivicArchivePersistenceAdapter();

function loadRecords(): Map<string, PublicCivicArchiveRecord> {
  const snapshot = persistence.load();

  return new Map<string, PublicCivicArchiveRecord>(
    Object.entries(snapshot.records).map(([archiveRecordId, record]) => [
      archiveRecordId,
      structuredClone(record),
    ]),
  );
}

const records = loadRecords();

function persistRecords(): void {
  persistence.save(snapshotFromArchiveRecords(records));
}

export function getArchiveRecordById(archiveRecordId: string): PublicCivicArchiveRecord | null {
  const record = records.get(archiveRecordId);

  return record ? structuredClone(record) : null;
}

export function listArchiveRecords(): PublicCivicArchiveRecord[] {
  return Array.from(records.values(), (record) => structuredClone(record));
}

export function listArchiveRecordsByInitiative(initiativeId: string): PublicCivicArchiveRecord[] {
  return listArchiveRecords().filter((record) => record.initiativeId === initiativeId);
}

export function listArchiveRecordsByImpact(impactId: string): PublicCivicArchiveRecord[] {
  return listArchiveRecords().filter((record) => record.impactId === impactId);
}

export function listArchiveRecordsByAuthor(authorId: string): PublicCivicArchiveRecord[] {
  return listArchiveRecords().filter((record) => record.authorId === authorId);
}

export function listPublishedArchiveRecords(options?: {
  includeVerificationFixtures?: boolean;
  verificationRunId?: string;
}): PublicCivicArchiveRecord[] {
  return listArchiveRecords()
    .filter((record) => record.status === "published")
    .filter((record) => {
      if (options?.includeVerificationFixtures) {
        if (options.verificationRunId) {
          return record.verification?.verificationRunId === options.verificationRunId;
        }

        return true;
      }

      return !isPublicVerificationFixtureRecord(record);
    })
    .sort((left, right) => (right.archivedAt ?? "").localeCompare(left.archivedAt ?? ""));
}

export function getDraftArchiveRecordForImpact(impactId: string): PublicCivicArchiveRecord | null {
  const draft = listArchiveRecordsByImpact(impactId).find((record) => record.status === "draft");

  return draft ? structuredClone(draft) : null;
}

export function getNextArchiveVersion(impactId: string): number {
  const versions = listArchiveRecordsByImpact(impactId)
    .filter((record) => record.status === "published")
    .map((record) => record.archivedVersion);

  if (versions.length === 0) {
    return 1;
  }

  return Math.max(...versions) + 1;
}

export function createArchiveRecord(record: PublicCivicArchiveRecord): PublicCivicArchiveRecord {
  records.set(record.archiveRecordId, structuredClone(record));
  persistRecords();

  return structuredClone(record);
}

export function updateArchiveRecord(
  archiveRecordId: string,
  update: PublicCivicArchiveUpdate,
): PublicCivicArchiveRecord | null {
  const record = records.get(archiveRecordId);

  if (!record) {
    return null;
  }

  if (update.title !== undefined) {
    record.title = update.title;
  }

  if (update.summary !== undefined) {
    record.summary = update.summary;
  }

  if (update.lessonsLearned !== undefined) {
    record.lessonsLearned = structuredClone(update.lessonsLearned);
  }

  if (update.knowledgeContribution !== undefined) {
    record.knowledgeContribution = structuredClone(update.knowledgeContribution);
  }

  if (update.status !== undefined) {
    record.status = update.status;
  }

  if (update.archivedVersion !== undefined) {
    record.archivedVersion = update.archivedVersion;
  }

  if (update.archivedAt !== undefined) {
    record.archivedAt = update.archivedAt;
  }

  if (update.verification !== undefined) {
    record.verification = structuredClone(update.verification);
  }

  if (update.country !== undefined) {
    record.country = update.country;
  }

  if (update.region !== undefined) {
    record.region = update.region;
  }

  if (update.community !== undefined) {
    record.community = update.community;
  }

  if (update.activityArea !== undefined) {
    record.activityArea = update.activityArea;
  }

  record.updatedAt = new Date().toISOString();

  persistRecords();

  return structuredClone(record);
}

export function getPersistenceMode(): "file" | "memory" | "mongodb" {
  return persistence.mode;
}

export function removeVerificationFixturesForRun(verificationRunId: string): number {
  let removed = 0;

  for (const [archiveRecordId, record] of records.entries()) {
    if (
      record.verification?.isVerificationFixture &&
      record.verification.verificationRunId === verificationRunId
    ) {
      records.delete(archiveRecordId);
      removed += 1;
    }
  }

  if (removed > 0) {
    persistRecords();
  }

  return removed;
}

export function removePublicVerificationFixtureRecords(): number {
  let removed = 0;

  for (const [archiveRecordId, record] of records.entries()) {
    if (isPublicVerificationFixtureRecord(record)) {
      records.delete(archiveRecordId);
      removed += 1;
    }
  }

  if (removed > 0) {
    persistRecords();
  }

  return removed;
}

export function reloadArchiveRecordsFromPersistence(): void {
  records.clear();

  for (const [archiveRecordId, record] of loadRecords().entries()) {
    records.set(archiveRecordId, record);
  }
}
