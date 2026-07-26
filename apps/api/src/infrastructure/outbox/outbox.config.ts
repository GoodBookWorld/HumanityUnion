export function resolveOutboxConfig() {
  const dispatchEnabledRaw = process.env.OUTBOX_DISPATCH_ENABLED?.trim().toLowerCase();
  const dispatchEnabled =
    dispatchEnabledRaw === undefined
      ? true
      : dispatchEnabledRaw === "true" || dispatchEnabledRaw === "1";

  return {
    dispatchEnabled,
    dispatchIntervalMs: Number(process.env.OUTBOX_DISPATCH_INTERVAL_MS ?? 2_000),
    dispatchBatchSize: Number(process.env.OUTBOX_DISPATCH_BATCH_SIZE ?? 50),
    maxAttempts: Number(process.env.OUTBOX_MAX_ATTEMPTS ?? 5),
  };
}

export type OutboxConfig = ReturnType<typeof resolveOutboxConfig>;
