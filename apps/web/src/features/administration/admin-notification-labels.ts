/**
 * Pack 22E.2 — presentation labels for Admin notification types.
 */
import type { AdminNotification, AdminNotificationType } from "@hu/types";

const ADMIN_NOTIFICATION_TYPE_LABELS: Record<AdminNotificationType, string> = {
  participant_registered: "New Participant",
  blog_subscriber_confirmed: "New Blog subscriber",
  initiative_published: "New Initiative",
  public_choice_published: "New Public Choice",
  blog_post_published: "New Blog publication",
  operational_alert: "Platform alert",
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
