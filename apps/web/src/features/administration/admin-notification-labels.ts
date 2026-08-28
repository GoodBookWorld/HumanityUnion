/**
 * Pack 22E.2 — presentation labels for Admin notification types.
 * Pack 25D.1 — legacy member_badge_order_paid deep-link fallback.
 */
import type { AdminNotification, AdminNotificationType } from "@hu/types";

const ADMIN_NOTIFICATION_TYPE_LABELS: Record<AdminNotificationType, string> = {
  participant_registered: "New Participant",
  blog_subscriber_confirmed: "New Blog subscriber",
  initiative_published: "New Initiative",
  public_choice_published: "New Public Choice",
  blog_post_published: "New Blog publication",
  operational_alert: "Platform alert",
  participant_suspension_review_requested: "Suspension review request",
  member_badge_order_paid: "Member badge order paid",
};

export function resolveAdminNotificationTypeLabel(
  notification: Pick<AdminNotification, "type" | "title">,
): string {
  const mapped = ADMIN_NOTIFICATION_TYPE_LABELS[notification.type];
  if (mapped) {
    return mapped;
  }
  const title = notification.title?.trim();
  return title && title.length > 0 ? title : "Notification";
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
  notification: Pick<AdminNotification, "type" | "targetHref">,
): string | null {
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
