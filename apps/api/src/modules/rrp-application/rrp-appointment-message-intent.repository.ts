/**
 * HU-RRP-03C — durable, idempotent post-approval Messages intent.
 * Written in the same transaction as approval/appointment.
 * Best-effort DM delivery happens after commit and never rolls back appointment.
 *
 * Temporary delivery failures keep status `pending` (with lastError) so a
 * later retry can succeed. Automatic worker retry is not implemented yet.
 * Duplicate DM sends are prevented by stable clientMessageId.
 */

import { randomUUID } from "node:crypto";

import type { ClientSession } from "mongodb";

import { MONGO_COLLECTIONS } from "../../infrastructure/mongodb/mongo-collections.js";
import { isMongoConfigured } from "../../infrastructure/mongodb/mongo-config.js";
import { connectMongoClient } from "../../infrastructure/mongodb/mongo-connection.js";
import { getMongoCollection } from "../../infrastructure/mongodb/mongo-database.js";

export type RrpAppointmentMessageIntentStatus =
  | "pending"
  | "delivered"
  | "failed";

export interface RrpAppointmentMessageIntentRecord {
  readonly intentId: string;
  readonly appointmentId: string;
  readonly applicationId: string;
  readonly recipientParticipantId: string;
  readonly adminParticipantId: string;
  readonly representCountryCode: string;
  readonly status: RrpAppointmentMessageIntentStatus;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly deliveryAttempts: number;
  readonly lastError: string | null;
  readonly clientMessageId: string;
}

interface IntentDocument extends RrpAppointmentMessageIntentRecord {
  _id?: string;
}

let forceMemoryForTests = false;
const memoryStore = new Map<string, RrpAppointmentMessageIntentRecord>();

export function setRrpAppointmentMessageIntentForceMemoryForTests(enabled: boolean): void {
  forceMemoryForTests = enabled;
}

export function resetRrpAppointmentMessageIntentMemoryForTests(): void {
  memoryStore.clear();
}

async function ensureReady(): Promise<void> {
  if (forceMemoryForTests) {
    return;
  }
  if (!isMongoConfigured()) {
    return;
  }
  await connectMongoClient();
}

function strip(document: IntentDocument): RrpAppointmentMessageIntentRecord {
  const { _id: _ignored, ...record } = document;
  return record;
}

export function buildRrpAppointmentMessageIntent(input: {
  appointmentId: string;
  applicationId: string;
  recipientParticipantId: string;
  adminParticipantId: string;
  representCountryCode: string;
}): RrpAppointmentMessageIntentRecord {
  const now = new Date().toISOString();
  return {
    intentId: randomUUID(),
    appointmentId: input.appointmentId,
    applicationId: input.applicationId,
    recipientParticipantId: input.recipientParticipantId,
    adminParticipantId: input.adminParticipantId,
    representCountryCode: input.representCountryCode,
    status: "pending",
    createdAt: now,
    updatedAt: now,
    deliveryAttempts: 0,
    lastError: null,
    // Stable idempotency key for DM send retries.
    clientMessageId: `rrp-appointment:${input.appointmentId}`,
  };
}

export async function findRrpAppointmentMessageIntentByAppointmentId(
  appointmentId: string,
): Promise<RrpAppointmentMessageIntentRecord | null> {
  await ensureReady();
  if (forceMemoryForTests) {
    for (const record of memoryStore.values()) {
      if (record.appointmentId === appointmentId) {
        return record;
      }
    }
    return null;
  }
  if (!isMongoConfigured()) {
    return null;
  }
  const document = await getMongoCollection<IntentDocument>(
    MONGO_COLLECTIONS.rrpAppointmentMessageIntents,
  ).findOne({ appointmentId });
  return document ? strip(document) : null;
}

/**
 * Insert intent idempotently. Returns existing row when appointmentId already recorded.
 */
export async function insertRrpAppointmentMessageIntentIdempotent(
  record: RrpAppointmentMessageIntentRecord,
  options: { session?: ClientSession } = {},
): Promise<{ record: RrpAppointmentMessageIntentRecord; created: boolean }> {
  await ensureReady();
  if (forceMemoryForTests) {
    for (const existing of memoryStore.values()) {
      if (existing.appointmentId === record.appointmentId) {
        return { record: existing, created: false };
      }
    }
    memoryStore.set(record.intentId, record);
    return { record, created: true };
  }

  if (!isMongoConfigured()) {
    // Memory-less no-op for environments without Mongo — caller still returns warning.
    return { record, created: false };
  }

  try {
    await getMongoCollection<IntentDocument>(
      MONGO_COLLECTIONS.rrpAppointmentMessageIntents,
    ).insertOne({ ...record }, options.session ? { session: options.session } : undefined);
    return { record, created: true };
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code?: number }).code === 11000
    ) {
      const existing = await findRrpAppointmentMessageIntentByAppointmentId(record.appointmentId);
      if (existing) {
        return { record: existing, created: false };
      }
    }
    throw error;
  }
}

export async function markRrpAppointmentMessageIntentDelivered(
  appointmentId: string,
): Promise<void> {
  await ensureReady();
  const now = new Date().toISOString();
  if (forceMemoryForTests) {
    for (const [key, record] of memoryStore.entries()) {
      if (record.appointmentId === appointmentId) {
        memoryStore.set(key, {
          ...record,
          status: "delivered",
          updatedAt: now,
          deliveryAttempts: record.deliveryAttempts + 1,
          lastError: null,
        });
      }
    }
    return;
  }
  if (!isMongoConfigured()) {
    return;
  }
  await getMongoCollection<IntentDocument>(
    MONGO_COLLECTIONS.rrpAppointmentMessageIntents,
  ).updateOne(
    { appointmentId },
    {
      $set: { status: "delivered", updatedAt: now, lastError: null },
      $inc: { deliveryAttempts: 1 },
    },
  );
}

/**
 * Record a temporary delivery failure while keeping the intent `pending`
 * so an operator or future worker can retry. Does not mark delivered.
 */
export async function recordRrpAppointmentMessageIntentDeliveryAttempt(
  appointmentId: string,
  lastError: string,
): Promise<void> {
  await ensureReady();
  const now = new Date().toISOString();
  if (forceMemoryForTests) {
    for (const [key, record] of memoryStore.entries()) {
      if (record.appointmentId === appointmentId && record.status !== "delivered") {
        memoryStore.set(key, {
          ...record,
          status: "pending",
          updatedAt: now,
          deliveryAttempts: record.deliveryAttempts + 1,
          lastError,
        });
      }
    }
    return;
  }
  if (!isMongoConfigured()) {
    return;
  }
  await getMongoCollection<IntentDocument>(
    MONGO_COLLECTIONS.rrpAppointmentMessageIntents,
  ).updateOne(
    { appointmentId, status: { $ne: "delivered" } },
    {
      $set: { status: "pending", updatedAt: now, lastError },
      $inc: { deliveryAttempts: 1 },
    },
  );
}
