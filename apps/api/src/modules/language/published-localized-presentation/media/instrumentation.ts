/**
 * Reset 03 — Media PLP process-local instrumentation counters.
 */

export type MediaPlpInstrumentationCounters = {
  PLP_READ_COUNT: number;
  CONTENT_TRANSLATION_READ_COUNT: number;
  CONTENT_TRANSLATION_WRITE_COUNT: number;
  PROVIDER_CALL_COUNT: number;
  CLIENT_SEMANTIC_TRANSLATION_REQUEST_COUNT: number;
  POST_HYDRATION_SEMANTIC_CHANGE_COUNT: number;
};

const counters: MediaPlpInstrumentationCounters = {
  PLP_READ_COUNT: 0,
  CONTENT_TRANSLATION_READ_COUNT: 0,
  CONTENT_TRANSLATION_WRITE_COUNT: 0,
  PROVIDER_CALL_COUNT: 0,
  CLIENT_SEMANTIC_TRANSLATION_REQUEST_COUNT: 0,
  POST_HYDRATION_SEMANTIC_CHANGE_COUNT: 0,
};

export function resetMediaPlpInstrumentationForTests(): void {
  counters.PLP_READ_COUNT = 0;
  counters.CONTENT_TRANSLATION_READ_COUNT = 0;
  counters.CONTENT_TRANSLATION_WRITE_COUNT = 0;
  counters.PROVIDER_CALL_COUNT = 0;
  counters.CLIENT_SEMANTIC_TRANSLATION_REQUEST_COUNT = 0;
  counters.POST_HYDRATION_SEMANTIC_CHANGE_COUNT = 0;
}

export function getMediaPlpInstrumentationCounters(): MediaPlpInstrumentationCounters {
  return { ...counters };
}

export function markMediaPlpRead(): void {
  counters.PLP_READ_COUNT += 1;
}

export function markMediaPlpContentTranslationRead(): void {
  counters.CONTENT_TRANSLATION_READ_COUNT += 1;
}

export function markMediaPlpContentTranslationWrite(): void {
  counters.CONTENT_TRANSLATION_WRITE_COUNT += 1;
}

export function markMediaPlpProviderCall(): void {
  counters.PROVIDER_CALL_COUNT += 1;
}

export function markMediaPlpClientSemanticTranslationRequest(): void {
  counters.CLIENT_SEMANTIC_TRANSLATION_REQUEST_COUNT += 1;
}

export function markMediaPlpPostHydrationSemanticChange(): void {
  counters.POST_HYDRATION_SEMANTIC_CHANGE_COUNT += 1;
}

export function formatMediaPlpInstrumentationCounters(
  values: MediaPlpInstrumentationCounters = getMediaPlpInstrumentationCounters(),
): string {
  return [
    `PLP_READ_COUNT=${values.PLP_READ_COUNT}`,
    `CONTENT_TRANSLATION_READ_COUNT=${values.CONTENT_TRANSLATION_READ_COUNT}`,
    `CONTENT_TRANSLATION_WRITE_COUNT=${values.CONTENT_TRANSLATION_WRITE_COUNT}`,
    `PROVIDER_CALL_COUNT=${values.PROVIDER_CALL_COUNT}`,
    `CLIENT_SEMANTIC_TRANSLATION_REQUEST_COUNT=${values.CLIENT_SEMANTIC_TRANSLATION_REQUEST_COUNT}`,
    `POST_HYDRATION_SEMANTIC_CHANGE_COUNT=${values.POST_HYDRATION_SEMANTIC_CHANGE_COUNT}`,
  ].join("\n");
}
