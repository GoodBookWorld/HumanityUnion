import { randomUUID } from "node:crypto";

import type {
  RrpApplicationRecord,
  RrpApplicationStatus,
  RrpFundingModel,
} from "@hu/types";
import { RRP_APPLICATION_ACTIVE_STATUSES } from "@hu/types";

import { MONGO_COLLECTIONS } from "../../infrastructure/mongodb/mongo-collections.js";
import { isMongoConfigured } from "../../infrastructure/mongodb/mongo-config.js";
import { connectMongoClient } from "../../infrastructure/mongodb/mongo-connection.js";
import { getMongoCollection } from "../../infrastructure/mongodb/mongo-database.js";
import { RrpApplicationConflictError, RrpApplicationUnavailableError } from "./rrp-application.errors.js";
import { assertRrpApplicationActiveUniqueIndexReady } from "./rrp-application.index-readiness.js";

interface RrpApplicationDocument extends RrpApplicationRecord {
  _id?: string;
}

export interface RrpApplicationAdminListFilter {
  participantId?: string;
  representCountryCode?: string;
  fundingModel?: RrpFundingModel;
  status?: RrpApplicationStatus;
  annualRequestedAmountCadMin?: number;
  annualRequestedAmountCadMax?: number;
  limit: number;
  offset: number;
}

let forceMemoryForTests = false;
const memoryStore = new Map<string, RrpApplicationRecord>();

export function setRrpApplicationForceMemoryForTests(enabled: boolean): void {
  forceMemoryForTests = enabled;
}

/** True when RRP application persistence uses the in-memory test store. */
export function isRrpApplicationForceMemoryForTests(): boolean {
  return forceMemoryForTests;
}

export function resetRrpApplicationMemoryForTests(): void {
  memoryStore.clear();
}

function isDuplicateKeyError(error: unknown): boolean {
  return Boolean(
    error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code?: number }).code === 11000,
  );
}

async function ensureReady(): Promise<void> {
  if (forceMemoryForTests) {
    return;
  }

  if (!isMongoConfigured()) {
    throw new RrpApplicationUnavailableError(
      "Regional Representative application persistence is unavailable.",
    );
  }

  await connectMongoClient();
}

/** Reads may proceed after connect; writes require the active unique index. */
async function ensureWriteReady(): Promise<void> {
  await ensureReady();
  await assertRrpApplicationActiveUniqueIndexReady({
    skipMongo: forceMemoryForTests,
  });
}

function strip(document: RrpApplicationDocument): RrpApplicationRecord {
  const { _id: _ignored, ...record } = document;
  return record;
}

function assertMemoryUniqueActive(record: RrpApplicationRecord): void {
  if (!RRP_APPLICATION_ACTIVE_STATUSES.includes(record.status)) {
    return;
  }
  for (const existing of memoryStore.values()) {
    if (
      existing.applicationId !== record.applicationId &&
      existing.participantId === record.participantId &&
      existing.representCountryCode === record.representCountryCode &&
      RRP_APPLICATION_ACTIVE_STATUSES.includes(existing.status)
    ) {
      throw new RrpApplicationConflictError(
        "An active Regional Representative application already exists for this representation country.",
      );
    }
  }
}

export function buildRrpApplicationRecord(input: {
  userId: string;
  participantId: string;
  representCountryCode: string;
  legalFirstName?: string | null;
  legalLastName?: string | null;
  profession?: string | null;
  residenceCountryCode?: string | null;
  dateOfBirth?: string | null;
  fundingModel?: RrpFundingModel | null;
  annualRequestedAmountCad?: number | null;
  teamMemberCount?: number | null;
  relevantExperience?: string | null;
  motivation?: string | null;
}): RrpApplicationRecord {
  const timestamp = new Date().toISOString();

  return {
    applicationId: randomUUID(),
    userId: input.userId,
    participantId: input.participantId,
    legalFirstName: input.legalFirstName ?? null,
    legalLastName: input.legalLastName ?? null,
    profession: input.profession ?? null,
    residenceCountryCode: input.residenceCountryCode ?? null,
    representCountryCode: input.representCountryCode,
    dateOfBirth: input.dateOfBirth ?? null,
    fundingModel: input.fundingModel ?? null,
    annualRequestedAmountCad: input.annualRequestedAmountCad ?? null,
    teamMemberCount: input.teamMemberCount ?? null,
    relevantExperience: input.relevantExperience ?? null,
    motivation: input.motivation ?? null,
    consentAcceptedAt: null,
    consentVersion: null,
    status: "draft",
    createdAt: timestamp,
    updatedAt: timestamp,
    submittedAt: null,
    reviewedAt: null,
    reviewerAdminUserId: null,
    revision: 1,
    decisionHistory: [],
  };
}

export async function insertRrpApplication(
  record: RrpApplicationRecord,
): Promise<RrpApplicationRecord> {
  await ensureWriteReady();

  if (forceMemoryForTests) {
    assertMemoryUniqueActive(record);
    memoryStore.set(record.applicationId, record);
    return record;
  }

  const collection = getMongoCollection<RrpApplicationDocument>(
    MONGO_COLLECTIONS.rrpApplications,
  );

  try {
    await collection.insertOne(record);
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      throw new RrpApplicationConflictError(
        "An active Regional Representative application already exists for this representation country.",
      );
    }
    throw error;
  }

  return record;
}

export async function findRrpApplicationById(
  applicationId: string,
): Promise<RrpApplicationRecord | null> {
  await ensureReady();

  if (forceMemoryForTests) {
    return memoryStore.get(applicationId) ?? null;
  }

  const collection = getMongoCollection<RrpApplicationDocument>(
    MONGO_COLLECTIONS.rrpApplications,
  );
  const document = await collection.findOne({ applicationId });
  return document ? strip(document) : null;
}

export async function findRrpApplicationByIdForUser(input: {
  applicationId: string;
  userId: string;
}): Promise<RrpApplicationRecord | null> {
  await ensureReady();

  if (forceMemoryForTests) {
    const record = memoryStore.get(input.applicationId);
    if (!record || record.userId !== input.userId) {
      return null;
    }
    return record;
  }

  const collection = getMongoCollection<RrpApplicationDocument>(
    MONGO_COLLECTIONS.rrpApplications,
  );
  const document = await collection.findOne({
    applicationId: input.applicationId,
    userId: input.userId,
  });
  return document ? strip(document) : null;
}

export async function listRrpApplicationsForUser(
  userId: string,
): Promise<RrpApplicationRecord[]> {
  await ensureReady();

  if (forceMemoryForTests) {
    return [...memoryStore.values()]
      .filter((record) => record.userId === userId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  const collection = getMongoCollection<RrpApplicationDocument>(
    MONGO_COLLECTIONS.rrpApplications,
  );
  const documents = await collection
    .find({ userId })
    .sort({ updatedAt: -1 })
    .toArray();
  return documents.map(strip);
}

export async function findActiveRrpApplicationForParticipantCountry(input: {
  participantId: string;
  representCountryCode: string;
}): Promise<RrpApplicationRecord | null> {
  await ensureReady();

  if (forceMemoryForTests) {
    for (const record of memoryStore.values()) {
      if (
        record.participantId === input.participantId &&
        record.representCountryCode === input.representCountryCode &&
        RRP_APPLICATION_ACTIVE_STATUSES.includes(record.status)
      ) {
        return record;
      }
    }
    return null;
  }

  const collection = getMongoCollection<RrpApplicationDocument>(
    MONGO_COLLECTIONS.rrpApplications,
  );
  const document = await collection.findOne({
    participantId: input.participantId,
    representCountryCode: input.representCountryCode,
    status: { $in: [...RRP_APPLICATION_ACTIVE_STATUSES] },
  });
  return document ? strip(document) : null;
}

function matchesAdminFilter(
  record: RrpApplicationRecord,
  filter: RrpApplicationAdminListFilter,
): boolean {
  if (filter.participantId && record.participantId !== filter.participantId) {
    return false;
  }
  if (filter.representCountryCode && record.representCountryCode !== filter.representCountryCode) {
    return false;
  }
  if (filter.fundingModel && record.fundingModel !== filter.fundingModel) {
    return false;
  }
  if (filter.status && record.status !== filter.status) {
    return false;
  }
  if (
    filter.annualRequestedAmountCadMin !== undefined &&
    (record.annualRequestedAmountCad === null ||
      record.annualRequestedAmountCad < filter.annualRequestedAmountCadMin)
  ) {
    return false;
  }
  if (
    filter.annualRequestedAmountCadMax !== undefined &&
    (record.annualRequestedAmountCad === null ||
      record.annualRequestedAmountCad > filter.annualRequestedAmountCadMax)
  ) {
    return false;
  }
  return true;
}

export async function listRrpApplicationsForAdmin(
  filter: RrpApplicationAdminListFilter,
): Promise<{ items: RrpApplicationRecord[]; total: number }> {
  await ensureReady();

  if (forceMemoryForTests) {
    const matched = [...memoryStore.values()]
      .filter((record) => matchesAdminFilter(record, filter))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    return {
      total: matched.length,
      items: matched.slice(filter.offset, filter.offset + filter.limit),
    };
  }

  const collection = getMongoCollection<RrpApplicationDocument>(
    MONGO_COLLECTIONS.rrpApplications,
  );

  const query: Record<string, unknown> = {};
  if (filter.participantId) {
    query.participantId = filter.participantId;
  }
  if (filter.representCountryCode) {
    query.representCountryCode = filter.representCountryCode;
  }
  if (filter.fundingModel) {
    query.fundingModel = filter.fundingModel;
  }
  if (filter.status) {
    query.status = filter.status;
  }
  if (
    filter.annualRequestedAmountCadMin !== undefined ||
    filter.annualRequestedAmountCadMax !== undefined
  ) {
    const amountQuery: Record<string, number> = {};
    if (filter.annualRequestedAmountCadMin !== undefined) {
      amountQuery.$gte = filter.annualRequestedAmountCadMin;
    }
    if (filter.annualRequestedAmountCadMax !== undefined) {
      amountQuery.$lte = filter.annualRequestedAmountCadMax;
    }
    query.annualRequestedAmountCad = amountQuery;
  }

  const [total, documents] = await Promise.all([
    collection.countDocuments(query),
    collection
      .find(query)
      .sort({ updatedAt: -1 })
      .skip(filter.offset)
      .limit(filter.limit)
      .toArray(),
  ]);

  return { total, items: documents.map(strip) };
}

/**
 * Optimistic concurrency replace — matches applicationId + expectedRevision.
 * Returns null on revision mismatch.
 */
export async function replaceRrpApplicationIfRevision(input: {
  expectedRevision: number;
  next: RrpApplicationRecord;
  session?: import("mongodb").ClientSession;
}): Promise<RrpApplicationRecord | null> {
  await ensureWriteReady();

  if (input.next.revision !== input.expectedRevision + 1) {
    throw new RrpApplicationConflictError(
      "Application revision increment is invalid.",
    );
  }

  if (forceMemoryForTests) {
    const current = memoryStore.get(input.next.applicationId);
    if (!current || current.revision !== input.expectedRevision) {
      return null;
    }
    assertMemoryUniqueActive(input.next);
    memoryStore.set(input.next.applicationId, input.next);
    return input.next;
  }

  const collection = getMongoCollection<RrpApplicationDocument>(
    MONGO_COLLECTIONS.rrpApplications,
  );

  try {
    const result = await collection.findOneAndUpdate(
      {
        applicationId: input.next.applicationId,
        revision: input.expectedRevision,
      },
      { $set: { ...input.next } },
      {
        returnDocument: "after",
        ...(input.session ? { session: input.session } : {}),
      },
    );
    return result ? strip(result) : null;
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      throw new RrpApplicationConflictError(
        "An active Regional Representative application already exists for this representation country.",
      );
    }
    throw error;
  }
}

/** Applicant pipeline statuses used for directory classification (submitted+, not draft). */
export const RRP_APPLICANT_DIRECTORY_STATUSES: readonly RrpApplicationStatus[] = [
  "submitted",
  "under_review",
  "information_requested",
];

export async function findUserIdsForApplicantFundingClassification(
  fundingModel: RrpFundingModel,
): Promise<string[]> {
  await ensureReady();
  if (forceMemoryForTests) {
    return [
      ...new Set(
        [...memoryStore.values()]
          .filter(
            (record) =>
              record.fundingModel === fundingModel &&
              RRP_APPLICANT_DIRECTORY_STATUSES.includes(record.status),
          )
          .map((record) => record.userId),
      ),
    ];
  }

  const values = await getMongoCollection<RrpApplicationDocument>(
    MONGO_COLLECTIONS.rrpApplications,
  ).distinct("userId", {
    fundingModel,
    status: { $in: [...RRP_APPLICANT_DIRECTORY_STATUSES] },
  });
  return values.filter((value): value is string => typeof value === "string");
}

/** HU-RRP-04B — applicants in pipeline with fundingModel unset (null). */
export async function findUserIdsForApplicantUnspecifiedFundingClassification(): Promise<
  string[]
> {
  await ensureReady();
  if (forceMemoryForTests) {
    return [
      ...new Set(
        [...memoryStore.values()]
          .filter(
            (record) =>
              record.fundingModel === null &&
              RRP_APPLICANT_DIRECTORY_STATUSES.includes(record.status),
          )
          .map((record) => record.userId),
      ),
    ];
  }

  const values = await getMongoCollection<RrpApplicationDocument>(
    MONGO_COLLECTIONS.rrpApplications,
  ).distinct("userId", {
    fundingModel: null,
    status: { $in: [...RRP_APPLICANT_DIRECTORY_STATUSES] },
  });
  return values.filter((value): value is string => typeof value === "string");
}

export async function listRrpApplicationsForParticipantIds(
  participantIds: readonly string[],
): Promise<RrpApplicationRecord[]> {
  if (participantIds.length === 0) {
    return [];
  }
  await ensureReady();
  if (forceMemoryForTests) {
    return [...memoryStore.values()].filter((record) =>
      participantIds.includes(record.participantId),
    );
  }
  const documents = await getMongoCollection<RrpApplicationDocument>(
    MONGO_COLLECTIONS.rrpApplications,
  )
    .find({ participantId: { $in: [...participantIds] } })
    .toArray();
  return documents.map(strip);
}
