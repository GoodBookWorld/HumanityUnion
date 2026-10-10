import { MONGO_COLLECTIONS } from "../../infrastructure/mongodb/mongo-collections.js";
import { getMongoCollection } from "../../infrastructure/mongodb/mongo-database.js";
import type { INTEGRITY_MEDIA_SOURCE } from "./external-author-link.constants.js";
import type {
  ExternalAuthorLinkAuditRecord,
  ExternalAuthorLinkRecord,
  ExternalAuthorLinkResultRecord,
} from "./external-author-link.types.js";

export type ClaimExternalAuthorLinkResult =
  | { status: "claimed"; record: ExternalAuthorLinkResultRecord }
  | { status: "missing" }
  | { status: "consumed" }
  | { status: "expired" };

export interface ExternalAuthorLinkStore {
  insertResult(record: ExternalAuthorLinkResultRecord): Promise<void>;
  claimResult(resultCode: string, nowIso: string): Promise<ClaimExternalAuthorLinkResult>;
  findLinkByAuthor(
    source: typeof INTEGRITY_MEDIA_SOURCE,
    externalAuthorId: string,
  ): Promise<ExternalAuthorLinkRecord | null>;
  findLinkByMember(
    source: typeof INTEGRITY_MEDIA_SOURCE,
    memberId: string,
  ): Promise<ExternalAuthorLinkRecord | null>;
  insertLink(record: ExternalAuthorLinkRecord): Promise<"inserted" | "duplicate">;
  updateLink(record: ExternalAuthorLinkRecord): Promise<"updated" | "missing" | "refused">;
  appendAudit(record: ExternalAuthorLinkAuditRecord): Promise<void>;
  listLinks(): Promise<ExternalAuthorLinkRecord[]>;
  listResults(): Promise<ExternalAuthorLinkResultRecord[]>;
  listAudits(): Promise<ExternalAuthorLinkAuditRecord[]>;
}

export function createMemoryExternalAuthorLinkStore(): ExternalAuthorLinkStore {
  const results = new Map<string, ExternalAuthorLinkResultRecord>();
  const byAuthor = new Map<string, ExternalAuthorLinkRecord>();
  const byMember = new Map<string, ExternalAuthorLinkRecord>();
  const audits: ExternalAuthorLinkAuditRecord[] = [];

  return {
    async insertResult(record) {
      if (results.has(record.resultCode)) {
        throw new Error("Duplicate external author link result code.");
      }

      results.set(record.resultCode, { ...record });
    },

    async claimResult(resultCode, nowIso) {
      const current = results.get(resultCode);

      if (!current) {
        return { status: "missing" };
      }

      if (current.consumedAt) {
        return { status: "consumed" };
      }

      if (current.expiresAt <= nowIso) {
        current.consumedAt = nowIso;
        return { status: "expired" };
      }

      const claimed = { ...current };
      current.consumedAt = nowIso;
      return { status: "claimed", record: claimed };
    },

    async findLinkByAuthor(source, externalAuthorId) {
      return copyLink(byAuthor.get(linkKey(source, externalAuthorId)));
    },

    async findLinkByMember(source, memberId) {
      return copyLink(byMember.get(linkKey(source, memberId)));
    },

    async insertLink(record) {
      const authorKey = linkKey(record.source, record.externalAuthorId);
      const memberKey = linkKey(record.source, record.memberId);

      if (byAuthor.has(authorKey) || byMember.has(memberKey)) {
        return "duplicate";
      }

      const stored = { ...record };
      byAuthor.set(authorKey, stored);
      byMember.set(memberKey, stored);
      return "inserted";
    },

    async updateLink(record) {
      const authorKey = linkKey(record.source, record.externalAuthorId);
      const existing = byAuthor.get(authorKey);

      if (!existing) {
        return "missing";
      }

      if (
        existing.memberId !== record.memberId ||
        existing.externalAuthorId !== record.externalAuthorId ||
        existing.source !== record.source
      ) {
        return "refused";
      }

      const stored = { ...record };
      byAuthor.set(authorKey, stored);
      byMember.set(linkKey(record.source, record.memberId), stored);
      return "updated";
    },

    async appendAudit(record) {
      audits.push({ ...record });
    },

    async listLinks() {
      return [...byAuthor.values()].map((record) => ({ ...record }));
    },

    async listResults() {
      return [...results.values()].map((record) => ({ ...record }));
    },

    async listAudits() {
      return audits.map((record) => ({ ...record }));
    },
  };
}

export function createMongoExternalAuthorLinkStore(): ExternalAuthorLinkStore {
  const links = () =>
    getMongoCollection<ExternalAuthorLinkRecord>(MONGO_COLLECTIONS.externalAuthorLinks);
  const results = () =>
    getMongoCollection<ExternalAuthorLinkResultRecord>(MONGO_COLLECTIONS.externalAuthorLinkResults);
  const audits = () =>
    getMongoCollection<ExternalAuthorLinkAuditRecord>(MONGO_COLLECTIONS.externalAuthorLinkAudit);

  return {
    async insertResult(record) {
      await results().insertOne(record);
    },

    async claimResult(resultCode, nowIso) {
      const claimed = await results().findOneAndUpdate(
        { resultCode, consumedAt: null, expiresAt: { $gt: nowIso } },
        { $set: { consumedAt: nowIso } },
        { returnDocument: "before" },
      );

      if (claimed) {
        return { status: "claimed", record: withoutId(claimed) };
      }

      const existing = await results().findOne({ resultCode });

      if (!existing) {
        return { status: "missing" };
      }

      if (!existing.consumedAt && existing.expiresAt <= nowIso) {
        await results().updateOne(
          { resultCode, consumedAt: null },
          { $set: { consumedAt: nowIso } },
        );
        return { status: "expired" };
      }

      return { status: "consumed" };
    },

    async findLinkByAuthor(source, externalAuthorId) {
      const document = await links().findOne({ source, externalAuthorId });
      return document ? withoutId(document) : null;
    },

    async findLinkByMember(source, memberId) {
      const document = await links().findOne({ source, memberId });
      return document ? withoutId(document) : null;
    },

    async insertLink(record) {
      try {
        await links().insertOne(record);
        return "inserted";
      } catch (error) {
        if (isDuplicateKeyError(error)) {
          return "duplicate";
        }

        throw error;
      }
    },

    async updateLink(record) {
      const result = await links().updateOne(
        {
          source: record.source,
          externalAuthorId: record.externalAuthorId,
          memberId: record.memberId,
        },
        {
          $set: {
            state: record.state,
            updatedAt: record.updatedAt,
            confirmedAt: record.confirmedAt,
            disconnectedAt: record.disconnectedAt,
          },
        },
      );

      return result.matchedCount === 0 ? "missing" : "updated";
    },

    async appendAudit(record) {
      await audits().insertOne(record);
    },

    async listLinks() {
      const documents = await links().find({}).toArray();
      return documents.map((document) => withoutId(document));
    },

    async listResults() {
      const documents = await results().find({}).toArray();
      return documents.map((document) => withoutId(document));
    },

    async listAudits() {
      const documents = await audits().find({}).toArray();
      return documents.map((document) => withoutId(document));
    },
  };
}

let storeOverride: ExternalAuthorLinkStore | null = null;
let storeSingleton: ExternalAuthorLinkStore | null = null;

export function setExternalAuthorLinkStoreForTests(store: ExternalAuthorLinkStore | null): void {
  storeOverride = store;
}

export function getExternalAuthorLinkStore(): ExternalAuthorLinkStore {
  if (storeOverride) {
    return storeOverride;
  }

  if (!storeSingleton) {
    storeSingleton = process.env.MONGODB_URI?.trim()
      ? createMongoExternalAuthorLinkStore()
      : createMemoryExternalAuthorLinkStore();
  }

  return storeSingleton;
}

function linkKey(source: string, id: string): string {
  return `${source}\0${id}`;
}

function copyLink(record: ExternalAuthorLinkRecord | undefined): ExternalAuthorLinkRecord | null {
  return record ? { ...record } : null;
}

function withoutId<T extends object>(document: T & { _id?: unknown }): T {
  const copy = { ...document };
  delete (copy as { _id?: unknown })._id;
  return copy;
}

function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === 11000
  );
}
