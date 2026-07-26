export { default as emailRouter } from "./email.routes.js";
export { resolveEmailProvider } from "./email.provider.js";
export { resolveEmailConfig, isAuthEmailVerificationRequired } from "./email.config.js";
export {
  sendTransactionalEmail,
  sendRegistrationVerificationEmail,
  sendPasswordResetEmail,
  sendEmailChangeVerificationEmail,
  sendSecurityAlertEmail,
  sendLoginNotificationEmail,
  getEmailProviderHealth,
  drainEmailQueueForTests,
} from "./email.service.js";
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
