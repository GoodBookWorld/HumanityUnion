import type { PublicCivicArchiveRecord } from "@hu/types";

export interface PublicCivicArchivePersistenceSnapshot {
  version: 1;
  records: Record<string, PublicCivicArchiveRecord>;
}

export interface PublicCivicArchivePersistenceAdapter {
  readonly mode: "file" | "memory";
  load(): PublicCivicArchivePersistenceSnapshot;
  save(snapshot: PublicCivicArchivePersistenceSnapshot): void;
}

export function createEmptyPublicCivicArchivePersistenceSnapshot(): PublicCivicArchivePersistenceSnapshot {
  return {
    version: 1,
    records: {},
  };
}

export function snapshotFromArchiveRecords(
  records: Map<string, PublicCivicArchiveRecord>,
): PublicCivicArchivePersistenceSnapshot {
  const serialized: Record<string, PublicCivicArchiveRecord> = {};

  for (const [archiveRecordId, record] of records) {
    serialized[archiveRecordId] = structuredClone(record);
  }

  return {
    version: 1,
    records: serialized,
  };
}
