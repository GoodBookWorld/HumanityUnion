/**
 * Pack 08K.2.8 — process-local counters for thin residual diagnostics.
 */

const counters = {
  SOURCE_RECORDS_LOADED: 0,
  TRANSLATION_ROWS_LOADED: 0,
  OUTBOX_ROWS_INSPECTED: 0,
  IDENTITY_RESOLUTIONS: 0,
  WRITES_PERFORMED: 0,
  PROVIDER_CALLS: 0,
  MONGO_CLOSED: false,
};

export function resetThinLocalizationCountersForTests(): void {
  counters.SOURCE_RECORDS_LOADED = 0;
  counters.TRANSLATION_ROWS_LOADED = 0;
  counters.OUTBOX_ROWS_INSPECTED = 0;
  counters.IDENTITY_RESOLUTIONS = 0;
  counters.WRITES_PERFORMED = 0;
  counters.PROVIDER_CALLS = 0;
  counters.MONGO_CLOSED = false;
}

export function markThinSourceRecordsLoaded(count: number): void {
  counters.SOURCE_RECORDS_LOADED += Math.max(0, count);
}

export function markThinTranslationRowsLoaded(count: number): void {
  counters.TRANSLATION_ROWS_LOADED += Math.max(0, count);
}

export function markThinOutboxRowsInspected(count: number): void {
  counters.OUTBOX_ROWS_INSPECTED += Math.max(0, count);
}

export function markThinIdentityResolved(): void {
  counters.IDENTITY_RESOLUTIONS += 1;
}

export function markThinWritePerformedForTests(): void {
  counters.WRITES_PERFORMED += 1;
}

export function markThinProviderCallForTests(): void {
  counters.PROVIDER_CALLS += 1;
}

export function markThinMongoClosed(): void {
  counters.MONGO_CLOSED = true;
}

export function getThinLocalizationCounters(): {
  readonly SOURCE_RECORDS_LOADED: number;
  readonly TRANSLATION_ROWS_LOADED: number;
  readonly OUTBOX_ROWS_INSPECTED: number;
  readonly IDENTITY_RESOLUTIONS: number;
  readonly WRITES_PERFORMED: number;
  readonly PROVIDER_CALLS: number;
  readonly MONGO_CLOSED: boolean;
} {
  return { ...counters };
}
