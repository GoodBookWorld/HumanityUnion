import fs from "node:fs";
import path from "node:path";

import {
  isMongoPersistenceMode,
  resolvePersistenceMode,
  type PersistenceMode,
} from "../../config/production-persistence-contract.js";
import { createMongoSnapshotPersistence } from "./create-mongo-snapshot-persistence.js";

/**
 * Bridge for legacy Map + `.runtime` JSON stores → Mongo in production.
 * Dev/test retain file (or empty memory when mongodb without hydrate yet).
 */
export function createLegacyFileStoreMongoBridge<TSnapshot extends { version: 1 }>(input: {
  envKey: string;
  defaultFilePath: string;
  filePathEnvKey?: string;
  createEmpty: () => TSnapshot;
  bindings: Array<{
    collectionName: string;
    idField: string;
    select: (snapshot: TSnapshot) => Record<string, object>;
    assign: (snapshot: TSnapshot, records: Record<string, object>) => TSnapshot;
  }>;
  isValidSnapshot: (value: unknown) => value is TSnapshot;
}) {
  const handles = createMongoSnapshotPersistence({
    createEmpty: input.createEmpty,
    bindings: input.bindings,
  });

  function resolveFilePath(): string {
    if (input.filePathEnvKey) {
      return process.env[input.filePathEnvKey]?.trim() || input.defaultFilePath;
    }
    return input.defaultFilePath;
  }

  function loadFileSnapshot(): TSnapshot {
    const filePath = resolveFilePath();
    if (!fs.existsSync(filePath)) {
      return input.createEmpty();
    }
    try {
      const parsed: unknown = JSON.parse(fs.readFileSync(filePath, "utf-8"));
      if (input.isValidSnapshot(parsed)) {
        return parsed;
      }
    } catch {
      // fall through
    }
    return input.createEmpty();
  }

  function saveFileSnapshot(snapshot: TSnapshot): void {
    const filePath = resolveFilePath();
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    const tempPath = `${filePath}.tmp`;
    fs.writeFileSync(tempPath, `${JSON.stringify(snapshot, null, 2)}\n`, "utf-8");
    fs.renameSync(tempPath, filePath);
  }

  function mode(): PersistenceMode {
    return resolvePersistenceMode(input.envKey, "file");
  }

  return {
    mode,
    loadInitial(): TSnapshot {
      if (mode() === "mongodb") {
        return input.createEmpty();
      }
      return loadFileSnapshot();
    },
    save(snapshot: TSnapshot): void {
      const resolved = mode();
      if (resolved === "mongodb") {
        handles.adapter.save(snapshot);
        return;
      }
      if (resolved === "memory") {
        return;
      }
      saveFileSnapshot(snapshot);
    },
    async hydrate(): Promise<void> {
      if (!isMongoPersistenceMode(input.envKey)) {
        return;
      }
      await handles.hydrate();
    },
    async flush(): Promise<void> {
      if (!isMongoPersistenceMode(input.envKey)) {
        return;
      }
      await handles.flush();
    },
    loadMongoCache(): TSnapshot {
      return handles.adapter.load();
    },
  };
}
