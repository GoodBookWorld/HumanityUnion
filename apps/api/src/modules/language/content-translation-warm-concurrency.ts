/**
 * Pack 02G Task 04 / 08I.16 — bounded locale fan-out concurrency for warm consumer.
 *
 * Locale fan-out must never exceed CONTENT_TRANSLATION_WORKER_CONCURRENCY.
 */

import { resolveContentTranslationWorkerConcurrency } from "./content-translation-worker-concurrency.js";

const DEFAULT_LOCALE_CONCURRENCY = 1;

export function resolveContentTranslationWarmLocaleConcurrency(): number {
  const raw = process.env.CONTENT_TRANSLATION_WARM_LOCALE_CONCURRENCY?.trim();
  let resolved = DEFAULT_LOCALE_CONCURRENCY;
  if (raw) {
    const parsed = Number.parseInt(raw, 10);
    if (Number.isFinite(parsed) && parsed >= 1) {
      resolved = Math.min(parsed, 8);
    }
  }
  return Math.min(resolved, resolveContentTranslationWorkerConcurrency());
}

/**
 * Deterministic ordered map with a small concurrency ceiling.
 */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  if (items.length === 0) {
    return [];
  }
  const limit = Math.max(1, concurrency);
  const results = new Array<R>(items.length);
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await mapper(items[index]!, index);
    }
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}
