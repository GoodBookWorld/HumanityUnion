/**
 * Pack 21C — Blog subscription Admin UI labels.
 */
import type { BlogSubscriptionStatus, BlogSubscriptionType } from "@hu/types";

export function formatBlogSubscriptionTypeLabel(type: BlogSubscriptionType): string {
  switch (type) {
    case "blog_publications":
      return "Blog publications";
    default:
      return type;
  }
}

export function formatBlogSubscriptionStatusLabel(status: BlogSubscriptionStatus): string {
  switch (status) {
    case "not_confirmed":
      return "Not confirmed";
    case "subscribed":
      return "Subscribed";
    case "unsubscribed":
      return "Unsubscribed";
    default:
      return status;
  }
}

export function blogSubscriptionStatusClassName(status: BlogSubscriptionStatus): string {
  switch (status) {
    case "subscribed":
      return "admin-publishing-table__status admin-publishing-table__status--active";
    case "not_confirmed":
      return "admin-publishing-table__status admin-publishing-table__status--pending";
    case "unsubscribed":
      return "admin-publishing-table__status admin-publishing-table__status--blocked";
    default:
      return "admin-publishing-table__status";
  }
}
