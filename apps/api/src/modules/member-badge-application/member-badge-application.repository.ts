import { randomUUID } from "node:crypto";

import type {
  MemberBadgeApplicationFulfillmentStatus,
  MemberBadgeApplicationRecord,
  MemberBadgeApplicationShippingAddress,
} from "@hu/types";

import { MONGO_COLLECTIONS } from "../../infrastructure/mongodb/mongo-collections.js";
import { isMongoConfigured } from "../../infrastructure/mongodb/mongo-config.js";
import { connectMongoClient } from "../../infrastructure/mongodb/mongo-connection.js";
import { getMongoCollection } from "../../infrastructure/mongodb/mongo-database.js";
import {
  MEMBER_BADGE_APPLICATION_AMOUNT_CENTS,
  MEMBER_BADGE_APPLICATION_CURRENCY,
} from "./member-badge-application.constants.js";
import { MemberBadgeApplicationUnavailableError } from "./member-badge-application.errors.js";

interface MemberBadgeApplicationDocument extends MemberBadgeApplicationRecord {
  _id?: string;
}

async function ensureReady(): Promise<void> {
  if (!isMongoConfigured()) {
    throw new MemberBadgeApplicationUnavailableError(
      "Member Badge Application persistence is unavailable.",
    );
  }

  await connectMongoClient();
}

/** Pack 25D — fill shipped/delivered markers for legacy documents. */
export function normalizeRecord(
  record: MemberBadgeApplicationRecord,
): MemberBadgeApplicationRecord {
  return {
    ...record,
    shipped: record.shipped === true,
    shippedAt: record.shippedAt ?? null,
    delivered: record.delivered === true,
    deliveredAt: record.deliveredAt ?? null,
    lastLabelEmailedAt: record.lastLabelEmailedAt ?? null,
  };
}

function strip(document: MemberBadgeApplicationDocument): MemberBadgeApplicationRecord {
  const { _id: _ignored, ...record } = document;
  return normalizeRecord(record);
}

export function buildMemberBadgeApplicationRecord(input: {
  userId: string;
  participantId: string;
  membershipId: string;
  memberNumberSnapshot: string;
  shippingAddress: MemberBadgeApplicationShippingAddress;
  applicationStatus: MemberBadgeApplicationRecord["applicationStatus"];
}): MemberBadgeApplicationRecord {
  const timestamp = new Date().toISOString();

  return {
    applicationId: randomUUID(),
    userId: input.userId,
    participantId: input.participantId,
    membershipId: input.membershipId,
    memberNumberSnapshot: input.memberNumberSnapshot,
    shippingAddress: input.shippingAddress,
    applicationStatus: input.applicationStatus,
    paymentStatus: "unpaid",
    fulfillmentStatus: "not_ready",
    shipped: false,
    shippedAt: null,
    delivered: false,
    deliveredAt: null,
    amountCents: MEMBER_BADGE_APPLICATION_AMOUNT_CENTS,
    currency: MEMBER_BADGE_APPLICATION_CURRENCY,
    deliveryIncluded: true,
    stripeCheckoutSessionId: null,
    stripePaymentIntentId: null,
    lastStripeEventId: null,
    paidAt: null,
    lastLabelEmailedAt: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export async function findActiveUnpaidMemberBadgeApplicationByUserId(
  userId: string,
): Promise<MemberBadgeApplicationRecord | null> {
  await ensureReady();
  const collection = getMongoCollection<MemberBadgeApplicationDocument>(
    MONGO_COLLECTIONS.memberBadgeApplications,
  );
  const document = await collection.findOne({
    userId,
    paymentStatus: "unpaid",
    applicationStatus: { $in: ["draft", "submitted"] },
  });
  return document ? strip(document) : null;
}

/** Latest non-cancelled application for the owner widget (paid or unpaid). */
export async function findCurrentMemberBadgeApplicationByUserId(
  userId: string,
): Promise<MemberBadgeApplicationRecord | null> {
  await ensureReady();
  const collection = getMongoCollection<MemberBadgeApplicationDocument>(
    MONGO_COLLECTIONS.memberBadgeApplications,
  );
  const document = await collection.findOne(
    {
      userId,
      applicationStatus: { $ne: "cancelled" },
    },
    { sort: { updatedAt: -1 } },
  );
  return document ? strip(document) : null;
}

export async function findMemberBadgeApplicationById(
  applicationId: string,
): Promise<MemberBadgeApplicationRecord | null> {
  await ensureReady();
  const collection = getMongoCollection<MemberBadgeApplicationDocument>(
    MONGO_COLLECTIONS.memberBadgeApplications,
  );
  const document = await collection.findOne({ applicationId });
  return document ? strip(document) : null;
}

export async function findMemberBadgeApplicationByCheckoutSessionId(
  stripeCheckoutSessionId: string,
): Promise<MemberBadgeApplicationRecord | null> {
  await ensureReady();
  const collection = getMongoCollection<MemberBadgeApplicationDocument>(
    MONGO_COLLECTIONS.memberBadgeApplications,
  );
  const document = await collection.findOne({ stripeCheckoutSessionId });
  return document ? strip(document) : null;
}

export async function findMemberBadgeApplicationByIdForUser(input: {
  applicationId: string;
  userId: string;
}): Promise<MemberBadgeApplicationRecord | null> {
  await ensureReady();
  const collection = getMongoCollection<MemberBadgeApplicationDocument>(
    MONGO_COLLECTIONS.memberBadgeApplications,
  );
  const document = await collection.findOne({
    applicationId: input.applicationId,
    userId: input.userId,
  });
  return document ? strip(document) : null;
}

/** Distinct userIds that have at least one Member Badge Application. */
export async function findUserIdsWithMemberBadgeApplications(): Promise<string[]> {
  await ensureReady();
  const collection = getMongoCollection<MemberBadgeApplicationDocument>(
    MONGO_COLLECTIONS.memberBadgeApplications,
  );
  const userIds = await collection.distinct("userId");
  return userIds.filter((id): id is string => typeof id === "string" && id.trim().length > 0);
}

/** Admin list — newest updated first. */
export async function listMemberBadgeApplicationsForAdmin(input: {
  limit: number;
  offset: number;
}): Promise<MemberBadgeApplicationRecord[]> {
  await ensureReady();
  const collection = getMongoCollection<MemberBadgeApplicationDocument>(
    MONGO_COLLECTIONS.memberBadgeApplications,
  );
  const documents = await collection
    .find({})
    .sort({ updatedAt: -1 })
    .skip(input.offset)
    .limit(input.limit)
    .toArray();
  return documents.map(strip);
}

/**
 * Latest application per userId (by updatedAt desc).
 * Used for Member Badge Orders directory rows.
 */
export async function findLatestMemberBadgeApplicationByUserIds(
  userIds: readonly string[],
): Promise<Map<string, MemberBadgeApplicationRecord>> {
  const uniqueIds = [...new Set(userIds.filter((id) => id.trim().length > 0))];
  if (uniqueIds.length === 0) {
    return new Map();
  }

  await ensureReady();
  const collection = getMongoCollection<MemberBadgeApplicationDocument>(
    MONGO_COLLECTIONS.memberBadgeApplications,
  );
  const documents = await collection
    .find({ userId: { $in: uniqueIds } })
    .sort({ updatedAt: -1 })
    .toArray();

  const result = new Map<string, MemberBadgeApplicationRecord>();
  for (const document of documents) {
    if (!result.has(document.userId)) {
      result.set(document.userId, strip(document));
    }
  }
  return result;
}

export async function insertMemberBadgeApplication(
  record: MemberBadgeApplicationRecord,
): Promise<MemberBadgeApplicationRecord> {
  await ensureReady();
  const collection = getMongoCollection<MemberBadgeApplicationDocument>(
    MONGO_COLLECTIONS.memberBadgeApplications,
  );
  await collection.insertOne(record);
  return record;
}

export async function updateMemberBadgeApplicationShipping(input: {
  applicationId: string;
  userId: string;
  shippingAddress: MemberBadgeApplicationShippingAddress;
  applicationStatus: MemberBadgeApplicationRecord["applicationStatus"];
}): Promise<MemberBadgeApplicationRecord | null> {
  await ensureReady();
  const collection = getMongoCollection<MemberBadgeApplicationDocument>(
    MONGO_COLLECTIONS.memberBadgeApplications,
  );
  const updatedAt = new Date().toISOString();
  const result = await collection.findOneAndUpdate(
    {
      applicationId: input.applicationId,
      userId: input.userId,
      paymentStatus: "unpaid",
      applicationStatus: { $in: ["draft", "submitted"] },
    },
    {
      $set: {
        shippingAddress: input.shippingAddress,
        applicationStatus: input.applicationStatus,
        updatedAt,
      },
    },
    { returnDocument: "after" },
  );

  return result ? strip(result) : null;
}

export async function updateMemberBadgeApplicationCheckoutSession(input: {
  applicationId: string;
  userId: string;
  stripeCheckoutSessionId: string;
}): Promise<MemberBadgeApplicationRecord | null> {
  await ensureReady();
  const collection = getMongoCollection<MemberBadgeApplicationDocument>(
    MONGO_COLLECTIONS.memberBadgeApplications,
  );
  const updatedAt = new Date().toISOString();
  const result = await collection.findOneAndUpdate(
    {
      applicationId: input.applicationId,
      userId: input.userId,
      paymentStatus: "unpaid",
      applicationStatus: { $in: ["draft", "submitted"] },
    },
    {
      $set: {
        stripeCheckoutSessionId: input.stripeCheckoutSessionId,
        applicationStatus: "submitted",
        updatedAt,
      },
    },
    { returnDocument: "after" },
  );

  return result ? strip(result) : null;
}

export async function markMemberBadgeApplicationPaid(input: {
  applicationId: string;
  paidAt: string;
  stripeCheckoutSessionId: string | null;
  stripePaymentIntentId: string | null;
  lastStripeEventId: string;
}): Promise<MemberBadgeApplicationRecord | null> {
  await ensureReady();
  const collection = getMongoCollection<MemberBadgeApplicationDocument>(
    MONGO_COLLECTIONS.memberBadgeApplications,
  );
  const updatedAt = new Date().toISOString();
  const result = await collection.findOneAndUpdate(
    {
      applicationId: input.applicationId,
      paymentStatus: "unpaid",
    },
    {
      $set: {
        paymentStatus: "paid",
        fulfillmentStatus: "awaiting_fulfillment",
        applicationStatus: "submitted",
        paidAt: input.paidAt,
        stripeCheckoutSessionId: input.stripeCheckoutSessionId,
        stripePaymentIntentId: input.stripePaymentIntentId,
        lastStripeEventId: input.lastStripeEventId,
        updatedAt,
      },
    },
    { returnDocument: "after" },
  );

  return result ? strip(result) : null;
}

export async function markMemberBadgeApplicationRefunded(input: {
  applicationId: string;
  lastStripeEventId: string;
}): Promise<MemberBadgeApplicationRecord | null> {
  await ensureReady();
  const collection = getMongoCollection<MemberBadgeApplicationDocument>(
    MONGO_COLLECTIONS.memberBadgeApplications,
  );
  const updatedAt = new Date().toISOString();
  const result = await collection.findOneAndUpdate(
    {
      applicationId: input.applicationId,
      paymentStatus: "paid",
    },
    {
      $set: {
        paymentStatus: "refunded",
        lastStripeEventId: input.lastStripeEventId,
        updatedAt,
      },
    },
    { returnDocument: "after" },
  );

  return result ? strip(result) : null;
}

export async function updateMemberBadgeApplicationFulfillmentMarkers(input: {
  applicationId: string;
  shipped: boolean;
  shippedAt: string | null;
  delivered: boolean;
  deliveredAt: string | null;
  fulfillmentStatus: MemberBadgeApplicationFulfillmentStatus;
}): Promise<MemberBadgeApplicationRecord | null> {
  await ensureReady();
  const collection = getMongoCollection<MemberBadgeApplicationDocument>(
    MONGO_COLLECTIONS.memberBadgeApplications,
  );
  const updatedAt = new Date().toISOString();
  const result = await collection.findOneAndUpdate(
    { applicationId: input.applicationId },
    {
      $set: {
        shipped: input.shipped,
        shippedAt: input.shippedAt,
        delivered: input.delivered,
        deliveredAt: input.deliveredAt,
        fulfillmentStatus: input.fulfillmentStatus,
        updatedAt,
      },
    },
    { returnDocument: "after" },
  );

  return result ? strip(result) : null;
}

export async function markMemberBadgeApplicationLabelEmailed(
  applicationId: string,
): Promise<MemberBadgeApplicationRecord | null> {
  await ensureReady();
  const collection = getMongoCollection<MemberBadgeApplicationDocument>(
    MONGO_COLLECTIONS.memberBadgeApplications,
  );
  const timestamp = new Date().toISOString();
  const result = await collection.findOneAndUpdate(
    { applicationId },
    {
      $set: {
        lastLabelEmailedAt: timestamp,
        updatedAt: timestamp,
      },
    },
    { returnDocument: "after" },
  );

  return result ? strip(result) : null;
}

export async function deleteMemberBadgeApplicationsByUserIdPrefix(
  prefix: string,
): Promise<void> {
  if (!isMongoConfigured()) {
    return;
  }

  await connectMongoClient();
  const collection = getMongoCollection<MemberBadgeApplicationDocument>(
    MONGO_COLLECTIONS.memberBadgeApplications,
  );
  await collection.deleteMany({ userId: { $regex: `^${prefix}` } });
}
