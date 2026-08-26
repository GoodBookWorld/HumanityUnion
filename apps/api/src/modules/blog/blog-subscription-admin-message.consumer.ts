/**
 * Pack 21E — BlogAdminSubscriberMessageQueued outbox consumer.
 */
import type { CanonicalDomainEventEnvelope } from "../../infrastructure/events/domain-event.js";
import {
  BLOG_ADMIN_SUBSCRIBER_MESSAGE_CONSUMER_ID,
  fanOutBlogAdminSubscriberMessage,
} from "./blog-subscription-admin-message-delivery.service.js";

export { BLOG_ADMIN_SUBSCRIBER_MESSAGE_CONSUMER_ID };

export async function handleBlogAdminSubscriberMessageQueued(
  envelope: CanonicalDomainEventEnvelope,
): Promise<void> {
  await fanOutBlogAdminSubscriberMessage({ envelope });
}
