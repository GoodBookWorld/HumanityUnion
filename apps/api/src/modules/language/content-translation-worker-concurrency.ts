/**
 * Pack 08I.16 — global bounded concurrency for TranslationProvider work.
 *
 * Universal coverage (08I.15) means eligible content is discoverable; it does
 * NOT mean unbounded parallel Gemini calls. One shared slot pool caps peak
 * memory on small staging instances.
 */

const DEFAULT_WORKER_CONCURRENCY = 1;
const MAX_WORKER_CONCURRENCY = 4;

let observedPeakConcurrency = 0;
let inFlight = 0;
const waitQueue: Array<() => void> = [];

export function resolveContentTranslationWorkerConcurrency(): number {
  const raw = process.env.CONTENT_TRANSLATION_WORKER_CONCURRENCY?.trim();
  if (!raw) {
    return DEFAULT_WORKER_CONCURRENCY;
  }
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return DEFAULT_WORKER_CONCURRENCY;
  }
  return Math.min(parsed, MAX_WORKER_CONCURRENCY);
}

export function getContentTranslationWorkerInFlightForTests(): number {
  return inFlight;
}

export function getContentTranslationWorkerPeakConcurrencyForTests(): number {
  return observedPeakConcurrency;
}

export function resetContentTranslationWorkerConcurrencyForTests(): void {
  inFlight = 0;
  observedPeakConcurrency = 0;
  waitQueue.length = 0;
}

/**
 * Acquire a global translation worker slot. Releases in `finally`.
 * Completed work returns before the next waiter runs (batch release).
 */
export async function withContentTranslationWorkerSlot<T>(
  run: () => Promise<T>,
): Promise<T> {
  const limit = resolveContentTranslationWorkerConcurrency();

  await new Promise<void>((resolve) => {
    const tryAcquire = () => {
      if (inFlight < limit) {
        inFlight += 1;
        observedPeakConcurrency = Math.max(observedPeakConcurrency, inFlight);
        resolve();
        return;
      }
      waitQueue.push(tryAcquire);
    };
    tryAcquire();
  });

  try {
    return await run();
  } finally {
    inFlight = Math.max(0, inFlight - 1);
    const next = waitQueue.shift();
    if (next) {
      next();
    }
  }
}
