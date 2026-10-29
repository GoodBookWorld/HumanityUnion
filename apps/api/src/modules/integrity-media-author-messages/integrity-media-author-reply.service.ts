import { randomUUID } from "node:crypto";
import type { ClientSession } from "mongodb";

import { isMongoConfigured } from "../../infrastructure/mongodb/mongo-config.js";
import { runMongoTransaction } from "../../infrastructure/mongodb/mongo-transaction.js";
import {
  resolveIntegrityMediaCollaborationStatus,
} from "../external-author-link/external-author-link.collaboration.js";
import { resolveIntegrityMediaLinkConfig } from "../external-author-link/external-author-link.config.js";
import {
  INTEGRITY_MEDIA_AUTHOR_ID_PATTERN,
  INTEGRITY_MEDIA_REPLAY_WINDOW_SECONDS,
  INTEGRITY_MEDIA_SOURCE,
} from "../external-author-link/external-author-link.constants.js";
import { findBlockingAuthorDeletion } from "../external-author-link/external-author-link.author-deletion.js";
import { isIntegrityMediaAuthorLinkOperational } from "../external-author-link/external-author-link.service.js";
import { assignedLinkRevision } from "../external-author-link/external-author-link.revision.js";
import {
  externalAuthorLinkStoreUsesOverride,
  getExternalAuthorLinkStore,
} from "../external-author-link/external-author-link.store.js";
import type { ExternalAuthorLinkRecord } from "../external-author-link/external-author-link.types.js";
import { announceAcceptedIntegrityMediaAuthorReply } from "../admin-notifications/integrity-media-author-reply-notification.js";
import { INTEGRITY_MEDIA_AUTHOR_MESSAGE_BODY_MAX_LENGTH } from "./integrity-media-author-message.constants.js";
import { INTEGRITY_MEDIA_AUTHOR_MESSAGE_CATEGORY } from "./integrity-media-author-message.constants.js";
import { resolveIntegrityMediaAuthorMessageDirection } from "./integrity-media-author-message.contract.js";
import {
  buildIntegrityMediaAuthorReplyCanonical,
  hasIntegrityMediaAuthorReplySignature,
  hashIntegrityMediaAuthorReplyContent,
  integrityMediaAuthorReplySignaturesEqual,
  noteIntegrityMediaAuthorReplySignature,
  signIntegrityMediaAuthorReply,
} from "./integrity-media-author-reply.hmac.js";
import { runIntegrityMediaLinkCriticalSection } from "./integrity-media-author-reply.section.js";
import { getIntegrityMediaAuthorMessageStore } from "./integrity-media-author-message.store.js";
import type {
  IntegrityMediaAuthorMessageAuditRecord,
  IntegrityMediaAuthorMessageRecord,
} from "./integrity-media-author-message.types.js";

export interface IntegrityMediaAuthorReplySuccess {
  ok: true;
  messageId: string;
  authorId: string;
  memberId: string;
  idempotent: boolean;
}

export interface IntegrityMediaAuthorReplyFailure {
  ok: false;
  status: number;
  code: string;
  message: string;
}

export interface IntegrityMediaAuthorReplyRequest {
  messageId: string;
  authorId: string;
  memberId: string;
  linkRevision: number;
  replyToMessageId?: string;
  body: string;
  timestamp: string;
  signature: string;
  secret: string | null;
  now?: Date;
}

/**
 * Trusted IM → HU author reply.
 *
 * An identical messageId is acknowledged even after the link later becomes
 * ineligible, and it does not insert another row or another acceptance audit.
 * A new messageId is accepted only while the live link matches the signed
 * member and revision. The revision is not refreshed from a later reconnect.
 *
 * In one process, acceptance and disconnect share a critical section.
 * On Mongo, acceptance also increments the link's `linkWriteGuard` inside the
 * reply transaction. A disconnect or rebind from any process then waits for
 * the reply to commit, or the reply retries and re-reads the changed link.
 */
export async function acceptIntegrityMediaAuthorReply(
  input: IntegrityMediaAuthorReplyRequest,
): Promise<IntegrityMediaAuthorReplySuccess | IntegrityMediaAuthorReplyFailure> {
  const validated = validateReplyRequest(input);
  if (!validated.ok) {
    return validated;
  }

  if (!input.secret) {
    return failure(503, "unavailable", "Integrity Media reply acceptance is not configured.");
  }

  const canonical = buildIntegrityMediaAuthorReplyCanonical({
    timestamp: input.timestamp,
    messageId: validated.value.messageId,
    authorId: validated.value.authorId,
    memberId: validated.value.memberId,
    linkRevision: validated.value.linkRevision,
    replyToMessageId: validated.value.replyToMessageId,
    contentSha256: hashIntegrityMediaAuthorReplyContent(validated.value.body),
  });
  const expected = signIntegrityMediaAuthorReply(input.secret, canonical);

  if (!integrityMediaAuthorReplySignaturesEqual(expected, input.signature)) {
    return failure(401, "invalid_signature", "The reply signature is not valid.");
  }

  const now = input.now ?? new Date();
  const timestampSeconds = Number(input.timestamp);
  const nowSeconds = Math.floor(now.getTime() / 1000);

  if (Math.abs(nowSeconds - timestampSeconds) > INTEGRITY_MEDIA_REPLAY_WINDOW_SECONDS) {
    return failure(401, "stale_timestamp", "The reply timestamp is outside the allowed window.");
  }

  if (hasIntegrityMediaAuthorReplySignature(input.signature, now.getTime())) {
    return failure(401, "replayed", "This reply request was already used.");
  }

  noteIntegrityMediaAuthorReplySignature(input.signature, now.getTime());

  return runIntegrityMediaLinkCriticalSection(() =>
    commitReply(validated.value, now),
  );
}

export function resolveIntegrityMediaAuthorReplySecret(): string | null {
  return resolveIntegrityMediaLinkConfig().hmacSecret;
}

async function commitReply(
  value: ValidReply,
  now: Date,
): Promise<IntegrityMediaAuthorReplySuccess | IntegrityMediaAuthorReplyFailure> {
  const outcome =
    !externalAuthorLinkStoreUsesOverride() && isMongoConfigured()
      ? await runMongoTransaction((session) => commitReplyWithSession(value, now, session))
      : await commitReplyWithSession(value, now);

  if (outcome.auditAction) {
    await audit(value, outcome.auditAction, outcome.auditReason, now);
  }

  if (outcome.result.ok && !outcome.result.idempotent) {
    await announceAcceptedIntegrityMediaAuthorReply({
      messageId: outcome.result.messageId,
      memberId: outcome.result.memberId,
    });
  }

  return outcome.result;
}

async function commitReplyWithSession(
  value: ValidReply,
  now: Date,
  session?: ClientSession,
): Promise<ReplyCommit> {
  const options = session ? { session } : undefined;
  const messages = getIntegrityMediaAuthorMessageStore();
  const existing = await messages.findByMessageId(value.messageId, options);

  if (existing) {
    if (sameStoredReply(existing, value)) {
      return {
        result: {
          ok: true,
          messageId: existing.messageId,
          authorId: value.authorId,
          memberId: value.memberId,
          idempotent: true,
        },
        auditAction: null,
        auditReason: null,
      };
    }

    return {
      result: failure(409, "message_conflict", "This reply is already bound to another message."),
      auditAction: "integrity_media_author_reply_rejected",
      auditReason: "message_conflict",
    };
  }

  const links = getExternalAuthorLinkStore();
  if (await findBlockingAuthorDeletion(value.authorId)) {
    return {
      result: failureFor("author_deletion_pending"),
      auditAction: "integrity_media_author_reply_rejected",
      auditReason: "author_deletion_pending",
    };
  }

  const link = await links.findLinkByAuthor(INTEGRITY_MEDIA_SOURCE, value.authorId, options);
  const ineligible = replyEligibilityCode(link, value);

  if (ineligible) {
    return {
      result: failureFor(ineligible),
      auditAction: "integrity_media_author_reply_rejected",
      auditReason: ineligible,
    };
  }

  const replyTarget = await replyTargetCode(value, options);
  if (replyTarget) {
    return {
      result: failure(400, "invalid_request", "The referenced message is not part of this collaboration."),
      auditAction: "integrity_media_author_reply_rejected",
      auditReason: replyTarget,
    };
  }

  const held = await links.holdAuthorReplyLink({
    source: INTEGRITY_MEDIA_SOURCE,
    externalAuthorId: value.authorId,
    memberId: value.memberId,
    linkRevision: value.linkRevision,
    ...(session ? { session } : {}),
  });

  if (!held) {
    if (await findBlockingAuthorDeletion(value.authorId)) {
      return {
        result: failureFor("author_deletion_pending"),
        auditAction: "integrity_media_author_reply_rejected",
        auditReason: "author_deletion_pending",
      };
    }

    const current = await links.findLinkByAuthor(INTEGRITY_MEDIA_SOURCE, value.authorId, options);
    const code = replyEligibilityCode(current, value) ?? "revision_conflict";
    return {
      result: failureFor(code),
      auditAction: "integrity_media_author_reply_rejected",
      auditReason: code,
    };
  }

  const nowIso = now.toISOString();
  const record: IntegrityMediaAuthorMessageRecord = {
    messageId: value.messageId,
    destination: INTEGRITY_MEDIA_SOURCE,
    actorMemberId: held.memberId,
    recipientMemberId: held.memberId,
    recipientExternalAuthorId: held.externalAuthorId,
    direction: "im_to_hu",
    kind: "chat",
    category: INTEGRITY_MEDIA_AUTHOR_MESSAGE_CATEGORY,
    title: "",
    body: value.body,
    cta: null,
    linkRevision: value.linkRevision,
    ...(value.replyToMessageId ? { replyToMessageId: value.replyToMessageId } : {}),
    status: "recorded",
    attemptCount: 0,
    lastAttemptAt: null,
    nextAttemptAt: null,
    deliveredAt: null,
    lastErrorCode: null,
    createdAt: nowIso,
    updatedAt: nowIso,
  };
  const inserted = await messages.insert(record, options);

  if (inserted === "duplicate") {
    const raced = await messages.findByMessageId(value.messageId, options);
    if (raced && sameStoredReply(raced, value)) {
      return {
        result: {
          ok: true,
          messageId: value.messageId,
          authorId: value.authorId,
          memberId: value.memberId,
          idempotent: true,
        },
        auditAction: null,
        auditReason: null,
      };
    }

    return {
      result: failure(409, "message_conflict", "This reply is already bound to another message."),
      auditAction: "integrity_media_author_reply_rejected",
      auditReason: "message_conflict",
    };
  }

  return {
    result: {
      ok: true,
      messageId: value.messageId,
      authorId: value.authorId,
      memberId: held.memberId,
      idempotent: false,
    },
    auditAction: "integrity_media_author_reply_accepted",
    auditReason: null,
  };
}

interface ReplyCommit {
  result: IntegrityMediaAuthorReplySuccess | IntegrityMediaAuthorReplyFailure;
  auditAction: IntegrityMediaAuthorMessageAuditRecord["action"] | null;
  auditReason: string | null;
}

interface ValidReply {
  messageId: string;
  authorId: string;
  memberId: string;
  linkRevision: number;
  replyToMessageId: string;
  body: string;
}

function validateReplyRequest(
  input: IntegrityMediaAuthorReplyRequest,
): { ok: true; value: ValidReply } | IntegrityMediaAuthorReplyFailure {
  if (
    !INTEGRITY_MEDIA_AUTHOR_ID_PATTERN.test(input.messageId) ||
    !INTEGRITY_MEDIA_AUTHOR_ID_PATTERN.test(input.authorId) ||
    !INTEGRITY_MEDIA_AUTHOR_ID_PATTERN.test(input.memberId) ||
    !Number.isInteger(input.linkRevision) ||
    input.linkRevision < 1 ||
    typeof input.body !== "string" ||
    !/^\d{10}$/.test(input.timestamp)
  ) {
    return failure(400, "invalid_request", "The reply request is not valid.");
  }

  if (input.replyToMessageId !== undefined && !INTEGRITY_MEDIA_AUTHOR_ID_PATTERN.test(input.replyToMessageId)) {
    return failure(400, "invalid_request", "The reply request is not valid.");
  }

  const body = input.body.trim();
  if (body.length === 0 || body !== input.body || /[<>]/.test(body)) {
    return failure(400, "invalid_request", "The reply request is not valid.");
  }

  if (body.length > INTEGRITY_MEDIA_AUTHOR_MESSAGE_BODY_MAX_LENGTH) {
    return failure(400, "payload_too_large", "Message is too long.");
  }

  return {
    ok: true,
    value: {
      messageId: input.messageId,
      authorId: input.authorId,
      memberId: input.memberId,
      linkRevision: input.linkRevision,
      replyToMessageId: input.replyToMessageId ?? "",
      body,
    },
  };
}

function replyEligibilityCode(
  link: ExternalAuthorLinkRecord | null,
  value: ValidReply,
): string | null {
  if (!link) {
    return "link_not_found";
  }

  if (link.authorDeletionPending === true) {
    return "author_deletion_pending";
  }

  if (link.memberId !== value.memberId || link.externalAuthorId !== value.authorId) {
    return "member_mismatch";
  }

  if (link.state !== "linked") {
    return "link_disabled";
  }

  if (!isIntegrityMediaAuthorLinkOperational(link)) {
    return "author_activation_pending";
  }

  const collaboration = resolveIntegrityMediaCollaborationStatus(link);
  if (collaboration === "blocked") {
    return "collaboration_blocked";
  }

  if (collaboration === "archived") {
    return "collaboration_archived";
  }

  if (assignedLinkRevision(link.linkRevision) !== value.linkRevision) {
    return "revision_conflict";
  }

  return null;
}

async function replyTargetCode(
  value: ValidReply,
  options: { session?: ClientSession } | undefined,
): Promise<string | null> {
  if (!value.replyToMessageId) {
    return null;
  }

  const referenced = await getIntegrityMediaAuthorMessageStore().findByMessageId(
    value.replyToMessageId,
    options,
  );

  if (
    !referenced ||
    referenced.recipientMemberId !== value.memberId ||
    referenced.recipientExternalAuthorId !== value.authorId ||
    resolveIntegrityMediaAuthorMessageDirection(referenced.direction) !== "hu_to_im" ||
    referenced.direction === "im_to_hu"
  ) {
    return "invalid_request";
  }

  return null;
}

function sameStoredReply(existing: IntegrityMediaAuthorMessageRecord, value: ValidReply): boolean {
  return (
    existing.direction === "im_to_hu" &&
    existing.kind === "chat" &&
    existing.recipientExternalAuthorId === value.authorId &&
    existing.recipientMemberId === value.memberId &&
    existing.linkRevision === value.linkRevision &&
    existing.body === value.body &&
    (existing.replyToMessageId ?? "") === value.replyToMessageId
  );
}

function failureFor(code: string): IntegrityMediaAuthorReplyFailure {
  switch (code) {
    case "author_deletion_pending":
      return failure(409, code, "This Integrity Media author connection is pending deletion.");
    case "link_not_found":
      return failure(404, code, "No Integrity Media author link exists for this author.");
    case "link_disabled":
      return failure(409, code, "This Integrity Media collaboration is disconnected.");
    case "collaboration_blocked":
      return failure(409, code, "This Integrity Media collaboration is blocked.");
    case "collaboration_archived":
      return failure(409, code, "This Integrity Media collaboration is archived.");
    case "author_activation_pending":
      return failure(409, code, "This Integrity Media collaboration is not ready for messaging.");
    case "member_mismatch":
      return failure(409, code, "The reply names a different Humanity Union member.");
    case "revision_conflict":
      return failure(409, code, "The reply names a connection generation that is not current.");
    default:
      return failure(409, "revision_conflict", "The reply names a connection generation that is not current.");
  }
}

async function audit(
  value: ValidReply,
  action: IntegrityMediaAuthorMessageAuditRecord["action"],
  reason: string | null,
  now: Date,
): Promise<void> {
  try {
    await getIntegrityMediaAuthorMessageStore().appendAudit({
      eventId: randomUUID(),
      action,
      messageId: value.messageId,
      actorMemberId: value.memberId,
      recipientMemberId: value.memberId,
      recipientExternalAuthorId: value.authorId,
      errorCode: null,
      reason,
      createdAt: now.toISOString(),
    });
  } catch {
    // The stored reply is the source of truth. Audit must not block it.
  }
}

function failure(status: number, code: string, message: string): IntegrityMediaAuthorReplyFailure {
  return { ok: false, status, code, message };
}
