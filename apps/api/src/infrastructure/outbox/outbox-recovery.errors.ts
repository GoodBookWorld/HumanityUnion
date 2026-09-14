/**
 * Staging Historical Outbox Recovery — reusable single-ID failed→pending requeue.
 *
 * Does not mark published, does not delete history, does not bulk-retry.
 * Downstream delivery remains the canonical dispatcher path.
 */

export class OutboxRecoveryValidationError extends Error {
  readonly code = "outbox_recovery_validation" as const;

  constructor(message: string) {
    super(message);
    this.name = "OutboxRecoveryValidationError";
  }
}

export class OutboxRecoveryNotFoundError extends Error {
  readonly code = "outbox_recovery_not_found" as const;

  constructor(outboxId: string) {
    super(`Outbox record "${outboxId}" was not found.`);
    this.name = "OutboxRecoveryNotFoundError";
  }
}

export class OutboxRecoveryNotFailedError extends Error {
  readonly code = "outbox_recovery_not_failed" as const;

  constructor(outboxId: string, status: string) {
    super(
      `Outbox record "${outboxId}" has status "${status}" and cannot be requeued. Only failed records may be retried.`,
    );
    this.name = "OutboxRecoveryNotFailedError";
  }
}

/** Fail-closed ID validation — exact single UUID string only. */
export function assertSingleOutboxId(raw: unknown): string {
  if (typeof raw !== "string" || !raw.trim()) {
    throw new OutboxRecoveryValidationError("A single outboxId is required.");
  }
  const outboxId = raw.trim();
  if (outboxId.includes(",") || outboxId.includes(" ")) {
    throw new OutboxRecoveryValidationError(
      "Bulk outbox retry is not supported. Provide exactly one outboxId.",
    );
  }
  // Canonical outbox _id is UUID v4 (see enqueueDomainEvent).
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      outboxId,
    )
  ) {
    throw new OutboxRecoveryValidationError("outboxId must be a UUID.");
  }
  return outboxId;
}

/**
 * Pure gate used by repository + tests: only `failed` may requeue.
 * pending/published must fail closed.
 */
export function assertOutboxRecordEligibleForFailedRetry(input: {
  outboxId: string;
  status: string;
}): void {
  if (input.status === "failed") {
    return;
  }
  throw new OutboxRecoveryNotFailedError(input.outboxId, input.status);
}
