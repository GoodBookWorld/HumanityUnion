/**
 * Pack 21C — Blog subscriber Admin labels + eligibility helpers.
 */
import type { BlogSubscriptionStatus, BlogSubscriptionType } from "@hu/types";

export function formatBlogSubscriptionTypeLabel(type: BlogSubscriptionType): string {
  switch (type) {
    case "blog_publications":
      return "Blog publications";
    default: {
      const exhaustive: never = type;
      return String(exhaustive);
    }
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
    default: {
      const exhaustive: never = status;
      return String(exhaustive);
    }
  }
}

/** Eligible for future publication fan-out (Pack 21D) — subscribed only. */
export function isBlogSubscriberEligibleForPublicationDelivery(
  status: BlogSubscriptionStatus,
): boolean {
  return status === "subscribed";
}
