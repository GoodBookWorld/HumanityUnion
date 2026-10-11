import { MONGO_COLLECTIONS } from "../../infrastructure/mongodb/mongo-collections.js";
import { getMongoCollection } from "../../infrastructure/mongodb/mongo-database.js";
import type { INTEGRITY_MEDIA_SOURCE } from "./external-author-link.constants.js";
import type {
  ExternalAuthorLinkAuditRecord,
  ExternalAuthorLinkRecord,
  ExternalAuthorLinkResultRecord,
} from "./external-author-link.types.js";

export type ExternalAuthorLinkAdminListState = "all" | "linked" | "disabled" | "setup_pending";

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
  claimNextPendingAuthorActivation(input: {
    source: typeof INTEGRITY_MEDIA_SOURCE;
    nowIso: string;
    eligibleBeforeIso: string;
  }): Promise<ExternalAuthorLinkRecord | null>;
  appendAudit(record: ExternalAuthorLinkAuditRecord): Promise<void>;
  listLinks(): Promise<ExternalAuthorLinkRecord[]>;
  listForAdmin(input: {
    source: typeof INTEGRITY_MEDIA_SOURCE;
    state: ExternalAuthorLinkAdminListState;
    limit: number;
    offset: number;
  }): Promise<{ items: ExternalAuthorLinkRecord[]; total: number }>;
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

    async claimNextPendingAuthorActivation({ source, nowIso, eligibleBeforeIso }) {
      for (const record of byAuthor.values()) {
        if (!isPendingAuthorActivationEligible(record, source, eligibleBeforeIso)) {
          continue;
        }

        record.authorActivationAttemptAt = nowIso;
        record.updatedAt = nowIso;
        return copyLink(record);
      }

      return null;
    },

    async appendAudit(record) {
      audits.push({ ...record });
    },

    async listLinks() {
      return [...byAuthor.values()].map((record) => ({ ...record }));
    },

    async listForAdmin(input) {
      const items = [...byAuthor.values()]
        .filter((record) => matchesAdminLinkList(record, input.source, input.state))
        .sort(compareAdminLinks);
      return {
        total: items.length,
        items: items.slice(input.offset, input.offset + input.limit).map((record) => ({ ...record })),
      };
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
            authorActivationPending: record.authorActivationPending === true,
            authorActivationAttemptAt: record.authorActivationAttemptAt ?? null,
          },
        },
      );

      return result.matchedCount === 0 ? "missing" : "updated";
    },

    async claimNextPendingAuthorActivation({ source, nowIso, eligibleBeforeIso }) {
      const candidate = await links().findOne(
        pendingAuthorActivationFilter(source, eligibleBeforeIso),
        { sort: { updatedAt: 1 } },
      );

      if (!candidate) {
        return null;
      }

      const claimed = await links().findOneAndUpdate(
        {
          ...pendingAuthorActivationFilter(source, eligibleBeforeIso),
          externalAuthorId: candidate.externalAuthorId,
          memberId: candidate.memberId,
        },
        { $set: { authorActivationAttemptAt: nowIso, updatedAt: nowIso } },
        { returnDocument: "after" },
      );

      return claimed ? withoutId(claimed) : null;
    },

    async appendAudit(record) {
      await audits().insertOne(record);
    },

    async listLinks() {
      const documents = await links().find({}).toArray();
      return documents.map((document) => withoutId(document));
    },

    async listForAdmin(input) {
      const filter = adminLinkListFilter(input.source, input.state);
      const collection = links();
      const [total, documents] = await Promise.all([
        collection.countDocuments(filter),
        collection
          .find(filter)
          .sort({ createdAt: -1, memberId: 1 })
          .skip(input.offset)
          .limit(input.limit)
          .toArray(),
      ]);
      return { total, items: documents.map((document) => withoutId(document)) };
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

function pendingAuthorActivationFilter(
  source: typeof INTEGRITY_MEDIA_SOURCE,
  eligibleBeforeIso: string,
) {
  return {
    source,
    state: "linked" as const,
    authorActivationPending: true,
    $or: [
      { authorActivationAttemptAt: null },
      { authorActivationAttemptAt: { $exists: false } },
      { authorActivationAttemptAt: { $lte: eligibleBeforeIso } },
    ],
  };
}

function isPendingAuthorActivationEligible(
  record: ExternalAuthorLinkRecord,
  source: typeof INTEGRITY_MEDIA_SOURCE,
  eligibleBeforeIso: string,
): boolean {
  if (record.source !== source || record.state !== "linked" || record.authorActivationPending !== true) {
    return false;
  }

  const attemptAt = record.authorActivationAttemptAt;
  return attemptAt == null || attemptAt <= eligibleBeforeIso;
}

function matchesAdminLinkList(
  record: ExternalAuthorLinkRecord,
  source: typeof INTEGRITY_MEDIA_SOURCE,
  state: ExternalAuthorLinkAdminListState,
): boolean {
  if (record.source !== source) {
    return false;
  }

  if (state === "disabled") {
    return record.state === "disabled";
  }

  if (state === "setup_pending") {
    return record.state === "linked" && record.authorActivationPending === true;
  }

  if (state === "linked") {
    return record.state === "linked" && record.authorActivationPending !== true;
  }

  return true;
}

function adminLinkListFilter(
  source: typeof INTEGRITY_MEDIA_SOURCE,
  state: ExternalAuthorLinkAdminListState,
): Record<string, unknown> {
  if (state === "disabled") {
    return { source, state: "disabled" };
  }

  if (state === "setup_pending") {
    return { source, state: "linked", authorActivationPending: true };
  }

  if (state === "linked") {
    return {
      source,
      state: "linked",
      authorActivationPending: { $ne: true },
    };
  }

  return { source };
}

function compareAdminLinks(left: ExternalAuthorLinkRecord, right: ExternalAuthorLinkRecord): number {
  const created = right.createdAt.localeCompare(left.createdAt);
  if (created !== 0) {
    return created;
  }

  return left.memberId.localeCompare(right.memberId);
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
