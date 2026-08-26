/**
 * Pack 22E.1 — register Admin notification projection consumers.
 */
import { registerDomainEventHandler } from "../../infrastructure/integration/event-handler-registry.js";
import { CATALOGUE_EVENTS } from "../../infrastructure/events/catalogue-events.js";
import {
  ADMIN_NOTIFICATIONS_BLOG_POST_PUBLISHED_CONSUMER_ID,
  ADMIN_NOTIFICATIONS_BLOG_SUBSCRIBER_CONFIRMED_CONSUMER_ID,
  ADMIN_NOTIFICATIONS_INITIATIVE_PUBLISHED_CONSUMER_ID,
  ADMIN_NOTIFICATIONS_MEMBER_REGISTERED_CONSUMER_ID,
  handleBlogPostPublishedAdminNotification,
  handleBlogSubscriptionConfirmedAdminNotification,
  handleInitiativePublishedAdminNotification,
  handleMemberRegisteredAdminNotification,
} from "./admin-notification.consumers.js";

let adminNotificationHandlersRegistered = false;

export function resetAdminNotificationHandlersForTests(): void {
  adminNotificationHandlersRegistered = false;
}

export function registerAdminNotificationHandlers(): void {
  if (adminNotificationHandlersRegistered) {
    return;
  }

  registerDomainEventHandler({
    consumerId: ADMIN_NOTIFICATIONS_MEMBER_REGISTERED_CONSUMER_ID,
    eventName: CATALOGUE_EVENTS.memberRegistered,
    handle: handleMemberRegisteredAdminNotification,
  });

  registerDomainEventHandler({
    consumerId: ADMIN_NOTIFICATIONS_BLOG_SUBSCRIBER_CONFIRMED_CONSUMER_ID,
    eventName: CATALOGUE_EVENTS.blogSubscriptionConfirmed,
    handle: handleBlogSubscriptionConfirmedAdminNotification,
  });

  registerDomainEventHandler({
    consumerId: ADMIN_NOTIFICATIONS_INITIATIVE_PUBLISHED_CONSUMER_ID,
    eventName: CATALOGUE_EVENTS.initiativePublished,
    handle: handleInitiativePublishedAdminNotification,
  });

  registerDomainEventHandler({
    consumerId: ADMIN_NOTIFICATIONS_BLOG_POST_PUBLISHED_CONSUMER_ID,
    eventName: CATALOGUE_EVENTS.blogPostPublished,
    handle: handleBlogPostPublishedAdminNotification,
  });

  adminNotificationHandlersRegistered = true;
}

export {
  ADMIN_NOTIFICATIONS_BLOG_POST_PUBLISHED_CONSUMER_ID,
  ADMIN_NOTIFICATIONS_BLOG_SUBSCRIBER_CONFIRMED_CONSUMER_ID,
  ADMIN_NOTIFICATIONS_INITIATIVE_PUBLISHED_CONSUMER_ID,
  ADMIN_NOTIFICATIONS_MEMBER_REGISTERED_CONSUMER_ID,
  handleBlogPostPublishedAdminNotification,
  handleBlogSubscriptionConfirmedAdminNotification,
  handleInitiativePublishedAdminNotification,
  handleMemberRegisteredAdminNotification,
} from "./admin-notification.consumers.js";
export {
  countAdminNotificationsForActor,
  deleteAdminNotificationForActor,
  listAdminNotificationsForActor,
  listActiveAdminUserIds,
  projectAdminNotificationForAdmins,
  updateAdminNotificationsBySourceEventId,
  ADMIN_NOTIFICATION_RETENTION_DAYS,
  computeAdminNotificationExpireAt,
} from "./admin-notification.service.js";
export {
  createBlogSubscriptionConfirmedEvent,
  emitBlogSubscriptionConfirmed,
  buildBlogSubscriptionConfirmedEventId,
} from "./events/blog-subscription-confirmed.event.js";
export {
  createInitiativePublishedEvent,
  emitInitiativePublished,
  buildInitiativePublishedEventId,
} from "./events/initiative-published.event.js";
export {
  resetMemoryAdminNotificationPersistenceForTests,
} from "./persistence/admin-notification-memory.persistence.js";
export {
  resetAdminNotificationPersistenceResolverForTests,
} from "./persistence/resolve-admin-notification-persistence.js";
export {
  detectOperationalConditions,
  evaluateAdminOperationalAlerts,
  collectLiveOperationalHealthSnapshot,
} from "./operational/evaluate-admin-operational-alerts.js";
export {
  resetAdminOperationalIncidentStoreForTests,
  resolveAdminOperationalIncidentStore,
} from "./operational/admin-operational-incident.store.js";
