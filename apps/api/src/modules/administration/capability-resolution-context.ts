import { AsyncLocalStorage } from "node:async_hooks";

import type { PlatformCapabilityId } from "@hu/types";

type CapabilityCache = Map<string, ReadonlySet<PlatformCapabilityId>>;

const store = new AsyncLocalStorage<CapabilityCache>();

/** Run work with a request-scoped capability resolution cache (no distributed cache). */
export function runWithCapabilityResolutionContext<T>(fn: () => Promise<T>): Promise<T> {
  return store.run(new Map(), fn);
}

export function getCapabilityResolutionCache(): CapabilityCache | undefined {
  return store.getStore();
}

export function capabilityResolutionCacheKey(
  participantId: string,
  role: string | undefined,
): string {
  return `${participantId}::${role ?? ""}`;
}
