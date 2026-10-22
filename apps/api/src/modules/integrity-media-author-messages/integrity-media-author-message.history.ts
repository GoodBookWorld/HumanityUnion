import { INTEGRITY_MEDIA_SOURCE } from "../external-author-link/external-author-link.constants.js";
import { getExternalAuthorLinkStore } from "../external-author-link/external-author-link.store.js";
import { INTEGRITY_MEDIA_AUTHOR_MESSAGE_HISTORY_PAGE_SIZE } from "./integrity-media-author-message.constants.js";
import {
  decodeIntegrityMediaAuthorMessageCursor,
  encodeIntegrityMediaAuthorMessageCursor,
  isIntegrityMediaAuthorMessageId,
  resolveIntegrityMediaAuthorMessageDirection,
  resolveIntegrityMediaAuthorMessageKind,
  type IntegrityMediaAuthorMessageCursor,
} from "./integrity-media-author-message.contract.js";
import { requireIntegrityMediaAuthorMessageAdmin } from "./integrity-media-author-message.service.js";
import { getIntegrityMediaAuthorMessageStore } from "./integrity-media-author-message.store.js";
import type {
  IntegrityMediaAuthorMessageHistoryItem,
  IntegrityMediaAuthorMessageHistoryPage,
  IntegrityMediaAuthorMessageRecord,
} from "./integrity-media-author-message.types.js";

export interface IntegrityMediaAuthorMessageHistoryFailure {
  ok: false;
  status: number;
  code: string;
  message: string;
}

/**
 * Read-only history for the durable member/author pair. The caller does not
 * choose the external author id. Inactive collaboration states stay readable.
 */
export async function listIntegrityMediaAuthorMessageHistory(input: {
  actorUserId: string;
  actorMemberId: string;
  recipientMemberId: string;
  limit?: number;
  cursor?: string;
}): Promise<
  | { ok: true; data: IntegrityMediaAuthorMessageHistoryPage }
  | IntegrityMediaAuthorMessageHistoryFailure
> {
  await requireIntegrityMediaAuthorMessageAdmin(input.actorUserId, input.actorMemberId);

  const memberId = input.recipientMemberId.trim();
  if (!memberId || /\s/.test(memberId)) {
    return failure(400, "invalid_request", "The selected member is not valid.");
  }

  if (
    input.limit !== undefined &&
    (!Number.isInteger(input.limit) ||
      input.limit < 1 ||
      input.limit > INTEGRITY_MEDIA_AUTHOR_MESSAGE_HISTORY_PAGE_SIZE)
  ) {
    return failure(400, "invalid_request", "The message history request is not valid.");
  }

  let before: IntegrityMediaAuthorMessageCursor | null = null;
  if (input.cursor !== undefined) {
    before = decodeIntegrityMediaAuthorMessageCursor(input.cursor);
    if (!before) {
      return failure(400, "invalid_request", "The message history request is not valid.");
    }
  }

  const link = await getExternalAuthorLinkStore().findLinkByMember(INTEGRITY_MEDIA_SOURCE, memberId);
  if (!link || link.memberId !== memberId || !link.externalAuthorId) {
    return failure(404, "link_missing", "This member is not linked to Integrity Media.");
  }

  const limit = input.limit ?? INTEGRITY_MEDIA_AUTHOR_MESSAGE_HISTORY_PAGE_SIZE;
  const page = await getIntegrityMediaAuthorMessageStore().listHistory({
    recipientMemberId: link.memberId,
    recipientExternalAuthorId: link.externalAuthorId,
    limit,
    before,
  });
  const newestFirst = page.records.slice(0, limit);
  const oldestFirst = [...newestFirst].reverse();
  const boundary = newestFirst[newestFirst.length - 1];

  return {
    ok: true,
    data: {
      memberId: link.memberId,
      messages: oldestFirst.map(toHistoryItem),
      pageInfo: {
        hasMore: page.hasMore,
        nextCursor:
          page.hasMore && boundary
            ? encodeIntegrityMediaAuthorMessageCursor({
                createdAt: boundary.createdAt,
                messageId: boundary.messageId,
              })
            : null,
      },
    },
  };
}

/**
 * Read-only identity for an accepted IM → HU author chat.
 * The caller supplies a message id. The member id comes only from that row
 * and must still be the linked member for the same external author.
 */
export async function resolveIntegrityMediaAuthorReplyMember(input: {
  actorUserId: string;
  actorMemberId: string;
  messageId: string;
}): Promise<
  | { ok: true; data: { memberId: string } }
  | IntegrityMediaAuthorMessageHistoryFailure
> {
  await requireIntegrityMediaAuthorMessageAdmin(input.actorUserId, input.actorMemberId);

  if (!isIntegrityMediaAuthorMessageId(input.messageId)) {
    return failure(404, "not_found", "The author conversation could not be found.");
  }

  const record = await getIntegrityMediaAuthorMessageStore().findByMessageId(input.messageId);
  if (
    !record ||
    record.direction !== "im_to_hu" ||
    record.kind !== "chat" ||
    record.status !== "recorded" ||
    !record.recipientMemberId ||
    !record.recipientExternalAuthorId
  ) {
    return failure(404, "not_found", "The author conversation could not be found.");
  }

  const link = await getExternalAuthorLinkStore().findLinkByMember(
    INTEGRITY_MEDIA_SOURCE,
    record.recipientMemberId,
  );
  if (
    !link ||
    link.memberId !== record.recipientMemberId ||
    link.externalAuthorId !== record.recipientExternalAuthorId
  ) {
    return failure(404, "not_found", "The author conversation could not be found.");
  }

  return { ok: true, data: { memberId: link.memberId } };
}

/**
 * Records that this page of inbound chats was presented. Other ids, outbound
 * rows, and system rows stay unchanged. A second call for the same ids does
 * not write again.
 */
export async function acknowledgePresentedIntegrityMediaAuthorChats(input: {
  actorUserId: string;
  actorMemberId: string;
  recipientMemberId: string;
  messageIds: readonly string[];
}): Promise<
  | { ok: true; data: { markedCount: number; unreadMessageCount: number } }
  | IntegrityMediaAuthorMessageHistoryFailure
> {
  await requireIntegrityMediaAuthorMessageAdmin(input.actorUserId, input.actorMemberId);

  const memberId = input.recipientMemberId.trim();
  if (!memberId || /\s/.test(memberId)) {
    return failure(400, "invalid_request", "The selected member is not valid.");
  }

  if (
    input.messageIds.length < 1 ||
    input.messageIds.length > INTEGRITY_MEDIA_AUTHOR_MESSAGE_HISTORY_PAGE_SIZE
  ) {
    return failure(400, "invalid_request", "The message history request is not valid.");
  }

  const link = await getExternalAuthorLinkStore().findLinkByMember(INTEGRITY_MEDIA_SOURCE, memberId);
  if (!link || link.memberId !== memberId || !link.externalAuthorId) {
    return failure(404, "link_missing", "This member is not linked to Integrity Media.");
  }

  const messageStore = getIntegrityMediaAuthorMessageStore();
  const markedCount = await messageStore.markPresentedInboundChats({
    recipientMemberId: link.memberId,
    recipientExternalAuthorId: link.externalAuthorId,
    messageIds: input.messageIds,
    readAt: new Date().toISOString(),
  });
  const unreadMessageCount = await messageStore.countUnreadInboundChats();

  return {
    ok: true,
    data: { markedCount, unreadMessageCount },
  };
}

export function toHistoryItem(
  record: IntegrityMediaAuthorMessageRecord,
): IntegrityMediaAuthorMessageHistoryItem {
  const direction = resolveIntegrityMediaAuthorMessageDirection(record.direction);
  const kind = resolveIntegrityMediaAuthorMessageKind(record.kind);

  return {
    messageId: record.messageId,
    memberId: record.recipientMemberId,
    externalAuthorId: record.recipientExternalAuthorId,
    direction,
    kind,
    body: record.body,
    createdAt: record.createdAt,
    title: record.title,
    cta: record.cta ? { label: record.cta.label, url: record.cta.url } : null,
    actorMemberId: record.actorMemberId,
    replyToMessageId: record.replyToMessageId ?? null,
    delivery:
      direction === "hu_to_im"
        ? {
            status: record.status,
            deliveredAt: record.deliveredAt,
            attemptCount: record.attemptCount,
            lastErrorCode: record.lastErrorCode,
          }
        : null,
  };
}

function failure(
  status: number,
  code: string,
  message: string,
): IntegrityMediaAuthorMessageHistoryFailure {
  return { ok: false, status, code, message };
}
