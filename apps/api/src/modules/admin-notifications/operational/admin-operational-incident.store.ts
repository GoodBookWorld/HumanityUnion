import type { AdminOpsDedupeKey } from "@hu/types";

import { MONGO_COLLECTIONS } from "../../../infrastructure/mongodb/mongo-collections.js";
import { isMongoConfigured } from "../../../infrastructure/mongodb/mongo-config.js";
import { connectMongoClient } from "../../../infrastructure/mongodb/mongo-connection.js";
import { getMongoCollection } from "../../../infrastructure/mongodb/mongo-database.js";
import { resolvePersistenceMode } from "../../../config/production-persistence-contract.js";
import type {
  AdminOperationalIncident,
  AdminOperationalIncidentStore,
} from "./admin-operational-incident.types.js";

interface IncidentDocument extends AdminOperationalIncident {
  _id?: string;
}

class MemoryAdminOperationalIncidentStore implements AdminOperationalIncidentStore {
  private rows = new Map<string, AdminOperationalIncident>();

  async findByDedupeKey(dedupeKey: AdminOpsDedupeKey): Promise<AdminOperationalIncident | null> {
    const row = this.rows.get(dedupeKey);
    return row ? structuredClone(row) : null;
  }

  async upsert(incident: AdminOperationalIncident): Promise<void> {
    this.rows.set(incident.dedupeKey, structuredClone(incident));
  }

  clearForTests(): void {
    this.rows.clear();
  }
}

class MongoAdminOperationalIncidentStore implements AdminOperationalIncidentStore {
  async findByDedupeKey(dedupeKey: AdminOpsDedupeKey): Promise<AdminOperationalIncident | null> {
    if (!isMongoConfigured()) {
      return null;
    }
    await connectMongoClient();
    const collection = getMongoCollection<IncidentDocument>(
      MONGO_COLLECTIONS.adminOperationalIncidents,
    );
    const doc = await collection.findOne({ dedupeKey });
    if (!doc) {
      return null;
    }
    const { _id: _ignored, ...row } = doc;
    return row;
  }

  async upsert(incident: AdminOperationalIncident): Promise<void> {
    if (!isMongoConfigured()) {
      return;
    }
    await connectMongoClient();
    const collection = getMongoCollection<IncidentDocument>(
      MONGO_COLLECTIONS.adminOperationalIncidents,
    );
    await collection.updateOne(
      { dedupeKey: incident.dedupeKey },
      { $set: incident },
      { upsert: true },
    );
  }
}

let memoryStore: MemoryAdminOperationalIncidentStore | null = null;
let cachedStore: AdminOperationalIncidentStore | null = null;

export function resolveAdminOperationalIncidentStore(): AdminOperationalIncidentStore {
  if (cachedStore) {
    return cachedStore;
  }
  const mode = resolvePersistenceMode("ADMIN_NOTIFICATION_PERSISTENCE", "memory");
  if (mode === "mongodb") {
    cachedStore = new MongoAdminOperationalIncidentStore();
  } else {
    if (!memoryStore) {
      memoryStore = new MemoryAdminOperationalIncidentStore();
    }
    cachedStore = memoryStore;
  }
  return cachedStore;
}

export function resetAdminOperationalIncidentStoreForTests(): void {
  cachedStore = null;
  if (memoryStore) {
    memoryStore.clearForTests();
  }
}
