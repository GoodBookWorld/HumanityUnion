export type IntegrityMediaAuthorListState = "all" | "linked" | "disabled" | "setup_pending";

export type IntegrityMediaAuthorDeliveryStatus = "delivered" | "pending" | "failed";

export interface IntegrityMediaAuthorLatestMessage {
  messageId: string;
  title: string;
  status: IntegrityMediaAuthorDeliveryStatus;
  lastErrorCode: string | null;
  createdAt: string;
  deliveredAt: string | null;
}

export interface IntegrityMediaAuthorRow {
  memberId: string;
  externalAuthorId: string;
  state: "linked" | "disabled";
  authorActivationPending: boolean;
  canSend: boolean;
  createdAt: string;
  confirmedAt: string;
  disconnectedAt: string | null;
  participantDisplayName: string;
  participantAvatarUrl?: string;
  participantProfileHref?: string;
  messageCount: number;
  latestMessage: IntegrityMediaAuthorLatestMessage | null;
}

export interface IntegrityMediaAuthorDirectoryPage {
  authors: IntegrityMediaAuthorRow[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
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
