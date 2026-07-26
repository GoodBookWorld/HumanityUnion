import { randomUUID } from "node:crypto";

import type { MembershipWebhookEventRecord } from "@hu/types";

import { MONGO_COLLECTIONS } from "../../infrastructure/mongodb/mongo-collections.js";
import { isMongoConfigured } from "../../infrastructure/mongodb/mongo-config.js";
import { connectMongoClient } from "../../infrastructure/mongodb/mongo-connection.js";
import { getMongoCollection } from "../../infrastructure/mongodb/mongo-database.js";
import { MembershipPaymentUnavailableError } from "./membership-payment.errors.js";

interface MembershipWebhookEventDocument extends MembershipWebhookEventRecord {
  _id?: string;
}

async function ensureReady(): Promise<void> {
  if (!isMongoConfigured()) {
    throw new MembershipPaymentUnavailableError("Membership payment persistence is unavailable.");
  }

  await connectMongoClient();
}

function strip(document: MembershipWebhookEventDocument): MembershipWebhookEventRecord {
  const { _id: _ignored, ...record } = document;
  return record;
}

export async function insertMembershipWebhookEvent(
  record: MembershipWebhookEventRecord,
): Promise<MembershipWebhookEventRecord> {
  await ensureReady();
  const collection = getMongoCollection<MembershipWebhookEventDocument>(
    MONGO_COLLECTIONS.membershipWebhookEvents,
  );

  try {
    await collection.insertOne(record);
    return record;
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === 11000) {
      const existing = await findMembershipWebhookEventByStripeEventId(record.stripeEventId);
      if (existing) {
        return existing;
      }
    }

    throw error;
  }
}

export async function findMembershipWebhookEventByStripeEventId(
  stripeEventId: string,
): Promise<MembershipWebhookEventRecord | null> {
  await ensureReady();
  const collection = getMongoCollection<MembershipWebhookEventDocument>(
    MONGO_COLLECTIONS.membershipWebhookEvents,
  );
  const document = await collection.findOne({ stripeEventId });
  return document ? strip(document) : null;
}

export function buildMembershipWebhookEventRecord(input: {
  stripeEventId: string;
  stripeEventType: string;
  stripeApiVersion: string | null;
  livemode: boolean;
  membershipId?: string | null;
  contributionId?: string | null;
  userId?: string | null;
  processingStatus: MembershipWebhookEventRecord["processingStatus"];
  processingError?: string | null;
}): MembershipWebhookEventRecord {
  const timestamp = new Date().toISOString();

  return {
    webhookEventRecordId: randomUUID(),
    stripeEventId: input.stripeEventId,
    stripeEventType: input.stripeEventType,
    stripeApiVersion: input.stripeApiVersion,
    livemode: input.livemode,
    membershipId: input.membershipId ?? null,
    contributionId: input.contributionId ?? null,
    userId: input.userId ?? null,
    processingStatus: input.processingStatus,
    processingError: input.processingError ?? null,
    receivedAt: timestamp,
    processedAt: input.processingStatus === "processed" ? timestamp : null,
  };
}

export async function markMembershipWebhookEventProcessed(
  stripeEventId: string,
  input: {
    processingStatus: MembershipWebhookEventRecord["processingStatus"];
    processingError?: string | null;
    membershipId?: string | null;
    contributionId?: string | null;
    userId?: string | null;
  },
): Promise<void> {
  await ensureReady();
  const collection = getMongoCollection<MembershipWebhookEventDocument>(
    MONGO_COLLECTIONS.membershipWebhookEvents,
  );
  const processedAt = new Date().toISOString();

  await collection.updateOne(
    { stripeEventId },
    {
      $set: {
        processingStatus: input.processingStatus,
        processingError: input.processingError ?? null,
        membershipId: input.membershipId ?? null,
        contributionId: input.contributionId ?? null,
        userId: input.userId ?? null,
        processedAt,
      },
    },
  );
}

export async function deleteMembershipWebhookEventsByUserIdPrefix(prefix: string): Promise<number> {
  await ensureReady();
  const collection = getMongoCollection<MembershipWebhookEventDocument>(
    MONGO_COLLECTIONS.membershipWebhookEvents,
  );
  const result = await collection.deleteMany({
    userId: { $regex: `^${prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}` },
  });
  return result.deletedCount ?? 0;
}
