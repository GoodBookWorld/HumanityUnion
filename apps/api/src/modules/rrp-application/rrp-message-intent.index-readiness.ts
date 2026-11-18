/**
 * HU-RRP-03H — fail-closed readiness for RRP message-intent unique indexes.
 */

import type { IndexDescription } from "mongodb";

import { MONGO_COLLECTIONS } from "../../infrastructure/mongodb/mongo-collections.js";
import { getMongoCollection } from "../../infrastructure/mongodb/mongo-database.js";
import {
  RRP_APPOINTMENT_MESSAGE_INTENT_APPOINTMENT_SPARSE_UNIQUE_INDEX_NAME,
  RRP_MESSAGE_INTENT_CLIENT_MESSAGE_ID_UNIQUE_INDEX_NAME,
} from "./rrp-message-intent.constants.js";
import { RrpApplicationUnavailableError } from "./rrp-application.errors.js";

export const RRP_MESSAGE_INTENT_CLIENT_MESSAGE_ID_UNIQUE_INDEX: IndexDescription = {
  key: { clientMessageId: 1 },
  unique: true,
  name: RRP_MESSAGE_INTENT_CLIENT_MESSAGE_ID_UNIQUE_INDEX_NAME,
};

export const RRP_MESSAGE_INTENT_APPOINTMENT_SPARSE_UNIQUE_INDEX: IndexDescription = {
  key: { appointmentId: 1 },
  unique: true,
  partialFilterExpression: { appointmentId: { $type: "string" } },
  name: RRP_APPOINTMENT_MESSAGE_INTENT_APPOINTMENT_SPARSE_UNIQUE_INDEX_NAME,
};

let readinessOverrideForTests: boolean | null = null;
let cachedReady = false;

export function setRrpMessageIntentIndexesReadyForTests(ready: boolean | null): void {
  readinessOverrideForTests = ready;
  if (ready !== true) {
    cachedReady = false;
  }
}

export function resetRrpMessageIntentIndexReadinessForTests(): void {
  readinessOverrideForTests = null;
  cachedReady = false;
}

function unavailable(message: string): never {
  throw new RrpApplicationUnavailableError(message);
}

/**
 * Create/verify unique indexes on rrp_appointment_message_intents.
 * Fail closed before durable intent writes or claim/lease mutations.
 */
export async function assertRrpMessageIntentIndexesReady(
  options: { skipMongo?: boolean } = {},
): Promise<void> {
  if (readinessOverrideForTests === false) {
    unavailable("Regional Representative message intent indexes are not ready.");
  }

  if (readinessOverrideForTests === true || cachedReady) {
    return;
  }

  if (options.skipMongo) {
    return;
  }

  const collection = getMongoCollection(MONGO_COLLECTIONS.rrpAppointmentMessageIntents);

  const requiredNames = [
    RRP_MESSAGE_INTENT_CLIENT_MESSAGE_ID_UNIQUE_INDEX_NAME,
    RRP_APPOINTMENT_MESSAGE_INTENT_APPOINTMENT_SPARSE_UNIQUE_INDEX_NAME,
  ] as const;

  let indexes: Array<{ name?: string; unique?: boolean }>;
  try {
    indexes = await collection.indexes();
  } catch {
    unavailable(
      "Regional Representative message intent indexes could not be verified.",
    );
  }

  const missing = requiredNames.filter(
    (requiredName) =>
      !indexes.some((index) => index.name === requiredName && index.unique === true),
  );

  if (missing.length > 0) {
    for (const index of [
      RRP_MESSAGE_INTENT_CLIENT_MESSAGE_ID_UNIQUE_INDEX,
      RRP_MESSAGE_INTENT_APPOINTMENT_SPARSE_UNIQUE_INDEX,
    ]) {
      if (!missing.includes(index.name as (typeof requiredNames)[number])) {
        continue;
      }
      try {
        await collection.createIndex(index.key, {
          unique: index.unique,
          partialFilterExpression: index.partialFilterExpression,
          name: index.name,
        });
      } catch (error) {
        const mongoError = error as { code?: number; message?: string };
        if (mongoError.code !== 85 && mongoError.code !== 86) {
          unavailable(
            `Regional Representative message intent indexes could not be created (${mongoError.code ?? "unknown"}: ${mongoError.message ?? "no message"}).`,
          );
        }
      }
    }

    try {
      indexes = await collection.indexes();
    } catch {
      unavailable(
        "Regional Representative message intent indexes could not be verified.",
      );
    }
  }

  for (const requiredName of requiredNames) {
    const found = indexes.find(
      (index) => index.name === requiredName && index.unique === true,
    );
    if (!found) {
      unavailable(
        `Regional Representative message intent index is missing: ${requiredName}.`,
      );
    }
  }

  cachedReady = true;
}
