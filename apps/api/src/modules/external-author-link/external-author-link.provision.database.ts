import type { BlogCapabilityGrant, MemberProfile } from "@hu/types";
import type { ClientSession, Filter } from "mongodb";

import { MONGO_COLLECTIONS } from "../../infrastructure/mongodb/mongo-collections.js";
import { isMongoConfigured } from "../../infrastructure/mongodb/mongo-config.js";
import { connectMongoClient } from "../../infrastructure/mongodb/mongo-connection.js";
import { getMongoCollection } from "../../infrastructure/mongodb/mongo-database.js";
import {
  MongoTransactionUnavailableError,
  runMongoTransaction,
} from "../../infrastructure/mongodb/mongo-transaction.js";
import type { AuthUserRecord } from "../auth/auth-user.types.js";
import { upsertBlogCapabilityGrant, findBlogCapabilityGrant } from "../blog/persistence/blog.repository.js";
import { insertMember } from "../member/infrastructure/member.repository.js";
import type { PersistedMemberRecord } from "../member/domain/member.types.js";
import { insertMemberProfile } from "../member-profile/member-profile.repository.js";
import type { INTEGRITY_MEDIA_SOURCE } from "./external-author-link.constants.js";
import {
  getExternalAuthorLinkStore,
  integrityMediaMemoryAuthorDeletionTombstoneExists,
  type ExternalAuthorLinkStore,
} from "./external-author-link.store.js";
import type {
  ExternalAuthorLinkRecord,
  ExternalAuthorLinkResultRecord,
} from "./external-author-link.types.js";

export interface ProvisionAttemptRecord {
  attemptId: string;
  externalAuthorId: string;
  email: string;
  displayName: string;
  target: string;
  expiresAt: number;
  returnPath: string;
  emailVerification: "pending";
  memberId: string | null;
  userId: string | null;
  createdMember: boolean;
  createdAt: string;
  updatedAt: string;
  /**
   * Set only by a valid version-2 declaration on the original insert.
   * Absent or false is a legacy attempt. Snapshot absence does not imply either.
   */
  snapshotRequired?: boolean;
  /** Exact version-2 snapshot string. Absent until a snapshot is registered. */
  profileSnapshot?: string;
  /** Lowercase SHA-256 hex of `profileSnapshot`. Never returned by the API. */
  profileSnapshotDigest?: string;
  /** Absent means the attempt is not eligible for photo import. */
  photoImportStatus?: PhotoImportStatus;
  photoImportAttempts?: number;
  photoImportClaimedAt?: string;
  photoImportDigest?: string;
  photoImportByteLength?: number;
}

export type PhotoImportStatus = "pending" | "in_progress" | "applied" | "skipped" | "failed";

export interface PhotoImportEligibility {
  digest: string;
  byteLength: number;
}

export type PhotoImportEstablishResult = "established" | "already_set" | "missing" | "ineligible";

export type PhotoImportClaimResult =
  | "claimed"
  | "busy"
  | "expired"
  | "terminal"
  | "missing"
  | "ineligible";

export interface PhotoImportClaimInput {
  attemptId: string;
  nowSeconds: number;
  nowIso: string;
  leaseBeforeIso: string;
  maxAttempts: number;
}

export type SnapshotAttachResult =
  | "stored"
  | "idempotent"
  | "missing"
  | "expired"
  | "consumed"
  | "conflict"
  | "target_mismatch"
  | "not_required";

export interface SnapshotAttachInput {
  attemptId: string;
  target: string;
  snapshot: string;
  digest: string;
  nowSeconds: number;
  updatedAt: string;
}

export interface ProvisionUserView {
  userId: string;
  memberId: string;
  email: string;
  emailVerificationStatus: AuthUserRecord["emailVerificationStatus"];
  passwordHash: string;
}

export interface ProvisionGrantView {
  capabilities: readonly string[];
  publishWithoutManualReview: boolean;
}

export interface ProvisionDatabase {
  findAttempt(attemptId: string): Promise<ProvisionAttemptRecord | null>;
  insertAttempt(record: ProvisionAttemptRecord): Promise<"inserted" | "duplicate">;
  saveAttempt(record: ProvisionAttemptRecord): Promise<void>;
  attachProfileSnapshot(input: SnapshotAttachInput): Promise<SnapshotAttachResult>;
  establishPhotoImportEligibility(
    attemptId: string,
    photo: PhotoImportEligibility,
    updatedAt: string,
  ): Promise<PhotoImportEstablishResult>;
  claimPhotoImport(input: PhotoImportClaimInput): Promise<PhotoImportClaimResult>;
  settlePhotoImport(
    attemptId: string,
    status: Exclude<PhotoImportStatus, "in_progress">,
    updatedAt: string,
  ): Promise<void>;
  claimEmptyAvatar(input: {
    userId: string;
    avatarUrl: string;
    updatedAt: string;
  }): Promise<"applied" | "occupied" | "missing">;
  findUserByEmail(email: string): Promise<ProvisionUserView | null>;
  findUserByMemberId(memberId: string): Promise<ProvisionUserView | null>;
  insertUser(record: AuthUserRecord): Promise<void>;
  insertProfile(profile: MemberProfile): Promise<void>;
  insertParticipant(record: PersistedMemberRecord): Promise<void>;
  findGrant(participantId: string): Promise<ProvisionGrantView | null>;
  insertGrant(grant: BlogCapabilityGrant): Promise<void>;
  findLinkByAuthor(
    source: typeof INTEGRITY_MEDIA_SOURCE,
    externalAuthorId: string,
  ): Promise<ExternalAuthorLinkRecord | null>;
  insertLink(record: ExternalAuthorLinkRecord): Promise<"inserted" | "duplicate">;
  listResultsForAttempt(attemptState: string): Promise<ExternalAuthorLinkResultRecord[]>;
  insertResult(record: ExternalAuthorLinkResultRecord): Promise<void>;
}

export class ProvisionDuplicateKeyError extends Error {
  readonly code = 11000;

  constructor() {
    super("Duplicate provision identity.");
    this.name = "ProvisionDuplicateKeyError";
  }
}

export function isProvisionDuplicateKeyError(error: unknown): boolean {
  return (
    error instanceof ProvisionDuplicateKeyError ||
    (typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: number }).code === 11000)
  );
}

interface MemorySnapshot {
  attempts: Map<string, ProvisionAttemptRecord>;
  users: Map<string, AuthUserRecord>;
  profiles: Map<string, MemberProfile>;
  participants: Map<string, PersistedMemberRecord>;
  grants: Map<string, BlogCapabilityGrant>;
  links: Map<string, ExternalAuthorLinkRecord>;
  results: Map<string, ExternalAuthorLinkResultRecord>;
}

export interface MemoryProvisionState {
  readonly mutationCount: number;
  failNextLinkInsert: boolean;
  transaction<T>(work: (db: ProvisionDatabase) => Promise<T>): Promise<T>;
  exclusive<T>(work: () => Promise<T>): Promise<T>;
  view(): ProvisionDatabase;
  users(): AuthUserRecord[];
  links(): ExternalAuthorLinkRecord[];
  grants(): BlogCapabilityGrant[];
  results(): ExternalAuthorLinkResultRecord[];
  attempts(): ProvisionAttemptRecord[];
  removeAttemptsForAuthor(externalAuthorId: string): number;
  participants(): PersistedMemberRecord[];
  profiles(): MemberProfile[];
  patchAttempt(attemptId: string, patch: Partial<ProvisionAttemptRecord>): void;
  patchProfile(userId: string, patch: Partial<MemberProfile>): void;
}

let memoryState: MemoryProvisionState | null = null;
let memoryQueue: Promise<unknown> = Promise.resolve();

export function setProvisionMemoryForTests(state: MemoryProvisionState | null): void {
  memoryState = state;
  memoryQueue = Promise.resolve();
}

export function getProvisionMemoryForTests(): MemoryProvisionState | null {
  return memoryState;
}

/** Exact externalAuthorId only. Member identities stored on the attempt are not used as authority. */
export async function deleteProvisionAttemptsForAuthorDeletion(
  externalAuthorId: string,
  session?: ClientSession,
): Promise<number> {
  if (session) {
    const result = await getMongoCollection<ProvisionAttemptRecord>(
      MONGO_COLLECTIONS.externalAuthorProvisionAttempts,
    ).deleteMany({ externalAuthorId }, { session });
    return result.deletedCount;
  }

  const memory = memoryState;
  if (memory) {
    return memory.removeAttemptsForAuthor(externalAuthorId);
  }

  if (!isMongoConfigured()) {
    return 0;
  }

  const result = await getMongoCollection<ProvisionAttemptRecord>(
    MONGO_COLLECTIONS.externalAuthorProvisionAttempts,
  ).deleteMany({ externalAuthorId });
  return result.deletedCount;
}

export function createMemoryProvisionState(): MemoryProvisionState {
  let attempts = new Map<string, ProvisionAttemptRecord>();
  let users = new Map<string, AuthUserRecord>();
  let profiles = new Map<string, MemberProfile>();
  let participants = new Map<string, PersistedMemberRecord>();
  let grants = new Map<string, BlogCapabilityGrant>();
  let links = new Map<string, ExternalAuthorLinkRecord>();
  let results = new Map<string, ExternalAuthorLinkResultRecord>();
  let mutationCount = 0;
  let failNextLinkInsert = false;

  function snapshot(): MemorySnapshot {
    return {
      attempts: cloneMap(attempts),
      users: cloneMap(users),
      profiles: cloneMap(profiles),
      participants: cloneMap(participants),
      grants: cloneMap(grants),
      links: cloneMap(links),
      results: cloneMap(results),
    };
  }

  function restore(saved: MemorySnapshot): void {
    attempts = saved.attempts;
    users = saved.users;
    profiles = saved.profiles;
    participants = saved.participants;
    grants = saved.grants;
    links = saved.links;
    results = saved.results;
  }

  const database = createMemoryDatabaseView(() => ({
    attempts,
    users,
    profiles,
    participants,
    grants,
    links,
    results,
    noteMutation() {
      mutationCount += 1;
    },
    consumeLinkFailure() {
      if (!failNextLinkInsert) {
        return false;
      }

      failNextLinkInsert = false;
      return true;
    },
  }));

  const state: MemoryProvisionState = {
    get mutationCount() {
      return mutationCount;
    },
    get failNextLinkInsert() {
      return failNextLinkInsert;
    },
    set failNextLinkInsert(value: boolean) {
      failNextLinkInsert = value;
    },
    transaction(work) {
      return enqueue(async () => {
        const saved = snapshot();

        try {
          return await work(database);
        } catch (error) {
          restore(saved);
          throw error;
        }
      });
    },
    exclusive(work) {
      return enqueue(work);
    },
    view: () => database,
    users: () => [...users.values()].map((user) => ({ ...user })),
    links: () => [...links.values()].map((link) => ({ ...link })),
    grants: () => [...grants.values()].map((grant) => ({ ...grant, capabilities: [...grant.capabilities] })),
    results: () => [...results.values()].map((result) => ({ ...result })),
    attempts: () => [...attempts.values()].map((attempt) => ({ ...attempt })),
    removeAttemptsForAuthor(externalAuthorId) {
      let removed = 0;
      for (const [attemptId, attempt] of attempts) {
        if (attempt.externalAuthorId === externalAuthorId) {
          attempts.delete(attemptId);
          removed += 1;
        }
      }
      return removed;
    },
    participants: () => [...participants.values()].map((participant) => ({ ...participant })),
    profiles: () => [...profiles.values()].map((profile) => structuredClone(profile)),
    patchAttempt(attemptId, patch) {
      const current = attempts.get(attemptId);
      if (!current) {
        throw new Error("Provision attempt is missing.");
      }

      attempts.set(attemptId, { ...current, ...patch });
    },
    patchProfile(userId, patch) {
      const current = profiles.get(userId);
      if (!current) {
        throw new Error("Provision profile is missing.");
      }

      Object.assign(current, patch);
    },
  };

  return state;
}

export async function runProvisionTransaction<T>(
  work: (db: ProvisionDatabase) => Promise<T>,
): Promise<T> {
  if (memoryState) {
    return memoryState.transaction(work);
  }

  if (!isMongoConfigured()) {
    throw new MongoTransactionUnavailableError();
  }

  return runMongoTransaction((session) => work(createMongoProvisionDatabase(session)));
}

export async function withProvisionLock<T>(work: () => Promise<T>): Promise<T> {
  if (!memoryState) {
    return work();
  }

  return memoryState.exclusive(work);
}

export function currentProvisionDatabase(): ProvisionDatabase {
  if (memoryState) {
    return memoryState.view();
  }

  return createMongoProvisionDatabase();
}

export async function findCommittedProvisionAttempt(
  attemptId: string,
): Promise<ProvisionAttemptRecord | null> {
  if (memoryState) {
    return memoryState.view().findAttempt(attemptId);
  }

  if (!isMongoConfigured()) {
    return null;
  }

  return createMongoProvisionDatabase().findAttempt(attemptId);
}

function enqueue<T>(work: () => Promise<T>): Promise<T> {
  const run = memoryQueue.then(work, work);
  memoryQueue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

function cloneMap<T>(source: Map<string, T>): Map<string, T> {
  return new Map([...source].map(([key, value]) => [key, structuredClone(value)]));
}

interface MemoryTables {
  attempts: Map<string, ProvisionAttemptRecord>;
  users: Map<string, AuthUserRecord>;
  profiles: Map<string, MemberProfile>;
  participants: Map<string, PersistedMemberRecord>;
  grants: Map<string, BlogCapabilityGrant>;
  links: Map<string, ExternalAuthorLinkRecord>;
  results: Map<string, ExternalAuthorLinkResultRecord>;
  noteMutation(): void;
  consumeLinkFailure(): boolean;
}

function createMemoryDatabaseView(read: () => MemoryTables): ProvisionDatabase {
  return {
    async findAttempt(attemptId) {
      return copy(read().attempts.get(attemptId));
    },
    async insertAttempt(record) {
      const tables = read();
      if (tables.attempts.has(record.attemptId)) {
        return "duplicate";
      }

      tables.noteMutation();
      tables.attempts.set(record.attemptId, { ...record });
      return "inserted";
    },
    async saveAttempt(record) {
      const tables = read();
      const current = tables.attempts.get(record.attemptId);
      if (!current) {
        throw new Error("Provision attempt is missing.");
      }

      tables.noteMutation();
      tables.attempts.set(record.attemptId, {
        ...current,
        memberId: record.memberId,
        userId: record.userId,
        createdMember: record.createdMember,
        updatedAt: record.updatedAt,
      });
    },
    async attachProfileSnapshot(input) {
      const tables = read();
      const current = tables.attempts.get(input.attemptId);
      if (!current) {
        return "missing";
      }

      if (current.target !== input.target) {
        return "target_mismatch";
      }

      if (current.expiresAt <= input.nowSeconds) {
        return "expired";
      }

      if (current.memberId !== null || current.createdMember) {
        return "consumed";
      }

      if (current.snapshotRequired !== true) {
        return "not_required";
      }

      if (current.profileSnapshot === undefined || current.profileSnapshot === null) {
        tables.noteMutation();
        tables.attempts.set(input.attemptId, {
          ...current,
          profileSnapshot: input.snapshot,
          profileSnapshotDigest: input.digest,
          updatedAt: input.updatedAt,
        });
        return "stored";
      }

      if (current.profileSnapshot === input.snapshot) {
        return "idempotent";
      }

      return "conflict";
    },
    async establishPhotoImportEligibility(attemptId, photo, updatedAt) {
      const tables = read();
      const current = tables.attempts.get(attemptId);
      if (!current) {
        return "missing";
      }

      if (current.createdMember !== true) {
        return "ineligible";
      }

      if (current.photoImportStatus) {
        return "already_set";
      }

      tables.noteMutation();
      tables.attempts.set(attemptId, {
        ...current,
        photoImportStatus: "pending",
        photoImportAttempts: 0,
        photoImportDigest: photo.digest,
        photoImportByteLength: photo.byteLength,
        updatedAt,
      });
      return "established";
    },
    async claimPhotoImport(input) {
      const tables = read();
      const current = tables.attempts.get(input.attemptId);
      if (!current) {
        return "missing";
      }

      if (current.expiresAt <= input.nowSeconds) {
        return "expired";
      }

      const attempts = current.photoImportAttempts ?? 0;
      const status = current.photoImportStatus;
      if (status === "applied" || status === "skipped" || status === "failed") {
        return "terminal";
      }

      if (status !== "pending" && status !== "in_progress") {
        return "ineligible";
      }

      if (attempts >= input.maxAttempts) {
        return "terminal";
      }

      const leaseHeld =
        status === "in_progress" &&
        typeof current.photoImportClaimedAt === "string" &&
        current.photoImportClaimedAt >= input.leaseBeforeIso;
      if (leaseHeld) {
        return "busy";
      }

      tables.noteMutation();
      tables.attempts.set(input.attemptId, {
        ...current,
        photoImportStatus: "in_progress",
        photoImportAttempts: attempts + 1,
        photoImportClaimedAt: input.nowIso,
      });
      return "claimed";
    },
    async settlePhotoImport(attemptId, status, updatedAt) {
      const tables = read();
      const current = tables.attempts.get(attemptId);
      if (!current) {
        return;
      }

      tables.noteMutation();
      tables.attempts.set(attemptId, {
        ...current,
        photoImportStatus: status,
        updatedAt,
      });
    },
    async claimEmptyAvatar(input) {
      const tables = read();
      const profile = tables.profiles.get(input.userId);
      if (!profile) {
        return "missing";
      }

      if (Object.prototype.hasOwnProperty.call(profile, "avatarUrl") && profile.avatarUrl !== undefined) {
        return "occupied";
      }

      tables.noteMutation();
      profile.avatarUrl = input.avatarUrl;
      profile.updatedAt = input.updatedAt;
      return "applied";
    },
    async findUserByEmail(email) {
      const user = [...read().users.values()].find((candidate) => candidate.email === email);
      return user ? toUserView(user) : null;
    },
    async findUserByMemberId(memberId) {
      const user = [...read().users.values()].find((candidate) => candidate.memberId === memberId);
      return user ? toUserView(user) : null;
    },
    async insertUser(record) {
      const tables = read();
      if ([...tables.users.values()].some((user) => user.email === record.email)) {
        throw new ProvisionDuplicateKeyError();
      }

      tables.noteMutation();
      tables.users.set(record.userId, { ...record });
    },
    async insertProfile(profile) {
      const tables = read();
      tables.noteMutation();
      tables.profiles.set(profile.userId, structuredClone(profile));
    },
    async insertParticipant(record) {
      const tables = read();
      if (
        [...tables.participants.values()].some(
          (participant) =>
            participant.memberId === record.memberId ||
            participant.identityId === record.identityId ||
            participant.uniqueName === record.uniqueName,
        )
      ) {
        throw new ProvisionDuplicateKeyError();
      }

      tables.noteMutation();
      tables.participants.set(record.memberId, { ...record });
    },
    async findGrant(participantId) {
      const grant = read().grants.get(participantId);
      return grant
        ? {
            capabilities: [...grant.capabilities],
            publishWithoutManualReview: grant.publishWithoutManualReview === true,
          }
        : null;
    },
    async insertGrant(grant) {
      const tables = read();
      if (tables.grants.has(grant.participantId)) {
        throw new ProvisionDuplicateKeyError();
      }

      tables.noteMutation();
      tables.grants.set(grant.participantId, {
        ...grant,
        capabilities: [...grant.capabilities],
      });
    },
    async findLinkByAuthor(_source, externalAuthorId) {
      return copy(read().links.get(externalAuthorId));
    },
    async insertLink(record) {
      const tables = read();
      if (tables.consumeLinkFailure()) {
        tables.noteMutation();
        throw new Error("Forced provision link failure.");
      }

      if (
        integrityMediaMemoryAuthorDeletionTombstoneExists(record.source, record.externalAuthorId) ||
        tables.links.has(record.externalAuthorId) ||
        [...tables.links.values()].some((link) => link.memberId === record.memberId)
      ) {
        return "duplicate";
      }

      tables.noteMutation();
      tables.links.set(record.externalAuthorId, { ...record });
      return "inserted";
    },
    async listResultsForAttempt(attemptState) {
      return [...read().results.values()]
        .filter((result) => result.attemptState === attemptState)
        .map((result) => ({ ...result }));
    },
    async insertResult(record) {
      const tables = read();
      if (tables.results.has(record.resultCode)) {
        throw new ProvisionDuplicateKeyError();
      }

      tables.noteMutation();
      tables.results.set(record.resultCode, { ...record });
    },
  };
}

function createMongoProvisionDatabase(session?: ClientSession): ProvisionDatabase {
  const attempts = () =>
    getMongoCollection<ProvisionAttemptRecord>(MONGO_COLLECTIONS.externalAuthorProvisionAttempts);
  const users = () => getMongoCollection<AuthUserRecord>(MONGO_COLLECTIONS.authUsers);
  const sessionOptions = session ? { session } : {};
  const linkStore = (): ExternalAuthorLinkStore => getExternalAuthorLinkStore();

  return {
    async findAttempt(attemptId) {
      await ensureMongo();
      const document = await attempts().findOne({ attemptId }, sessionOptions);
      return document ? withoutId(document) : null;
    },
    async insertAttempt(record) {
      await ensureMongo();

      try {
        await attempts().insertOne(record, sessionOptions);
        return "inserted";
      } catch (error) {
        if (isProvisionDuplicateKeyError(error)) {
          return "duplicate";
        }

        throw error;
      }
    },
    async saveAttempt(record) {
      await ensureMongo();
      await attempts().updateOne(
        { attemptId: record.attemptId },
        {
          $set: {
            memberId: record.memberId,
            userId: record.userId,
            createdMember: record.createdMember,
            updatedAt: record.updatedAt,
          },
        },
        sessionOptions,
      );
    },
    async attachProfileSnapshot(input) {
      await ensureMongo();
      const collection = attempts();
      const claim = {
        attemptId: input.attemptId,
        target: input.target,
        expiresAt: { $gt: input.nowSeconds },
        memberId: null,
        createdMember: false,
        snapshotRequired: true,
        profileSnapshot: { $exists: false },
      };
      const claimed = await collection.findOneAndUpdate(
        claim,
        {
          $set: {
            profileSnapshot: input.snapshot,
            profileSnapshotDigest: input.digest,
            updatedAt: input.updatedAt,
          },
        },
        { returnDocument: "after", ...sessionOptions },
      );

      if (claimed) {
        return "stored";
      }

      const current = await collection.findOne({ attemptId: input.attemptId }, sessionOptions);
      if (!current) {
        return "missing";
      }

      if (current.target !== input.target) {
        return "target_mismatch";
      }

      if (current.expiresAt <= input.nowSeconds) {
        return "expired";
      }

      if (current.memberId !== null || current.createdMember) {
        return "consumed";
      }

      if (current.snapshotRequired !== true) {
        return "not_required";
      }

      if (current.profileSnapshot === input.snapshot) {
        return "idempotent";
      }

      if (typeof current.profileSnapshot === "string") {
        return "conflict";
      }

      const raced = await collection.findOneAndUpdate(
        claim,
        {
          $set: {
            profileSnapshot: input.snapshot,
            profileSnapshotDigest: input.digest,
            updatedAt: input.updatedAt,
          },
        },
        { returnDocument: "after", ...sessionOptions },
      );
      return raced ? "stored" : "conflict";
    },
    async establishPhotoImportEligibility(attemptId, photo, updatedAt) {
      await ensureMongo();
      const updated = await attempts().findOneAndUpdate(
        {
          attemptId,
          createdMember: true,
          photoImportStatus: { $exists: false },
        },
        {
          $set: {
            photoImportStatus: "pending",
            photoImportAttempts: 0,
            photoImportDigest: photo.digest,
            photoImportByteLength: photo.byteLength,
            updatedAt,
          },
        },
        { returnDocument: "after", ...sessionOptions },
      );
      if (updated) {
        return "established";
      }

      const current = await attempts().findOne({ attemptId }, sessionOptions);
      if (!current) {
        return "missing";
      }

      if (current.createdMember !== true) {
        return "ineligible";
      }

      return "already_set";
    },
    async claimPhotoImport(input) {
      await ensureMongo();
      const filter: Filter<ProvisionAttemptRecord> = {
        attemptId: input.attemptId,
        expiresAt: { $gt: input.nowSeconds },
        $and: [
          {
            $or: [
              { photoImportAttempts: { $lt: input.maxAttempts } },
              { photoImportAttempts: { $exists: false } },
            ],
          },
          {
            $or: [
              { photoImportStatus: "pending" },
              {
                photoImportStatus: "in_progress",
                $or: [
                  { photoImportClaimedAt: { $lt: input.leaseBeforeIso } },
                  { photoImportClaimedAt: { $exists: false } },
                ],
              },
            ],
          },
        ],
      };
      const claimed = await attempts().findOneAndUpdate(
        filter,
        {
          $set: {
            photoImportStatus: "in_progress",
            photoImportClaimedAt: input.nowIso,
          },
          $inc: { photoImportAttempts: 1 },
        },
        { returnDocument: "after", ...sessionOptions },
      );
      if (claimed) {
        return "claimed";
      }

      const current = await attempts().findOne({ attemptId: input.attemptId }, sessionOptions);
      if (!current) {
        return "missing";
      }

      if (current.expiresAt <= input.nowSeconds) {
        return "expired";
      }

      if (
        current.photoImportStatus === "applied" ||
        current.photoImportStatus === "skipped" ||
        current.photoImportStatus === "failed" ||
        (current.photoImportAttempts ?? 0) >= input.maxAttempts
      ) {
        return "terminal";
      }

      if (current.photoImportStatus === "in_progress") {
        return "busy";
      }

      return "ineligible";
    },
    async settlePhotoImport(attemptId, status, updatedAt) {
      await ensureMongo();
      await attempts().updateOne(
        { attemptId },
        { $set: { photoImportStatus: status, updatedAt } },
        sessionOptions,
      );
    },
    async claimEmptyAvatar(input) {
      await ensureMongo();
      const profiles = getMongoCollection<MemberProfile>(MONGO_COLLECTIONS.memberProfiles);
      const updated = await profiles.findOneAndUpdate(
        { userId: input.userId, avatarUrl: { $exists: false } },
        { $set: { avatarUrl: input.avatarUrl, updatedAt: input.updatedAt } },
        { returnDocument: "after", ...sessionOptions },
      );
      if (updated) {
        return "applied";
      }

      const existing = await profiles.findOne({ userId: input.userId }, sessionOptions);
      return existing ? "occupied" : "missing";
    },
    async findUserByEmail(email) {
      await ensureMongo();
      const document = await users().findOne({ email }, sessionOptions);
      return document ? toUserView(withoutId(document)) : null;
    },
    async findUserByMemberId(memberId) {
      await ensureMongo();
      const document = await users().findOne({ memberId }, sessionOptions);
      return document ? toUserView(withoutId(document)) : null;
    },
    async insertUser(record) {
      await ensureMongo();
      await users().insertOne(record, sessionOptions);
    },
    async insertProfile(profile) {
      await insertMemberProfile(profile, { session });
    },
    async insertParticipant(record) {
      await insertMember(toMemberInput(record), { session });
    },
    async findGrant(participantId) {
      const grant = await findBlogCapabilityGrant(participantId, { session });
      return grant
        ? {
            capabilities: [...grant.capabilities],
            publishWithoutManualReview: grant.publishWithoutManualReview === true,
          }
        : null;
    },
    async insertGrant(grant) {
      await upsertBlogCapabilityGrant(grant, { session });
    },
    async findLinkByAuthor(source, externalAuthorId) {
      return linkStore().findLinkByAuthor(source, externalAuthorId, { session });
    },
    async insertLink(record) {
      return linkStore().insertLink(record, { session });
    },
    async listResultsForAttempt(attemptState) {
      await ensureMongo();
      const documents = await getMongoCollection<ExternalAuthorLinkResultRecord>(
        MONGO_COLLECTIONS.externalAuthorLinkResults,
      )
        .find({ attemptState }, sessionOptions)
        .toArray();
      return documents.map((document) => withoutId(document));
    },
    async insertResult(record) {
      await linkStore().insertResult(record, { session });
    },
  };
}

function toMemberInput(record: PersistedMemberRecord) {
  return {
    memberId: record.memberId,
    identityId: record.identityId,
    displayName: record.displayName,
    uniqueName: record.uniqueName,
    verificationLevel: record.verificationLevel,
  };
}

function toUserView(user: AuthUserRecord): ProvisionUserView {
  return {
    userId: user.userId,
    memberId: user.memberId,
    email: user.email,
    emailVerificationStatus: user.emailVerificationStatus,
    passwordHash: user.passwordHash,
  };
}

function copy<T>(value: T | undefined): T | null {
  return value === undefined ? null : structuredClone(value);
}

function withoutId<T extends { _id?: unknown }>(document: T): Omit<T, "_id"> {
  const { _id: _ignored, ...record } = document;
  return record;
}

async function ensureMongo(): Promise<void> {
  if (!isMongoConfigured()) {
    throw new MongoTransactionUnavailableError();
  }

  await connectMongoClient();
}
