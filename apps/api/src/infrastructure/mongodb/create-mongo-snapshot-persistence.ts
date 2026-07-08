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
}): MongoSnapshotPersistenceHandles<TSnapshot> {
  let cache: TSnapshot = config.createEmpty();
  let pendingWrite: Promise<void> | null = null;

  async function persistSnapshot(snapshot: TSnapshot): Promise<void> {
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
        pendingWrite = persistSnapshot(snapshot).catch((error) => {
          pendingWrite = null;
          throw error;
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
    },
  };
}
