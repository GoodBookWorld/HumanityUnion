/**
 * Backward-compatible re-exports.
 * Mail Delivery Reliability Pack 01 consolidates guards in email-safety-guards.ts.
 */
export {
  assertRecipientAllowedForExternalDelivery,
  assertSafeEmailProviderForCurrentMode,
  assertSafeRecipientForVerificationMode,
  isAutomatedTestOrVerificationEnvironment,
  isRealEmailAllowedInTests,
  isReservedTestRecipient,
  isSafePublicHttpsLogoUrl,
  isSyntheticTestRecipient,
  isVerificationMode,
  maskRecipientEmail,
  mustForceMockEmailProvider,
  recipientDomainForLogs,
  TestRecipientBlockedError,
} from "./email-safety-guards.js";
