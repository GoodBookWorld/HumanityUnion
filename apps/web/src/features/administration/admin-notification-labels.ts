/**
 * Pack 22E.2 — presentation labels for Admin notification types.
 * Pack 25D.1 — legacy member_badge_order_paid deep-link fallback.
 */
import type { AdminNotification, AdminNotificationType } from "@hu/types";

import { isIntegrityMediaAuthorReplyMessageId } from "./admin-integrity-media-authors-model";

/** English fallback labels — UI prefers `adminNotifications.types` via next-intl. */
const ADMIN_NOTIFICATION_TYPE_LABELS: Record<AdminNotificationType, string> = {
  participant_registered: "New Participant",
  blog_subscriber_confirmed: "New Blog subscriber",
  initiative_published: "New Initiative",
  public_choice_published: "New Public Choice",
  blog_post_published: "New Blog publication",
  operational_alert: "Platform alert",
  participant_suspension_review_requested: "Suspension review request",
  member_badge_order_paid: "Member badge order paid",
  integrity_media_author_message: "Integrity Media author message",
  rrp_application_submitted: "Regional Representative application submitted",
};

export function resolveAdminNotificationTypeLabel(
  notification: Pick<AdminNotification, "type" | "title">,
  translateType?: (type: AdminNotificationType) => string | undefined,
): string {
  if (translateType) {
    const localized = translateType(notification.type)?.trim();
    if (localized) {
      return localized;
    }
  }
  const mapped = ADMIN_NOTIFICATION_TYPE_LABELS[notification.type];
  if (mapped) {
    return mapped;
  }
  const title = notification.title?.trim();
  return title && title.length > 0 ? title : "Notification";
}

/** Ensures RRP deep links keep opaque participant/application ids only. */
export function isSafeAdminRrpNotificationHref(href: string | null | undefined): boolean {
  if (!href?.trim()) {
    return false;
  }
  try {
    const url = new URL(href, "https://hu.local");
    if (url.pathname !== "/admin/participants") {
      return false;
    }
    const participantId = url.searchParams.get("participantId")?.trim() ?? "";
    const rrpApplicationId = url.searchParams.get("rrpApplicationId")?.trim() ?? "";
    if (!participantId || !rrpApplicationId) {
      return false;
    }
    const lowered = href.toLowerCase();
    return !/(dateofbirth|motivation|funding|annualrequested|dob|narrative)/i.test(lowered);
  } catch {
    return false;
  }
}

/**
 * Pack 25D.1 — resolve clickable Admin notification href.
 *
 * New badge-paid notifications already include
 * `view=member_badge_orders&badgeApplicationId=…`.
 * Legacy retained notifications may only point at `/admin/participants`.
 * For those, select Member Badge Orders without guessing an order identity.
 */
export function resolveAdminNotificationHref(
  notification: Pick<AdminNotification, "type" | "targetHref" | "sourceEventId">,
): string | null {
  if (notification.type === "integrity_media_author_message") {
    return integrityMediaAuthorMessageNotificationHref(notification);
  }

  if (notification.type === "participant_registered") {
    return participantRegisteredNotificationHref(notification);
  }

  const raw = notification.targetHref?.trim() || null;

  if (notification.type !== "member_badge_order_paid") {
    return raw;
  }

  const base = raw && raw.length > 0 ? raw : "/admin/participants";

  try {
    const url = new URL(base, "https://hu.local");
    if (!url.searchParams.get("view")) {
      url.searchParams.set("view", "member_badge_orders");
    }
    return `${url.pathname}${url.search}`;
  } catch {
    return "/admin/participants?view=member_badge_orders";
  }
}

const PARTICIPANT_DIRECTORY_PATH = "/admin/participants";
const MEMBER_REGISTERED_SOURCE_PREFIX = "member-registered:";
/** Opaque directory ids. Rejects query, path, and whitespace injection. */
const PARTICIPANT_DIRECTORY_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;

export function participantIdFromMemberRegisteredSourceEvent(
  sourceEventId: string | null | undefined,
): string | null {
  const raw = sourceEventId?.trim() ?? "";
  if (!raw.startsWith(MEMBER_REGISTERED_SOURCE_PREFIX)) {
    return null;
  }
  const memberId = raw.slice(MEMBER_REGISTERED_SOURCE_PREFIX.length);
  if (!PARTICIPANT_DIRECTORY_ID_PATTERN.test(memberId)) {
    return null;
  }
  return memberId;
}

/**
 * Legacy New Participant rows store only the directory path. Their event id
 * already carries member-registered:{memberId}. A future row may include the
 * id in targetHref; that value wins and is not rewritten.
 */
export function participantRegisteredNotificationHref(
  notification: Pick<AdminNotification, "targetHref" | "sourceEventId">,
): string {
  const raw = notification.targetHref?.trim() || PARTICIPANT_DIRECTORY_PATH;
  try {
    const url = new URL(raw, "https://hu.local");
    if (url.pathname !== PARTICIPANT_DIRECTORY_PATH) {
      return raw;
    }
    const existing = url.searchParams.get("participantId")?.trim() ?? "";
    if (PARTICIPANT_DIRECTORY_ID_PATTERN.test(existing)) {
      return `${url.pathname}${url.search}`;
    }
    const memberId = participantIdFromMemberRegisteredSourceEvent(notification.sourceEventId);
    if (!memberId) {
      return `${url.pathname}${url.search}`;
    }
    url.searchParams.set("participantId", memberId);
    return `${url.pathname}${url.search}`;
  } catch {
    return PARTICIPANT_DIRECTORY_PATH;
  }
}

const INTEGRITY_MEDIA_AUTHOR_DIRECTORY_PATH = "/admin/integrity-media";

/**
 * Click address for an author-reply notification. The stored targetHref stays
 * the directory. A valid reply id selects that conversation; anything else
 * stays on the directory and does not open a chat.
 */
export function integrityMediaAuthorMessageNotificationHref(
  notification: Pick<AdminNotification, "targetHref" | "sourceEventId">,
): string {
  const directory = notification.targetHref?.trim() || INTEGRITY_MEDIA_AUTHOR_DIRECTORY_PATH;
  const messageId = notification.sourceEventId?.trim() ?? "";
  if (!isIntegrityMediaAuthorReplyMessageId(messageId)) {
    return directory;
  }

  const params = new URLSearchParams();
  params.set("messageId", messageId);
  return `${INTEGRITY_MEDIA_AUTHOR_DIRECTORY_PATH}?${params.toString()}`;
}

export function formatAdminNotificationDate(iso: string): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(parsed);
}
