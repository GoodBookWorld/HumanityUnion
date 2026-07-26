import { randomUUID } from "node:crypto";

import type { MemberBadgeContributionRecord, MemberBadgeShippingAddress } from "@hu/types";

import { MONGO_COLLECTIONS } from "../../infrastructure/mongodb/mongo-collections.js";
import { isMongoConfigured } from "../../infrastructure/mongodb/mongo-config.js";
import { connectMongoClient } from "../../infrastructure/mongodb/mongo-connection.js";
import { getMongoCollection } from "../../infrastructure/mongodb/mongo-database.js";
import {
  MEMBER_BADGE_CONTRIBUTION_AMOUNT_CENTS,
  MEMBER_BADGE_CONTRIBUTION_CURRENCY,
  MEMBER_BADGE_CONTRIBUTION_PURPOSE,
} from "./member-badge-contribution.constants.js";
import { MemberBadgeContributionUnavailableError } from "./member-badge-contribution.errors.js";
import { generateMemberBadgeRequestNumber } from "./member-badge-request-number.js";

interface MemberBadgeContributionDocument extends MemberBadgeContributionRecord {
  _id?: string;
}

async function ensureReady(): Promise<void> {
  if (!isMongoConfigured()) {
    throw new MemberBadgeContributionUnavailableError(
      "Member Badge Contribution persistence is unavailable.",
    );
  }

  await connectMongoClient();
}

function strip(document: MemberBadgeContributionDocument): MemberBadgeContributionRecord {
  const { _id: _ignored, ...record } = document;
  return record;
}

export function buildDefaultMemberBadgeContribution(input: {
  userId: string;
  profileId: string;
  membershipId: string;
  memberNumberSnapshot: string | null;
  amountCents?: number;
}): MemberBadgeContributionRecord {
  const timestamp = new Date().toISOString();

  return {
    badgeContributionId: randomUUID(),
    badgeRequestNumber: generateMemberBadgeRequestNumber(),
    userId: input.userId,
    profileId: input.profileId,
    membershipId: input.membershipId,
    memberNumberSnapshot: input.memberNumberSnapshot,
    contributionPurpose: MEMBER_BADGE_CONTRIBUTION_PURPOSE,
    amountCents: input.amountCents ?? MEMBER_BADGE_CONTRIBUTION_AMOUNT_CENTS,
    currency: MEMBER_BADGE_CONTRIBUTION_CURRENCY,
    contributionStatus: "not_started",
    paymentStatus: "pending",
    fulfillmentStatus: "not_ready",
    recipientName: null,
    shippingAddress: null,
    shippingMethod: null,
    shippingAmountCents: null,
    totalProcessedAmountCents: null,
    trackingCarrier: null,
    trackingNumber: null,
    stripeCheckoutSessionId: null,
    stripePaymentIntentId: null,
    stripeCustomerId: null,
    stripeShippingRateId: null,
    createdAt: timestamp,
    updatedAt: timestamp,
    paidAt: null,
    confirmedAt: null,
    shippedAt: null,
    deliveredAt: null,
    refundedAt: null,
    lastWebhookEventId: null,
    confirmationEmailSentAt: null,
    version: 1,
  };
}

export async function insertMemberBadgeContribution(
  record: MemberBadgeContributionRecord,
): Promise<MemberBadgeContributionRecord> {
  await ensureReady();
  const collection = getMongoCollection<MemberBadgeContributionDocument>(
    MONGO_COLLECTIONS.memberBadgeContributions,
  );
  await collection.insertOne(record);
  return record;
}

export async function findMemberBadgeContributionById(
  badgeContributionId: string,
): Promise<MemberBadgeContributionRecord | null> {
  await ensureReady();
  const collection = getMongoCollection<MemberBadgeContributionDocument>(
    MONGO_COLLECTIONS.memberBadgeContributions,
  );
  const document = await collection.findOne({ badgeContributionId });
  return document ? strip(document) : null;
}

export async function findMemberBadgeContributionByCheckoutSessionId(
  sessionId: string,
): Promise<MemberBadgeContributionRecord | null> {
  await ensureReady();
  const collection = getMongoCollection<MemberBadgeContributionDocument>(
    MONGO_COLLECTIONS.memberBadgeContributions,
  );
  const document = await collection.findOne({ stripeCheckoutSessionId: sessionId });
  return document ? strip(document) : null;
}

export async function findMemberBadgeContributionByPaymentIntentId(
  paymentIntentId: string,
): Promise<MemberBadgeContributionRecord | null> {
  await ensureReady();
  const collection = getMongoCollection<MemberBadgeContributionDocument>(
    MONGO_COLLECTIONS.memberBadgeContributions,
  );
  const document = await collection.findOne({ stripePaymentIntentId: paymentIntentId });
  return document ? strip(document) : null;
}

export async function findMemberBadgeContributionsByUserId(
  userId: string,
): Promise<MemberBadgeContributionRecord[]> {
  await ensureReady();
  const collection = getMongoCollection<MemberBadgeContributionDocument>(
    MONGO_COLLECTIONS.memberBadgeContributions,
  );
  const documents = await collection.find({ userId }).sort({ createdAt: -1 }).toArray();
  return documents.map(strip);
}

export async function findActiveMemberBadgeCheckoutByUserId(
  userId: string,
): Promise<MemberBadgeContributionRecord | null> {
  await ensureReady();
  const collection = getMongoCollection<MemberBadgeContributionDocument>(
    MONGO_COLLECTIONS.memberBadgeContributions,
  );
  const document = await collection.findOne(
    {
      userId,
      contributionStatus: { $in: ["checkout_created", "payment_pending"] },
    },
    { sort: { createdAt: -1 } },
  );
  return document ? strip(document) : null;
}

export async function updateMemberBadgeContribution(
  badgeContributionId: string,
  patch: Partial<MemberBadgeContributionRecord>,
): Promise<MemberBadgeContributionRecord | null> {
  await ensureReady();
  const collection = getMongoCollection<MemberBadgeContributionDocument>(
    MONGO_COLLECTIONS.memberBadgeContributions,
  );
  const updatedAt = new Date().toISOString();
  const result = await collection.findOneAndUpdate(
    { badgeContributionId },
    { $set: { ...patch, updatedAt }, $inc: { version: 1 } },
    { returnDocument: "after" },
  );
  return result ? strip(result) : null;
}

export async function deleteMemberBadgeContributionsByUserIdPrefix(
  prefix: string,
): Promise<number> {
  await ensureReady();
  const collection = getMongoCollection<MemberBadgeContributionDocument>(
    MONGO_COLLECTIONS.memberBadgeContributions,
  );
  const result = await collection.deleteMany({
    userId: { $regex: `^${prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}` },
  });
  return result.deletedCount ?? 0;
}

export async function findMemberBadgeContributionsForFulfillment(
  contributionStatus: MemberBadgeContributionRecord["contributionStatus"],
): Promise<MemberBadgeContributionRecord[]> {
  await ensureReady();
  const collection = getMongoCollection<MemberBadgeContributionDocument>(
    MONGO_COLLECTIONS.memberBadgeContributions,
  );
  const documents = await collection
    .find({ contributionStatus })
    .sort({ confirmedAt: -1 })
    .toArray();
  return documents.map(strip);
}

export function parseStripeShippingAddress(input: {
  name?: string | null;
  address?: {
    line1?: string | null;
    line2?: string | null;
    city?: string | null;
    state?: string | null;
    postal_code?: string | null;
    country?: string | null;
  } | null;
}): MemberBadgeShippingAddress | null {
  const address = input.address;
  if (
    !input.name?.trim() ||
    !address?.line1?.trim() ||
    !address.city?.trim() ||
    !address.postal_code?.trim() ||
    !address.country?.trim()
  ) {
    return null;
  }

  return {
    recipientName: input.name.trim(),
    addressLine1: address.line1.trim(),
    addressLine2: address.line2?.trim() || null,
    city: address.city.trim(),
    administrativeArea: address.state?.trim() || null,
    postalCode: address.postal_code.trim(),
    countryCode: address.country.trim().toUpperCase(),
  };
}
