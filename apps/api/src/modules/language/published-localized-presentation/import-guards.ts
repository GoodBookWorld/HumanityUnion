/**
 * Reset 02 — test-visible import guards for the PUBLISHED read path.
 * Flip only when a forbidden module is actually imported into the read graph.
 */

export type PublishedLocalizationReadImportGuards = {
  PUBLISHED_READ_PROVIDER_IMPORTED: boolean;
  PUBLISHED_READ_WORKER_IMPORTED: boolean;
  PUBLISHED_READ_CORPUS_IMPORTED: boolean;
  PUBLISHED_READ_AGGREGATE_HYDRATION_IMPORTED: boolean;
};

const guards: PublishedLocalizationReadImportGuards = {
  PUBLISHED_READ_PROVIDER_IMPORTED: false,
  PUBLISHED_READ_WORKER_IMPORTED: false,
  PUBLISHED_READ_CORPUS_IMPORTED: false,
  PUBLISHED_READ_AGGREGATE_HYDRATION_IMPORTED: false,
};

export function getPublishedLocalizationReadImportGuards(): PublishedLocalizationReadImportGuards {
  return { ...guards };
}

export function resetPublishedLocalizationReadImportGuardsForTests(): void {
  guards.PUBLISHED_READ_PROVIDER_IMPORTED = false;
  guards.PUBLISHED_READ_WORKER_IMPORTED = false;
  guards.PUBLISHED_READ_CORPUS_IMPORTED = false;
  guards.PUBLISHED_READ_AGGREGATE_HYDRATION_IMPORTED = false;
}

/** Test-only: simulate a forbidden import edge (must not be called from production read). */
export function markPublishedReadProviderImportedForTests(): void {
  guards.PUBLISHED_READ_PROVIDER_IMPORTED = true;
}

export function markPublishedReadWorkerImportedForTests(): void {
  guards.PUBLISHED_READ_WORKER_IMPORTED = true;
}

export function markPublishedReadCorpusImportedForTests(): void {
  guards.PUBLISHED_READ_CORPUS_IMPORTED = true;
}

export function markPublishedReadAggregateHydrationImportedForTests(): void {
  guards.PUBLISHED_READ_AGGREGATE_HYDRATION_IMPORTED = true;
}

export function formatPublishedReadImportGuardCounters(
  values: PublishedLocalizationReadImportGuards = getPublishedLocalizationReadImportGuards(),
): string {
  return [
    `PUBLISHED_READ_PROVIDER_IMPORTED=${values.PUBLISHED_READ_PROVIDER_IMPORTED}`,
    `PUBLISHED_READ_WORKER_IMPORTED=${values.PUBLISHED_READ_WORKER_IMPORTED}`,
    `PUBLISHED_READ_CORPUS_IMPORTED=${values.PUBLISHED_READ_CORPUS_IMPORTED}`,
    `PUBLISHED_READ_AGGREGATE_HYDRATION_IMPORTED=${values.PUBLISHED_READ_AGGREGATE_HYDRATION_IMPORTED}`,
  ].join("\n");
}
