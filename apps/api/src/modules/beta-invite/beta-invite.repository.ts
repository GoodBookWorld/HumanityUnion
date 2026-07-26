import { randomUUID } from "node:crypto";

import type { BetaInviteStatus } from "@hu/types";

import { MONGO_COLLECTIONS } from "../../infrastructure/mongodb/mongo-collections.js";
import { isMongoConfigured } from "../../infrastructure/mongodb/mongo-config.js";
import { connectMongoClient } from "../../infrastructure/mongodb/mongo-connection.js";
import { getMongoCollection } from "../../infrastructure/mongodb/mongo-database.js";
import { AuthPersistenceUnavailableError } from "../auth/auth.errors.js";
import { hashBetaInviteCode, normalizeBetaInviteCode } from "./beta-invite-code.js";
import type {
  BetaInviteRecord,
  CreateBetaInviteInput,
  IssuedBetaInvite,
} from "./beta-invite.types.js";
import { generateBetaInviteCode } from "./beta-invite-code.js";

interface BetaInviteDocument extends BetaInviteRecord {
  _id?: string;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

async function ensureBetaInviteMongoReady(): Promise<void> {
  if (!isMongoConfigured()) {
    throw new AuthPersistenceUnavailableError();
  }

  await connectMongoClient();
}

function toRecord(document: BetaInviteDocument): BetaInviteRecord {
  const { _id: _ignored, ...record } = document;
  return record;
}

export async function insertBetaInvite(input: CreateBetaInviteInput): Promise<IssuedBetaInvite> {
  await ensureBetaInviteMongoReady();

  const code = generateBetaInviteCode();
  const now = new Date().toISOString();
  const record: BetaInviteRecord = {
    inviteId: randomUUID(),
    email: normalizeEmail(input.email),
    codeHash: hashBetaInviteCode(code),
    createdBy: input.createdBy,
    createdAt: now,
    expiresAt: input.expiresAt,
    status: "pending",
  };

  const collection = getMongoCollection<BetaInviteDocument>(MONGO_COLLECTIONS.betaInvites);

  await collection.insertOne(record);

  return { invite: record, code };
}

export async function findBetaInviteByEmail(email: string): Promise<BetaInviteRecord | null> {
  await ensureBetaInviteMongoReady();

  const collection = getMongoCollection<BetaInviteDocument>(MONGO_COLLECTIONS.betaInvites);
  const document = await collection.findOne({
    email: normalizeEmail(email),
    status: "pending",
  });

  return document ? toRecord(document) : null;
}

export async function findPendingBetaInviteByCodeHash(
  codeHash: string,
): Promise<BetaInviteRecord | null> {
  await ensureBetaInviteMongoReady();

  const collection = getMongoCollection<BetaInviteDocument>(MONGO_COLLECTIONS.betaInvites);
  const document = await collection.findOne({
    codeHash,
    status: "pending",
  });

  return document ? toRecord(document) : null;
}

export async function markBetaInviteUsed(inviteId: string, usedAt: string): Promise<void> {
  await ensureBetaInviteMongoReady();

  const collection = getMongoCollection<BetaInviteDocument>(MONGO_COLLECTIONS.betaInvites);

  await collection.updateOne(
    { inviteId, status: "pending" },
    {
      $set: {
        status: "used" satisfies BetaInviteStatus,
        usedAt,
      },
    },
  );
}

export async function expireBetaInviteIfNeeded(
  invite: BetaInviteRecord,
): Promise<BetaInviteRecord> {
  if (invite.status !== "pending") {
    return invite;
  }

  if (new Date(invite.expiresAt).getTime() > Date.now()) {
    return invite;
  }

  await ensureBetaInviteMongoReady();

  const collection = getMongoCollection<BetaInviteDocument>(MONGO_COLLECTIONS.betaInvites);

  await collection.updateOne(
    { inviteId: invite.inviteId, status: "pending" },
    { $set: { status: "expired" satisfies BetaInviteStatus } },
  );

  return { ...invite, status: "expired" };
}

export async function listBetaInvitesByCreator(createdBy: string): Promise<BetaInviteRecord[]> {
  await ensureBetaInviteMongoReady();

  const collection = getMongoCollection<BetaInviteDocument>(MONGO_COLLECTIONS.betaInvites);
  const documents = await collection
    .find({ createdBy })
    .sort({ createdAt: -1 })
    .limit(100)
    .toArray();

  return documents.map(toRecord);
}

export async function deleteBetaInvitesByEmailPrefix(emailPrefix: string): Promise<void> {
  if (!isMongoConfigured()) {
    return;
  }

  await connectMongoClient();

  const collection = getMongoCollection<BetaInviteDocument>(MONGO_COLLECTIONS.betaInvites);
  await collection.deleteMany({ email: { $regex: `^${emailPrefix}` } });
}

export function resolveInviteCodeHash(code: string): string {
  return hashBetaInviteCode(normalizeBetaInviteCode(code));
}
