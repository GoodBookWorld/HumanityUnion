import { loadRecordMap, replaceRecordMap } from "./mongo-snapshot-store.js";

export interface MongoSnapshotPersistenceHandles<TSnapshot extends { version: 1 }> {
  adapter: {
    readonly mode: "mongodb";
    load(): TSnapshot;
    save(snapshot: TSnapshot): void;
  };
  hydrate(): Promise<void>;
  flush(): Promise<void>;
}

interface RecordMapBinding<TSnapshot extends { version: 1 }> {
  collectionName: string;
  idField: string;
  select: (snapshot: TSnapshot) => Record<string, object>;
  assign: (snapshot: TSnapshot, records: Record<string, object>) => TSnapshot;
}

export function createMongoSnapshotPersistence<TSnapshot extends { version: 1 }>(config: {
  createEmpty: () => TSnapshot;
  bindings: RecordMapBinding<TSnapshot>[];
  /**
   * Test seam / optional override. Defaults to writing each binding via
   * replaceRecordMap. Production callers omit this.
   */
  persistSnapshot?: (snapshot: TSnapshot) => Promise<void>;
}): MongoSnapshotPersistenceHandles<TSnapshot> {
  let cache: TSnapshot = config.createEmpty();
  let pendingWrite: Promise<void> | null = null;
  let lastPersistError: Error | null = null;

  async function persistSnapshot(snapshot: TSnapshot): Promise<void> {
    if (config.persistSnapshot) {
      await config.persistSnapshot(snapshot);
      return;
    }
    for (const binding of config.bindings) {
      await replaceRecordMap(binding.collectionName, binding.select(snapshot), binding.idField);
    }
  }

  return {
    adapter: {
      mode: "mongodb",
      load(): TSnapshot {
        return structuredClone(cache);
      },
      save(snapshot: TSnapshot): void {
        cache = structuredClone(snapshot);
        // Chain writes so a later save never drops an in-flight earlier persist
        // (flush must observe every queued write before disconnect/reconnect).
        // CRITICAL: catch at the end so a failed background persist never becomes an
        // unhandledRejection that crashes the process before verification dispose().
        const snapshotToPersist = cache;
        pendingWrite = (pendingWrite ?? Promise.resolve())
          .catch(() => undefined)
          .then(() => persistSnapshot(snapshotToPersist))
          .then(() => {
            lastPersistError = null;
          })
          .catch((error: unknown) => {
            lastPersistError = error instanceof Error ? error : new Error(String(error));
          });
      },
    },
    async hydrate(): Promise<void> {
      let snapshot = config.createEmpty();

      for (const binding of config.bindings) {
        const records = await loadRecordMap(binding.collectionName, binding.idField);
        snapshot = binding.assign(snapshot, records);
      }

      cache = snapshot;
    },
    async flush(): Promise<void> {
      if (pendingWrite) {
        await pendingWrite;
        pendingWrite = null;
      }
      if (lastPersistError) {
        const error = lastPersistError;
        lastPersistError = null;
        throw error;
      }
    },
  };
}
