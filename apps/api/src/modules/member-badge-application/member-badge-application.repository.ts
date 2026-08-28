import { randomUUID } from "node:crypto";

import type {
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

function strip(document: MemberBadgeApplicationDocument): MemberBadgeApplicationRecord {
  const { _id: _ignored, ...record } = document;
  return record;
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
    amountCents: MEMBER_BADGE_APPLICATION_AMOUNT_CENTS,
    currency: MEMBER_BADGE_APPLICATION_CURRENCY,
    deliveryIncluded: true,
    stripeCheckoutSessionId: null,
    stripePaymentIntentId: null,
    lastStripeEventId: null,
    paidAt: null,
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
