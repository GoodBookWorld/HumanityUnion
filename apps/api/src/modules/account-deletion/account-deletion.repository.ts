import { randomUUID } from "node:crypto";

import { MONGO_COLLECTIONS } from "../../infrastructure/mongodb/mongo-collections.js";
import { isMongoConfigured } from "../../infrastructure/mongodb/mongo-config.js";
import { connectMongoClient } from "../../infrastructure/mongodb/mongo-connection.js";
import { getMongoCollection } from "../../infrastructure/mongodb/mongo-database.js";
import { AuthPersistenceUnavailableError } from "../auth/auth.errors.js";
import type {
  AccountDeletionFinalNoticeStatus,
  AccountDeletionRecord,
  AuthUserRecord,
} from "../auth/auth-user.types.js";

interface AuthUserDocument extends AuthUserRecord {
  _id?: string;
}

async function ready(): Promise<void> {
  if (!isMongoConfigured()) {
    throw new AuthPersistenceUnavailableError();
  }
  await connectMongoClient();
}

function collection() {
  return getMongoCollection<AuthUserDocument>(MONGO_COLLECTIONS.authUsers);
}

function strip(document: AuthUserDocument): AuthUserRecord {
  const { _id: _ignored, ...record } = document;
  return record;
}

export async function markAccountDeletionAwaiting(input: {
  userId: string;
  requestId: string;
  requestedAt: string;
  confirmationExpiresAt: string;
}): Promise<AuthUserRecord | null> {
  await ready();
  const result = await collection().findOneAndUpdate(
    {
      userId: input.userId,
      status: "active",
      role: "member",
      $or: [
        { accountDeletion: { $exists: false } },
        { "accountDeletion.phase": { $in: ["awaiting_confirmation", "cancelled"] } },
      ],
    },
    {
      $set: {
        accountDeletion: {
          requestId: input.requestId,
          phase: "awaiting_confirmation",
          requestedAt: input.requestedAt,
          confirmationExpiresAt: input.confirmationExpiresAt,
        } satisfies AccountDeletionRecord,
        updatedAt: input.requestedAt,
      },
    },
    { returnDocument: "after" },
  );
  return result ? strip(result) : null;
}

/**
 * Starts the recovery window once. A second update cannot match `awaiting_confirmation`,
 * so the stored deadline stays on the first confirmation.
 */
export async function markAccountDeletionPending(input: {
  userId: string;
  requestId: string;
  confirmedAt: string;
  deadlineAt: string;
}): Promise<AuthUserRecord | null> {
  await ready();
  const result = await collection().findOneAndUpdate(
    {
      userId: input.userId,
      status: "active",
      role: "member",
      "accountDeletion.phase": "awaiting_confirmation",
      "accountDeletion.requestId": input.requestId,
    },
    {
      $set: {
        "accountDeletion.phase": "pending",
        "accountDeletion.confirmedAt": input.confirmedAt,
        "accountDeletion.deadlineAt": input.deadlineAt,
        updatedAt: input.confirmedAt,
      },
      $unset: {
        "accountDeletion.confirmationExpiresAt": "",
      },
    },
    { returnDocument: "after" },
  );
  return result ? strip(result) : null;
}

export async function markAccountDeletionCancelled(input: {
  userId: string;
  requestId: string;
  cancelledAt: string;
  nowIso: string;
}): Promise<AuthUserRecord | null> {
  await ready();
  const result = await collection().findOneAndUpdate(
    {
      userId: input.userId,
      status: "active",
      "accountDeletion.phase": "pending",
      "accountDeletion.requestId": input.requestId,
      "accountDeletion.deadlineAt": { $gt: input.nowIso },
    },
    {
      $set: {
        "accountDeletion.phase": "cancelled",
        "accountDeletion.cancelledAt": input.cancelledAt,
        updatedAt: input.cancelledAt,
      },
    },
    { returnDocument: "after" },
  );
  return result ? strip(result) : null;
}

export async function recordScheduledDeletionNotice(input: {
  userId: string;
  requestId: string;
  emailId: string;
}): Promise<void> {
  await ready();
  await collection().updateOne(
    {
      userId: input.userId,
      "accountDeletion.phase": "pending",
      "accountDeletion.requestId": input.requestId,
      "accountDeletion.scheduledNoticeEmailId": { $exists: false },
    },
    { $set: { "accountDeletion.scheduledNoticeEmailId": input.emailId } },
  );
}

export async function listAccountDeletionFinalizationCandidates(
  nowIso: string,
): Promise<AuthUserRecord[]> {
  await ready();
  const documents = await collection()
    .find({
      $or: [
        {
          status: "active",
          "accountDeletion.phase": "pending",
          "accountDeletion.deadlineAt": { $lte: nowIso },
        },
        {
          "accountDeletion.phase": "finalized",
          "accountDeletion.profileClosedAt": { $exists: false },
        },
      ],
    })
    .limit(25)
    .toArray();
  return documents.map(strip);
}

/** One worker owns the final notice. A loser receives null. */
export async function claimAccountDeletionFinalNotice(input: {
  userId: string;
  nowIso: string;
}): Promise<AuthUserRecord | null> {
  await ready();
  const result = await collection().findOneAndUpdate(
    {
      userId: input.userId,
      status: "active",
      "accountDeletion.phase": "pending",
      "accountDeletion.deadlineAt": { $lte: input.nowIso },
      "accountDeletion.finalNoticeStatus": { $exists: false },
    },
    {
      $set: {
        "accountDeletion.finalNoticeStatus": "sending",
        updatedAt: input.nowIso,
      },
    },
    { returnDocument: "after" },
  );
  return result ? strip(result) : null;
}

export async function setAccountDeletionFinalNoticeStatus(input: {
  userId: string;
  status: Exclude<AccountDeletionFinalNoticeStatus, "sending">;
  nowIso: string;
}): Promise<void> {
  await ready();
  await collection().updateOne(
    {
      userId: input.userId,
      "accountDeletion.phase": "pending",
      "accountDeletion.finalNoticeStatus": "sending",
    },
    {
      $set: {
        "accountDeletion.finalNoticeStatus": input.status,
        updatedAt: input.nowIso,
      },
    },
  );
}

/**
 * Restart recovery. A claim left on `sending` becomes `skipped` so finalization
 * continues without a second message.
 */
export async function skipStaleAccountDeletionFinalNotice(input: {
  userId: string;
  nowIso: string;
  claimedBeforeIso: string;
}): Promise<boolean> {
  await ready();
  const result = await collection().updateOne(
    {
      userId: input.userId,
      status: "active",
      "accountDeletion.phase": "pending",
      "accountDeletion.finalNoticeStatus": "sending",
      updatedAt: { $lte: input.claimedBeforeIso },
    },
    {
      $set: {
        "accountDeletion.finalNoticeStatus": "skipped",
        updatedAt: input.nowIso,
      },
    },
  );
  return (result.modifiedCount ?? 0) > 0;
}

export async function finalizeAccountDeletionRecord(input: {
  userId: string;
  nowIso: string;
  reservedEmail: string;
  passwordHash: string;
  previousEmailHash: string;
}): Promise<AuthUserRecord | null> {
  await ready();
  const result = await collection().findOneAndUpdate(
    {
      userId: input.userId,
      status: "active",
      "accountDeletion.phase": "pending",
      "accountDeletion.deadlineAt": { $lte: input.nowIso },
      "accountDeletion.finalNoticeStatus": { $in: ["sent", "failed", "skipped"] },
    },
    {
      $set: {
        email: input.reservedEmail,
        passwordHash: input.passwordHash,
        "accountDeletion.phase": "finalized",
        "accountDeletion.finalizedAt": input.nowIso,
        "accountDeletion.previousEmailHash": input.previousEmailHash,
        updatedAt: input.nowIso,
      },
      $unset: {
        pendingEmail: "",
      },
    },
    { returnDocument: "after" },
  );
  return result ? strip(result) : null;
}

export async function markAccountDeletionProfileClosed(input: {
  userId: string;
  closedAt: string;
}): Promise<void> {
  await ready();
  await collection().updateOne(
    {
      userId: input.userId,
      "accountDeletion.phase": "finalized",
      "accountDeletion.profileClosedAt": { $exists: false },
    },
    { $set: { "accountDeletion.profileClosedAt": input.closedAt, updatedAt: input.closedAt } },
  );
}

export function createAccountDeletionRequestId(): string {
  return randomUUID();
}

export async function listAccountDeletionReminderCandidates(
  nowIso: string,
  reminderDueByIso: string,
): Promise<AuthUserRecord[]> {
  await ready();
  const documents = await collection()
    .find({
      status: "active",
      "accountDeletion.phase": "pending",
      "accountDeletion.deadlineAt": { $gt: nowIso, $lte: reminderDueByIso },
      "accountDeletion.reminderStatus": { $ne: "sent" },
    })
    .limit(25)
    .toArray();
  return documents.map(strip);
}

/** One scheduler owns the reminder. A second claim returns null. */
export async function claimAccountDeletionReminder(input: {
  userId: string;
  nowIso: string;
  reminderDueByIso: string;
}): Promise<AuthUserRecord | null> {
  await ready();
  const result = await collection().findOneAndUpdate(
    {
      userId: input.userId,
      status: "active",
      "accountDeletion.phase": "pending",
      "accountDeletion.deadlineAt": { $gt: input.nowIso, $lte: input.reminderDueByIso },
      $or: [
        { "accountDeletion.reminderStatus": { $exists: false } },
        { "accountDeletion.reminderStatus": "failed" },
      ],
    },
    {
      $set: {
        "accountDeletion.reminderStatus": "sending",
        updatedAt: input.nowIso,
      },
    },
    { returnDocument: "after" },
  );
  return result ? strip(result) : null;
}

export async function setAccountDeletionReminderStatus(input: {
  userId: string;
  status: "sent" | "failed";
  nowIso: string;
}): Promise<void> {
  await ready();
  await collection().updateOne(
    {
      userId: input.userId,
      "accountDeletion.phase": "pending",
      "accountDeletion.reminderStatus": "sending",
    },
    {
      $set: {
        "accountDeletion.reminderStatus": input.status,
        updatedAt: input.nowIso,
      },
    },
  );
}

/** A crashed send becomes failed so a later tick can retry. `sent` is never cleared. */
export async function releaseStaleAccountDeletionReminder(input: {
  userId: string;
  nowIso: string;
  claimedBeforeIso: string;
}): Promise<boolean> {
  await ready();
  const result = await collection().updateOne(
    {
      userId: input.userId,
      status: "active",
      "accountDeletion.phase": "pending",
      "accountDeletion.reminderStatus": "sending",
      updatedAt: { $lte: input.claimedBeforeIso },
    },
    {
      $set: {
        "accountDeletion.reminderStatus": "failed",
        updatedAt: input.nowIso,
      },
    },
  );
  return (result.modifiedCount ?? 0) > 0;
}
