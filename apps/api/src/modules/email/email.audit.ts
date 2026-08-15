import { randomUUID } from "node:crypto";

import type { EmailAuditRecordPublic, EmailDeliveryStatus, EmailTemplateId } from "@hu/types";

import { MONGO_COLLECTIONS } from "../../infrastructure/mongodb/mongo-collections.js";
import { isMongoConfigured } from "../../infrastructure/mongodb/mongo-config.js";
import { connectMongoClient } from "../../infrastructure/mongodb/mongo-connection.js";
import { getMongoCollection } from "../../infrastructure/mongodb/mongo-database.js";
import { hashRecipientEmail } from "./email.templates.js";

export interface EmailAuditRecord {
  emailId: string;
  template: EmailTemplateId;
  provider: string;
  recipientHash: string;
  status: EmailDeliveryStatus;
  createdAt: string;
  sentAt?: string;
  errorSummary?: string;
}

interface EmailAuditDocument extends EmailAuditRecord {
  _id?: string;
}

const memoryAuditRecords: EmailAuditRecord[] = [];

async function ensureAuditMongoReady(): Promise<void> {
  if (!isMongoConfigured()) {
    return;
  }

  await connectMongoClient();
}

export async function createEmailAuditRecord(input: {
  template: EmailTemplateId;
  provider: string;
  recipientEmail: string;
}): Promise<EmailAuditRecord> {
  const record: EmailAuditRecord = {
    emailId: randomUUID(),
    template: input.template,
    provider: input.provider,
    recipientHash: hashRecipientEmail(input.recipientEmail),
    status: "queued",
    createdAt: new Date().toISOString(),
  };

  if (!isMongoConfigured()) {
    memoryAuditRecords.push(record);
    return record;
  }

  await ensureAuditMongoReady();
  const collection = getMongoCollection<EmailAuditDocument>(MONGO_COLLECTIONS.emailAuditRecords);
  await collection.insertOne(record);
  return record;
}

export async function markEmailAuditSent(emailId: string, sentAt: string): Promise<void> {
  if (!isMongoConfigured()) {
    const record = memoryAuditRecords.find((entry) => entry.emailId === emailId);

    if (record) {
      record.status = "sent";
      record.sentAt = sentAt;
    }

    return;
  }

  await ensureAuditMongoReady();
  const collection = getMongoCollection<EmailAuditDocument>(MONGO_COLLECTIONS.emailAuditRecords);

  await collection.updateOne(
    { emailId },
    {
      $set: {
        status: "sent",
        sentAt,
      },
    },
  );
}

export async function markEmailAuditFailed(
  emailId: string,
  errorSummary: string,
  status: Extract<EmailDeliveryStatus, "failed" | "deferred" | "blocked"> = "failed",
): Promise<void> {
  if (!isMongoConfigured()) {
    const record = memoryAuditRecords.find((entry) => entry.emailId === emailId);

    if (record) {
      record.status = status;
      record.errorSummary = errorSummary.slice(0, 500);
    }

    return;
  }

  await ensureAuditMongoReady();
  const collection = getMongoCollection<EmailAuditDocument>(MONGO_COLLECTIONS.emailAuditRecords);

  await collection.updateOne(
    { emailId },
    {
      $set: {
        status,
        errorSummary: errorSummary.slice(0, 500),
      },
    },
  );
}

export function toEmailAuditRecordPublic(record: EmailAuditRecord): EmailAuditRecordPublic {
  return {
    emailId: record.emailId,
    template: record.template,
    provider: record.provider,
    recipientHash: record.recipientHash,
    status: record.status,
    createdAt: record.createdAt,
    sentAt: record.sentAt,
    errorSummary: record.errorSummary,
  };
}

export async function findEmailAuditRecordById(emailId: string): Promise<EmailAuditRecord | null> {
  if (!isMongoConfigured()) {
    return memoryAuditRecords.find((entry) => entry.emailId === emailId) ?? null;
  }

  await ensureAuditMongoReady();
  const collection = getMongoCollection<EmailAuditDocument>(MONGO_COLLECTIONS.emailAuditRecords);
  const document = await collection.findOne({ emailId });

  if (!document) {
    return null;
  }

  const { _id: _ignored, ...record } = document;
  return record;
}

export function clearEmailAuditRecordsForTests(): void {
  memoryAuditRecords.length = 0;
}

export async function deleteEmailAuditRecordsByRecipientHashPrefix(
  prefix: string,
): Promise<number> {
  if (!isMongoConfigured()) {
    const before = memoryAuditRecords.length;
    for (let index = memoryAuditRecords.length - 1; index >= 0; index -= 1) {
      if (memoryAuditRecords[index]?.recipientHash.startsWith(prefix)) {
        memoryAuditRecords.splice(index, 1);
      }
    }

    return before - memoryAuditRecords.length;
  }

  await ensureAuditMongoReady();
  const collection = getMongoCollection<EmailAuditDocument>(MONGO_COLLECTIONS.emailAuditRecords);
  const result = await collection.deleteMany({
    recipientHash: { $regex: `^${prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}` },
  });

  return result.deletedCount ?? 0;
}
