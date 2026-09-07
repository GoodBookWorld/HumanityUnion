/**
 * Reset 03B — process-local counters for Media PLP materializer.
 */

const counters = {
  SOURCE_LOOKUP_COUNT: 0,
  PLP_LOOKUP_COUNT: 0,
  TRANSLATION_LOOKUP_COUNT: 0,
  LANGUAGE_REGISTRY_LOOKUP_COUNT: 0,
  PROVIDER_IMPORTED: false,
  PROVIDER_CALL_COUNT: 0,
  PLP_WRITES: 0,
  CONTENT_TRANSLATION_WRITES: 0,
  SOURCE_WRITES: 0,
  MONGO_CLOSED: false,
};

export function resetMediaPlpMaterializerCountersForTests(): void {
  counters.SOURCE_LOOKUP_COUNT = 0;
  counters.PLP_LOOKUP_COUNT = 0;
  counters.TRANSLATION_LOOKUP_COUNT = 0;
  counters.LANGUAGE_REGISTRY_LOOKUP_COUNT = 0;
  counters.PROVIDER_IMPORTED = false;
  counters.PROVIDER_CALL_COUNT = 0;
  counters.PLP_WRITES = 0;
  counters.CONTENT_TRANSLATION_WRITES = 0;
  counters.SOURCE_WRITES = 0;
  counters.MONGO_CLOSED = false;
}

/**
 * RESET 05C — per-request provider budget for the continuous auto-build queue.
 * Materializer CLI counters are one-shot; the in-process processor resets the
 * call cap before each queued build so concurrency=1 drain can continue.
 */
export function resetMediaPlpMaterializerProviderCallBudget(): void {
  counters.PROVIDER_CALL_COUNT = 0;
  counters.PROVIDER_IMPORTED = false;
}

export function markMaterializerSourceLookup(): void {
  counters.SOURCE_LOOKUP_COUNT += 1;
}

export function markMaterializerPlpLookup(): void {
  counters.PLP_LOOKUP_COUNT += 1;
}

export function markMaterializerTranslationLookup(): void {
  counters.TRANSLATION_LOOKUP_COUNT += 1;
}

export function markMaterializerLanguageRegistryLookup(): void {
  counters.LANGUAGE_REGISTRY_LOOKUP_COUNT += 1;
}

export function markMaterializerProviderImported(): void {
  counters.PROVIDER_IMPORTED = true;
}

export function markMaterializerProviderCall(): void {
  counters.PROVIDER_CALL_COUNT += 1;
}

export function markMaterializerPlpWrite(): void {
  counters.PLP_WRITES += 1;
}

export function markMaterializerContentTranslationWriteForTests(): void {
  counters.CONTENT_TRANSLATION_WRITES += 1;
}

export function markMaterializerSourceWriteForTests(): void {
  counters.SOURCE_WRITES += 1;
}

export function markMaterializerMongoClosed(): void {
  counters.MONGO_CLOSED = true;
}

export function getMediaPlpMaterializerCounters(): typeof counters & {
  readonly TOTAL_BOUNDED_LOOKUPS: number;
} {
  return {
    ...counters,
    TOTAL_BOUNDED_LOOKUPS:
      counters.SOURCE_LOOKUP_COUNT +
      counters.PLP_LOOKUP_COUNT +
      counters.TRANSLATION_LOOKUP_COUNT +
      counters.LANGUAGE_REGISTRY_LOOKUP_COUNT,
  };
}
