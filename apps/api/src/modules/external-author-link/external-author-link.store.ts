import type { ClientSession, Filter } from "mongodb";

import { runIntegrityMediaLinkCriticalSection } from "../integrity-media-author-messages/integrity-media-author-reply.section.js";

import { MONGO_COLLECTIONS } from "../../infrastructure/mongodb/mongo-collections.js";
import { getMongoCollection } from "../../infrastructure/mongodb/mongo-database.js";
import type { INTEGRITY_MEDIA_SOURCE } from "./external-author-link.constants.js";
import { isOrdinaryIntegrityMediaCollaborationAllowed } from "./external-author-link.collaboration.js";
import { assignedLinkRevision, linkRevisionMatches } from "./external-author-link.revision.js";
import type {
  ExternalAuthorDisconnectEventRecord,
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
    options?: { session?: ClientSession },
  ): Promise<ExternalAuthorLinkRecord | null>;
  /**
   * Re-read the link and, on Mongo, write it only while the reply is still
   * eligible. The stored generation, member, and state stay the same.
   * A concurrent disconnect conflicts with that write.
   */
  holdAuthorReplyLink(input: {
    source: typeof INTEGRITY_MEDIA_SOURCE;
    externalAuthorId: string;
    memberId: string;
    linkRevision: number;
    session?: ClientSession;
  }): Promise<ExternalAuthorLinkRecord | null>;
  findLinkByMember(
    source: typeof INTEGRITY_MEDIA_SOURCE,
    memberId: string,
  ): Promise<ExternalAuthorLinkRecord | null>;
  insertLink(record: ExternalAuthorLinkRecord): Promise<"inserted" | "duplicate">;
  updateLink(record: ExternalAuthorLinkRecord): Promise<"updated" | "missing" | "refused">;
  /**
   * Disable only while the stored generation still equals the expected one.
   * Expected generation 1 also matches a row that has never been assigned.
   * The write and the comparison are one operation.
   */
  compareAndDisableLink(input: {
    source: typeof INTEGRITY_MEDIA_SOURCE;
    externalAuthorId: string;
    memberId: string;
    linkRevision: number;
    nowIso: string;
  }): Promise<"disabled" | "stale" | "missing">;
  claimNextPendingAuthorActivation(input: {
    source: typeof INTEGRITY_MEDIA_SOURCE;
    nowIso: string;
    eligibleBeforeIso: string;
  }): Promise<ExternalAuthorLinkRecord | null>;
  appendAudit(record: ExternalAuthorLinkAuditRecord): Promise<void>;
  findDisconnectEvent(eventId: string): Promise<ExternalAuthorDisconnectEventRecord | null>;
  insertDisconnectEvent(
    record: ExternalAuthorDisconnectEventRecord,
  ): Promise<"inserted" | "duplicate">;
  listDisconnectEvents(): Promise<ExternalAuthorDisconnectEventRecord[]>;
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
  const disconnectEvents = new Map<string, ExternalAuthorDisconnectEventRecord>();
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

    async compareAndDisableLink(input) {
      return runIntegrityMediaLinkCriticalSection(async () => {
        const authorKey = linkKey(input.source, input.externalAuthorId);
        const current = byAuthor.get(authorKey);
        if (!current || current.memberId !== input.memberId) {
          return "missing" as const;
        }

        if (!linkRevisionMatches(current.linkRevision, input.linkRevision)) {
          return "stale" as const;
        }

        const stored: ExternalAuthorLinkRecord = {
          ...current,
          state: "disabled",
          linkRevision: input.linkRevision,
          disconnectedAt: input.nowIso,
          updatedAt: input.nowIso,
        };
        byAuthor.set(authorKey, stored);
        byMember.set(linkKey(input.source, input.memberId), stored);
        return "disabled" as const;
      });
    },

    async holdAuthorReplyLink(input) {
      const authorKey = linkKey(input.source, input.externalAuthorId);
      const current = byAuthor.get(authorKey);
      if (!current || !authorReplyLinkIsEligible(current, input)) {
        return null;
      }

      return copyLink(current);
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

    async findDisconnectEvent(eventId) {
      const found = disconnectEvents.get(eventId);
      return found ? { ...found } : null;
    },

    async insertDisconnectEvent(record) {
      if (disconnectEvents.has(record.eventId)) {
        return "duplicate";
      }

      disconnectEvents.set(record.eventId, { ...record });
      return "inserted";
    },

    async listDisconnectEvents() {
      return [...disconnectEvents.values()].map((record) => ({ ...record }));
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
  const disconnectEvents = () =>
    getMongoCollection<ExternalAuthorDisconnectEventRecord>(
      MONGO_COLLECTIONS.externalAuthorDisconnectEvents,
    );

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

    async findLinkByAuthor(source, externalAuthorId, options) {
      const document = await links().findOne(
        { source, externalAuthorId },
        options?.session ? { session: options.session } : {},
      );
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
          $set: linkUpdateFields(record),
        },
      );

      return result.matchedCount === 0 ? "missing" : "updated";
    },

    async compareAndDisableLink(input) {
      return runIntegrityMediaLinkCriticalSection(async () => {
        const existing = await links().findOne({
          source: input.source,
          externalAuthorId: input.externalAuthorId,
          memberId: input.memberId,
        });
        if (!existing) {
          return "missing" as const;
        }

        const updated = await links().findOneAndUpdate(
          {
            source: input.source,
            externalAuthorId: input.externalAuthorId,
            memberId: input.memberId,
            ...integrityMediaDisconnectRevisionFilter(input.linkRevision),
          },
          {
            $set: {
              state: "disabled",
              linkRevision: input.linkRevision,
              disconnectedAt: input.nowIso,
              updatedAt: input.nowIso,
            },
          },
          { returnDocument: "after" },
        );

        return updated ? ("disabled" as const) : ("stale" as const);
      });
    },

    async holdAuthorReplyLink(input) {
      const updated = await links().findOneAndUpdate(
        authorReplyLinkFilter(input),
        [{ $set: { updatedAt: "$updatedAt" } }],
        {
          returnDocument: "after",
          ...(input.session ? { session: input.session } : {}),
        },
      );
      return updated ? withoutId(updated) : null;
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

    async findDisconnectEvent(eventId) {
      const document = await disconnectEvents().findOne({ eventId });
      return document ? withoutId(document) : null;
    },

    async insertDisconnectEvent(record) {
      try {
        await disconnectEvents().insertOne(record);
        return "inserted";
      } catch (error) {
        if (isDuplicateKeyError(error)) {
          return "duplicate";
        }

        throw error;
      }
    },

    async listDisconnectEvents() {
      const documents = await disconnectEvents().find({}).toArray();
      return documents.map((document) => withoutId(document));
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

export function externalAuthorLinkStoreUsesOverride(): boolean {
  return storeOverride !== null;
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

export function integrityMediaDisconnectRevisionFilter(
  linkRevision: number,
): Filter<ExternalAuthorLinkRecord> {
  if (linkRevision === 1) {
    return {
      $or: [
        { linkRevision: 1 },
        { linkRevision: { $exists: false } },
        { linkRevision: { $type: "null" } },
      ],
    };
  }

  return { linkRevision };
}

function linkUpdateFields(record: ExternalAuthorLinkRecord): {
  state: ExternalAuthorLinkRecord["state"];
  updatedAt: string;
  confirmedAt: string;
  disconnectedAt: string | null;
  authorActivationPending: boolean;
  authorActivationAttemptAt: string | null;
  collaborationStatus?: ExternalAuthorLinkRecord["collaborationStatus"];
  linkRevision?: number;
} {
  return {
    state: record.state,
    updatedAt: record.updatedAt,
    confirmedAt: record.confirmedAt,
    disconnectedAt: record.disconnectedAt,
    authorActivationPending: record.authorActivationPending === true,
    authorActivationAttemptAt: record.authorActivationAttemptAt ?? null,
    ...(record.collaborationStatus ? { collaborationStatus: record.collaborationStatus } : {}),
    ...(typeof record.linkRevision === "number" &&
    Number.isInteger(record.linkRevision) &&
    record.linkRevision >= 1
      ? { linkRevision: record.linkRevision }
      : {}),
  };
}

function authorReplyLinkIsEligible(
  link: ExternalAuthorLinkRecord,
  input: { memberId: string; linkRevision: number },
): boolean {
  return (
    link.memberId === input.memberId &&
    link.state === "linked" &&
    assignedLinkRevision(link.linkRevision) === input.linkRevision &&
    isOrdinaryIntegrityMediaCollaborationAllowed(link)
  );
}

function authorReplyLinkFilter(input: {
  source: typeof INTEGRITY_MEDIA_SOURCE;
  externalAuthorId: string;
  memberId: string;
  linkRevision: number;
}): Filter<ExternalAuthorLinkRecord> {
  return {
    source: input.source,
    externalAuthorId: input.externalAuthorId,
    memberId: input.memberId,
    state: "linked",
    linkRevision: input.linkRevision,
    authorActivationPending: { $ne: true },
    $or: [
      { collaborationStatus: "active" },
      { collaborationStatus: { $exists: false } },
      { collaborationStatus: { $type: "null" } },
    ],
  };
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
