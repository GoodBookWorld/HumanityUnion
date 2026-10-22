/**
 * Process-wide gate for SEO localized-eligibility evidence fetches.
 *
 * Identical in-flight requests share one promise. The entry is removed when
 * that promise settles, so a negative result cannot be reused later.
 * At most {@link SEO_EVIDENCE_FETCH_CONCURRENCY_LIMIT} fetches run at once.
 * Additional work waits in a FIFO queue and is never dropped.
 *
 * Stored on globalThis so duplicated server module instances share one gate.
 * Callers must not acquire another permit from inside `work` (that deadlocks).
 */

const SEO_EVIDENCE_FETCH_GATE_KEY = "__huSeoEvidenceFetchGate";

export const SEO_EVIDENCE_FETCH_CONCURRENCY_LIMIT = 8;

interface QueuedPermit {
  readonly generation: number;
  readonly grant: () => void;
  readonly cancel: (error: Error) => void;
}

interface SeoEvidenceFetchGateState {
  active: number;
  generation: number;
  readonly queue: QueuedPermit[];
  readonly inFlight: Map<string, Promise<unknown>>;
}

function gateState(): SeoEvidenceFetchGateState {
  const host = globalThis as unknown as Record<string, SeoEvidenceFetchGateState | undefined>;
  const existing = host[SEO_EVIDENCE_FETCH_GATE_KEY];
  if (existing) {
    return existing;
  }
  const created: SeoEvidenceFetchGateState = {
    active: 0,
    generation: 0,
    queue: [],
    inFlight: new Map(),
  };
  host[SEO_EVIDENCE_FETCH_GATE_KEY] = created;
  return created;
}

function acquire(state: SeoEvidenceFetchGateState, generation: number): Promise<void> {
  if (state.active < SEO_EVIDENCE_FETCH_CONCURRENCY_LIMIT) {
    state.active += 1;
    return Promise.resolve();
  }
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

function release(state: SeoEvidenceFetchGateState): void {
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

/**
 * Run one evidence fetch, sharing an in-flight promise for `key`.
 * The key must include every input that can change the response.
 */
export function runSeoEvidenceFetch<T>(key: string, work: () => Promise<T>): Promise<T> {
  const state = gateState();
  const existing = state.inFlight.get(key);
  if (existing) {
    return existing as Promise<T>;
  }

  let resolvePromise!: (value: T) => void;
  let rejectPromise!: (reason: unknown) => void;
  const promise = new Promise<T>((resolve, reject) => {
    resolvePromise = resolve;
    rejectPromise = reject;
  });
  state.inFlight.set(key, promise);

  const generation = state.generation;
  void (async () => {
    let permitHeld = false;
    try {
      await acquire(state, generation);
      if (state.generation !== generation) {
        throw new Error("SEO evidence fetch gate was reset.");
      }
      permitHeld = true;
      resolvePromise(await work());
    } catch (error) {
      rejectPromise(error);
    } finally {
      if (state.generation === generation && state.inFlight.get(key) === promise) {
        state.inFlight.delete(key);
      }
      if (permitHeld && state.generation === generation) {
        release(state);
      }
    }
  })();

  return promise;
}

export function readActiveSeoEvidenceFetchesForTests(): number {
  return gateState().active;
}

export function readQueuedSeoEvidenceFetchesForTests(): number {
  return gateState().queue.length;
}

export function readInFlightSeoEvidenceKeysForTests(): readonly string[] {
  return [...gateState().inFlight.keys()];
}

export function resetSeoEvidenceFetchGateForTests(): void {
  const state = gateState();
  state.generation += 1;
  state.active = 0;
  const abandoned = state.queue.splice(0);
  state.inFlight.clear();
  const error = new Error("SEO evidence fetch gate was reset.");
  for (const waiter of abandoned) {
    waiter.cancel(error);
  }
}
