import type { OfficialResponse, OfficialResponseIdentity } from "@hu/types";

import { MONGO_COLLECTIONS } from "../../../infrastructure/mongodb/mongo-collections.js";
import {
  loadRecordMap,
  loadSingletonDocument,
  replaceRecordMap,
  replaceSingletonDocument,
} from "../../../infrastructure/mongodb/mongo-snapshot-store.js";

import {
  createEmptyOfficialResponsePersistenceSnapshot,
  type OfficialResponsePersistenceAdapter,
  type OfficialResponsePersistenceSnapshot,
} from "./official-response-persistence.types.js";

interface OfficialResponseSequenceMetadata {
  responseSequence: number;
  responseSequenceYear: number;
}

let cache: OfficialResponsePersistenceSnapshot = createEmptyOfficialResponsePersistenceSnapshot();
let pendingWrite: Promise<void> | null = null;

async function persistSnapshot(snapshot: OfficialResponsePersistenceSnapshot): Promise<void> {
  await replaceRecordMap(
    MONGO_COLLECTIONS.officialResponses,
    snapshot.responses as Record<string, object>,
    "responseId",
  );
  await replaceRecordMap(
    MONGO_COLLECTIONS.officialResponseIdentities,
    snapshot.identities as Record<string, object>,
    "capId",
  );
  await replaceSingletonDocument<OfficialResponseSequenceMetadata>(
    MONGO_COLLECTIONS.officialResponseMetadata,
    {
      responseSequence: snapshot.responseSequence,
      responseSequenceYear: snapshot.responseSequenceYear,
    },
  );
}

const adapter: OfficialResponsePersistenceAdapter = {
  mode: "mongodb",
  load(): OfficialResponsePersistenceSnapshot {
    return structuredClone(cache);
  },
  save(snapshot: OfficialResponsePersistenceSnapshot): void {
    cache = structuredClone(snapshot);
    pendingWrite = persistSnapshot(snapshot).catch((error) => {
      pendingWrite = null;
      throw error;
    });
  },
};

export function createMongoOfficialResponsePersistenceAdapter(): OfficialResponsePersistenceAdapter {
  return adapter;
}

export async function hydrateOfficialResponseMongoPersistence(): Promise<void> {
  if (process.env.OFFICIAL_RESPONSE_PERSISTENCE !== "mongodb") {
    return;
  }

  const empty = createEmptyOfficialResponsePersistenceSnapshot();
  const responses = await loadRecordMap<OfficialResponse>(
    MONGO_COLLECTIONS.officialResponses,
    "responseId",
  );
  const identities = await loadRecordMap<OfficialResponseIdentity>(
    MONGO_COLLECTIONS.officialResponseIdentities,
    "capId",
  );
  const metadata = await loadSingletonDocument<OfficialResponseSequenceMetadata>(
    MONGO_COLLECTIONS.officialResponseMetadata,
    {
      responseSequence: empty.responseSequence,
      responseSequenceYear: empty.responseSequenceYear,
    },
  );

  cache = {
    version: 1,
    responses,
    identities,
    responseSequence: metadata.responseSequence,
    responseSequenceYear: metadata.responseSequenceYear,
  };
}

export async function flushOfficialResponseMongoPersistence(): Promise<void> {
  if (process.env.OFFICIAL_RESPONSE_PERSISTENCE !== "mongodb") {
    return;
  }

  if (pendingWrite) {
    await pendingWrite;
    pendingWrite = null;
  }
}
