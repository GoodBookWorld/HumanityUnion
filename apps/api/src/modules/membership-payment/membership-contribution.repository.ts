import { randomUUID } from "node:crypto";

import type { MembershipContributionRecord } from "@hu/types";

import { MONGO_COLLECTIONS } from "../../infrastructure/mongodb/mongo-collections.js";
import { isMongoConfigured } from "../../infrastructure/mongodb/mongo-config.js";
import { connectMongoClient } from "../../infrastructure/mongodb/mongo-connection.js";
import { getMongoCollection } from "../../infrastructure/mongodb/mongo-database.js";
import { MembershipPaymentUnavailableError } from "./membership-payment.errors.js";
import {
  MEMBERSHIP_CONTRIBUTION_AMOUNT_CENTS,
  MEMBERSHIP_CONTRIBUTION_CURRENCY,
} from "./membership-payment.constants.js";

interface MembershipContributionDocument extends MembershipContributionRecord {
  _id?: string;
}

async function ensureReady(): Promise<void> {
  if (!isMongoConfigured()) {
    throw new MembershipPaymentUnavailableError("Membership payment persistence is unavailable.");
  }

  await connectMongoClient();
}

function strip(document: MembershipContributionDocument): MembershipContributionRecord {
  const { _id: _ignored, ...record } = document;
  return record;
}

export function buildDefaultMembershipContribution(input: {
  membershipId: string;
  userId: string;
}): MembershipContributionRecord {
  const timestamp = new Date().toISOString();

  return {
    contributionId: randomUUID(),
    membershipId: input.membershipId,
    userId: input.userId,
    amountCents: MEMBERSHIP_CONTRIBUTION_AMOUNT_CENTS,
    currency: MEMBERSHIP_CONTRIBUTION_CURRENCY,
    status: "pending",
    stripeCheckoutSessionId: null,
    stripePaymentIntentId: null,
    stripeChargeId: null,
    stripeCustomerId: null,
    paidAt: null,
    refundedAt: null,
    disputedAt: null,
    lastStripeEventId: null,
    webhookProcessedAt: null,
    webhookResult: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export async function insertMembershipContribution(
  record: MembershipContributionRecord,
): Promise<MembershipContributionRecord> {
  await ensureReady();
  const collection = getMongoCollection<MembershipContributionDocument>(
    MONGO_COLLECTIONS.membershipContributions,
  );
  await collection.insertOne(record);
  return record;
}

export async function findMembershipContributionById(
  contributionId: string,
): Promise<MembershipContributionRecord | null> {
  await ensureReady();
  const collection = getMongoCollection<MembershipContributionDocument>(
    MONGO_COLLECTIONS.membershipContributions,
  );
  const document = await collection.findOne({ contributionId });
  return document ? strip(document) : null;
}

export async function findMembershipContributionByCheckoutSessionId(
  sessionId: string,
): Promise<MembershipContributionRecord | null> {
  await ensureReady();
  const collection = getMongoCollection<MembershipContributionDocument>(
    MONGO_COLLECTIONS.membershipContributions,
  );
  const document = await collection.findOne({ stripeCheckoutSessionId: sessionId });
  return document ? strip(document) : null;
}

export async function findMembershipContributionByPaymentIntentId(
  paymentIntentId: string,
): Promise<MembershipContributionRecord | null> {
  await ensureReady();
  const collection = getMongoCollection<MembershipContributionDocument>(
    MONGO_COLLECTIONS.membershipContributions,
  );
  const document = await collection.findOne({ stripePaymentIntentId: paymentIntentId });
  return document ? strip(document) : null;
}

export async function findLatestMembershipContributionByMembershipId(
  membershipId: string,
): Promise<MembershipContributionRecord | null> {
  await ensureReady();
  const collection = getMongoCollection<MembershipContributionDocument>(
    MONGO_COLLECTIONS.membershipContributions,
  );
  const document = await collection.findOne({ membershipId }, { sort: { createdAt: -1 } });
  return document ? strip(document) : null;
}

export async function updateMembershipContribution(
  contributionId: string,
  patch: Partial<MembershipContributionRecord>,
): Promise<MembershipContributionRecord | null> {
  await ensureReady();
  const collection = getMongoCollection<MembershipContributionDocument>(
    MONGO_COLLECTIONS.membershipContributions,
  );
  const updatedAt = new Date().toISOString();
  const result = await collection.findOneAndUpdate(
    { contributionId },
    { $set: { ...patch, updatedAt } },
    { returnDocument: "after" },
  );
  return result ? strip(result) : null;
}

export async function deleteMembershipContributionsByUserIdPrefix(prefix: string): Promise<number> {
  await ensureReady();
  const collection = getMongoCollection<MembershipContributionDocument>(
    MONGO_COLLECTIONS.membershipContributions,
  );
  const result = await collection.deleteMany({
    userId: { $regex: `^${prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}` },
  });
  return result.deletedCount ?? 0;
}
