/**
 * HU-RRP-03C/03E — durable, idempotent RRP Messages intents.
 * Written with the review/appointment decision; DM delivery is best-effort after commit.
 *
 * Temporary failures stay `pending` with nextRetryAt backoff until attempt limit,
 * then `failed`. Stable clientMessageId prevents duplicate DMs.
 */

import { randomUUID } from "node:crypto";

import type { ClientSession } from "mongodb";

import { MONGO_COLLECTIONS } from "../../infrastructure/mongodb/mongo-collections.js";
import { isMongoConfigured } from "../../infrastructure/mongodb/mongo-config.js";
import { connectMongoClient } from "../../infrastructure/mongodb/mongo-connection.js";
import { getMongoCollection } from "../../infrastructure/mongodb/mongo-database.js";
import {
  buildRrpAppointmentApprovalClientMessageId,
  buildRrpRequestInformationClientMessageId,
  computeRrpMessageIntentNextRetryAt,
  RRP_MESSAGE_INTENT_CLAIM_LEASE_MS,
  RRP_MESSAGE_INTENT_MAX_DELIVERY_ATTEMPTS,
  type RrpMessageIntentKind,
} from "./rrp-message-intent.constants.js";
import { assertRrpMessageIntentIndexesReady } from "./rrp-message-intent.index-readiness.js";

export type RrpAppointmentMessageIntentStatus =
  | "pending"
  | "delivered"
  | "failed";

export interface RrpAppointmentMessageIntentRecord {
  readonly intentId: string;
  readonly kind: RrpMessageIntentKind;
  /** Set for appointment_approval; null for request_information. */
  readonly appointmentId: string | null;
  readonly applicationId: string;
  /** Revision at intent creation — used for request_information idempotency. */
  readonly applicationRevision: number;
  readonly recipientParticipantId: string;
  readonly adminParticipantId: string;
  readonly representCountryCode: string;
  /**
   * Admin explanation for request_information only.
   * Never stores DOB, funding amounts, or application narrative fields.
   */
  readonly requestExplanation: string | null;
  readonly status: RrpAppointmentMessageIntentStatus;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly deliveryAttempts: number;
  readonly lastError: string | null;
  readonly nextRetryAt: string | null;
  /** Exclusive worker lease expiry; null when unclaimed. */
  readonly claimLeaseUntil: string | null;
  /** Opaque claim owner id for diagnostics (no PII). */
  readonly claimOwnerId: string | null;
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

async function ensureWriteReady(): Promise<void> {
  await ensureReady();
  if (forceMemoryForTests) {
    return;
  }
  if (!isMongoConfigured()) {
    return;
  }
  await assertRrpMessageIntentIndexesReady({ skipMongo: false });
}

function strip(document: IntentDocument): RrpAppointmentMessageIntentRecord {
  const { _id: _ignored, ...record } = document;
  return {
    ...record,
    kind: record.kind ?? "appointment_approval",
    appointmentId: record.appointmentId ?? null,
    applicationRevision: record.applicationRevision ?? 0,
    requestExplanation: record.requestExplanation ?? null,
    nextRetryAt: record.nextRetryAt ?? null,
    claimLeaseUntil: record.claimLeaseUntil ?? null,
    claimOwnerId: record.claimOwnerId ?? null,
  };
}

export function buildRrpAppointmentMessageIntent(input: {
  appointmentId: string;
  applicationId: string;
  applicationRevision?: number;
  recipientParticipantId: string;
  adminParticipantId: string;
  representCountryCode: string;
}): RrpAppointmentMessageIntentRecord {
  const now = new Date().toISOString();
  return {
    intentId: randomUUID(),
    kind: "appointment_approval",
    appointmentId: input.appointmentId,
    applicationId: input.applicationId,
    applicationRevision: input.applicationRevision ?? 0,
    recipientParticipantId: input.recipientParticipantId,
    adminParticipantId: input.adminParticipantId,
    representCountryCode: input.representCountryCode,
    requestExplanation: null,
    status: "pending",
    createdAt: now,
    updatedAt: now,
    deliveryAttempts: 0,
    lastError: null,
    nextRetryAt: now,
    claimLeaseUntil: null,
    claimOwnerId: null,
    clientMessageId: buildRrpAppointmentApprovalClientMessageId(input.appointmentId),
  };
}

export function buildRrpRequestInformationMessageIntent(input: {
  applicationId: string;
  applicationRevision: number;
  recipientParticipantId: string;
  adminParticipantId: string;
  representCountryCode: string;
  requestExplanation: string;
}): RrpAppointmentMessageIntentRecord {
  const now = new Date().toISOString();
  return {
    intentId: randomUUID(),
    kind: "request_information",
    appointmentId: null,
    applicationId: input.applicationId,
    applicationRevision: input.applicationRevision,
    recipientParticipantId: input.recipientParticipantId,
    adminParticipantId: input.adminParticipantId,
    representCountryCode: input.representCountryCode,
    requestExplanation: input.requestExplanation,
    status: "pending",
    createdAt: now,
    updatedAt: now,
    deliveryAttempts: 0,
    lastError: null,
    nextRetryAt: now,
    claimLeaseUntil: null,
    claimOwnerId: null,
    clientMessageId: buildRrpRequestInformationClientMessageId({
      applicationId: input.applicationId,
      applicationRevision: input.applicationRevision,
    }),
  };
}

export async function findRrpMessageIntentById(
  intentId: string,
): Promise<RrpAppointmentMessageIntentRecord | null> {
  await ensureReady();
  if (forceMemoryForTests) {
    return memoryStore.get(intentId) ?? null;
  }
  if (!isMongoConfigured()) {
    return null;
  }
  const document = await getMongoCollection<IntentDocument>(
    MONGO_COLLECTIONS.rrpAppointmentMessageIntents,
  ).findOne({ intentId });
  return document ? strip(document) : null;
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

export async function findRrpMessageIntentByClientMessageId(
  clientMessageId: string,
): Promise<RrpAppointmentMessageIntentRecord | null> {
  await ensureReady();
  if (forceMemoryForTests) {
    for (const record of memoryStore.values()) {
      if (record.clientMessageId === clientMessageId) {
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
  ).findOne({ clientMessageId });
  return document ? strip(document) : null;
}

/**
 * Owner-safe linkage helper — all intents for one application (any status/kind).
 * Newest-first by updatedAt then createdAt for deterministic selection.
 */
export async function listRrpMessageIntentsByApplicationId(
  applicationId: string,
): Promise<RrpAppointmentMessageIntentRecord[]> {
  const id = applicationId.trim();
  if (!id) {
    return [];
  }
  await ensureReady();
  if (forceMemoryForTests) {
    return [...memoryStore.values()]
      .filter((record) => record.applicationId === id)
      .sort(compareRrpMessageIntentsNewestFirst);
  }
  if (!isMongoConfigured()) {
    return [];
  }
  const documents = await getMongoCollection<IntentDocument>(
    MONGO_COLLECTIONS.rrpAppointmentMessageIntents,
  )
    .find({ applicationId: id })
    .toArray();
  return documents.map(strip).sort(compareRrpMessageIntentsNewestFirst);
}

function compareRrpMessageIntentsNewestFirst(
  left: RrpAppointmentMessageIntentRecord,
  right: RrpAppointmentMessageIntentRecord,
): number {
  const byUpdated = right.updatedAt.localeCompare(left.updatedAt);
  if (byUpdated !== 0) {
    return byUpdated;
  }
  return right.createdAt.localeCompare(left.createdAt);
}

/**
 * Insert intent idempotently by clientMessageId (and appointmentId for approvals).
 */
export async function insertRrpAppointmentMessageIntentIdempotent(
  record: RrpAppointmentMessageIntentRecord,
  options: { session?: ClientSession } = {},
): Promise<{ record: RrpAppointmentMessageIntentRecord; created: boolean }> {
  await ensureWriteReady();
  if (forceMemoryForTests) {
    for (const existing of memoryStore.values()) {
      if (existing.clientMessageId === record.clientMessageId) {
        return { record: existing, created: false };
      }
      if (
        record.appointmentId &&
        existing.appointmentId === record.appointmentId
      ) {
        return { record: existing, created: false };
      }
    }
    memoryStore.set(record.intentId, record);
    return { record, created: true };
  }

  if (!isMongoConfigured()) {
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
      const existing =
        (await findRrpMessageIntentByClientMessageId(record.clientMessageId)) ??
        (record.appointmentId
          ? await findRrpAppointmentMessageIntentByAppointmentId(record.appointmentId)
          : null);
      if (existing) {
        return { record: existing, created: false };
      }
    }
    throw error;
  }
}

export async function markRrpMessageIntentDelivered(intentId: string): Promise<void> {
  await ensureWriteReady();
  const now = new Date().toISOString();
  if (forceMemoryForTests) {
    const record = memoryStore.get(intentId);
    if (record) {
      memoryStore.set(intentId, {
        ...record,
        status: "delivered",
        updatedAt: now,
        deliveryAttempts: record.deliveryAttempts + 1,
        lastError: null,
        nextRetryAt: null,
        claimLeaseUntil: null,
        claimOwnerId: null,
      });
    }
    return;
  }
  if (!isMongoConfigured()) {
    return;
  }
  await getMongoCollection<IntentDocument>(
    MONGO_COLLECTIONS.rrpAppointmentMessageIntents,
  ).updateOne(
    { intentId },
    {
      $set: {
        status: "delivered",
        updatedAt: now,
        lastError: null,
        nextRetryAt: null,
        claimLeaseUntil: null,
        claimOwnerId: null,
      },
      $inc: { deliveryAttempts: 1 },
    },
  );
}

/** @deprecated Prefer markRrpMessageIntentDelivered(intentId). */
export async function markRrpAppointmentMessageIntentDelivered(
  appointmentId: string,
): Promise<void> {
  const intent = await findRrpAppointmentMessageIntentByAppointmentId(appointmentId);
  if (intent) {
    await markRrpMessageIntentDelivered(intent.intentId);
  }
}

/**
 * Record a delivery failure. Keeps `pending` with backoff until max attempts,
 * then marks terminal `failed`.
 */
export async function recordRrpMessageIntentDeliveryAttempt(
  intentId: string,
  lastError: string,
): Promise<RrpAppointmentMessageIntentRecord | null> {
  await ensureWriteReady();
  const nowDate = new Date();
  const now = nowDate.toISOString();

  const applyFailure = (
    record: RrpAppointmentMessageIntentRecord,
  ): RrpAppointmentMessageIntentRecord => {
    const deliveryAttempts = record.deliveryAttempts + 1;
    const exhausted = deliveryAttempts >= RRP_MESSAGE_INTENT_MAX_DELIVERY_ATTEMPTS;
    return {
      ...record,
      status: exhausted ? "failed" : "pending",
      updatedAt: now,
      deliveryAttempts,
      lastError,
      nextRetryAt: exhausted
        ? null
        : computeRrpMessageIntentNextRetryAt({
            deliveryAttempts,
            now: nowDate,
          }),
      claimLeaseUntil: null,
      claimOwnerId: null,
    };
  };

  if (forceMemoryForTests) {
    const record = memoryStore.get(intentId);
    if (!record || record.status === "delivered") {
      return record ?? null;
    }
    const next = applyFailure(record);
    memoryStore.set(intentId, next);
    return next;
  }
  if (!isMongoConfigured()) {
    return null;
  }

  const collection = getMongoCollection<IntentDocument>(
    MONGO_COLLECTIONS.rrpAppointmentMessageIntents,
  );
  const current = await collection.findOne({ intentId, status: { $ne: "delivered" } });
  if (!current) {
    return null;
  }
  const next = applyFailure(strip(current));
  await collection.updateOne(
    { intentId, status: { $ne: "delivered" } },
    {
      $set: {
        status: next.status,
        updatedAt: next.updatedAt,
        lastError: next.lastError,
        nextRetryAt: next.nextRetryAt,
        deliveryAttempts: next.deliveryAttempts,
        claimLeaseUntil: null,
        claimOwnerId: null,
      },
    },
  );
  return next;
}

/** @deprecated Prefer recordRrpMessageIntentDeliveryAttempt(intentId). */
export async function recordRrpAppointmentMessageIntentDeliveryAttempt(
  appointmentId: string,
  lastError: string,
): Promise<void> {
  const intent = await findRrpAppointmentMessageIntentByAppointmentId(appointmentId);
  if (intent) {
    await recordRrpMessageIntentDeliveryAttempt(intent.intentId, lastError);
  }
}

function isClaimExpired(
  record: RrpAppointmentMessageIntentRecord,
  nowIso: string,
): boolean {
  return record.claimLeaseUntil === null || record.claimLeaseUntil <= nowIso;
}

function isRetryDue(record: RrpAppointmentMessageIntentRecord, nowIso: string): boolean {
  return record.nextRetryAt === null || record.nextRetryAt <= nowIso;
}

export async function listRetryableRrpMessageIntents(input: {
  limit: number;
  now?: Date;
}): Promise<RrpAppointmentMessageIntentRecord[]> {
  const limit = Math.min(Math.max(Math.trunc(input.limit), 1), 100);
  const nowIso = (input.now ?? new Date()).toISOString();
  await ensureReady();

  if (forceMemoryForTests) {
    return [...memoryStore.values()]
      .filter(
        (record) =>
          record.status === "pending" &&
          record.deliveryAttempts < RRP_MESSAGE_INTENT_MAX_DELIVERY_ATTEMPTS &&
          isRetryDue(record, nowIso) &&
          isClaimExpired(record, nowIso),
      )
      .sort((a, b) => a.updatedAt.localeCompare(b.updatedAt))
      .slice(0, limit);
  }

  if (!isMongoConfigured()) {
    return [];
  }

  const documents = await getMongoCollection<IntentDocument>(
    MONGO_COLLECTIONS.rrpAppointmentMessageIntents,
  )
    .find({
      status: "pending",
      deliveryAttempts: { $lt: RRP_MESSAGE_INTENT_MAX_DELIVERY_ATTEMPTS },
      $and: [
        { $or: [{ nextRetryAt: null }, { nextRetryAt: { $lte: nowIso } }] },
        { $or: [{ claimLeaseUntil: null }, { claimLeaseUntil: { $lte: nowIso } }] },
      ],
    })
    .sort({ updatedAt: 1 })
    .limit(limit)
    .toArray();

  return documents.map(strip);
}

/**
 * Atomically claim one retryable intent for exclusive processing.
 * Sets claimLeaseUntil so concurrent workers / API instances skip it until
 * lease expiry (or deliver/fail clears the lease). Restart-safe: expired
 * leases become claimable again.
 */
export async function claimNextRrpMessageIntent(input?: {
  now?: Date;
  claimOwnerId?: string;
  leaseMs?: number;
}): Promise<RrpAppointmentMessageIntentRecord | null> {
  await ensureWriteReady();
  const nowDate = input?.now ?? new Date();
  const nowIso = nowDate.toISOString();
  const leaseMs = input?.leaseMs ?? RRP_MESSAGE_INTENT_CLAIM_LEASE_MS;
  const leaseUntil = new Date(nowDate.getTime() + leaseMs).toISOString();
  const claimOwnerId = input?.claimOwnerId ?? randomUUID();

  if (forceMemoryForTests) {
    const eligible = [...memoryStore.values()]
      .filter(
        (record) =>
          record.status === "pending" &&
          record.deliveryAttempts < RRP_MESSAGE_INTENT_MAX_DELIVERY_ATTEMPTS &&
          isRetryDue(record, nowIso) &&
          isClaimExpired(record, nowIso),
      )
      .sort((a, b) => a.updatedAt.localeCompare(b.updatedAt));
    const current = eligible[0];
    if (!current) {
      return null;
    }
    // Re-check under the same in-memory map (single-threaded atomicity for tests).
    const latest = memoryStore.get(current.intentId);
    if (
      !latest ||
      latest.status !== "pending" ||
      !isRetryDue(latest, nowIso) ||
      !isClaimExpired(latest, nowIso)
    ) {
      return null;
    }
    const claimed: RrpAppointmentMessageIntentRecord = {
      ...latest,
      updatedAt: nowIso,
      claimLeaseUntil: leaseUntil,
      claimOwnerId,
      // Hold off other workers until lease ends even if nextRetryAt was due.
      nextRetryAt: leaseUntil,
    };
    memoryStore.set(latest.intentId, claimed);
    return claimed;
  }

  if (!isMongoConfigured()) {
    return null;
  }

  const collection = getMongoCollection<IntentDocument>(
    MONGO_COLLECTIONS.rrpAppointmentMessageIntents,
  );
  const eligibility = {
    status: "pending" as const,
    deliveryAttempts: { $lt: RRP_MESSAGE_INTENT_MAX_DELIVERY_ATTEMPTS },
    $and: [
      { $or: [{ nextRetryAt: null }, { nextRetryAt: { $lte: nowIso } }] },
      { $or: [{ claimLeaseUntil: null }, { claimLeaseUntil: { $lte: nowIso } }] },
    ],
  };

  const candidate = await collection.findOne(eligibility, { sort: { updatedAt: 1 } });
  if (!candidate) {
    return null;
  }

  const claimed = await collection.findOneAndUpdate(
    {
      intentId: candidate.intentId,
      ...eligibility,
    },
    {
      $set: {
        updatedAt: nowIso,
        claimLeaseUntil: leaseUntil,
        claimOwnerId,
        nextRetryAt: leaseUntil,
      },
    },
    { returnDocument: "after" },
  );

  return claimed ? strip(claimed) : null;
}
