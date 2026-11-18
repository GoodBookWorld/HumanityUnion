/**
 * HU-RRP-03C — Representative appointment persistence.
 * Multiple Representatives per country are allowed.
 * At most one active appointment per (participantId, representCountryCode).
 */

import { randomUUID } from "node:crypto";

import type { ClientSession } from "mongodb";
import type { RrpAppointmentRecord, RrpAppointmentStatus } from "@hu/types";

import { MONGO_COLLECTIONS } from "../../infrastructure/mongodb/mongo-collections.js";
import { isMongoConfigured } from "../../infrastructure/mongodb/mongo-config.js";
import { connectMongoClient } from "../../infrastructure/mongodb/mongo-connection.js";
import { getMongoCollection } from "../../infrastructure/mongodb/mongo-database.js";
import { RrpApplicationConflictError, RrpApplicationUnavailableError } from "./rrp-application.errors.js";

interface RrpAppointmentDocument extends RrpAppointmentRecord {
  _id?: string;
}

let forceMemoryForTests = false;
const memoryStore = new Map<string, RrpAppointmentRecord>();

export function setRrpAppointmentForceMemoryForTests(enabled: boolean): void {
  forceMemoryForTests = enabled;
}

export function resetRrpAppointmentMemoryForTests(): void {
  memoryStore.clear();
}

function isDuplicateKeyError(error: unknown): boolean {
  return Boolean(
    error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code?: number }).code === 11000,
  );
}

async function ensureReady(): Promise<void> {
  if (forceMemoryForTests) {
    return;
  }
  if (!isMongoConfigured()) {
    throw new RrpApplicationUnavailableError(
      "Regional Representative appointment persistence is unavailable.",
    );
  }
  await connectMongoClient();
}

function strip(document: RrpAppointmentDocument): RrpAppointmentRecord {
  const { _id: _ignored, ...record } = document;
  return record;
}

function assertMemoryUniqueActive(record: RrpAppointmentRecord): void {
  if (record.status !== "active") {
    return;
  }
  for (const existing of memoryStore.values()) {
    if (
      existing.appointmentId !== record.appointmentId &&
      existing.participantId === record.participantId &&
      existing.representCountryCode === record.representCountryCode &&
      existing.status === "active"
    ) {
      throw new RrpApplicationConflictError(
        "An active Representative appointment already exists for this participant and country.",
      );
    }
  }
}

export function buildRrpAppointmentRecord(input: {
  participantId: string;
  userId: string;
  representCountryCode: string;
  sourceApplicationId: string;
  appointedByAdminUserId: string;
  appointedAt?: string;
}): RrpAppointmentRecord {
  const appointedAt = input.appointedAt ?? new Date().toISOString();
  return {
    appointmentId: randomUUID(),
    participantId: input.participantId,
    userId: input.userId,
    representCountryCode: input.representCountryCode,
    sourceApplicationId: input.sourceApplicationId,
    status: "active",
    appointedAt,
    appointedByAdminUserId: input.appointedByAdminUserId,
    revokedAt: null,
    revokedByAdminUserId: null,
    revision: 1,
    auditHistory: [
      {
        at: appointedAt,
        byAdminUserId: input.appointedByAdminUserId,
        action: "appoint",
        note: null,
      },
    ],
  };
}

export async function findRrpAppointmentById(
  appointmentId: string,
): Promise<RrpAppointmentRecord | null> {
  await ensureReady();
  if (forceMemoryForTests) {
    return memoryStore.get(appointmentId) ?? null;
  }
  const document = await getMongoCollection<RrpAppointmentDocument>(
    MONGO_COLLECTIONS.rrpAppointments,
  ).findOne({ appointmentId });
  return document ? strip(document) : null;
}

export async function findActiveRrpAppointmentForParticipantCountry(input: {
  participantId: string;
  representCountryCode: string;
}): Promise<RrpAppointmentRecord | null> {
  await ensureReady();
  if (forceMemoryForTests) {
    for (const record of memoryStore.values()) {
      if (
        record.participantId === input.participantId &&
        record.representCountryCode === input.representCountryCode &&
        record.status === "active"
      ) {
        return record;
      }
    }
    return null;
  }
  const document = await getMongoCollection<RrpAppointmentDocument>(
    MONGO_COLLECTIONS.rrpAppointments,
  ).findOne({
    participantId: input.participantId,
    representCountryCode: input.representCountryCode,
    status: "active",
  });
  return document ? strip(document) : null;
}

export async function findActiveRrpAppointmentBySourceApplicationId(
  sourceApplicationId: string,
): Promise<RrpAppointmentRecord | null> {
  await ensureReady();
  if (forceMemoryForTests) {
    for (const record of memoryStore.values()) {
      if (record.sourceApplicationId === sourceApplicationId && record.status === "active") {
        return record;
      }
    }
    return null;
  }
  const document = await getMongoCollection<RrpAppointmentDocument>(
    MONGO_COLLECTIONS.rrpAppointments,
  ).findOne({ sourceApplicationId, status: "active" });
  return document ? strip(document) : null;
}

export async function listActiveRrpAppointmentsForParticipantIds(
  participantIds: readonly string[],
): Promise<RrpAppointmentRecord[]> {
  if (participantIds.length === 0) {
    return [];
  }
  await ensureReady();
  if (forceMemoryForTests) {
    return [...memoryStore.values()].filter(
      (record) => record.status === "active" && participantIds.includes(record.participantId),
    );
  }
  const documents = await getMongoCollection<RrpAppointmentDocument>(
    MONGO_COLLECTIONS.rrpAppointments,
  )
    .find({ participantId: { $in: [...participantIds] }, status: "active" })
    .toArray();
  return documents.map(strip);
}

export async function findUserIdsWithActiveRrpAppointments(): Promise<string[]> {
  await ensureReady();
  if (forceMemoryForTests) {
    return [
      ...new Set(
        [...memoryStore.values()]
          .filter((record) => record.status === "active")
          .map((record) => record.userId),
      ),
    ];
  }
  const values = await getMongoCollection<RrpAppointmentDocument>(
    MONGO_COLLECTIONS.rrpAppointments,
  ).distinct("userId", { status: "active" });
  return values.filter((value): value is string => typeof value === "string");
}

export async function insertRrpAppointment(
  record: RrpAppointmentRecord,
  options: { session?: ClientSession } = {},
): Promise<RrpAppointmentRecord> {
  await ensureReady();
  if (forceMemoryForTests) {
    assertMemoryUniqueActive(record);
    if (memoryStore.has(record.appointmentId)) {
      throw new RrpApplicationConflictError("Appointment id already exists.");
    }
    memoryStore.set(record.appointmentId, record);
    return record;
  }

  try {
    await getMongoCollection<RrpAppointmentDocument>(MONGO_COLLECTIONS.rrpAppointments).insertOne(
      { ...record },
      options.session ? { session: options.session } : undefined,
    );
    return record;
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      throw new RrpApplicationConflictError(
        "An active Representative appointment already exists for this participant and country.",
      );
    }
    throw error;
  }
}

export async function replaceRrpAppointment(
  record: RrpAppointmentRecord,
  options: { session?: ClientSession } = {},
): Promise<void> {
  await ensureReady();
  if (forceMemoryForTests) {
    assertMemoryUniqueActive(record);
    memoryStore.set(record.appointmentId, record);
    return;
  }
  await getMongoCollection<RrpAppointmentDocument>(MONGO_COLLECTIONS.rrpAppointments).replaceOne(
    { appointmentId: record.appointmentId },
    { ...record },
    options.session ? { session: options.session } : undefined,
  );
}

/** Internal revoke helper — no public UI in this pack. */
export async function revokeRrpAppointmentRecord(input: {
  appointmentId: string;
  revokedByAdminUserId: string;
  note?: string | null;
}): Promise<RrpAppointmentRecord> {
  const current = await findRrpAppointmentById(input.appointmentId);
  if (!current) {
    throw new RrpApplicationConflictError("Appointment not found.");
  }
  if (current.status === "revoked") {
    return current;
  }
  const now = new Date().toISOString();
  const next: RrpAppointmentRecord = {
    ...current,
    status: "revoked" as RrpAppointmentStatus,
    revokedAt: now,
    revokedByAdminUserId: input.revokedByAdminUserId,
    revision: current.revision + 1,
    auditHistory: [
      ...current.auditHistory,
      {
        at: now,
        byAdminUserId: input.revokedByAdminUserId,
        action: "revoke",
        note: input.note ?? null,
      },
    ],
  };
  await replaceRrpAppointment(next);
  return next;
}
