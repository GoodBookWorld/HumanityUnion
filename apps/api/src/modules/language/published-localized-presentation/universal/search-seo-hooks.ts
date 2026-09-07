/**
 * RESET 04 — search/SEO invalidation hooks after atomic PLP publish.
 * HREFLANG remains DEFERRED. Hooks do not implement locale URLs.
 */

import type { PlpSearchSeoInvalidationHookInput } from "@hu/types";

export type PlpSearchSeoInvalidationListener = (
  input: PlpSearchSeoInvalidationHookInput,
) => void;

const listeners = new Set<PlpSearchSeoInvalidationListener>();

let lastInvalidation: PlpSearchSeoInvalidationHookInput | null = null;
let invalidationCount = 0;

export function registerPlpSearchSeoInvalidationListener(
  listener: PlpSearchSeoInvalidationListener,
): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function notifyPlpSearchSeoInvalidation(
  input: PlpSearchSeoInvalidationHookInput,
): void {
  lastInvalidation = input;
  invalidationCount += 1;
  for (const listener of listeners) {
    try {
      listener(input);
    } catch {
      // Hooks must not fail publication.
    }
  }
}

export function getPlpSearchSeoInvalidationStatsForTests(): {
  readonly count: number;
  readonly last: PlpSearchSeoInvalidationHookInput | null;
} {
  return { count: invalidationCount, last: lastInvalidation };
}

export function resetPlpSearchSeoInvalidationForTests(): void {
  listeners.clear();
  lastInvalidation = null;
  invalidationCount = 0;
}
