export { default as emailRouter } from "./email.routes.js";
export { resolveEmailProvider, resetEmailProviderCacheForTests } from "./email.provider.js";
export {
  resolveEmailConfig,
  isAuthEmailVerificationRequired,
  CANONICAL_FLOCKMAIL_SMTP_HOST,
} from "./email.config.js";
export {
  MailDeliveryService,
  sendTransactionalEmail,
  sendTransactionalEmailAndAwait,
  sendRegistrationVerificationEmail,
  sendPasswordResetEmail,
  sendEmailChangeVerificationEmail,
  sendSecurityAlertEmail,
  sendLoginNotificationEmail,
  sendWorkspaceNotificationSummaryEmail,
  sendWorkspaceMessageAlertEmail,
  sendBlogAuthorApplicationStatusEmail,
  sendBlogPublicationStatusEmail,
  isParticipantEmailNotificationsEnabled,
  getEmailProviderHealth,
  drainEmailQueueForTests,
} from "./email.service.js";
export {
  isSyntheticTestRecipient,
  mustForceMockEmailProvider,
  assertRecipientAllowedForExternalDelivery,
  TestRecipientBlockedError,
} from "./email-safety-guards.js";
export {
  createEmailVerificationToken,
  consumeEmailVerificationToken,
  findValidEmailVerificationToken,
  hashVerificationToken,
  clearEmailVerificationTokensForTests,
  deleteEmailVerificationTokensByUserIds,
} from "./email.tokens.js";
export {
  createEmailAuditRecord,
  findEmailAuditRecordById,
  toEmailAuditRecordPublic,
  clearEmailAuditRecordsForTests,
  deleteEmailAuditRecordsByRecipientHashPrefix,
} from "./email.audit.js";
export { renderEmailTemplate, hashRecipientEmail } from "./email.templates.js";
export { clearEmailQueueForTests } from "./email.queue.js";
export { MockEmailProvider } from "./providers/mock.provider.js";
