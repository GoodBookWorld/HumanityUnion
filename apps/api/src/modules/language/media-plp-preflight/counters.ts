/**
 * Reset 03A — process-local counters for Media PLP preflight (read-only).
 */

const counters = {
  SOURCE_LOOKUP_COUNT: 0,
  PLP_LOOKUP_COUNT: 0,
  LANGUAGE_REGISTRY_LOOKUP_COUNT: 0,
  SAMPLE_DISCOVERY_COUNT: 0,
  WRITES_PERFORMED: 0,
  PROVIDER_CALLS: 0,
  MONGO_CLOSED: false,
};

export function resetMediaPlpPreflightCountersForTests(): void {
  counters.SOURCE_LOOKUP_COUNT = 0;
  counters.PLP_LOOKUP_COUNT = 0;
  counters.LANGUAGE_REGISTRY_LOOKUP_COUNT = 0;
  counters.SAMPLE_DISCOVERY_COUNT = 0;
  counters.WRITES_PERFORMED = 0;
  counters.PROVIDER_CALLS = 0;
  counters.MONGO_CLOSED = false;
}

export function markMediaPlpPreflightSourceLookup(): void {
  counters.SOURCE_LOOKUP_COUNT += 1;
}

export function markMediaPlpPreflightPlpLookup(): void {
  counters.PLP_LOOKUP_COUNT += 1;
}

export function markMediaPlpPreflightLanguageRegistryLookup(): void {
  counters.LANGUAGE_REGISTRY_LOOKUP_COUNT += 1;
}

export function markMediaPlpPreflightSampleDiscovery(): void {
  counters.SAMPLE_DISCOVERY_COUNT += 1;
}

export function markMediaPlpPreflightWriteForTests(): void {
  counters.WRITES_PERFORMED += 1;
}

export function markMediaPlpPreflightProviderCallForTests(): void {
  counters.PROVIDER_CALLS += 1;
}

export function markMediaPlpPreflightMongoClosed(): void {
  counters.MONGO_CLOSED = true;
}

export function getMediaPlpPreflightCounters(): {
  readonly SOURCE_LOOKUP_COUNT: number;
  readonly PLP_LOOKUP_COUNT: number;
  readonly LANGUAGE_REGISTRY_LOOKUP_COUNT: number;
  readonly SAMPLE_DISCOVERY_COUNT: number;
  readonly WRITES_PERFORMED: number;
  readonly PROVIDER_CALLS: number;
  readonly MONGO_CLOSED: boolean;
  readonly TOTAL_BOUNDED_LOOKUPS: number;
} {
  return {
    ...counters,
    TOTAL_BOUNDED_LOOKUPS:
      counters.SOURCE_LOOKUP_COUNT +
      counters.PLP_LOOKUP_COUNT +
      counters.LANGUAGE_REGISTRY_LOOKUP_COUNT +
      counters.SAMPLE_DISCOVERY_COUNT,
  };
}
