/**
 * Pack 21D — register Blog publication subscriber delivery consumer.
 */
import { registerDomainEventHandler } from "../../infrastructure/integration/event-handler-registry.js";
import { CATALOGUE_EVENTS } from "../../infrastructure/events/catalogue-events.js";
import {
  BLOG_PUBLICATION_DELIVERY_CONSUMER_ID,
  handleBlogPostPublishedPublicationDelivery,
} from "./blog-publication-delivery.consumer.js";

let blogPublicationDeliveryHandlersRegistered = false;

export function resetBlogPublicationDeliveryHandlersForTests(): void {
  blogPublicationDeliveryHandlersRegistered = false;
}

export function registerBlogPublicationDeliveryHandlers(): void {
  if (blogPublicationDeliveryHandlersRegistered) {
    return;
  }

  registerDomainEventHandler({
    consumerId: BLOG_PUBLICATION_DELIVERY_CONSUMER_ID,
    eventName: CATALOGUE_EVENTS.blogPostPublished,
    handle: handleBlogPostPublishedPublicationDelivery,
  });

  blogPublicationDeliveryHandlersRegistered = true;
}

export {
  BLOG_PUBLICATION_DELIVERY_CONSUMER_ID,
  handleBlogPostPublishedPublicationDelivery,
} from "./blog-publication-delivery.consumer.js";
export {
  BLOG_PUBLICATION_DELIVERY_BATCH_SIZE,
  BLOG_PUBLICATION_DELIVERY_CONCURRENCY,
  BLOG_PUBLICATION_DELIVERY_MAX_ATTEMPTS,
  fanOutBlogPublicationDelivery,
  isBlogPostPubliclyDeliverable,
  parseBlogPostPublishedDeliveryPayload,
} from "./blog-publication-delivery.service.js";
