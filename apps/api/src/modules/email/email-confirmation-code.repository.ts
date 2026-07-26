import { createHash, randomInt, randomUUID } from "node:crypto";

import { MONGO_COLLECTIONS } from "../../infrastructure/mongodb/mongo-collections.js";
import { isMongoConfigured } from "../../infrastructure/mongodb/mongo-config.js";
import { connectMongoClient } from "../../infrastructure/mongodb/mongo-connection.js";
import { getMongoCollection } from "../../infrastructure/mongodb/mongo-database.js";
import { resolveEmailConfirmationConfig } from "./email-confirmation.config.js";
import { resolveLoginEmailTwoStepConfig } from "./login-email-two-step.config.js";

export type EmailConfirmationCodePurpose =
  | "registration_email_confirmation"
  | "login_email_two_step"
  | "login_two_step_enable"
  | "login_two_step_disable";

export type EmailConfirmationCodeStatus = "active" | "consumed" | "expired" | "revoked";

export interface EmailConfirmationCodeRecord {
  confirmationId: string;
  userId: string;
  email: string;
  codeHash: string;
  purpose: EmailConfirmationCodePurpose;
  status: EmailConfirmationCodeStatus;
  attemptCount: number;
  maxAttempts: number;
  expiresAt: string;
  createdAt: string;
  consumedAt?: string;
  lastSentAt?: string;
  version: number;
}

interface EmailConfirmationCodeDocument extends EmailConfirmationCodeRecord {
  _id?: string;
}

export interface IssuedEmailConfirmationCode {
  code: string;
  record: EmailConfirmationCodeRecord;
}

const memoryCodes: EmailConfirmationCodeRecord[] = [];
const memorySendLog: Array<{
  userId: string;
  email: string;
  sentAt: string;
  ipKey?: string;
  purpose: EmailConfirmationCodePurpose;
  confirmationId?: string;
}> = [];
const lastIssuedCodesForTests = new Map<string, string>();
let confirmationCodeNowMsOverride: number | null = null;

/** Test-only clock override for deterministic confirmation-code expiry. */
export function setConfirmationCodeNowMsForTests(value: number | null): void {
  confirmationCodeNowMsOverride = value;
}

export function resetConfirmationCodeNowMsForTests(): void {
  confirmationCodeNowMsOverride = null;
}

function getConfirmationCodeNowMs(): number {
  return confirmationCodeNowMsOverride ?? Date.now();
}

export function hashEmailConfirmationCode(userId: string, code: string): string {
  return createHash("sha256").update(`${userId}:${code.trim()}`).digest("hex");
}

export function generateSixDigitConfirmationCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

async function ensureMongoReady(): Promise<void> {
  if (!isMongoConfigured()) {
    return;
  }

  await connectMongoClient();
}

function resolveCodePolicyForPurpose(purpose: EmailConfirmationCodePurpose): {
  codeTtlMinutes: number;
  maxAttempts: number;
} {
  if (
    purpose === "login_email_two_step" ||
    purpose === "login_two_step_enable" ||
    purpose === "login_two_step_disable"
  ) {
    const config = resolveLoginEmailTwoStepConfig();
    return {
      codeTtlMinutes: config.codeTtlMinutes,
      maxAttempts: config.maxAttempts,
    };
  }

  const config = resolveEmailConfirmationConfig();
  return {
    codeTtlMinutes: config.codeTtlMinutes,
    maxAttempts: config.maxAttempts,
  };
}

function resolveResendPolicyForPurpose(purpose: EmailConfirmationCodePurpose): {
  resendCooldownSeconds: number;
  maxSendsPerHour: number;
  ipMaxSendsPerHour: number;
  maxResendsPerChallenge: number;
} {
  if (
    purpose === "login_email_two_step" ||
    purpose === "login_two_step_enable" ||
    purpose === "login_two_step_disable"
  ) {
    const config = resolveLoginEmailTwoStepConfig();
    return {
      resendCooldownSeconds: config.resendCooldownSeconds,
      maxSendsPerHour: config.maxSendsPerHour,
      ipMaxSendsPerHour: config.ipMaxSendsPerHour,
      maxResendsPerChallenge: config.maxResendsPerChallenge,
    };
  }

  const config = resolveEmailConfirmationConfig();
  return {
    resendCooldownSeconds: config.resendCooldownSeconds,
    maxSendsPerHour: config.maxSendsPerHour,
    ipMaxSendsPerHour: config.ipMaxSendsPerHour,
    maxResendsPerChallenge: config.maxResendsPerChallenge,
  };
}

export { resolveResendPolicyForPurpose };

function resolveExpiryIso(minutes: number): string {
  return new Date(getConfirmationCodeNowMs() + minutes * 60_000).toISOString();
}

export async function revokeActiveEmailConfirmationCodes(input: {
  userId: string;
  purpose: EmailConfirmationCodePurpose;
}): Promise<number> {
  if (!isMongoConfigured()) {
    let revoked = 0;

    for (const record of memoryCodes) {
      if (
        record.userId === input.userId &&
        record.purpose === input.purpose &&
        record.status === "active"
      ) {
        record.status = "revoked";
        revoked += 1;
      }
    }

    return revoked;
  }

  await ensureMongoReady();
  const collection = getMongoCollection<EmailConfirmationCodeDocument>(
    MONGO_COLLECTIONS.emailConfirmationCodes,
  );
  const result = await collection.updateMany(
    {
      userId: input.userId,
      purpose: input.purpose,
      status: "active",
    },
    {
      $set: {
        status: "revoked",
      },
    },
  );

  return result.modifiedCount ?? 0;
}

export async function createEmailConfirmationCode(input: {
  userId: string;
  email: string;
  purpose: EmailConfirmationCodePurpose;
  ipKey?: string;
  preserveExistingActive?: boolean;
}): Promise<IssuedEmailConfirmationCode> {
  const policy = resolveCodePolicyForPurpose(input.purpose);
  const now = new Date(getConfirmationCodeNowMs()).toISOString();
  const code = generateSixDigitConfirmationCode();

  if (!input.preserveExistingActive) {
    await revokeActiveEmailConfirmationCodes({
      userId: input.userId,
      purpose: input.purpose,
    });
  }

  const record: EmailConfirmationCodeRecord = {
    confirmationId: randomUUID(),
    userId: input.userId,
    email: input.email.trim().toLowerCase(),
    codeHash: hashEmailConfirmationCode(input.userId, code),
    purpose: input.purpose,
    status: "active",
    attemptCount: 0,
    maxAttempts: policy.maxAttempts,
    expiresAt: resolveExpiryIso(policy.codeTtlMinutes),
    createdAt: now,
    version: 1,
  };

  if (!isMongoConfigured()) {
    memoryCodes.push(record);
    lastIssuedCodesForTests.set(`${input.userId}:${input.purpose}`, code);
    return { code, record };
  }

  await ensureMongoReady();
  const collection = getMongoCollection<EmailConfirmationCodeDocument>(
    MONGO_COLLECTIONS.emailConfirmationCodes,
  );
  await collection.insertOne(record);

  lastIssuedCodesForTests.set(`${input.userId}:${input.purpose}`, code);

  return { code, record };
}

export async function revokeActiveEmailConfirmationCodesExcept(input: {
  userId: string;
  purpose: EmailConfirmationCodePurpose;
  confirmationId: string;
}): Promise<number> {
  if (!isMongoConfigured()) {
    let revoked = 0;

    for (const record of memoryCodes) {
      if (
        record.userId === input.userId &&
        record.purpose === input.purpose &&
        record.status === "active" &&
        record.confirmationId !== input.confirmationId
      ) {
        record.status = "revoked";
        revoked += 1;
      }
    }

    return revoked;
  }

  await ensureMongoReady();
  const collection = getMongoCollection<EmailConfirmationCodeDocument>(
    MONGO_COLLECTIONS.emailConfirmationCodes,
  );
  const result = await collection.updateMany(
    {
      userId: input.userId,
      purpose: input.purpose,
      status: "active",
      confirmationId: { $ne: input.confirmationId },
    },
    {
      $set: {
        status: "revoked",
      },
    },
  );

  return result.modifiedCount ?? 0;
}

export async function discardEmailConfirmationCode(confirmationId: string): Promise<void> {
  if (!isMongoConfigured()) {
    const record = memoryCodes.find((entry) => entry.confirmationId === confirmationId);

    if (record && record.status === "active") {
      record.status = "revoked";
    }

    return;
  }

  await ensureMongoReady();
  const collection = getMongoCollection<EmailConfirmationCodeDocument>(
    MONGO_COLLECTIONS.emailConfirmationCodes,
  );
  await collection.updateOne(
    { confirmationId, status: "active" },
    {
      $set: {
        status: "revoked",
      },
    },
  );
}

export async function markEmailConfirmationCodeDelivered(input: {
  confirmationId: string;
  userId: string;
  email: string;
  purpose: EmailConfirmationCodePurpose;
  sentAt: string;
  ipKey?: string;
}): Promise<void> {
  if (!isMongoConfigured()) {
    const record = memoryCodes.find((entry) => entry.confirmationId === input.confirmationId);

    if (record) {
      record.lastSentAt = input.sentAt;
    }

    memorySendLog.push({
      userId: input.userId,
      email: input.email,
      sentAt: input.sentAt,
      ipKey: input.ipKey,
      purpose: input.purpose,
      confirmationId: input.confirmationId,
    });
    return;
  }

  await ensureMongoReady();
  const collection = getMongoCollection<EmailConfirmationCodeDocument>(
    MONGO_COLLECTIONS.emailConfirmationCodes,
  );
  await collection.updateOne(
    { confirmationId: input.confirmationId },
    { $set: { lastSentAt: input.sentAt } },
  );
  await recordEmailConfirmationSend({
    userId: input.userId,
    email: input.email,
    purpose: input.purpose,
    confirmationId: input.confirmationId,
    sentAt: input.sentAt,
    ipKey: input.ipKey,
  });
}

async function recordEmailConfirmationSend(input: {
  userId: string;
  email: string;
  purpose: EmailConfirmationCodePurpose;
  confirmationId?: string;
  sentAt: string;
  ipKey?: string;
}): Promise<void> {
  if (!isMongoConfigured()) {
    memorySendLog.push(input);
    return;
  }

  await ensureMongoReady();
  const collection = getMongoCollection<{
    sendId: string;
    userId: string;
    email: string;
    purpose: EmailConfirmationCodePurpose;
    confirmationId?: string;
    sentAt: string;
    ipKey?: string;
  }>(MONGO_COLLECTIONS.emailConfirmationSendLog);
  await collection.insertOne({
    sendId: randomUUID(),
    ...input,
  });
}

export async function countAccountAuthCodeSends(input: {
  userId: string;
  purpose: EmailConfirmationCodePurpose;
  sinceIso: string;
}): Promise<number> {
  if (!isMongoConfigured()) {
    return memorySendLog.filter(
      (entry) =>
        entry.sentAt >= input.sinceIso &&
        entry.userId === input.userId &&
        entry.purpose === input.purpose,
    ).length;
  }

  await ensureMongoReady();
  const collection = getMongoCollection<{
    userId: string;
    purpose: EmailConfirmationCodePurpose;
    sentAt: string;
  }>(MONGO_COLLECTIONS.emailConfirmationSendLog);

  return collection.countDocuments({
    userId: input.userId,
    purpose: input.purpose,
    sentAt: { $gte: input.sinceIso },
  });
}

export async function countIpAuthCodeSends(input: {
  ipKey: string;
  purpose: EmailConfirmationCodePurpose;
  sinceIso: string;
}): Promise<number> {
  if (!isMongoConfigured()) {
    return memorySendLog.filter(
      (entry) =>
        entry.sentAt >= input.sinceIso &&
        entry.ipKey === input.ipKey &&
        entry.purpose === input.purpose,
    ).length;
  }

  await ensureMongoReady();
  const collection = getMongoCollection<{
    ipKey?: string;
    purpose: EmailConfirmationCodePurpose;
    sentAt: string;
  }>(MONGO_COLLECTIONS.emailConfirmationSendLog);

  return collection.countDocuments({
    ipKey: input.ipKey,
    purpose: input.purpose,
    sentAt: { $gte: input.sinceIso },
  });
}

export async function countChallengeAuthCodeResends(input: {
  confirmationId: string;
}): Promise<number> {
  if (!isMongoConfigured()) {
    return memorySendLog.filter((entry) => entry.confirmationId === input.confirmationId).length;
  }

  await ensureMongoReady();
  const collection = getMongoCollection<{
    confirmationId?: string;
  }>(MONGO_COLLECTIONS.emailConfirmationSendLog);

  return collection.countDocuments({
    confirmationId: input.confirmationId,
  });
}

export async function deleteAuthCodeSendLogsForAccount(input: {
  userId: string;
  email: string;
}): Promise<number> {
  if (!isMongoConfigured()) {
    const before = memorySendLog.length;

    for (let index = memorySendLog.length - 1; index >= 0; index -= 1) {
      const entry = memorySendLog[index];

      if (entry?.userId === input.userId || entry?.email === input.email.trim().toLowerCase()) {
        memorySendLog.splice(index, 1);
      }
    }

    return before - memorySendLog.length;
  }

  await ensureMongoReady();
  const collection = getMongoCollection<{ userId: string; email: string }>(
    MONGO_COLLECTIONS.emailConfirmationSendLog,
  );
  const result = await collection.deleteMany({
    $or: [{ userId: input.userId }, { email: input.email.trim().toLowerCase() }],
  });

  return result.deletedCount ?? 0;
}

export async function clearAllAuthCodeSendLogsForTests(): Promise<void> {
  memorySendLog.length = 0;

  if (!isMongoConfigured()) {
    return;
  }

  await ensureMongoReady();
  const collection = getMongoCollection(MONGO_COLLECTIONS.emailConfirmationSendLog);
  await collection.deleteMany({});
}

/** @deprecated Use countAccountAuthCodeSends or countIpAuthCodeSends instead. */
export async function countRecentEmailConfirmationSends(input: {
  userId: string;
  email: string;
  ipKey?: string;
  sinceIso: string;
}): Promise<number> {
  return countAccountAuthCodeSends({
    userId: input.userId,
    purpose: "registration_email_confirmation",
    sinceIso: input.sinceIso,
  });
}

export async function findLatestEmailConfirmationSendAt(input: {
  userId: string;
  purpose: EmailConfirmationCodePurpose;
}): Promise<string | null> {
  if (!isMongoConfigured()) {
    const records = memoryCodes.filter(
      (entry) => entry.userId === input.userId && entry.purpose === input.purpose,
    );

    if (records.length === 0) {
      const latestSend = memorySendLog
        .filter((entry) => entry.userId === input.userId)
        .sort((left, right) => right.sentAt.localeCompare(left.sentAt))[0];

      return latestSend?.sentAt ?? null;
    }

    return (
      records
        .filter((entry) => entry.lastSentAt)
        .sort((left, right) => right.lastSentAt!.localeCompare(left.lastSentAt!))[0]?.lastSentAt ??
      null
    );
  }

  await ensureMongoReady();
  const codeCollection = getMongoCollection<EmailConfirmationCodeDocument>(
    MONGO_COLLECTIONS.emailConfirmationCodes,
  );
  const latestCode = await codeCollection.findOne(
    { userId: input.userId, purpose: input.purpose },
    { sort: { lastSentAt: -1 } },
  );

  if (latestCode?.lastSentAt) {
    return latestCode.lastSentAt;
  }

  const sendCollection = getMongoCollection<{ userId: string; sentAt: string }>(
    MONGO_COLLECTIONS.emailConfirmationSendLog,
  );
  const latestSend = await sendCollection.findOne(
    { userId: input.userId },
    { sort: { sentAt: -1 } },
  );

  return latestSend?.sentAt ?? null;
}

export async function findActiveEmailConfirmationCode(input: {
  userId: string;
  purpose: EmailConfirmationCodePurpose;
}): Promise<EmailConfirmationCodeRecord | null> {
  const now = new Date(getConfirmationCodeNowMs()).toISOString();

  if (!isMongoConfigured()) {
    const record =
      memoryCodes.find(
        (entry) =>
          entry.userId === input.userId &&
          entry.purpose === input.purpose &&
          entry.status === "active",
      ) ?? null;

    if (!record) {
      return null;
    }

    if (record.expiresAt <= now) {
      record.status = "expired";
      return null;
    }

    return record;
  }

  await ensureMongoReady();
  const collection = getMongoCollection<EmailConfirmationCodeDocument>(
    MONGO_COLLECTIONS.emailConfirmationCodes,
  );
  const document = await collection.findOne({
    userId: input.userId,
    purpose: input.purpose,
    status: "active",
    expiresAt: { $gt: now },
  });

  if (!document) {
    return null;
  }

  const { _id: _ignored, ...record } = document;
  return record;
}

export async function incrementEmailConfirmationAttempt(
  confirmationId: string,
): Promise<EmailConfirmationCodeRecord | null> {
  if (!isMongoConfigured()) {
    const record = memoryCodes.find((entry) => entry.confirmationId === confirmationId) ?? null;

    if (!record || record.status !== "active") {
      return null;
    }

    record.attemptCount += 1;

    if (record.attemptCount >= record.maxAttempts) {
      record.status = "revoked";
    }

    return record;
  }

  await ensureMongoReady();
  const collection = getMongoCollection<EmailConfirmationCodeDocument>(
    MONGO_COLLECTIONS.emailConfirmationCodes,
  );
  const existing = await collection.findOne({ confirmationId, status: "active" });

  if (!existing) {
    return null;
  }

  const nextAttemptCount = existing.attemptCount + 1;
  const nextStatus = nextAttemptCount >= existing.maxAttempts ? "revoked" : "active";

  const result = await collection.findOneAndUpdate(
    { confirmationId, status: "active" },
    {
      $set: {
        attemptCount: nextAttemptCount,
        status: nextStatus,
      },
    },
    { returnDocument: "after" },
  );

  if (!result) {
    return null;
  }

  const { _id: _ignored, ...record } = result;
  return record;
}

export async function consumeEmailConfirmationCode(input: {
  userId: string;
  code: string;
  purpose: EmailConfirmationCodePurpose;
}): Promise<EmailConfirmationCodeRecord | null> {
  const now = new Date(getConfirmationCodeNowMs()).toISOString();
  const codeHash = hashEmailConfirmationCode(input.userId, input.code);

  if (!isMongoConfigured()) {
    const record =
      memoryCodes.find(
        (entry) =>
          entry.userId === input.userId &&
          entry.purpose === input.purpose &&
          entry.status === "active" &&
          entry.codeHash === codeHash,
      ) ?? null;

    if (!record) {
      return null;
    }

    if (record.expiresAt <= now) {
      record.status = "expired";
      return null;
    }

    record.status = "consumed";
    record.consumedAt = now;
    return record;
  }

  await ensureMongoReady();
  const collection = getMongoCollection<EmailConfirmationCodeDocument>(
    MONGO_COLLECTIONS.emailConfirmationCodes,
  );

  const result = await collection.findOneAndUpdate(
    {
      userId: input.userId,
      purpose: input.purpose,
      status: "active",
      codeHash,
      expiresAt: { $gt: now },
    },
    {
      $set: {
        status: "consumed",
        consumedAt: now,
      },
    },
    { returnDocument: "after" },
  );

  if (!result) {
    return null;
  }

  const { _id: _ignored, ...record } = result;
  return record;
}

export function clearEmailConfirmationCodesForTests(): void {
  memoryCodes.length = 0;
  memorySendLog.length = 0;
  lastIssuedCodesForTests.clear();
  resetConfirmationCodeNowMsForTests();
}

export function getLastIssuedConfirmationCodeForTests(
  userId: string,
  purpose: EmailConfirmationCodePurpose = "registration_email_confirmation",
): string | null {
  return (
    lastIssuedCodesForTests.get(`${userId}:${purpose}`) ??
    lastIssuedCodesForTests.get(userId) ??
    null
  );
}

export async function deleteEmailConfirmationCodesByUserIds(userIds: string[]): Promise<number> {
  if (userIds.length === 0) {
    return 0;
  }

  if (!isMongoConfigured()) {
    const before = memoryCodes.length;

    for (let index = memoryCodes.length - 1; index >= 0; index -= 1) {
      if (userIds.includes(memoryCodes[index]?.userId ?? "")) {
        memoryCodes.splice(index, 1);
      }
    }

    for (let index = memorySendLog.length - 1; index >= 0; index -= 1) {
      if (userIds.includes(memorySendLog[index]?.userId ?? "")) {
        memorySendLog.splice(index, 1);
      }
    }

    return before - memoryCodes.length;
  }

  await ensureMongoReady();
  const codeCollection = getMongoCollection<EmailConfirmationCodeDocument>(
    MONGO_COLLECTIONS.emailConfirmationCodes,
  );
  const sendCollection = getMongoCollection<{ userId: string }>(
    MONGO_COLLECTIONS.emailConfirmationSendLog,
  );
  const codeResult = await codeCollection.deleteMany({ userId: { $in: userIds } });
  await sendCollection.deleteMany({ userId: { $in: userIds } });

  return codeResult.deletedCount ?? 0;
}
