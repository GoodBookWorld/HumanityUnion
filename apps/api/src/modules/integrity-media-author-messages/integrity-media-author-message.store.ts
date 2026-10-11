import { MONGO_COLLECTIONS } from "../../infrastructure/mongodb/mongo-collections.js";
import { getMongoCollection } from "../../infrastructure/mongodb/mongo-database.js";
import type { IntegrityMediaAuthorMessageErrorCode } from "./integrity-media-author-message.constants.js";
import type {
  IntegrityMediaAuthorLatestMessageView,
  IntegrityMediaAuthorMessageAuditRecord,
  IntegrityMediaAuthorMessageRecord,
} from "./integrity-media-author-message.types.js";

export interface IntegrityMediaAuthorMessageRecipientSummary {
  messageCount: number;
  latest: IntegrityMediaAuthorLatestMessageView | null;
}

export interface IntegrityMediaAuthorMessageClaimInput {
  nowIso: string;
  backoffIso: string;
  messageId?: string;
}

export interface IntegrityMediaAuthorMessageStore {
  insert(
    record: IntegrityMediaAuthorMessageRecord,
  ): Promise<"inserted" | "duplicate">;
  findByMessageId(messageId: string): Promise<IntegrityMediaAuthorMessageRecord | null>;
  claimNext(
    input: IntegrityMediaAuthorMessageClaimInput,
  ): Promise<IntegrityMediaAuthorMessageRecord | null>;
  markDelivered(input: {
    messageId: string;
    nowIso: string;
  }): Promise<IntegrityMediaAuthorMessageRecord | null>;
  markFailed(input: {
    messageId: string;
    nowIso: string;
    errorCode: IntegrityMediaAuthorMessageErrorCode;
  }): Promise<IntegrityMediaAuthorMessageRecord | null>;
  markTransient(input: {
    messageId: string;
    nowIso: string;
    errorCode: IntegrityMediaAuthorMessageErrorCode;
  }): Promise<IntegrityMediaAuthorMessageRecord | null>;
  list(): Promise<IntegrityMediaAuthorMessageRecord[]>;
  summarizeForRecipients(
    recipientMemberIds: readonly string[],
  ): Promise<Map<string, IntegrityMediaAuthorMessageRecipientSummary>>;
  appendAudit(record: IntegrityMediaAuthorMessageAuditRecord): Promise<void>;
  listAudits(): Promise<IntegrityMediaAuthorMessageAuditRecord[]>;
}

export function createMemoryIntegrityMediaAuthorMessageStore(): IntegrityMediaAuthorMessageStore {
  const messages = new Map<string, IntegrityMediaAuthorMessageRecord>();
  const audits: IntegrityMediaAuthorMessageAuditRecord[] = [];

  return {
    async insert(record) {
      if (messages.has(record.messageId)) {
        return "duplicate";
      }

      messages.set(record.messageId, { ...record, cta: copyCta(record.cta) });
      return "inserted";
    },

    async findByMessageId(messageId) {
      return copyMessage(messages.get(messageId));
    },

    async claimNext(input) {
      return copyMessage(claimPendingMessage(messages, input));
    },

    async markDelivered(input) {
      return copyMessage(
        transitionMessage(messages, input.messageId, (current) => {
          current.status = "delivered";
          current.deliveredAt = input.nowIso;
          current.lastErrorCode = null;
          current.nextAttemptAt = null;
          current.updatedAt = input.nowIso;
        }),
      );
    },

    async markFailed(input) {
      return copyMessage(
        transitionMessage(messages, input.messageId, (current) => {
          current.status = "failed";
          current.lastErrorCode = input.errorCode;
          current.nextAttemptAt = null;
          current.updatedAt = input.nowIso;
        }),
      );
    },

    async markTransient(input) {
      return copyMessage(
        transitionMessage(messages, input.messageId, (current) => {
          current.lastErrorCode = input.errorCode;
          current.updatedAt = input.nowIso;
        }),
      );
    },

    async list() {
      return [...messages.values()].map((record) => copyMessage(record)!);
    },

    async summarizeForRecipients(recipientMemberIds) {
      return summarizeMessages([...messages.values()], recipientMemberIds);
    },

    async appendAudit(record) {
      audits.push({ ...record });
    },

    async listAudits() {
      return audits.map((record) => ({ ...record }));
    },
  };
}

export function createMongoIntegrityMediaAuthorMessageStore(): IntegrityMediaAuthorMessageStore {
  const messages = () =>
    getMongoCollection<IntegrityMediaAuthorMessageRecord>(
      MONGO_COLLECTIONS.integrityMediaAuthorMessages,
    );
  const audits = () =>
    getMongoCollection<IntegrityMediaAuthorMessageAuditRecord>(
      MONGO_COLLECTIONS.integrityMediaAuthorMessageAudit,
    );

  return {
    async insert(record) {
      try {
        await messages().insertOne(record);
        return "inserted";
      } catch (error) {
        if (isDuplicateKeyError(error)) {
          return "duplicate";
        }

        throw error;
      }
    },

    async findByMessageId(messageId) {
      const document = await messages().findOne({ messageId });
      return document ? withoutId(document) : null;
    },

    async claimNext(input) {
      const eligibility = pendingEligibility(input.nowIso);
      const filter = input.messageId
        ? { messageId: input.messageId, ...eligibility }
        : eligibility;
      const candidate = await messages().findOne(filter, { sort: { createdAt: 1 } });

      if (!candidate) {
        return null;
      }

      const claimed = await messages().findOneAndUpdate(
        { messageId: candidate.messageId, ...eligibility },
        {
          $set: {
            lastAttemptAt: input.nowIso,
            nextAttemptAt: input.backoffIso,
            updatedAt: input.nowIso,
          },
          $inc: { attemptCount: 1 },
        },
        { returnDocument: "after" },
      );

      return claimed ? withoutId(claimed) : null;
    },

    async markDelivered(input) {
      const updated = await messages().findOneAndUpdate(
        { messageId: input.messageId, status: "pending" },
        {
          $set: {
            status: "delivered",
            deliveredAt: input.nowIso,
            lastErrorCode: null,
            nextAttemptAt: null,
            updatedAt: input.nowIso,
          },
        },
        { returnDocument: "after" },
      );

      return updated ? withoutId(updated) : null;
    },

    async markFailed(input) {
      const updated = await messages().findOneAndUpdate(
        { messageId: input.messageId, status: "pending" },
        {
          $set: {
            status: "failed",
            lastErrorCode: input.errorCode,
            nextAttemptAt: null,
            updatedAt: input.nowIso,
          },
        },
        { returnDocument: "after" },
      );

      return updated ? withoutId(updated) : null;
    },

    async markTransient(input) {
      const updated = await messages().findOneAndUpdate(
        { messageId: input.messageId, status: "pending" },
        {
          $set: {
            lastErrorCode: input.errorCode,
            updatedAt: input.nowIso,
          },
        },
        { returnDocument: "after" },
      );

      return updated ? withoutId(updated) : null;
    },

    async list() {
      const documents = await messages().find({}).toArray();
      return documents.map((document) => withoutId(document));
    },

    async summarizeForRecipients(recipientMemberIds) {
      const ids = [...new Set(recipientMemberIds.filter((id) => id.trim().length > 0))];
      if (ids.length === 0) {
        return new Map();
      }

      const documents = await messages()
        .aggregate<IntegrityMediaAuthorMessageSummaryDocument>([
          { $match: { recipientMemberId: { $in: ids } } },
          {
            $project: {
              recipientMemberId: 1,
              messageId: 1,
              title: 1,
              status: 1,
              lastErrorCode: 1,
              createdAt: 1,
              deliveredAt: 1,
            },
          },
          { $sort: { createdAt: -1, messageId: -1 } },
          {
            $group: {
              _id: "$recipientMemberId",
              messageCount: { $sum: 1 },
              messageId: { $first: "$messageId" },
              title: { $first: "$title" },
              status: { $first: "$status" },
              lastErrorCode: { $first: "$lastErrorCode" },
              createdAt: { $first: "$createdAt" },
              deliveredAt: { $first: "$deliveredAt" },
            },
          },
        ])
        .toArray();

      return new Map(
        documents.map((document) => [
          document._id,
          {
            messageCount: document.messageCount,
            latest: {
              messageId: document.messageId,
              title: document.title,
              status: document.status,
              lastErrorCode: document.lastErrorCode,
              createdAt: document.createdAt,
              deliveredAt: document.deliveredAt,
            },
          },
        ]),
      );
    },

    async appendAudit(record) {
      await audits().insertOne(record);
    },

    async listAudits() {
      const documents = await audits().find({}).toArray();
      return documents.map((document) => withoutId(document));
    },
  };
}

let storeOverride: IntegrityMediaAuthorMessageStore | null = null;
let storeSingleton: IntegrityMediaAuthorMessageStore | null = null;

export function setIntegrityMediaAuthorMessageStoreForTests(
  store: IntegrityMediaAuthorMessageStore | null,
): void {
  storeOverride = store;
}

export function getIntegrityMediaAuthorMessageStore(): IntegrityMediaAuthorMessageStore {
  if (storeOverride) {
    return storeOverride;
  }

  if (!storeSingleton) {
    storeSingleton = process.env.MONGODB_URI?.trim()
      ? createMongoIntegrityMediaAuthorMessageStore()
      : createMemoryIntegrityMediaAuthorMessageStore();
  }

  return storeSingleton;
}

/**
 * Synchronous eligibility update. Overlapping in-process claims cannot both
 * observe the same pending row as available.
 */
function claimPendingMessage(
  messages: Map<string, IntegrityMediaAuthorMessageRecord>,
  input: IntegrityMediaAuthorMessageClaimInput,
): IntegrityMediaAuthorMessageRecord | null {
  const eligible = [...messages.values()]
    .filter((record) => isPendingEligible(record, input))
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  const current = eligible[0];

  if (!current) {
    return null;
  }

  current.lastAttemptAt = input.nowIso;
  current.nextAttemptAt = input.backoffIso;
  current.updatedAt = input.nowIso;
  current.attemptCount += 1;
  return current;
}

function isPendingEligible(
  record: IntegrityMediaAuthorMessageRecord,
  input: IntegrityMediaAuthorMessageClaimInput,
): boolean {
  if (record.status !== "pending") {
    return false;
  }

  if (input.messageId && record.messageId !== input.messageId) {
    return false;
  }

  return record.nextAttemptAt === null || record.nextAttemptAt <= input.nowIso;
}

function transitionMessage(
  messages: Map<string, IntegrityMediaAuthorMessageRecord>,
  messageId: string,
  apply: (current: IntegrityMediaAuthorMessageRecord) => void,
): IntegrityMediaAuthorMessageRecord | null {
  const current = messages.get(messageId);

  if (!current || current.status !== "pending") {
    return null;
  }

  apply(current);
  return current;
}

function pendingEligibility(nowIso: string) {
  return {
    status: "pending" as const,
    $or: [{ nextAttemptAt: null }, { nextAttemptAt: { $lte: nowIso } }],
  };
}

interface IntegrityMediaAuthorMessageSummaryDocument {
  _id: string;
  messageCount: number;
  messageId: string;
  title: string;
  status: IntegrityMediaAuthorMessageRecord["status"];
  lastErrorCode: IntegrityMediaAuthorMessageErrorCode | null;
  createdAt: string;
  deliveredAt: string | null;
}

function summarizeMessages(
  records: readonly IntegrityMediaAuthorMessageRecord[],
  recipientMemberIds: readonly string[],
): Map<string, IntegrityMediaAuthorMessageRecipientSummary> {
  const ids = new Set(recipientMemberIds.filter((id) => id.trim().length > 0));
  const grouped = new Map<string, IntegrityMediaAuthorMessageRecord[]>();

  for (const record of records) {
    if (!ids.has(record.recipientMemberId)) {
      continue;
    }

    const current = grouped.get(record.recipientMemberId) ?? [];
    current.push(record);
    grouped.set(record.recipientMemberId, current);
  }

  const summaries = new Map<string, IntegrityMediaAuthorMessageRecipientSummary>();

  for (const [recipientMemberId, group] of grouped) {
    const latest = [...group].sort((left, right) => {
      const created = right.createdAt.localeCompare(left.createdAt);
      if (created !== 0) {
        return created;
      }

      return right.messageId.localeCompare(left.messageId);
    })[0];

    summaries.set(recipientMemberId, {
      messageCount: group.length,
      latest: latest
        ? {
            messageId: latest.messageId,
            title: latest.title,
            status: latest.status,
            lastErrorCode: latest.lastErrorCode,
            createdAt: latest.createdAt,
            deliveredAt: latest.deliveredAt,
          }
        : null,
    });
  }

  return summaries;
}

function copyCta(
  cta: IntegrityMediaAuthorMessageRecord["cta"],
): IntegrityMediaAuthorMessageRecord["cta"] {
  return cta ? { label: cta.label, url: cta.url } : null;
}

function copyMessage(
  record: IntegrityMediaAuthorMessageRecord | null | undefined,
): IntegrityMediaAuthorMessageRecord | null {
  if (!record) {
    return null;
  }

  return { ...record, cta: copyCta(record.cta) };
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
