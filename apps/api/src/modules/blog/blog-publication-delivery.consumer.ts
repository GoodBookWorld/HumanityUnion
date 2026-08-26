/**
 * Pack 21D — BlogPostPublished outbox consumer for subscriber publication emails.
 */
import type { CanonicalDomainEventEnvelope } from "../../infrastructure/events/domain-event.js";
import {
  BLOG_PUBLICATION_DELIVERY_CONSUMER_ID,
  fanOutBlogPublicationDelivery,
} from "./blog-publication-delivery.service.js";

export { BLOG_PUBLICATION_DELIVERY_CONSUMER_ID };

export async function handleBlogPostPublishedPublicationDelivery(
  envelope: CanonicalDomainEventEnvelope,
): Promise<void> {
  await fanOutBlogPublicationDelivery({ envelope });
}
