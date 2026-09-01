/**
 * Pack 02G Task 04 — bounded locale fan-out concurrency for warm consumer.
 */

const DEFAULT_LOCALE_CONCURRENCY = 2;

export function resolveContentTranslationWarmLocaleConcurrency(): number {
  const raw = process.env.CONTENT_TRANSLATION_WARM_LOCALE_CONCURRENCY?.trim();
  if (!raw) {
    return DEFAULT_LOCALE_CONCURRENCY;
  }
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return DEFAULT_LOCALE_CONCURRENCY;
  }
  return Math.min(parsed, 8);
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
