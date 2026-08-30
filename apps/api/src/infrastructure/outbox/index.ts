export {
  dispatchOutboxBatch,
  dispatchOutboxOnceForTests,
  getOutboxHealthStatus,
  resetOutboxDispatcherStateForTests,
  startOutboxDispatcher,
  stopOutboxDispatcher,
} from "./outbox.dispatcher.js";
export { resolveOutboxConfig, type OutboxConfig } from "./outbox.config.js";
export {
  deleteOutboxRecordsByEventIdPrefix,
  enqueueDomainEvent,
  fetchPendingOutboxRecords,
  findOutboxRecordById,
  getOutboxDispatchStats,
  markOutboxRecordFailed,
  markOutboxRecordPublished,
  requeueFailedOutboxRecordById,
  setForceEnqueueFailureForTests,
} from "./outbox.repository.js";
export {
  assertOutboxRecordEligibleForFailedRetry,
  assertSingleOutboxId,
  OutboxRecoveryNotFailedError,
  OutboxRecoveryNotFoundError,
  OutboxRecoveryValidationError,
} from "./outbox-recovery.errors.js";
export {
  formatRetryFailedOutboxSummary,
  retryFailedOutboxRecordById,
  type RetryFailedOutboxRecordResult,
} from "./outbox-recovery.service.js";
export {
  claimEventForProcessing,
  deleteProcessedEventsByConsumerIdPrefix,
  deleteProcessedEventsByEventIdPrefix,
  isEventProcessed,
  markEventProcessingCompleted,
  releaseEventProcessingClaim,
  tryMarkEventProcessed,
} from "./processed-events.repository.js";
export type {
  EnqueueOutboxOptions,
  OutboxDispatchStats,
  OutboxHealthStatus,
  OutboxRecord,
  OutboxStatus,
} from "./outbox.types.js";
