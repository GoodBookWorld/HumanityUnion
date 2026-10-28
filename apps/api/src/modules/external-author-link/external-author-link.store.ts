import type { ClientSession, Filter } from "mongodb";

import { runIntegrityMediaLinkCriticalSection } from "../integrity-media-author-messages/integrity-media-author-reply.section.js";

import { isExplicitIsolatedMongoTest } from "../../infrastructure/mongodb/explicit-isolated-mongo-test.js";
import { MONGO_COLLECTIONS } from "../../infrastructure/mongodb/mongo-collections.js";
import { getMongoCollection } from "../../infrastructure/mongodb/mongo-database.js";
import { runMongoTransaction } from "../../infrastructure/mongodb/mongo-transaction.js";
import {
  executeBindingRecovery,
  resolveAbortedBindingRecovery,
  type BindingRecoveryApplyInput,
  type BindingRecoveryApplyResult,
  type BindingRecoveryPersistence,
} from "./external-author-link.binding-recovery.js";
import { INTEGRITY_MEDIA_SOURCE } from "./external-author-link.constants.js";
import { isOrdinaryIntegrityMediaCollaborationAllowed } from "./external-author-link.collaboration.js";
import { assignedLinkRevision, linkRevisionMatches } from "./external-author-link.revision.js";
import type {
  ExternalAuthorDisconnectEventRecord,
  ExternalAuthorLinkAuditRecord,
  ExternalAuthorLinkRecord,
  ExternalAuthorLinkRecoveryReceiptRecord,
  ExternalAuthorLinkResultRecord,
} from "./external-author-link.types.js";

export type ExternalAuthorLinkAdminListState = "all" | "linked" | "disabled" | "setup_pending";

export type ClaimExternalAuthorLinkResult =
  | { status: "claimed"; record: ExternalAuthorLinkResultRecord }
  | { status: "missing" }
  | { status: "consumed" }
  | { status: "expired" };

export interface ExternalAuthorLinkStore {
  insertResult(
    record: ExternalAuthorLinkResultRecord,
    options?: { session?: ClientSession },
  ): Promise<void>;
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
    options?: { session?: ClientSession },
  ): Promise<ExternalAuthorLinkRecord | null>;
  insertLink(
    record: ExternalAuthorLinkRecord,
    options?: { session?: ClientSession },
  ): Promise<"inserted" | "duplicate">;
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
  /**
   * Move one linked provisional instance to confirmed, or report that the
   * same linked instance is already confirmed. A disabled row is unchanged.
   */
  compareAndConfirmLink(input: {
    source: typeof INTEGRITY_MEDIA_SOURCE;
    externalAuthorId: string;
    memberId: string;
    linkRevision: number;
    linkInstanceId: string;
    nowIso: string;
  }): Promise<
    | { status: "confirmed"; record: ExternalAuthorLinkRecord }
    | { status: "already_confirmed"; record: ExternalAuthorLinkRecord }
    | { status: "missing" }
    | { status: "mismatch" }
    | { status: "legacy" }
    | { status: "disabled" }
  >;
  /**
   * Run `work` only while this member still holds the author's linked,
   * non-provisional row. On Mongo the row is changed in the same transaction
   * as `work`, so a concurrent rebind or disconnect of that row cannot commit
   * between the check and `work`'s writes.
   */
  runWithBoundAuthorLink<T>(
    input: {
      source: typeof INTEGRITY_MEDIA_SOURCE;
      externalAuthorId: string;
      memberId: string;
    },
    work: (session: ClientSession | null) => Promise<T>,
  ): Promise<{ status: "bound"; value: T } | { status: "changed" }>;
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
  listForAdminByMemberIds(input: {
    source: typeof INTEGRITY_MEDIA_SOURCE;
    memberIds: readonly string[];
    limit: number;
    offset: number;
  }): Promise<{ items: ExternalAuthorLinkRecord[]; total: number }>;
  listResults(): Promise<ExternalAuthorLinkResultRecord[]>;
  listAudits(): Promise<ExternalAuthorLinkAuditRecord[]>;
  /** Read only. Does not claim, reserve, or consume. */
  findResult(resultCode: string): Promise<ExternalAuthorLinkResultRecord | null>;
  /** Read only, outside any recovery transaction. */
  findBindingRecoveryReceipt(
    recoveryId: string,
  ): Promise<ExternalAuthorLinkRecoveryReceiptRecord | null>;
  /**
   * Rebind one confirmed link to the participant of a confirmation result.
   * On Mongo every recovery write runs in one transaction. There is no
   * session-less fallback.
   */
  applyBindingRecovery(input: BindingRecoveryApplyInput): Promise<BindingRecoveryApplyResult>;
  listBindingRecoveryReceipts(): Promise<ExternalAuthorLinkRecoveryReceiptRecord[]>;
}

export function createMemoryExternalAuthorLinkStore(): ExternalAuthorLinkStore {
  const results = new Map<string, ExternalAuthorLinkResultRecord>();
  const disconnectEvents = new Map<string, ExternalAuthorDisconnectEventRecord>();
  const byAuthor = new Map<string, ExternalAuthorLinkRecord>();
  const byMember = new Map<string, ExternalAuthorLinkRecord>();
  const audits: ExternalAuthorLinkAuditRecord[] = [];
  const recoveryReceipts = new Map<string, ExternalAuthorLinkRecoveryReceiptRecord>();

  const recoveryPersistence: BindingRecoveryPersistence = {
    async findReceipt(recoveryId) {
      const found = recoveryReceipts.get(recoveryId);
      return found ? copyReceipt(found) : null;
    },

    async insertReceipt(record) {
      if (recoveryReceipts.has(record.recoveryId)) {
        return "duplicate";
      }

      recoveryReceipts.set(record.recoveryId, copyReceipt(record));
      return "inserted";
    },

    async replaceReceipt(record) {
      recoveryReceipts.set(record.recoveryId, copyReceipt(record));
    },

    async findLinkByAuthor(externalAuthorId) {
      return copyLink(byAuthor.get(linkKey(INTEGRITY_MEDIA_SOURCE, externalAuthorId)));
    },

    async findLinkByMember(memberId) {
      return copyLink(byMember.get(linkKey(INTEGRITY_MEDIA_SOURCE, memberId)));
    },

    async findResult(resultCode) {
      const found = results.get(resultCode);
      return found ? { ...found } : null;
    },

    async reserveResult(resultCode, reservationId) {
      const current = results.get(resultCode);
      if (!current || current.consumedAt || current.bindingRecoveryReservationId !== undefined) {
        return false;
      }

      current.bindingRecoveryReservationId = reservationId;
      return true;
    },

    async releaseResult(resultCode, reservationId) {
      const current = results.get(resultCode);
      if (current && !current.consumedAt && current.bindingRecoveryReservationId === reservationId) {
        delete current.bindingRecoveryReservationId;
      }
    },

    async consumeResult(resultCode, reservationId, nowIso) {
      const current = results.get(resultCode);
      if (!current || current.consumedAt || current.bindingRecoveryReservationId !== reservationId) {
        return false;
      }

      current.consumedAt = nowIso;
      return true;
    },

    async rebind(input) {
      const authorKey = linkKey(INTEGRITY_MEDIA_SOURCE, input.externalAuthorId);
      const current = byAuthor.get(authorKey);
      if (
        !current ||
        current.memberId !== input.historicalMemberId ||
        current.linkRevision !== input.historicalLinkRevision ||
        current.linkInstanceId !== input.historicalLinkInstanceId ||
        current.state !== "linked" ||
        current.linkFinalization !== "confirmed" ||
        (current.bindingRecoveryId !== undefined && current.bindingRecoveryId !== input.recoveryId)
      ) {
        return "stale";
      }

      const replacementKey = linkKey(INTEGRITY_MEDIA_SOURCE, input.set.memberId);
      const occupant = byMember.get(replacementKey);
      if (occupant && occupant.externalAuthorId !== input.externalAuthorId) {
        return "member_taken";
      }

      const stored: ExternalAuthorLinkRecord = { ...current, ...input.set };
      byMember.delete(linkKey(INTEGRITY_MEDIA_SOURCE, current.memberId));
      byAuthor.set(authorKey, stored);
      byMember.set(replacementKey, stored);
      return "rebound";
    },

    async findRecoveryAudit(recoveryId) {
      const found = audits.find(
        (record) => record.action === "link_binding_recovered" && record.recoveryId === recoveryId,
      );
      return found ? { ...found } : null;
    },

    async insertAudit(record) {
      audits.push({ ...record });
    },
  };

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

      if (
        current.consumedAt ||
        current.bindingRecoveryReservationId !== undefined ||
        current.purpose !== undefined
      ) {
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

    async compareAndConfirmLink(input) {
      return runIntegrityMediaLinkCriticalSection(async () => {
        const authorKey = linkKey(input.source, input.externalAuthorId);
        const current = byAuthor.get(authorKey);
        if (!current) {
          return { status: "missing" as const };
        }

        const decision = classifyConfirmCandidate(current, input);
        if (decision !== "provisional") {
          return decision === "already_confirmed"
            ? { status: "already_confirmed" as const, record: copyLink(current)! }
            : { status: decision };
        }

        const stored: ExternalAuthorLinkRecord = {
          ...current,
          linkFinalization: "confirmed",
          updatedAt: input.nowIso,
        };
        byAuthor.set(authorKey, stored);
        byMember.set(linkKey(input.source, input.memberId), stored);
        return { status: "confirmed" as const, record: copyLink(stored)! };
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

    async runWithBoundAuthorLink(input, work) {
      return runIntegrityMediaLinkCriticalSection(async () => {
        const current = byAuthor.get(linkKey(input.source, input.externalAuthorId));
        if (!current || !isBoundAuthorLink(current, input)) {
          return { status: "changed" as const };
        }

        // In-process only: recovery and disconnect share this critical section.
        return { status: "bound" as const, value: await work(null) };
      });
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

    async listForAdminByMemberIds(input) {
      return pageAdminLinksByMemberIds([...byAuthor.values()], input);
    },

    async listResults() {
      return [...results.values()].map((record) => ({ ...record }));
    },

    async listAudits() {
      return audits.map((record) => ({ ...record }));
    },

    async findResult(resultCode) {
      const found = results.get(resultCode);
      return found ? { ...found } : null;
    },

    async findBindingRecoveryReceipt(recoveryId) {
      return runIntegrityMediaLinkCriticalSection(() => recoveryPersistence.findReceipt(recoveryId));
    },

    async applyBindingRecovery(input) {
      return runIntegrityMediaLinkCriticalSection(() =>
        executeBindingRecovery(recoveryPersistence, input),
      );
    },

    async listBindingRecoveryReceipts() {
      return [...recoveryReceipts.values()].map((record) => copyReceipt(record));
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
    async insertResult(record, options) {
      await results().insertOne(record, options?.session ? { session: options.session } : {});
    },

    async claimResult(resultCode, nowIso) {
      const claimed = await results().findOneAndUpdate(
        {
          resultCode,
          consumedAt: null,
          expiresAt: { $gt: nowIso },
          bindingRecoveryReservationId: { $exists: false },
          purpose: { $exists: false },
        },
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

      if (
        !existing.consumedAt &&
        existing.bindingRecoveryReservationId === undefined &&
        existing.purpose === undefined &&
        existing.expiresAt <= nowIso
      ) {
        await results().updateOne(
          {
            resultCode,
            consumedAt: null,
            bindingRecoveryReservationId: { $exists: false },
            purpose: { $exists: false },
          },
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

    async findLinkByMember(source, memberId, options) {
      const document = await links().findOne(
        { source, memberId },
        options?.session ? { session: options.session } : {},
      );
      return document ? withoutId(document) : null;
    },

    async insertLink(record, options) {
      try {
        await links().insertOne(record, options?.session ? { session: options.session } : {});
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

    async compareAndConfirmLink(input) {
      return runIntegrityMediaLinkCriticalSection(async () => {
        const updated = await links().findOneAndUpdate(
          {
            source: input.source,
            externalAuthorId: input.externalAuthorId,
            memberId: input.memberId,
            linkRevision: input.linkRevision,
            linkInstanceId: input.linkInstanceId,
            state: "linked",
            linkFinalization: "provisional",
          },
          { $set: { linkFinalization: "confirmed", updatedAt: input.nowIso } },
          { returnDocument: "after" },
        );
        if (updated) {
          return { status: "confirmed" as const, record: withoutId(updated) };
        }

        const current = await links().findOne({
          source: input.source,
          externalAuthorId: input.externalAuthorId,
        });
        if (!current) {
          return { status: "missing" as const };
        }

        const decision = classifyConfirmCandidate(withoutId(current), input);
        if (decision === "already_confirmed") {
          return { status: "already_confirmed" as const, record: withoutId(current) };
        }

        if (decision === "legacy" || decision === "mismatch" || decision === "disabled") {
          return { status: decision };
        }

        return { status: "mismatch" as const };
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

    async runWithBoundAuthorLink(input, work) {
      return runMongoTransaction(async (session) => {
        // A real change, not a no-op: only a changed document conflicts with a concurrent writer.
        const held = await links().findOneAndUpdate(
          boundAuthorLinkFilter(input),
          { $inc: { authorActivationGuard: 1 } },
          { session, returnDocument: "after" },
        );
        if (!held) {
          return { status: "changed" as const };
        }

        return { status: "bound" as const, value: await work(session) };
      });
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

    async listForAdminByMemberIds(input) {
      const memberIds = uniqueMemberIds(input.memberIds);
      if (memberIds.length === 0) {
        return { items: [], total: 0 };
      }
      const filter = { source: input.source, memberId: { $in: memberIds } };
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

    async findResult(resultCode) {
      const document = await results().findOne({ resultCode });
      return document ? withoutId(document) : null;
    },

    async findBindingRecoveryReceipt(recoveryId) {
      return runIntegrityMediaLinkCriticalSection(async () => {
        const document = await recoveryReceipts().findOne({ recoveryId });
        return document ? withoutId(document) : null;
      });
    },

    async applyBindingRecovery(input) {
      return runIntegrityMediaLinkCriticalSection(async () => {
        try {
          return await runMongoTransaction((session) =>
            executeBindingRecovery(createMongoBindingRecoveryPersistence(session), input),
          );
        } catch (error) {
          // The transaction is already aborted. Interpretation reads only.
          return resolveAbortedBindingRecovery({
            error,
            request: input.request,
            readCommittedReceipt: async () => {
              const document = await recoveryReceipts().findOne({
                recoveryId: input.request.recoveryId,
              });
              return document ? withoutId(document) : null;
            },
          });
        }
      });
    },

    async listBindingRecoveryReceipts() {
      const documents = await recoveryReceipts().find({}).toArray();
      return documents.map((document) => withoutId(document));
    },
  };
}

function recoveryReceipts() {
  return getMongoCollection<ExternalAuthorLinkRecoveryReceiptRecord>(
    MONGO_COLLECTIONS.externalAuthorLinkRecoveryReceipts,
  );
}

/**
 * Every recovery read and write is bound to the transaction session.
 * A duplicate key is not caught here: it aborts the transaction.
 */
export function createMongoBindingRecoveryPersistence(
  session: ClientSession,
): BindingRecoveryPersistence {
  const links = () =>
    getMongoCollection<ExternalAuthorLinkRecord>(MONGO_COLLECTIONS.externalAuthorLinks);
  const results = () =>
    getMongoCollection<ExternalAuthorLinkResultRecord>(MONGO_COLLECTIONS.externalAuthorLinkResults);
  const audits = () =>
    getMongoCollection<ExternalAuthorLinkAuditRecord>(MONGO_COLLECTIONS.externalAuthorLinkAudit);

  return {
    async findReceipt(recoveryId) {
      const document = await recoveryReceipts().findOne({ recoveryId }, { session });
      return document ? withoutId(document) : null;
    },

    async insertReceipt(record) {
      await recoveryReceipts().insertOne({ ...record }, { session });
      return "inserted";
    },

    async replaceReceipt(record) {
      await recoveryReceipts().replaceOne({ recoveryId: record.recoveryId }, { ...record }, { session });
    },

    async findLinkByAuthor(externalAuthorId) {
      const document = await links().findOne(
        { source: INTEGRITY_MEDIA_SOURCE, externalAuthorId },
        { session },
      );
      return document ? withoutId(document) : null;
    },

    async findLinkByMember(memberId) {
      const document = await links().findOne({ source: INTEGRITY_MEDIA_SOURCE, memberId }, { session });
      return document ? withoutId(document) : null;
    },

    async findResult(resultCode) {
      const document = await results().findOne({ resultCode }, { session });
      return document ? withoutId(document) : null;
    },

    async reserveResult(resultCode, reservationId) {
      const updated = await results().updateOne(
        { resultCode, consumedAt: null, bindingRecoveryReservationId: { $exists: false } },
        { $set: { bindingRecoveryReservationId: reservationId } },
        { session },
      );
      return updated.matchedCount === 1;
    },

    async releaseResult(resultCode, reservationId) {
      await results().updateOne(
        { resultCode, consumedAt: null, bindingRecoveryReservationId: reservationId },
        { $unset: { bindingRecoveryReservationId: "" } },
        { session },
      );
    },

    async consumeResult(resultCode, reservationId, nowIso) {
      const updated = await results().updateOne(
        { resultCode, consumedAt: null, bindingRecoveryReservationId: reservationId },
        { $set: { consumedAt: nowIso } },
        { session },
      );
      return updated.matchedCount === 1;
    },

    async rebind(input) {
      const updated = await links().findOneAndUpdate(
        {
          source: INTEGRITY_MEDIA_SOURCE,
          externalAuthorId: input.externalAuthorId,
          memberId: input.historicalMemberId,
          linkRevision: input.historicalLinkRevision,
          linkInstanceId: input.historicalLinkInstanceId,
          state: "linked",
          linkFinalization: "confirmed",
          $or: [
            { bindingRecoveryId: { $exists: false } },
            { bindingRecoveryId: input.recoveryId },
          ],
        },
        { $set: input.set },
        { returnDocument: "after", session },
      );
      return updated ? "rebound" : "stale";
    },

    async findRecoveryAudit(recoveryId) {
      const document = await audits().findOne(
        { action: "link_binding_recovered", recoveryId },
        { session },
      );
      return document ? withoutId(document) : null;
    },

    async insertAudit(record) {
      await audits().insertOne({ ...record }, { session });
    },
  };
}

let storeOverride: ExternalAuthorLinkStore | null = null;
let storeSingleton: ExternalAuthorLinkStore | null = null;
let storeSingletonUsesMongo = false;

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

  if (isExplicitIsolatedMongoTest()) {
    if (!storeSingletonUsesMongo || !storeSingleton) {
      storeSingleton = createMongoExternalAuthorLinkStore();
      storeSingletonUsesMongo = true;
    }
    return storeSingleton;
  }

  if (!storeSingleton) {
    storeSingletonUsesMongo = Boolean(process.env.MONGODB_URI?.trim());
    storeSingleton = storeSingletonUsesMongo
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
    linkFinalization: { $ne: "provisional" as const },
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
  if (
    record.source !== source ||
    record.state !== "linked" ||
    record.authorActivationPending !== true ||
    record.linkFinalization === "provisional"
  ) {
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

function uniqueMemberIds(memberIds: readonly string[]): string[] {
  return [...new Set(memberIds.filter((memberId) => memberId.trim().length > 0))];
}

function pageAdminLinksByMemberIds(
  records: readonly ExternalAuthorLinkRecord[],
  input: {
    source: typeof INTEGRITY_MEDIA_SOURCE;
    memberIds: readonly string[];
    limit: number;
    offset: number;
  },
): { items: ExternalAuthorLinkRecord[]; total: number } {
  const allowed = new Set(uniqueMemberIds(input.memberIds));
  if (allowed.size === 0) {
    return { items: [], total: 0 };
  }
  const items = records
    .filter((record) => record.source === input.source && allowed.has(record.memberId))
    .sort(compareAdminLinks);
  return {
    total: items.length,
    items: items.slice(input.offset, input.offset + input.limit).map((record) => ({ ...record })),
  };
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
  linkFinalization?: ExternalAuthorLinkRecord["linkFinalization"];
  linkInstanceId?: string;
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
    ...(record.linkFinalization ? { linkFinalization: record.linkFinalization } : {}),
    ...(record.linkInstanceId ? { linkInstanceId: record.linkInstanceId } : {}),
  };
}

function classifyConfirmCandidate(
  current: ExternalAuthorLinkRecord,
  input: {
    source: typeof INTEGRITY_MEDIA_SOURCE;
    externalAuthorId: string;
    memberId: string;
    linkRevision: number;
    linkInstanceId: string;
  },
): "provisional" | "already_confirmed" | "legacy" | "mismatch" | "disabled" {
  if (current.linkFinalization !== "provisional" && current.linkFinalization !== "confirmed") {
    return "legacy";
  }

  const revision = assignedLinkRevision(current.linkRevision);
  if (
    current.source !== input.source ||
    current.externalAuthorId !== input.externalAuthorId ||
    current.memberId !== input.memberId ||
    revision !== input.linkRevision ||
    current.linkInstanceId !== input.linkInstanceId
  ) {
    return "mismatch";
  }

  if (current.state !== "linked") {
    return "disabled";
  }

  return current.linkFinalization === "confirmed" ? "already_confirmed" : "provisional";
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
    linkFinalization: { $ne: "provisional" as const },
    $or: [
      { collaborationStatus: "active" },
      { collaborationStatus: { $exists: false } },
      { collaborationStatus: { $type: "null" } },
    ],
  };
}

function isBoundAuthorLink(
  link: ExternalAuthorLinkRecord,
  input: { source: typeof INTEGRITY_MEDIA_SOURCE; externalAuthorId: string; memberId: string },
): boolean {
  return (
    link.source === input.source &&
    link.externalAuthorId === input.externalAuthorId &&
    link.memberId === input.memberId &&
    link.state === "linked" &&
    link.linkFinalization !== "provisional"
  );
}

function boundAuthorLinkFilter(input: {
  source: typeof INTEGRITY_MEDIA_SOURCE;
  externalAuthorId: string;
  memberId: string;
}): Filter<ExternalAuthorLinkRecord> {
  return {
    source: input.source,
    externalAuthorId: input.externalAuthorId,
    memberId: input.memberId,
    state: "linked",
    linkFinalization: { $ne: "provisional" },
  };
}

function copyLink(record: ExternalAuthorLinkRecord | undefined): ExternalAuthorLinkRecord | null {
  return record ? { ...record } : null;
}

function copyReceipt(
  record: ExternalAuthorLinkRecoveryReceiptRecord,
): ExternalAuthorLinkRecoveryReceiptRecord {
  return { ...record, outcome: record.outcome ? { ...record.outcome } : null };
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
