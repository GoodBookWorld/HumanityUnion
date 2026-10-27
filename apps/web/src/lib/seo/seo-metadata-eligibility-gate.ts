/**
 * Process-wide gate for SEO metadata eligibility.
 *
 * At most {@link SEO_METADATA_ELIGIBILITY_CONCURRENCY_LIMIT} metadata
 * resolutions may run `buildPublicSeoLocalizedVariantPredicate` at once.
 * Additional callers wait in FIFO order and are never dropped.
 * This gate does not cache results and does not limit evidence fetches.
 *
 * Stored on globalThis so duplicated server module instances share one gate.
 * Acquire once per metadata resolution, before the predicate, and release in
 * finally. Do not acquire again from inside the predicate or from evidence
 * fetch work — a nested acquire deadlocks once four permits are held.
 */

const SEO_METADATA_ELIGIBILITY_GATE_KEY = "__huSeoMetadataEligibilityGate";

export const SEO_METADATA_ELIGIBILITY_CONCURRENCY_LIMIT = 4;

interface QueuedPermit {
  readonly generation: number;
  readonly grant: () => void;
  readonly cancel: (error: Error) => void;
}

interface SeoMetadataEligibilityGateState {
  active: number;
  generation: number;
  readonly queue: QueuedPermit[];
}

function gateState(): SeoMetadataEligibilityGateState {
  const host = globalThis as unknown as Record<string, SeoMetadataEligibilityGateState | undefined>;
  const existing = host[SEO_METADATA_ELIGIBILITY_GATE_KEY];
  if (existing) {
    return existing;
  }
  const created: SeoMetadataEligibilityGateState = {
    active: 0,
    generation: 0,
    queue: [],
  };
  host[SEO_METADATA_ELIGIBILITY_GATE_KEY] = created;
  return created;
}

/**
 * Wait for a metadata eligibility permit. The permit is held by the caller
 * until {@link releaseSeoMetadataEligibilityPermit}.
 */
export function acquireSeoMetadataEligibilityPermit(): Promise<void> {
  const state = gateState();
  if (state.active < SEO_METADATA_ELIGIBILITY_CONCURRENCY_LIMIT) {
    state.active += 1;
    return Promise.resolve();
  }
  const generation = state.generation;
  return new Promise((resolve, reject) => {
    state.queue.push({
      generation,
      grant: () => {
        state.active += 1;
        resolve();
      },
      cancel: (error) => {
        reject(error);
      },
    });
  });
}

/** Return one permit and start the oldest waiter, if any. */
export function releaseSeoMetadataEligibilityPermit(): void {
  const state = gateState();
  if (state.active > 0) {
    state.active -= 1;
  }
  while (state.queue.length > 0) {
    const next = state.queue.shift();
    if (!next || next.generation !== state.generation) {
      continue;
    }
    next.grant();
    return;
  }
}

export function readActiveSeoMetadataEligibilityPermitsForTests(): number {
  return gateState().active;
}

export function readQueuedSeoMetadataEligibilityPermitsForTests(): number {
  return gateState().queue.length;
}

export function resetSeoMetadataEligibilityGateForTests(): void {
  const state = gateState();
  state.generation += 1;
  state.active = 0;
  const abandoned = state.queue.splice(0);
  const error = new Error("SEO metadata eligibility gate was reset.");
  for (const waiter of abandoned) {
    waiter.cancel(error);
  }
}
