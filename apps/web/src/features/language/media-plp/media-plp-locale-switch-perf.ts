/**
 * Reset 03D — Media PLP locale-switch performance topology + timing.
 * Dev/test gated; no credentials, bodies, or participant-private data.
 *
 * Pre-fix topology was measured from code (03C.2) before changing:
 * guest critical path had 2 PLP resolve HTTP posts + duplicate languages SSR fetches.
 * HTTP Web→API remains (deployment boundary: no Mongo/API bootstrap in Web).
 */

export type MediaLocaleSwitchPerfPhase =
  | "T0_SELECTOR"
  | "T1_PREFERENCE_COOKIE"
  | "T2_NAVIGATION_START"
  | "T3_WEB_RENDER_BEGIN"
  | "T4_MEDIA_PLP_LOAD_BEGIN"
  | "T5_API_REQUEST_BEGIN"
  | "T6_API_REQUEST_RECEIVED"
  | "T7_PLP_LOOKUP"
  | "T8_API_RESPONSE_COMPLETE"
  | "T9_WEB_RENDER_COMPLETE"
  | "T10_CLIENT_COMMIT"
  | "T11_SELECTOR_PENDING_CLEAR";

/** Evidenced pre-fix (03C.2) request topology for one guest /media locale switch. */
export const MEDIA_PLP_LOCALE_SWITCH_PRE_FIX_TOPOLOGY = {
  preferenceMutationsGuest: 0,
  preferenceMutationsAuth: 1,
  cookieWrites: 1,
  languagesFetchesNestedInCookie: 1,
  languagesFetchesSsrDuplicate: 2, // layout + media page (no React.cache)
  brandLocalizationFetches: 1,
  mediaPayloadFetches: 1,
  mediaPlpResolveHttpPosts: 2, // trusted batch + principles batch
  clientPlpRefetches: 0,
  clientTranslationGenerates: 0,
} as const;

/** Post-03D target topology (guest /media locale switch, PLP ON). */
export const MEDIA_PLP_LOCALE_SWITCH_POST_FIX_TOPOLOGY = {
  preferenceMutationsGuest: 0,
  preferenceMutationsAuth: 1,
  cookieWrites: 1,
  languagesFetchesNestedInCookie: 1, // write validation stays authoritative
  languagesFetchesSsrPerRequest: 1, // React.cache dedupe layout+page
  brandLocalizationFetches: 1,
  mediaPayloadFetches: 1,
  mediaPlpResolveHttpPosts: 1, // single combined batch
  clientPlpRefetches: 0,
  clientTranslationGenerates: 0,
} as const;

/** Controllable application-work budgets (not Render/network guarantees). */
export const MEDIA_PLP_LOCALE_SWITCH_APP_BUDGETS = {
  /** Combined trusted+principles must be one HTTP resolve. */
  maxMediaPlpResolveHttpPosts: 1,
  /** SSR languages catalog fetches per navigation (after React.cache). */
  maxSsrLanguagesFetchesPerRequest: 1,
  /** No client PLP/CT after SSR settle. */
  maxClientPlpOrTranslationRequests: 0,
} as const;

export type MediaLocaleSwitchPerfTrace = {
  readonly LOCALE_SWITCH_TOTAL_MS: number | null;
  readonly PREFERENCE_MS: number | null;
  readonly NAVIGATION_MS: number | null;
  readonly MEDIA_RESOLVE_MS: number | null;
  readonly API_ROUNDTRIP_MS: number | null;
  readonly PLP_LOOKUP_MS: number | null;
  readonly CLIENT_COMMIT_MS: number | null;
  readonly MEDIA_PLP_REQUEST_COUNT: number;
  readonly phaseMarks: Readonly<Partial<Record<MediaLocaleSwitchPerfPhase, number>>>;
};

const emptyTrace = (): MediaLocaleSwitchPerfTrace => ({
  LOCALE_SWITCH_TOTAL_MS: null,
  PREFERENCE_MS: null,
  NAVIGATION_MS: null,
  MEDIA_RESOLVE_MS: null,
  API_ROUNDTRIP_MS: null,
  PLP_LOOKUP_MS: null,
  CLIENT_COMMIT_MS: null,
  MEDIA_PLP_REQUEST_COUNT: 0,
  phaseMarks: {},
});

let trace: MediaLocaleSwitchPerfTrace = emptyTrace();
let mediaPlpRequestCount = 0;
let perfEnabled =
  typeof process !== "undefined" &&
  (process.env.NODE_ENV === "test" ||
    process.env.HU_MEDIA_PLP_PERF_TRACE === "true" ||
    process.env.NODE_ENV === "development");

export function setMediaLocaleSwitchPerfEnabledForTests(enabled: boolean): void {
  perfEnabled = enabled;
}

export function resetMediaLocaleSwitchPerfTrace(): void {
  trace = emptyTrace();
  mediaPlpRequestCount = 0;
}

export function markMediaLocaleSwitchPerfPhase(phase: MediaLocaleSwitchPerfPhase): void {
  if (!perfEnabled) {
    return;
  }
  const now = Date.now();
  trace = {
    ...trace,
    phaseMarks: { ...trace.phaseMarks, [phase]: now },
  };
}

export function recordMediaPlpHttpResolveRequest(): void {
  mediaPlpRequestCount += 1;
  if (!perfEnabled) {
    return;
  }
  trace = {
    ...trace,
    MEDIA_PLP_REQUEST_COUNT: mediaPlpRequestCount,
  };
}

export function getMediaPlpHttpResolveRequestCount(): number {
  return mediaPlpRequestCount;
}

function delta(
  start: MediaLocaleSwitchPerfPhase,
  end: MediaLocaleSwitchPerfPhase,
): number | null {
  const a = trace.phaseMarks[start];
  const b = trace.phaseMarks[end];
  if (a == null || b == null) {
    return null;
  }
  return Math.max(0, b - a);
}

export function finalizeMediaLocaleSwitchPerfTrace(): MediaLocaleSwitchPerfTrace {
  if (!perfEnabled) {
    return {
      ...trace,
      MEDIA_PLP_REQUEST_COUNT: mediaPlpRequestCount,
    };
  }
  trace = {
    LOCALE_SWITCH_TOTAL_MS: delta("T0_SELECTOR", "T11_SELECTOR_PENDING_CLEAR"),
    PREFERENCE_MS: delta("T0_SELECTOR", "T1_PREFERENCE_COOKIE"),
    NAVIGATION_MS: delta("T2_NAVIGATION_START", "T10_CLIENT_COMMIT"),
    MEDIA_RESOLVE_MS: delta("T4_MEDIA_PLP_LOAD_BEGIN", "T9_WEB_RENDER_COMPLETE"),
    API_ROUNDTRIP_MS: delta("T5_API_REQUEST_BEGIN", "T8_API_RESPONSE_COMPLETE"),
    PLP_LOOKUP_MS: delta("T6_API_REQUEST_RECEIVED", "T8_API_RESPONSE_COMPLETE"),
    CLIENT_COMMIT_MS: delta("T10_CLIENT_COMMIT", "T11_SELECTOR_PENDING_CLEAR"),
    MEDIA_PLP_REQUEST_COUNT: mediaPlpRequestCount,
    phaseMarks: trace.phaseMarks,
  };
  return trace;
}

export function getMediaLocaleSwitchPerfTrace(): MediaLocaleSwitchPerfTrace {
  return {
    ...trace,
    MEDIA_PLP_REQUEST_COUNT: mediaPlpRequestCount,
  };
}

export function formatMediaLocaleSwitchPerfTrace(
  values: MediaLocaleSwitchPerfTrace = getMediaLocaleSwitchPerfTrace(),
): string {
  return [
    `LOCALE_SWITCH_TOTAL_MS=${values.LOCALE_SWITCH_TOTAL_MS ?? "n/a"}`,
    `PREFERENCE_MS=${values.PREFERENCE_MS ?? "n/a"}`,
    `NAVIGATION_MS=${values.NAVIGATION_MS ?? "n/a"}`,
    `MEDIA_RESOLVE_MS=${values.MEDIA_RESOLVE_MS ?? "n/a"}`,
    `API_ROUNDTRIP_MS=${values.API_ROUNDTRIP_MS ?? "n/a"}`,
    `PLP_LOOKUP_MS=${values.PLP_LOOKUP_MS ?? "n/a"}`,
    `CLIENT_COMMIT_MS=${values.CLIENT_COMMIT_MS ?? "n/a"}`,
    `MEDIA_PLP_REQUEST_COUNT=${values.MEDIA_PLP_REQUEST_COUNT}`,
  ].join("\n");
}

/**
 * Models sequential vs parallel pref+cookie waits (controllable application work).
 * Used to prove parallelization removes the sum-of-RTT wait without races.
 */
export function simulatePreferenceCookieOrdering(input: {
  readonly preferenceMs: number;
  readonly cookieMs: number;
  readonly parallel: boolean;
}): { readonly wallMs: number } {
  if (input.parallel) {
    return { wallMs: Math.max(input.preferenceMs, input.cookieMs) };
  }
  return { wallMs: input.preferenceMs + input.cookieMs };
}

/**
 * Pre-fix vs post-fix PLP HTTP round-trips for one Media navigation.
 */
export function simulateMediaPlpHttpRoundTrips(input: {
  readonly trustedBatchMs: number;
  readonly principlesBatchMs: number;
  readonly combined: boolean;
}): { readonly wallMs: number; readonly requestCount: number } {
  if (input.combined) {
    return {
      wallMs: Math.max(input.trustedBatchMs, input.principlesBatchMs),
      requestCount: 1,
    };
  }
  // 03C.2 used Promise.all of two HTTP posts — wall = max, but still 2 RTTs of work/load.
  return {
    wallMs: Math.max(input.trustedBatchMs, input.principlesBatchMs),
    requestCount: 2,
  };
}
