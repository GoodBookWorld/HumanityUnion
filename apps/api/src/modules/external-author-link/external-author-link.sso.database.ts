import { randomUUID } from "node:crypto";

import type { ClientSession } from "mongodb";

import { MONGO_COLLECTIONS } from "../../infrastructure/mongodb/mongo-collections.js";
import { isMongoConfigured } from "../../infrastructure/mongodb/mongo-config.js";
import { connectMongoClient } from "../../infrastructure/mongodb/mongo-connection.js";
import { getMongoCollection } from "../../infrastructure/mongodb/mongo-database.js";
import {
  MongoTransactionUnavailableError,
  runMongoTransaction,
} from "../../infrastructure/mongodb/mongo-transaction.js";
import { setAuthSessionWriterForTests } from "../auth/auth-session.repository.js";
import type { AuthSessionRecord, CreateAuthSessionInput } from "../auth/auth-session.types.js";
import { hashRefreshToken } from "../auth/auth-password.js";
import { findAuthUserById } from "../auth/auth-user.repository.js";
import type { AuthUserRecord } from "../auth/auth-user.types.js";
import { findMemberById } from "../member/infrastructure/member.repository.js";
import { INTEGRITY_MEDIA_SOURCE } from "./external-author-link.constants.js";
import {
  getExternalAuthorLinkStore,
  type ExternalAuthorLinkStore,
} from "./external-author-link.store.js";
import type { ExternalAuthorLinkRecord } from "./external-author-link.types.js";

export interface SsoGrantRecord {
  grantId: string;
  requestId: string;
  externalAuthorId: string;
  memberId: string;
  userId: string;
  linkRevision: number;
  target: string;
  expiresAt: string;
  consumedAt: string | null;
  createdAt: string;
}

export interface SsoMemberView {
  memberId: string;
  identityId: string;
}

export interface SsoDatabase {
  readonly clientSession?: ClientSession;
  findGrantByRequestId(requestId: string): Promise<SsoGrantRecord | null>;
  findGrantById(grantId: string): Promise<SsoGrantRecord | null>;
  insertGrant(record: SsoGrantRecord): Promise<"inserted" | "duplicate">;
  consumeGrant(grantId: string, nowIso: string): Promise<SsoGrantRecord | null>;
  findLink(externalAuthorId: string): Promise<ExternalAuthorLinkRecord | null>;
  findMember(memberId: string): Promise<SsoMemberView | null>;
  findUser(userId: string): Promise<AuthUserRecord | null>;
}

export class SsoDuplicateKeyError extends Error {
  readonly code = 11000;

  constructor() {
    super("Duplicate SSO grant.");
    this.name = "SsoDuplicateKeyError";
  }
}

export function isSsoDuplicateKeyError(error: unknown): boolean {
  return (
    error instanceof SsoDuplicateKeyError ||
    (typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: number }).code === 11000)
  );
}

export interface MemorySsoState {
  readonly sessionCount: number;
  transaction<T>(work: (db: SsoDatabase) => Promise<T>): Promise<T>;
  exclusive<T>(work: () => Promise<T>): Promise<T>;
  view(): SsoDatabase;
  addUser(user: AuthUserRecord): void;
  addMember(member: SsoMemberView): void;
  users(): AuthUserRecord[];
  members(): SsoMemberView[];
  grants(): SsoGrantRecord[];
  sessions(): AuthSessionRecord[];
  removeGrantsForAuthor(externalAuthorId: string): number;
}

let memoryState: MemorySsoState | null = null;
let memoryQueue: Promise<void> = Promise.resolve();

export function setSsoMemoryForTests(state: MemorySsoState | null): void {
  memoryState = state;
}

export function getSsoMemoryForTests(): MemorySsoState | null {
  return memoryState;
}

/** Exact externalAuthorId only. Grants for other authors stay. */
export async function deleteSsoGrantsForAuthorDeletion(
  externalAuthorId: string,
  session?: ClientSession,
): Promise<number> {
  if (session) {
    const result = await getMongoCollection<SsoGrantRecord>(
      MONGO_COLLECTIONS.externalAuthorSsoGrants,
    ).deleteMany({ externalAuthorId }, { session });
    return result.deletedCount;
  }

  if (memoryState) {
    return memoryState.removeGrantsForAuthor(externalAuthorId);
  }

  if (!isMongoConfigured()) {
    return 0;
  }

  const result = await getMongoCollection<SsoGrantRecord>(
    MONGO_COLLECTIONS.externalAuthorSsoGrants,
  ).deleteMany({ externalAuthorId });
  return result.deletedCount;
}

export function createMemorySsoState(): MemorySsoState {
  const grants = new Map<string, SsoGrantRecord>();
  const users = new Map<string, AuthUserRecord>();
  const members = new Map<string, SsoMemberView>();
  const sessions = new Map<string, AuthSessionRecord>();

  const snapshot = () => ({
    grants: cloneMap(grants),
    sessions: cloneMap(sessions),
  });

  const restore = (saved: ReturnType<typeof snapshot>) => {
    grants.clear();
    sessions.clear();
    for (const [key, value] of saved.grants) {
      grants.set(key, value);
    }
    for (const [key, value] of saved.sessions) {
      sessions.set(key, value);
    }
  };

  const database = createMemorySsoDatabase(() => ({ grants, users, members }));

  const state: MemorySsoState = {
    get sessionCount() {
      return sessions.size;
    },
    transaction(work) {
      return enqueue(async () => {
        const saved = snapshot();
        setAuthSessionWriterForTests(async (input) => {
          const record = sessionRecord(input);
          sessions.set(record.sessionId, record);
          return record;
        });

        try {
          return await work(database);
        } catch (error) {
          restore(saved);
          throw error;
        } finally {
          setAuthSessionWriterForTests(null);
        }
      });
    },
    exclusive(work) {
      return enqueue(work);
    },
    view: () => database,
    addUser(user) {
      users.set(user.userId, { ...user });
    },
    addMember(member) {
      members.set(member.memberId, { ...member });
    },
    users: () => [...users.values()].map((user) => ({ ...user })),
    members: () => [...members.values()].map((member) => ({ ...member })),
    grants: () => [...grants.values()].map((grant) => ({ ...grant })),
    removeGrantsForAuthor(externalAuthorId) {
      let removed = 0;
      for (const [grantId, grant] of grants) {
        if (grant.externalAuthorId === externalAuthorId) {
          grants.delete(grantId);
          removed += 1;
        }
      }
      return removed;
    },
    sessions: () => [...sessions.values()].map((session) => ({ ...session })),
  };

  return state;
}

export async function runSsoTransaction<T>(
  work: (db: SsoDatabase) => Promise<T>,
): Promise<T> {
  if (memoryState) {
    return memoryState.transaction(work);
  }

  if (!isMongoConfigured()) {
    throw new MongoTransactionUnavailableError();
  }

  return runMongoTransaction((session) => work(createMongoSsoDatabase(session)));
}

export async function withSsoLock<T>(work: () => Promise<T>): Promise<T> {
  if (!memoryState) {
    return work();
  }

  return memoryState.exclusive(work);
}

export function currentSsoDatabase(): SsoDatabase {
  if (memoryState) {
    return memoryState.view();
  }

  return createMongoSsoDatabase();
}

function createMemorySsoDatabase(
  read: () => {
    grants: Map<string, SsoGrantRecord>;
    users: Map<string, AuthUserRecord>;
    members: Map<string, SsoMemberView>;
  },
): SsoDatabase {
  return {
    async findGrantByRequestId(requestId) {
      const grant = [...read().grants.values()].find((entry) => entry.requestId === requestId);
      return grant ? { ...grant } : null;
    },
    async findGrantById(grantId) {
      const grant = read().grants.get(grantId);
      return grant ? { ...grant } : null;
    },
    async insertGrant(record) {
      const tables = read();
      if (
        tables.grants.has(record.grantId) ||
        [...tables.grants.values()].some((entry) => entry.requestId === record.requestId)
      ) {
        return "duplicate";
      }

      tables.grants.set(record.grantId, { ...record });
      return "inserted";
    },
    async consumeGrant(grantId, nowIso) {
      const tables = read();
      const grant = tables.grants.get(grantId);
      if (!grant || grant.consumedAt || grant.expiresAt <= nowIso) {
        return null;
      }

      const consumed = { ...grant, consumedAt: nowIso };
      tables.grants.set(grantId, consumed);
      return consumed;
    },
    async findLink(externalAuthorId) {
      return linkStore().findLinkByAuthor(INTEGRITY_MEDIA_SOURCE, externalAuthorId);
    },
    async findMember(memberId) {
      const member = read().members.get(memberId);
      return member ? { ...member } : null;
    },
    async findUser(userId) {
      const user = read().users.get(userId);
      return user ? { ...user } : null;
    },
  };
}

function createMongoSsoDatabase(session?: ClientSession): SsoDatabase {
  const grants = () =>
    getMongoCollection<SsoGrantRecord>(MONGO_COLLECTIONS.externalAuthorSsoGrants);
  const sessionOptions = session ? { session } : {};

  return {
    clientSession: session,
    async findGrantByRequestId(requestId) {
      await ensureMongo();
      const document = await grants().findOne({ requestId }, sessionOptions);
      return document ? withoutId(document) : null;
    },
    async findGrantById(grantId) {
      await ensureMongo();
      const document = await grants().findOne({ grantId }, sessionOptions);
      return document ? withoutId(document) : null;
    },
    async insertGrant(record) {
      await ensureMongo();

      try {
        await grants().insertOne(record, sessionOptions);
        return "inserted";
      } catch (error) {
        if (isSsoDuplicateKeyError(error)) {
          return "duplicate";
        }

        throw error;
      }
    },
    async consumeGrant(grantId, nowIso) {
      await ensureMongo();
      const document = await grants().findOneAndUpdate(
        { grantId, consumedAt: null, expiresAt: { $gt: nowIso } },
        { $set: { consumedAt: nowIso } },
        { returnDocument: "after", ...sessionOptions },
      );
      return document ? withoutId(document) : null;
    },
    async findLink(externalAuthorId) {
      return linkStore().findLinkByAuthor(INTEGRITY_MEDIA_SOURCE, externalAuthorId, { session });
    },
    async findMember(memberId) {
      const member = await findMemberById(memberId, { session });
      return member ? { memberId: member.memberId, identityId: member.identityId } : null;
    },
    async findUser(userId) {
      return findAuthUserById(userId, { session });
    },
  };
}

function linkStore(): ExternalAuthorLinkStore {
  return getExternalAuthorLinkStore();
}

function sessionRecord(input: CreateAuthSessionInput): AuthSessionRecord {
  return {
    sessionId: input.sessionId ?? randomUUID(),
    userId: input.userId,
    refreshTokenHash: hashRefreshToken(input.refreshToken),
    createdAt: new Date().toISOString(),
    expiresAt: input.expiresAt,
    userAgent: input.userAgent,
  };
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
