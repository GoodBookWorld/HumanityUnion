import path from "node:path";
import { fileURLToPath } from "node:url";

import type { InitiativeCivicArchiveVersion } from "@hu/types";

import { isMongoPersistenceMode } from "../../config/production-persistence-contract.js";
import { createLegacyFileStoreMongoBridge } from "../../infrastructure/mongodb/legacy-file-store-mongo-bridge.js";
import { MONGO_COLLECTIONS } from "../../infrastructure/mongodb/mongo-collections.js";

interface VersionSnapshot {
  version: 1;
  versions: Record<string, InitiativeCivicArchiveVersion>;
}

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_FILE_PATH = path.resolve(
  MODULE_DIR,
  "../../../.runtime/initiative-civic-archive-versions.json",
);

function emptySnapshot(): VersionSnapshot {
  return { version: 1, versions: {} };
}

const bridge = createLegacyFileStoreMongoBridge<VersionSnapshot>({
  envKey: "INITIATIVE_CIVIC_ARCHIVE_VERSION_PERSISTENCE",
  defaultFilePath: DEFAULT_FILE_PATH,
  filePathEnvKey: "INITIATIVE_CIVIC_ARCHIVE_VERSION_PERSISTENCE_PATH",
  createEmpty: emptySnapshot,
  isValidSnapshot: (value): value is VersionSnapshot =>
    Boolean(
      value &&
        typeof value === "object" &&
        (value as VersionSnapshot).version === 1 &&
        typeof (value as VersionSnapshot).versions === "object",
    ),
  bindings: [
    {
      collectionName: MONGO_COLLECTIONS.initiativeCivicArchiveVersions,
      idField: "archiveVersionId",
      select: (snapshot) => snapshot.versions as Record<string, object>,
      assign: (snapshot, records) => ({
        ...snapshot,
        versions: records as unknown as Record<string, InitiativeCivicArchiveVersion>,
      }),
    },
  ],
});

const versions = new Map<string, InitiativeCivicArchiveVersion>(
  Object.entries(bridge.loadInitial().versions).map(([id, record]) => [id, structuredClone(record)]),
);

function replaceFromSnapshot(snapshot: VersionSnapshot): void {
  versions.clear();
  for (const [id, record] of Object.entries(snapshot.versions)) {
    versions.set(id, structuredClone(record));
  }
}

function persist(): void {
  const versionRecord: Record<string, InitiativeCivicArchiveVersion> = {};
  for (const [id, record] of versions) {
    versionRecord[id] = structuredClone(record);
  }
  bridge.save({ version: 1, versions: versionRecord });
}

export async function hydrateInitiativeCivicArchiveVersionMongoPersistence(): Promise<void> {
  await bridge.hydrate();
  if (isMongoPersistenceMode("INITIATIVE_CIVIC_ARCHIVE_VERSION_PERSISTENCE")) {
    replaceFromSnapshot(bridge.loadMongoCache());
  }
}

export async function flushInitiativeCivicArchiveVersionMongoPersistence(): Promise<void> {
  await bridge.flush();
}

export function getArchiveVersionById(
  archiveVersionId: string,
): InitiativeCivicArchiveVersion | null {
  const record = versions.get(archiveVersionId);
  return record ? structuredClone(record) : null;
}

export function listArchiveVersionsByInitiative(
  initiativeId: string,
): InitiativeCivicArchiveVersion[] {
  return Array.from(versions.values())
    .filter((record) => record.initiativeId === initiativeId)
    .sort((left, right) => right.archiveVersion - left.archiveVersion)
    .map((record) => structuredClone(record));
}

export function getLatestArchiveVersionByInitiativeId(
  initiativeId: string,
): InitiativeCivicArchiveVersion | null {
  return listArchiveVersionsByInitiative(initiativeId)[0] ?? null;
}

export function upsertArchiveVersion(
  record: InitiativeCivicArchiveVersion,
): InitiativeCivicArchiveVersion {
  const existing = versions.get(record.archiveVersionId);

  if (existing && existing.archiveVersion !== record.archiveVersion) {
    throw new Error("Archive versions are immutable — cannot replace a version number.");
  }

  versions.set(record.archiveVersionId, structuredClone(record));
  persist();
  return structuredClone(record);
}

export function deleteArchiveVersionsByInitiativeIdForTests(initiativeId: string): number {
  let removed = 0;
  for (const [id, record] of versions.entries()) {
    if (record.initiativeId === initiativeId) {
      versions.delete(id);
      removed += 1;
    }
  }
  if (removed > 0) {
    persist();
  }
  return removed;
}
