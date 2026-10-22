export type IntegrityMediaAuthorListState = "all" | "linked" | "disabled" | "setup_pending" | "unread";

export type IntegrityMediaAuthorCollaborationStatus = "active" | "blocked" | "archived";

export type IntegrityMediaAuthorDeliveryStatus = "delivered" | "pending" | "failed";

export type IntegrityMediaAuthorDirectoryDeliveryStatus =
  | IntegrityMediaAuthorDeliveryStatus
  | "recorded";

export interface IntegrityMediaAuthorLatestMessage {
  messageId: string;
  title: string;
  status: IntegrityMediaAuthorDirectoryDeliveryStatus;
  lastErrorCode: string | null;
  createdAt: string;
  deliveredAt: string | null;
}

export interface IntegrityMediaAuthorRow {
  memberId: string;
  externalAuthorId: string;
  state: "linked" | "disabled";
  authorActivationPending: boolean;
  collaborationStatus: IntegrityMediaAuthorCollaborationStatus;
  canSend: boolean;
  createdAt: string;
  confirmedAt: string;
  disconnectedAt: string | null;
  participantDisplayName: string;
  participantAvatarUrl?: string;
  participantProfileHref?: string;
  messageCount: number;
  unreadCount: number;
  latestMessage: IntegrityMediaAuthorLatestMessage | null;
}

export interface IntegrityMediaAuthorDirectoryPage {
  authors: IntegrityMediaAuthorRow[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
  unreadMessageCount: number;
}

export interface IntegrityMediaAuthorMessageDelivery {
  messageId?: string;
  status?: string;
  recipientMemberId?: string;
  attemptCount?: number;
  lastErrorCode?: string | null;
  deliveredAt?: string | null;
}

export interface IntegrityMediaAuthorMessageRequest {
  title: string;
  body: string;
  cta?: { label: string; url: string };
}

export const INTEGRITY_MEDIA_AUTHORS_PAGE_SIZE = 25;
export const INTEGRITY_MEDIA_AUTHOR_HISTORY_PAGE_SIZE = 20;
export const INTEGRITY_MEDIA_AUTHOR_TITLE_MAX = 200;
export const INTEGRITY_MEDIA_AUTHOR_BODY_MAX = 8000;
export const INTEGRITY_MEDIA_AUTHOR_CTA_LABEL_MAX = 120;
export const INTEGRITY_MEDIA_AUTHOR_CTA_URL_MAX = 2000;

const DELIVERY_STATUSES = new Set<IntegrityMediaAuthorDeliveryStatus>([
  "delivered",
  "pending",
  "failed",
]);

export function buildAdminIntegrityMediaAuthorsPath(query: {
  state?: IntegrityMediaAuthorListState;
  limit?: number;
  offset?: number;
} = {}): string {
  const params = new URLSearchParams();
  if (query.state) {
    params.set("state", query.state);
  }
  if (query.limit !== undefined) {
    params.set("limit", String(query.limit));
  }
  if (query.offset !== undefined) {
    params.set("offset", String(query.offset));
  }
  const suffix = params.toString();
  return `/api/v1/admin/integrity-media/authors${suffix ? `?${suffix}` : ""}`;
}

export function integrityMediaAuthorsQueryAfterFilter(state: IntegrityMediaAuthorListState): {
  state: IntegrityMediaAuthorListState;
  offset: 0;
  limit: number;
} {
  return { state, offset: 0, limit: INTEGRITY_MEDIA_AUTHORS_PAGE_SIZE };
}

export function integrityMediaAuthorsNextOffset(
  offset: number,
  limit: number,
  hasMore: boolean,
): number | null {
  return hasMore ? offset + limit : null;
}

export function integrityMediaAuthorsPreviousOffset(offset: number, limit: number): number | null {
  if (offset <= 0) {
    return null;
  }
  return Math.max(0, offset - limit);
}

export function buildIntegrityMediaAuthorMessageRequest(input: {
  title: string;
  body: string;
  ctaLabel?: string;
  ctaUrl?: string;
}): IntegrityMediaAuthorMessageRequest {
  const title = input.title.trim();
  const body = input.body.trim();
  const ctaLabel = input.ctaLabel?.trim() ?? "";
  const ctaUrl = input.ctaUrl?.trim() ?? "";
  return {
    title,
    body,
    ...(ctaLabel || ctaUrl ? { cta: { label: ctaLabel, url: ctaUrl } } : {}),
  };
}

export function validateIntegrityMediaAuthorMessageForm(input: {
  title: string;
  body: string;
  ctaLabel: string;
  ctaUrl: string;
}): Partial<Record<"title" | "body" | "ctaLabel" | "ctaUrl", string>> | null {
  const title = input.title.trim();
  const body = input.body.trim();
  const ctaLabel = input.ctaLabel.trim();
  const ctaUrl = input.ctaUrl.trim();
  const errors: Partial<Record<"title" | "body" | "ctaLabel" | "ctaUrl", string>> = {};

  if (!title) {
    errors.title = "Title is required.";
  } else if (title.length > INTEGRITY_MEDIA_AUTHOR_TITLE_MAX) {
    errors.title = `Title must be ${INTEGRITY_MEDIA_AUTHOR_TITLE_MAX} characters or fewer.`;
  } else if (containsMarkup(title)) {
    errors.title = "Title must be plain text.";
  }

  if (!body) {
    errors.body = "Message is required.";
  } else if (body.length > INTEGRITY_MEDIA_AUTHOR_BODY_MAX) {
    errors.body = `Message must be ${INTEGRITY_MEDIA_AUTHOR_BODY_MAX} characters or fewer.`;
  } else if (containsMarkup(body)) {
    errors.body = "Message must be plain text.";
  }

  const hasLabel = ctaLabel.length > 0;
  const hasUrl = ctaUrl.length > 0;
  if (hasLabel !== hasUrl) {
    if (!hasLabel) {
      errors.ctaLabel = "Add a link label, or leave both link fields empty.";
    }
    if (!hasUrl) {
      errors.ctaUrl = "Add a link URL, or leave both link fields empty.";
    }
  } else if (hasLabel && hasUrl) {
    if (ctaLabel.length > INTEGRITY_MEDIA_AUTHOR_CTA_LABEL_MAX) {
      errors.ctaLabel = `Link label must be ${INTEGRITY_MEDIA_AUTHOR_CTA_LABEL_MAX} characters or fewer.`;
    }
    if (ctaUrl.length > INTEGRITY_MEDIA_AUTHOR_CTA_URL_MAX) {
      errors.ctaUrl = `Link URL must be ${INTEGRITY_MEDIA_AUTHOR_CTA_URL_MAX} characters or fewer.`;
    } else if (!isHttpUrl(ctaUrl)) {
      errors.ctaUrl = "Link URL must start with http:// or https://.";
    }
  }

  return Object.keys(errors).length > 0 ? errors : null;
}

export function interpretIntegrityMediaAuthorDelivery(
  status: unknown,
): { ok: true; status: IntegrityMediaAuthorDeliveryStatus } | { ok: false } {
  if (typeof status === "string" && DELIVERY_STATUSES.has(status as IntegrityMediaAuthorDeliveryStatus)) {
    return { ok: true, status: status as IntegrityMediaAuthorDeliveryStatus };
  }
  return { ok: false };
}

export function integrityMediaAuthorDeliveryCopy(status: IntegrityMediaAuthorDeliveryStatus | "unknown"): {
  title: string;
  message: string;
} {
  if (status === "delivered") {
    return {
      title: "Delivered",
      message: "Integrity Media accepted this message.",
    };
  }
  if (status === "pending") {
    return {
      title: "Pending",
      message: "Humanity Union stored this message. Delivery is still in progress.",
    };
  }
  if (status === "failed") {
    return {
      title: "Failed",
      message: "This message was not delivered.",
    };
  }
  return {
    title: "Delivery status unavailable",
    message: "The server did not return a delivery status.",
  };
}

export function integrityMediaAuthorConnectionLabel(row: {
  state: "linked" | "disabled";
  authorActivationPending: boolean;
}): string {
  if (row.state === "disabled") {
    return "Disabled";
  }
  if (row.authorActivationPending) {
    return "Setup pending";
  }
  return "Linked";
}

export type IntegrityMediaAuthorHistoryDirection = "hu_to_im" | "im_to_hu";
export type IntegrityMediaAuthorHistoryKind = "chat" | "system";

export interface IntegrityMediaAuthorHistoryMessage {
  messageId: string;
  memberId: string;
  externalAuthorId: string;
  direction: IntegrityMediaAuthorHistoryDirection;
  kind: IntegrityMediaAuthorHistoryKind;
  body: string;
  createdAt: string;
  title: string | null;
  cta: { label: string; url: string } | null;
  actorMemberId: string | null;
  replyToMessageId: string | null;
  delivery: {
    status: IntegrityMediaAuthorDirectoryDeliveryStatus;
    deliveredAt: string | null;
    attemptCount: number;
    lastErrorCode: string | null;
  } | null;
}

export interface IntegrityMediaAuthorHistoryPage {
  memberId: string;
  messages: IntegrityMediaAuthorHistoryMessage[];
  pageInfo: {
    hasMore: boolean;
    nextCursor: string | null;
  };
}

export function buildAdminIntegrityMediaAuthorHistoryPath(
  memberId: string,
  query: { limit?: number; cursor?: string } = {},
): string {
  const params = new URLSearchParams();
  if (query.limit !== undefined) {
    params.set("limit", String(query.limit));
  }
  if (query.cursor) {
    params.set("cursor", query.cursor);
  }
  const suffix = params.toString();
  return `/api/v1/admin/integrity-media/authors/${encodeURIComponent(memberId)}/messages${suffix ? `?${suffix}` : ""}`;
}

export function buildAdminIntegrityMediaAuthorReadPath(memberId: string): string {
  return `/api/v1/admin/integrity-media/authors/${encodeURIComponent(memberId)}/messages/read`;
}

const AUTHOR_REPLY_MESSAGE_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export const INTEGRITY_MEDIA_AUTHOR_DIRECTORY_LOOKUP_LIMIT = 100;
export const INTEGRITY_MEDIA_AUTHOR_DIRECTORY_LOOKUP_PAGES = 20;

export function isIntegrityMediaAuthorReplyMessageId(
  value: string | null | undefined,
): value is string {
  return typeof value === "string" && AUTHOR_REPLY_MESSAGE_ID_PATTERN.test(value);
}

export function buildAdminIntegrityMediaAuthorReplyTargetPath(messageId: string): string {
  const params = new URLSearchParams();
  params.set("messageId", messageId);
  return `/api/v1/admin/integrity-media/authors/reply-target?${params.toString()}`;
}

/** One directory row, chosen by member id. Display names are never the key. */
export function selectIntegrityMediaAuthorByMemberId(
  authors: readonly IntegrityMediaAuthorRow[],
  memberId: string,
): IntegrityMediaAuthorRow | null {
  const matches = authors.filter((author) => author.memberId === memberId);
  return matches.length === 1 ? (matches[0] ?? null) : null;
}

/**
 * Ask for a lookup only when the URL names a new valid reply.
 * The same id stays quiet so a mounted section does not look it up again.
 */
export function authorNotificationOpenRequest(
  messageIdParam: string | null,
  openedMessageId: string | null,
): string | null {
  if (!isIntegrityMediaAuthorReplyMessageId(messageIdParam)) {
    return null;
  }
  if (openedMessageId === messageIdParam) {
    return null;
  }
  return messageIdParam;
}

export function integrityMediaAuthorDirectoryHref(pathname: string, search: string): string {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  params.delete("messageId");
  const next = params.toString();
  return next ? `${pathname}?${next}` : pathname;
}

export async function findIntegrityMediaAuthorDirectoryRow(
  memberId: string,
  loadPage: (query: {
    state: "all";
    limit: number;
    offset: number;
  }) => Promise<Pick<IntegrityMediaAuthorDirectoryPage, "authors" | "hasMore">>,
): Promise<IntegrityMediaAuthorRow | null> {
  const identity = memberId.trim();
  if (!identity) {
    return null;
  }

  let offset = 0;
  for (let page = 0; page < INTEGRITY_MEDIA_AUTHOR_DIRECTORY_LOOKUP_PAGES; page += 1) {
    const result = await loadPage({
      state: "all",
      limit: INTEGRITY_MEDIA_AUTHOR_DIRECTORY_LOOKUP_LIMIT,
      offset,
    });
    const match = selectIntegrityMediaAuthorByMemberId(result.authors, identity);
    if (match) {
      return match;
    }
    if (!result.hasMore || result.authors.length === 0) {
      return null;
    }
    offset += result.authors.length;
  }

  return null;
}

export function inboundIntegrityMediaAuthorChatIds(
  messages: readonly IntegrityMediaAuthorHistoryMessage[],
): string[] {
  const ids: string[] = [];
  for (const message of messages) {
    if (message.direction !== "im_to_hu" || message.kind !== "chat" || ids.includes(message.messageId)) {
      continue;
    }
    ids.push(message.messageId);
  }
  return ids;
}

export function buildIntegrityMediaAuthorChatRequest(body: string): { body: string } {
  return { body: body.trim() };
}

export function validateIntegrityMediaAuthorChatForm(body: string): string | null {
  const trimmed = body.trim();
  if (!trimmed) {
    return "Message is required.";
  }
  if (trimmed.length > INTEGRITY_MEDIA_AUTHOR_BODY_MAX) {
    return `Message must be ${INTEGRITY_MEDIA_AUTHOR_BODY_MAX} characters or fewer.`;
  }
  if (containsMarkup(trimmed)) {
    return "Message must be plain text.";
  }
  return null;
}

export function mergeIntegrityMediaAuthorHistory(
  older: readonly IntegrityMediaAuthorHistoryMessage[],
  current: readonly IntegrityMediaAuthorHistoryMessage[],
): IntegrityMediaAuthorHistoryMessage[] {
  const byId = new Map<string, IntegrityMediaAuthorHistoryMessage>();
  for (const message of older) {
    byId.set(message.messageId, message);
  }
  for (const message of current) {
    byId.set(message.messageId, message);
  }
  return [...byId.values()].sort(compareIntegrityMediaAuthorHistory);
}

export function restoredTranscriptScrollTop(input: {
  previousScrollHeight: number;
  previousScrollTop: number;
  nextScrollHeight: number;
}): number {
  const distanceFromBottom = input.previousScrollHeight - input.previousScrollTop;
  return Math.max(0, input.nextScrollHeight - distanceFromBottom);
}

export function integrityMediaAuthorHistorySenderLabel(input: {
  direction: IntegrityMediaAuthorHistoryDirection;
  participantDisplayName: string;
}): string {
  return input.direction === "im_to_hu" ? input.participantDisplayName : "Humanity Union";
}

export function integrityMediaAuthorHistoryKindLabel(
  kind: IntegrityMediaAuthorHistoryKind,
): string {
  return kind === "chat" ? "Chat" : "System";
}

export function integrityMediaAuthorHistoryDeliveryLabel(status: string): string | null {
  if (status === "delivered") {
    return "Delivered";
  }
  if (status === "pending") {
    return "Pending";
  }
  if (status === "recorded") {
    return "Recorded";
  }
  if (status === "failed") {
    return "Not delivered";
  }
  return null;
}

export function integrityMediaAuthorLatestTitle(title: string): string {
  const trimmed = title.trim();
  return trimmed.length > 0 ? trimmed : "Chat message";
}

export function integrityMediaAuthorLatestStatusLabel(status: string): string {
  if (status === "delivered") {
    return "Delivered";
  }
  if (status === "pending") {
    return "Pending";
  }
  if (status === "recorded") {
    return "Recorded";
  }
  if (status === "failed") {
    return "Failed";
  }
  return "Unknown";
}

export function integrityMediaAuthorComposeBlockedCopy(input: {
  canSend: boolean;
  linkState: "linked" | "disabled";
  authorActivationPending: boolean;
  collaborationStatus: IntegrityMediaAuthorCollaborationStatus;
}): string | null {
  if (input.canSend) {
    return null;
  }
  if (input.linkState === "disabled") {
    return "This collaboration is disconnected. History remains available. New messages are turned off.";
  }
  if (input.authorActivationPending) {
    return "Author setup is still finishing. History remains available. New messages are turned off.";
  }
  if (input.collaborationStatus === "blocked") {
    return "This collaboration is blocked. History remains available. New messages are turned off.";
  }
  if (input.collaborationStatus === "archived") {
    return "This collaboration is archived. History remains available. New messages are turned off.";
  }
  return "New messages are unavailable. History remains available.";
}

const INTEGRITY_MEDIA_AUTHOR_ERROR_COPY: Record<string, string> = {
  link_missing: "This member is not linked to Integrity Media.",
  link_disabled: "This Integrity Media connection is disabled.",
  author_activation_pending: "Integrity Media author setup is still finishing.",
  collaboration_blocked: "This Integrity Media collaboration is blocked.",
  collaboration_archived: "This Integrity Media collaboration is archived.",
  link_ineligible: "This Integrity Media collaboration is not eligible for new messages.",
  administrator_required: "Administrator access is required.",
  authentication_required: "Authentication is required.",
  invalid_request: "This message is not valid.",
  payload_too_large: `Message must be ${INTEGRITY_MEDIA_AUTHOR_BODY_MAX} characters or fewer.`,
};

export function integrityMediaAuthorSafeError(code: string | undefined, fallback: string): string {
  if (!code || !Object.prototype.hasOwnProperty.call(INTEGRITY_MEDIA_AUTHOR_ERROR_COPY, code)) {
    return fallback;
  }
  return INTEGRITY_MEDIA_AUTHOR_ERROR_COPY[code] ?? fallback;
}

export function integrityMediaAuthorSafeHttpUrl(value: string): string | null {
  return isHttpUrl(value) ? value : null;
}

function compareIntegrityMediaAuthorHistory(
  left: IntegrityMediaAuthorHistoryMessage,
  right: IntegrityMediaAuthorHistoryMessage,
): number {
  if (left.createdAt < right.createdAt) {
    return -1;
  }
  if (left.createdAt > right.createdAt) {
    return 1;
  }
  if (left.messageId < right.messageId) {
    return -1;
  }
  if (left.messageId > right.messageId) {
    return 1;
  }
  return 0;
}

function containsMarkup(value: string): boolean {
  return /[<>]/.test(value);
}

function isHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}
