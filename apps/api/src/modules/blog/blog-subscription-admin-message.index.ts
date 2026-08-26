/**
 * Pack 21E — register Admin selected-subscriber message consumer.
 */
import { registerDomainEventHandler } from "../../infrastructure/integration/event-handler-registry.js";
import { CATALOGUE_EVENTS } from "../../infrastructure/events/catalogue-events.js";
import {
  BLOG_ADMIN_SUBSCRIBER_MESSAGE_CONSUMER_ID,
  handleBlogAdminSubscriberMessageQueued,
} from "./blog-subscription-admin-message.consumer.js";

let blogAdminSubscriberMessageHandlersRegistered = false;

export function resetBlogAdminSubscriberMessageHandlersForTests(): void {
  blogAdminSubscriberMessageHandlersRegistered = false;
}

export function registerBlogAdminSubscriberMessageHandlers(): void {
  if (blogAdminSubscriberMessageHandlersRegistered) {
    return;
  }

  registerDomainEventHandler({
    consumerId: BLOG_ADMIN_SUBSCRIBER_MESSAGE_CONSUMER_ID,
    eventName: CATALOGUE_EVENTS.blogAdminSubscriberMessageQueued,
    handle: handleBlogAdminSubscriberMessageQueued,
  });

  blogAdminSubscriberMessageHandlersRegistered = true;
}

export {
  BLOG_ADMIN_SUBSCRIBER_MESSAGE_CONSUMER_ID,
  handleBlogAdminSubscriberMessageQueued,
} from "./blog-subscription-admin-message.consumer.js";
export {
  BLOG_ADMIN_SUBSCRIBER_MESSAGE_BATCH_SIZE,
  BLOG_ADMIN_SUBSCRIBER_MESSAGE_CONCURRENCY,
  BLOG_ADMIN_SUBSCRIBER_MESSAGE_MAX_ATTEMPTS,
  fanOutBlogAdminSubscriberMessage,
  parseBlogAdminSubscriberMessageQueuedPayload,
} from "./blog-subscription-admin-message-delivery.service.js";
export { queueAdminBlogSubscriberMessage } from "./blog-subscription-admin-message.service.js";
