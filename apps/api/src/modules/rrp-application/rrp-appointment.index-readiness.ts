/**
 * HU-RRP-03H — fail-closed readiness for the active-appointment unique index.
 */

import type { IndexDescription } from "mongodb";

import { MONGO_COLLECTIONS } from "../../infrastructure/mongodb/mongo-collections.js";
import { getMongoCollection } from "../../infrastructure/mongodb/mongo-database.js";
import { RRP_APPOINTMENT_ACTIVE_UNIQUE_INDEX_DESCRIPTION, RRP_APPOINTMENT_ACTIVE_UNIQUE_INDEX_NAME } from "./rrp-appointment.constants.js";
import { RrpApplicationUnavailableError } from "./rrp-application.errors.js";

export const RRP_APPOINTMENT_ACTIVE_UNIQUE_INDEX: IndexDescription = {
  key: { ...RRP_APPOINTMENT_ACTIVE_UNIQUE_INDEX_DESCRIPTION.key },
  unique: true,
  partialFilterExpression: {
    ...RRP_APPOINTMENT_ACTIVE_UNIQUE_INDEX_DESCRIPTION.partialFilterExpression,
  },
  name: RRP_APPOINTMENT_ACTIVE_UNIQUE_INDEX_NAME,
};

let readinessOverrideForTests: boolean | null = null;
let cachedReady = false;

export function setRrpAppointmentActiveUniqueIndexReadyForTests(
  ready: boolean | null,
): void {
  readinessOverrideForTests = ready;
  if (ready !== true) {
    cachedReady = false;
  }
}

export function resetRrpAppointmentIndexReadinessForTests(): void {
  readinessOverrideForTests = null;
  cachedReady = false;
}

function unavailable(message: string): never {
  throw new RrpApplicationUnavailableError(message);
}

/**
 * Create/verify the active unique index on rrp_appointments only.
 * Fail closed when the index cannot be ensured — never allow unprotected writes.
 */
export async function assertRrpAppointmentActiveUniqueIndexReady(
  options: { skipMongo?: boolean } = {},
): Promise<void> {
  if (readinessOverrideForTests === false) {
    unavailable("Regional Representative appointment unique index is not ready.");
  }

  if (readinessOverrideForTests === true || cachedReady) {
    return;
  }

  if (options.skipMongo) {
    return;
  }

  const collection = getMongoCollection(MONGO_COLLECTIONS.rrpAppointments);

  let indexes: Array<{ name?: string; unique?: boolean }>;
  try {
    indexes = await collection.indexes();
  } catch {
    unavailable(
      "Regional Representative appointment unique index could not be verified.",
    );
  }

  const alreadyReady = indexes.some(
    (index) =>
      index.name === RRP_APPOINTMENT_ACTIVE_UNIQUE_INDEX_NAME && index.unique === true,
  );

  if (!alreadyReady) {
    try {
      await collection.createIndex(RRP_APPOINTMENT_ACTIVE_UNIQUE_INDEX.key, {
        unique: RRP_APPOINTMENT_ACTIVE_UNIQUE_INDEX.unique,
        partialFilterExpression: RRP_APPOINTMENT_ACTIVE_UNIQUE_INDEX.partialFilterExpression,
        name: RRP_APPOINTMENT_ACTIVE_UNIQUE_INDEX.name,
      });
    } catch (error) {
      const mongoError = error as { code?: number; message?: string };
      if (mongoError.code !== 85 && mongoError.code !== 86) {
        unavailable(
          `Regional Representative appointment unique index could not be created (${mongoError.code ?? "unknown"}: ${mongoError.message ?? "no message"}).`,
        );
      }
    }

    try {
      indexes = await collection.indexes();
    } catch {
      unavailable(
        "Regional Representative appointment unique index could not be verified.",
      );
    }
  }

  const found = indexes.find(
    (index) =>
      index.name === RRP_APPOINTMENT_ACTIVE_UNIQUE_INDEX_NAME && index.unique === true,
  );

  if (!found) {
    unavailable("Regional Representative appointment unique index is missing.");
  }

  cachedReady = true;
}
