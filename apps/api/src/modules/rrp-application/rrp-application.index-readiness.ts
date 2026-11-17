/**
 * HU-RRP-02B.1 — fail-closed readiness for the active-application unique index.
 * Ensures only the RRP collection index; does not touch unrelated collections.
 */

import type { IndexDescription } from "mongodb";

import { RRP_APPLICATION_ACTIVE_STATUSES } from "@hu/types";

import { MONGO_COLLECTIONS } from "../../infrastructure/mongodb/mongo-collections.js";
import { getMongoCollection } from "../../infrastructure/mongodb/mongo-database.js";
import {
  RRP_ACTIVE_UNIQUE_INDEX_KEYS,
  RRP_ACTIVE_UNIQUE_INDEX_NAME,
} from "./rrp-application.constants.js";
import { RrpApplicationUnavailableError } from "./rrp-application.errors.js";

export const RRP_ACTIVE_UNIQUE_INDEX_DESCRIPTION: IndexDescription = {
  key: { ...RRP_ACTIVE_UNIQUE_INDEX_KEYS },
  unique: true,
  partialFilterExpression: {
    status: { $in: [...RRP_APPLICATION_ACTIVE_STATUSES] },
  },
  name: RRP_ACTIVE_UNIQUE_INDEX_NAME,
};

/** null = use real Mongo check; true/false = forced test outcome. */
let readinessOverrideForTests: boolean | null = null;
let cachedReady = false;

export function setRrpApplicationActiveUniqueIndexReadyForTests(
  ready: boolean | null,
): void {
  readinessOverrideForTests = ready;
  if (ready !== true) {
    cachedReady = false;
  }
}

export function resetRrpApplicationIndexReadinessForTests(): void {
  readinessOverrideForTests = null;
  cachedReady = false;
}

function unavailable(message: string): never {
  throw new RrpApplicationUnavailableError(message);
}

/**
 * Create/verify the active unique index on rrp_applications only.
 * Fail closed when the index cannot be ensured — never allow unprotected writes.
 *
 * `skipMongo` is for in-memory test stores that enforce uniqueness in-process;
 * an explicit false readiness override still fails closed.
 */
export async function assertRrpApplicationActiveUniqueIndexReady(
  options: { skipMongo?: boolean } = {},
): Promise<void> {
  if (readinessOverrideForTests === false) {
    unavailable(
      "Regional Representative application unique index is not ready.",
    );
  }

  if (readinessOverrideForTests === true || cachedReady) {
    return;
  }

  if (options.skipMongo) {
    return;
  }

  const collection = getMongoCollection(MONGO_COLLECTIONS.rrpApplications);

  try {
    await collection.createIndex(RRP_ACTIVE_UNIQUE_INDEX_DESCRIPTION.key, {
      unique: RRP_ACTIVE_UNIQUE_INDEX_DESCRIPTION.unique,
      partialFilterExpression: RRP_ACTIVE_UNIQUE_INDEX_DESCRIPTION.partialFilterExpression,
      name: RRP_ACTIVE_UNIQUE_INDEX_DESCRIPTION.name,
    });
  } catch (error) {
    const mongoError = error as { code?: number };
    // 85/86 = equivalent index already exists under option conflict — still verify by name.
    if (mongoError.code !== 85 && mongoError.code !== 86) {
      unavailable(
        "Regional Representative application unique index could not be created.",
      );
    }
  }

  let indexes: Array<{ name?: string; unique?: boolean }>;
  try {
    indexes = await collection.indexes();
  } catch {
    unavailable(
      "Regional Representative application unique index could not be verified.",
    );
  }

  const found = indexes.find(
    (index) => index.name === RRP_ACTIVE_UNIQUE_INDEX_NAME && index.unique === true,
  );

  if (!found) {
    unavailable(
      "Regional Representative application unique index is missing.",
    );
  }

  cachedReady = true;
}
