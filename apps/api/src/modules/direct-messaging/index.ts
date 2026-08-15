export { directMessagingRouter } from "./direct-messaging.routes.js";
export {
  getDirectConversationDetail,
  listMyDirectConversations,
  listOlderDirectMessages,
  markDirectConversationRead,
  openOrCreateDirectConversation,
  requireConversationMembership,
  sendDirectMessage,
} from "./direct-messaging.service.js";
export {
  areParticipantsActiveAllies,
  isNewDirectConversationAllowed,
  isSendIntoExistingConversationAllowed,
} from "./direct-messaging-eligibility.js";
export { drainDirectMessageNotificationsForTests } from "./direct-messaging-notifications.js";
export { listUnreadDirectMessageSenderParticipantIds } from "./direct-messaging.projection.js";
export type { DirectConversationTargetIdentity } from "./direct-messaging.service.js";
export * from "./direct-messaging.errors.js";
