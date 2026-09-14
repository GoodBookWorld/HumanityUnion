/**
 * Staging Historical Outbox Recovery — operator-facing single failed-record retry.
 */

import { logger } from "../../shared/observability/logger.js";
import { dispatchOutboxBatch } from "./outbox.dispatcher.js";
import {
  assertSingleOutboxId,
  OutboxRecoveryNotFailedError,
  OutboxRecoveryNotFoundError,
  OutboxRecoveryValidationError,
} from "./outbox-recovery.errors.js";
import {
  findOutboxRecordById,
  requeueFailedOutboxRecordById,
} from "./outbox.repository.js";
import type { OutboxRecord } from "./outbox.types.js";

export interface RetryFailedOutboxRecordResult {
  readonly outboxId: string;
  readonly eventId: string;
  readonly eventName: string;
  readonly beforeStatus: "failed";
  readonly afterRequeueStatus: "pending";
  readonly priorAttempts: number;
  readonly priorLastError: string | null;
  readonly dispatchedNow: boolean;
  readonly afterDispatchStatus: OutboxRecord["status"] | null;
  readonly afterDispatchAttempts: number | null;
  readonly afterDispatchLastError: string | null;
}

/**
 * Requeue one failed outbox row, then optionally run one canonical dispatch cycle.
 * Never accepts arrays / bulk IDs. Never marks published directly.
 */
export async function retryFailedOutboxRecordById(input: {
  outboxId: string;
  dispatchNow?: boolean;
}): Promise<RetryFailedOutboxRecordResult> {
  const outboxId = assertSingleOutboxId(input.outboxId);
  const before = await findOutboxRecordById(outboxId);

  if (!before) {
    throw new OutboxRecoveryNotFoundError(outboxId);
  }

  if (before.status !== "failed") {
    throw new OutboxRecoveryNotFailedError(outboxId, before.status);
  }

  const requeued = await requeueFailedOutboxRecordById(outboxId);
  let afterDispatch: OutboxRecord | null = null;
  let dispatchedNow = false;

  if (input.dispatchNow === true) {
    await dispatchOutboxBatch();
    dispatchedNow = true;
    afterDispatch = await findOutboxRecordById(outboxId);
  }

  logger.info("outbox.recovery.retry_failed", {
    component: "outbox-recovery",
    outboxId,
    eventId: before.eventId,
    eventName: before.eventName,
    correlationId: before.correlationId,
    dispatchedNow,
    afterRequeueStatus: requeued.status,
    afterDispatchStatus: afterDispatch?.status ?? null,
  });

  return {
    outboxId,
    eventId: before.eventId,
    eventName: before.eventName,
    beforeStatus: "failed",
    afterRequeueStatus: "pending",
    priorAttempts: before.attempts,
    priorLastError: before.lastError,
    dispatchedNow,
    afterDispatchStatus: afterDispatch?.status ?? null,
    afterDispatchAttempts: afterDispatch?.attempts ?? null,
    afterDispatchLastError: afterDispatch?.lastError ?? null,
  };
}

export function formatRetryFailedOutboxSummary(
  result: RetryFailedOutboxRecordResult,
): string {
  const lines = [
    `outboxId=${result.outboxId}`,
    `eventId=${result.eventId}`,
    `eventName=${result.eventName}`,
    `beforeStatus=${result.beforeStatus}`,
    `afterRequeueStatus=${result.afterRequeueStatus}`,
    `priorAttempts=${result.priorAttempts}`,
    `priorLastError=${result.priorLastError ?? "(none)"}`,
    `dispatchedNow=${result.dispatchedNow}`,
  ];
  if (result.dispatchedNow) {
    lines.push(`afterDispatchStatus=${result.afterDispatchStatus ?? "(missing)"}`);
    lines.push(`afterDispatchAttempts=${result.afterDispatchAttempts ?? "(missing)"}`);
    lines.push(`afterDispatchLastError=${result.afterDispatchLastError ?? "(none)"}`);
  }
  return lines.join("\n");
}

export { OutboxRecoveryValidationError };
