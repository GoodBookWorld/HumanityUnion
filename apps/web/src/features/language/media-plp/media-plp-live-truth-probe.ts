/**
 * Reset 03E.7 / 03E.7A — bounded Media PLP live truth probe (test/dev/staging only).
 * Fingerprints only — never participant-facing bodies or secrets.
 * Browser-safe FNV fingerprints (no node:crypto — PageContent is a client module).
 *
 * Reset 03E.7A — always emit activation status on /media <main> so staging can
 * distinguish DISABLED / ENV_UNAVAILABLE / NOT_WIRED from a missing deploy.
 */

export const MEDIA_PLP_LIVE_TRUTH_PROBE_VERSION = "PLT.1" as const;

export const MEDIA_PLP_LIVE_TRUTH_PROBE_STATUS = {
  ENABLED: "ENABLED",
  DISABLED: "DISABLED",
  ENV_UNAVAILABLE: "ENV_UNAVAILABLE",
  NOT_WIRED: "NOT_WIRED",
} as const;

export type MediaPlpLiveTruthProbeStatus =
  (typeof MEDIA_PLP_LIVE_TRUTH_PROBE_STATUS)[keyof typeof MEDIA_PLP_LIVE_TRUTH_PROBE_STATUS];

export const EDITORIAL_PROBE_PATHS = [
  "overviewSummary",
  "faq[0].question",
  "faq[0].answer",
] as const;

export type EditorialProbePath = (typeof EDITORIAL_PROBE_PATHS)[number];

export type MediaPlpLiveTruthPathRecord = {
  readonly path: EditorialProbePath;
  readonly CANONICAL_FINGERPRINT: string;
  readonly RESOLVED_FINGERPRINT: string;
  readonly PROJECTED_FINGERPRINT: string;
  readonly SSR_FINGERPRINT: string;
  readonly firstLoss:
    | "NONE"
    | "RESOLVED_EQUALS_CANONICAL"
    | "PROJECTION_GAP"
    | "SSR_RENDER_GAP"
    | "NOT_REACHED";
};

export type MediaPlpLiveTruthProbeReport = {
  readonly version: typeof MEDIA_PLP_LIVE_TRUTH_PROBE_VERSION;
  readonly REQUESTED_LOCALE: string | null;
  readonly API_REQUEST_LOCALE: string | null;
  readonly API_ORIGIN_CLASS: string | null;
  readonly API_ROUTE_PATH: string | null;
  readonly ENTITY_REQUESTED: boolean;
  readonly REQUESTED_ENTITY_COUNT: number | null;
  readonly API_RESULT_MODE: "PUBLISHED_LOCALIZED" | "CANONICAL_FALLBACK" | "NOT_REACHED" | null;
  readonly API_RESULT_REASON: string | null;
  readonly API_RESULT_ENTITY_ID: string | null;
  readonly API_RESULT_CANONICAL_VERSION: string | null;
  readonly API_RESULT_SCHEMA: string | null;
  readonly API_RESULT_PRESENTATION_SHAPE: "string" | "wrapped_value" | "mixed" | "missing" | null;
  /** Reset 03E.8 — API persistence probe metadata (no secrets). */
  readonly PLP_PERSISTENCE_MODE: "MONGO" | "MEMORY_TEST" | "UNAVAILABLE" | null;
  readonly PLP_LOOKUP_RESULT: "FOUND" | "NOT_FOUND" | "ERROR" | null;
  readonly paths: readonly MediaPlpLiveTruthPathRecord[];
};

function processEnvAvailable(): boolean {
  return typeof process !== "undefined" && Boolean(process.env);
}

/**
 * Read HU_MEDIA_PLP_LIVE_TRUTH_PROBE with a static key first so Next/server
 * bundles retain a real runtime binding (dynamic-only `process.env[name]` can
 * miss vars that were unset at build and never statically referenced).
 */
export function readMediaPlpLiveTruthProbeEnv(): string | undefined {
  if (!processEnvAvailable()) {
    return undefined;
  }
  // Static identifier — required for reliable server runtime visibility.
  const staticValue = process.env.HU_MEDIA_PLP_LIVE_TRUTH_PROBE;
  if (typeof staticValue === "string") {
    return staticValue;
  }
  // Dynamic fallback for tests that assign via bracket keys only.
  return process.env["HU_MEDIA_PLP_LIVE_TRUTH_PROBE"];
}

let liveTruthProbeEnabledOverride: boolean | null = null;

export function setMediaPlpLiveTruthProbeEnabledForTests(
  enabled: boolean | null,
): void {
  liveTruthProbeEnabledOverride = enabled;
}

/**
 * Server-resolved activation status (never NOT_WIRED — that is client fallback
 * when page.tsx did not pass the prop).
 */
export function resolveMediaPlpLiveTruthProbeStatus(): Exclude<
  MediaPlpLiveTruthProbeStatus,
  "NOT_WIRED"
> {
  if (liveTruthProbeEnabledOverride !== null) {
    return liveTruthProbeEnabledOverride
      ? MEDIA_PLP_LIVE_TRUTH_PROBE_STATUS.ENABLED
      : MEDIA_PLP_LIVE_TRUTH_PROBE_STATUS.DISABLED;
  }
  if (!processEnvAvailable()) {
    return MEDIA_PLP_LIVE_TRUTH_PROBE_STATUS.ENV_UNAVAILABLE;
  }
  const explicit = readMediaPlpLiveTruthProbeEnv();
  if (explicit === "true") {
    return MEDIA_PLP_LIVE_TRUTH_PROBE_STATUS.ENABLED;
  }
  if (explicit === "false") {
    return MEDIA_PLP_LIVE_TRUTH_PROBE_STATUS.DISABLED;
  }
  // Unset: on in non-production (local/test); off in production/staging NODE_ENV.
  if (process.env.NODE_ENV !== "production") {
    return MEDIA_PLP_LIVE_TRUTH_PROBE_STATUS.ENABLED;
  }
  return MEDIA_PLP_LIVE_TRUTH_PROBE_STATUS.DISABLED;
}

/**
 * Staging (often NODE_ENV=production) enables via HU_MEDIA_PLP_LIVE_TRUTH_PROBE=true.
 * Local test/dev: on unless explicitly false.
 */
export function isMediaPlpLiveTruthProbeEnabled(): boolean {
  return (
    resolveMediaPlpLiveTruthProbeStatus() ===
    MEDIA_PLP_LIVE_TRUTH_PROBE_STATUS.ENABLED
  );
}

export function fingerprintProbeValue(value: string | null | undefined): string {
  const normalized = (value ?? "").trim().replace(/\s+/g, " ");
  if (!normalized) {
    return "empty";
  }
  // Dual FNV-1a 32-bit → 16 hex chars (stable SSR/client; not cryptographic).
  let h1 = 2166136261;
  let h2 = 2166136261 ^ 0x9e3779b9;
  for (let i = 0; i < normalized.length; i += 1) {
    const c = normalized.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 16777619);
    h2 = Math.imul(h2 ^ c, 16777619);
  }
  return (
    (h1 >>> 0).toString(16).padStart(8, "0") + (h2 >>> 0).toString(16).padStart(8, "0")
  );
}

export function classifyApiOriginClass(apiBaseUrl: string): string {
  try {
    const host = new URL(apiBaseUrl).hostname.toLowerCase();
    if (host === "localhost" || host === "127.0.0.1") {
      return "localhost";
    }
    if (host.includes("staging") || host.startsWith("api-staging") || host.includes(".onrender.com")) {
      return host.includes("staging") ? "staging-host" : "render-host";
    }
    if (host.endsWith("huws.org") || host.includes("humanity")) {
      return "hu-production-or-named";
    }
    return "other-host";
  } catch {
    return "invalid-url";
  }
}

export function classifyPresentationValueShape(value: unknown): "string" | "wrapped_value" | "other" | "missing" {
  if (value == null) {
    return "missing";
  }
  if (typeof value === "string") {
    return "string";
  }
  if (
    value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    "value" in value &&
    typeof (value as { value: unknown }).value === "string"
  ) {
    return "wrapped_value";
  }
  return "other";
}

export function readProbeStringAtPath(presentation: unknown, path: string): string | null {
  if (!path.trim()) {
    return null;
  }
  const parts = path.replace(/\[(\d+)\]/g, ".$1").split(".").filter(Boolean);
  let cursor: unknown = presentation;
  for (const part of parts) {
    if (cursor == null) {
      return null;
    }
    if (Array.isArray(cursor)) {
      const index = Number(part);
      if (!Number.isInteger(index) || index < 0 || index >= cursor.length) {
        return null;
      }
      cursor = cursor[index];
      continue;
    }
    if (typeof cursor !== "object") {
      return null;
    }
    cursor = (cursor as Record<string, unknown>)[part];
  }
  if (typeof cursor === "string") {
    return cursor;
  }
  if (
    cursor &&
    typeof cursor === "object" &&
    "value" in cursor &&
    typeof (cursor as { value: unknown }).value === "string"
  ) {
    return String((cursor as { value: string }).value);
  }
  return null;
}

export function evaluateEditorialPathLineage(input: {
  readonly path: EditorialProbePath;
  readonly canonical: string | null;
  readonly resolved: string | null;
  readonly projected: string | null;
  readonly ssr: string | null;
}): MediaPlpLiveTruthPathRecord {
  const CANONICAL_FINGERPRINT = fingerprintProbeValue(input.canonical);
  const RESOLVED_FINGERPRINT = fingerprintProbeValue(input.resolved);
  const PROJECTED_FINGERPRINT = fingerprintProbeValue(input.projected);
  const SSR_FINGERPRINT = fingerprintProbeValue(input.ssr);

  let firstLoss: MediaPlpLiveTruthPathRecord["firstLoss"] = "NONE";
  if (RESOLVED_FINGERPRINT === "empty" || RESOLVED_FINGERPRINT === CANONICAL_FINGERPRINT) {
    firstLoss = "RESOLVED_EQUALS_CANONICAL";
  } else if (PROJECTED_FINGERPRINT !== RESOLVED_FINGERPRINT) {
    firstLoss = "PROJECTION_GAP";
  } else if (SSR_FINGERPRINT !== PROJECTED_FINGERPRINT) {
    firstLoss = "SSR_RENDER_GAP";
  }

  return {
    path: input.path,
    CANONICAL_FINGERPRINT,
    RESOLVED_FINGERPRINT,
    PROJECTED_FINGERPRINT,
    SSR_FINGERPRINT,
    firstLoss,
  };
}

/** Mutable request-scoped probe bag (SSR). Cleared explicitly in tests. */
type ActiveProbeBag = {
  version: typeof MEDIA_PLP_LIVE_TRUTH_PROBE_VERSION;
  REQUESTED_LOCALE: string | null;
  API_REQUEST_LOCALE: string | null;
  API_ORIGIN_CLASS: string | null;
  API_ROUTE_PATH: string | null;
  ENTITY_REQUESTED: boolean;
  REQUESTED_ENTITY_COUNT: number | null;
  API_RESULT_MODE: "PUBLISHED_LOCALIZED" | "CANONICAL_FALLBACK" | "NOT_REACHED" | null;
  API_RESULT_REASON: string | null;
  API_RESULT_ENTITY_ID: string | null;
  API_RESULT_CANONICAL_VERSION: string | null;
  API_RESULT_SCHEMA: string | null;
  API_RESULT_PRESENTATION_SHAPE: "string" | "wrapped_value" | "mixed" | "missing" | null;
  PLP_PERSISTENCE_MODE: "MONGO" | "MEMORY_TEST" | "UNAVAILABLE" | null;
  PLP_LOOKUP_RESULT: "FOUND" | "NOT_FOUND" | "ERROR" | null;
  pathAccum: Partial<
    Record<
      EditorialProbePath,
      {
        canonical?: string | null;
        resolved?: string | null;
        projected?: string | null;
        ssr?: string | null;
      }
    >
  >;
};

let activeProbe: ActiveProbeBag | null = null;

export function resetMediaPlpLiveTruthProbeForTests(): void {
  activeProbe = null;
  liveTruthProbeEnabledOverride = null;
}

export function beginMediaPlpLiveTruthProbe(seed?: {
  readonly REQUESTED_LOCALE?: string;
}): void {
  if (!isMediaPlpLiveTruthProbeEnabled()) {
    activeProbe = null;
    return;
  }
  activeProbe = {
    version: MEDIA_PLP_LIVE_TRUTH_PROBE_VERSION,
    REQUESTED_LOCALE: seed?.REQUESTED_LOCALE ?? null,
    API_REQUEST_LOCALE: null,
    API_ORIGIN_CLASS: null,
    API_ROUTE_PATH: null,
    ENTITY_REQUESTED: false,
    REQUESTED_ENTITY_COUNT: null,
    API_RESULT_MODE: null,
    API_RESULT_REASON: null,
    API_RESULT_ENTITY_ID: null,
    API_RESULT_CANONICAL_VERSION: null,
    API_RESULT_SCHEMA: null,
    API_RESULT_PRESENTATION_SHAPE: null,
    PLP_PERSISTENCE_MODE: null,
    PLP_LOOKUP_RESULT: null,
    pathAccum: {},
  };
}

export function recordMediaPlpLiveTruthApiRequest(input: {
  readonly locale: string;
  readonly apiBaseUrl: string;
  readonly routePath: string;
  readonly entityCount: number;
  readonly editorialRequested: boolean;
}): void {
  if (!activeProbe) {
    return;
  }
  activeProbe.API_REQUEST_LOCALE = input.locale;
  activeProbe.API_ORIGIN_CLASS = classifyApiOriginClass(input.apiBaseUrl);
  activeProbe.API_ROUTE_PATH = input.routePath;
  activeProbe.REQUESTED_ENTITY_COUNT = input.entityCount;
  activeProbe.ENTITY_REQUESTED = input.editorialRequested;
}

/** True when the active probe has not yet recorded an editorial API result. */
export function mediaPlpLiveTruthNeedsEditorialRecord(): boolean {
  return Boolean(activeProbe?.pathAccum) && activeProbe?.API_RESULT_MODE == null;
}

export function recordMediaPlpLiveTruthEditorialResult(input: {
  readonly mode: "PUBLISHED_LOCALIZED" | "CANONICAL_FALLBACK";
  readonly reasonCode?: string;
  readonly entityId: string;
  readonly canonicalVersion: string;
  readonly schema?: string;
  readonly presentation: unknown;
  readonly canonicalPresentation: unknown;
  readonly persistenceMode?: "MONGO" | "MEMORY_TEST" | "UNAVAILABLE";
  readonly lookupResult?: "FOUND" | "NOT_FOUND" | "ERROR";
}): void {
  if (!activeProbe?.pathAccum) {
    return;
  }
  activeProbe.API_RESULT_MODE = input.mode;
  if (input.reasonCode !== undefined) {
    activeProbe.API_RESULT_REASON = input.reasonCode;
  }
  activeProbe.API_RESULT_ENTITY_ID = input.entityId;
  activeProbe.API_RESULT_CANONICAL_VERSION = input.canonicalVersion;
  activeProbe.API_RESULT_SCHEMA = input.schema ?? null;
  if (input.persistenceMode !== undefined) {
    activeProbe.PLP_PERSISTENCE_MODE = input.persistenceMode;
  }
  if (input.lookupResult !== undefined) {
    activeProbe.PLP_LOOKUP_RESULT = input.lookupResult;
  }

  const overviewShape = classifyPresentationValueShape(
    (input.presentation as Record<string, unknown> | null)?.overviewSummary,
  );
  const faq0 = Array.isArray((input.presentation as Record<string, unknown> | null)?.faq)
    ? ((input.presentation as { faq: unknown[] }).faq[0] as Record<string, unknown> | undefined)
    : undefined;
  const qShape = classifyPresentationValueShape(faq0?.question);
  const shapesSet = new Set([overviewShape, qShape].filter((s) => s !== "missing"));
  activeProbe.API_RESULT_PRESENTATION_SHAPE =
    shapesSet.size === 0
      ? "missing"
      : shapesSet.size > 1
        ? "mixed"
        : shapesSet.has("wrapped_value")
          ? "wrapped_value"
          : shapesSet.has("string")
            ? "string"
            : "missing";

  for (const path of EDITORIAL_PROBE_PATHS) {
    const accum = activeProbe.pathAccum[path] ?? {};
    accum.canonical = readProbeStringAtPath(input.canonicalPresentation, path);
    accum.resolved = readProbeStringAtPath(input.presentation, path);
    activeProbe.pathAccum[path] = accum;
  }
}

export function recordMediaPlpLiveTruthProjected(input: {
  readonly overviewSummary: string;
  readonly faq0Question: string;
  readonly faq0Answer: string;
}): void {
  if (!activeProbe?.pathAccum) {
    return;
  }
  const map: Record<EditorialProbePath, string> = {
    overviewSummary: input.overviewSummary,
    "faq[0].question": input.faq0Question,
    "faq[0].answer": input.faq0Answer,
  };
  for (const path of EDITORIAL_PROBE_PATHS) {
    const accum = activeProbe.pathAccum[path] ?? {};
    accum.projected = map[path];
    activeProbe.pathAccum[path] = accum;
  }
}

export function recordMediaPlpLiveTruthSsr(input: {
  readonly overviewSummary: string;
  readonly faq0Question: string;
  readonly faq0Answer: string;
}): void {
  if (!activeProbe?.pathAccum) {
    return;
  }
  const map: Record<EditorialProbePath, string> = {
    overviewSummary: input.overviewSummary,
    "faq[0].question": input.faq0Question,
    "faq[0].answer": input.faq0Answer,
  };
  for (const path of EDITORIAL_PROBE_PATHS) {
    const accum = activeProbe.pathAccum[path] ?? {};
    accum.ssr = map[path];
    activeProbe.pathAccum[path] = accum;
  }
}

export function finalizeMediaPlpLiveTruthProbe(): MediaPlpLiveTruthProbeReport | null {
  if (!activeProbe?.pathAccum) {
    return null;
  }
  const paths = EDITORIAL_PROBE_PATHS.map((path) => {
    const accum = activeProbe!.pathAccum![path] ?? {};
    return evaluateEditorialPathLineage({
      path,
      canonical: accum.canonical ?? null,
      resolved: accum.resolved ?? null,
      projected: accum.projected ?? null,
      ssr: accum.ssr ?? null,
    });
  });
  return {
    version: MEDIA_PLP_LIVE_TRUTH_PROBE_VERSION,
    REQUESTED_LOCALE: activeProbe.REQUESTED_LOCALE ?? null,
    API_REQUEST_LOCALE: activeProbe.API_REQUEST_LOCALE ?? null,
    API_ORIGIN_CLASS: activeProbe.API_ORIGIN_CLASS ?? null,
    API_ROUTE_PATH: activeProbe.API_ROUTE_PATH ?? null,
    ENTITY_REQUESTED: activeProbe.ENTITY_REQUESTED ?? false,
    REQUESTED_ENTITY_COUNT: activeProbe.REQUESTED_ENTITY_COUNT ?? null,
    API_RESULT_MODE: activeProbe.API_RESULT_MODE ?? null,
    API_RESULT_REASON: activeProbe.API_RESULT_REASON ?? null,
    API_RESULT_ENTITY_ID: activeProbe.API_RESULT_ENTITY_ID ?? null,
    API_RESULT_CANONICAL_VERSION: activeProbe.API_RESULT_CANONICAL_VERSION ?? null,
    API_RESULT_SCHEMA: activeProbe.API_RESULT_SCHEMA ?? null,
    API_RESULT_PRESENTATION_SHAPE: activeProbe.API_RESULT_PRESENTATION_SHAPE ?? null,
    PLP_PERSISTENCE_MODE: activeProbe.PLP_PERSISTENCE_MODE ?? null,
    PLP_LOOKUP_RESULT: activeProbe.PLP_LOOKUP_RESULT ?? null,
    paths,
  };
}

/** Encode probe as compact URI-encoded JSON for a single data attribute (no bodies). */
export function encodeMediaPlpLiveTruthProbeAttr(
  report: MediaPlpLiveTruthProbeReport,
): string {
  return encodeURIComponent(JSON.stringify(report));
}

export function decodeMediaPlpLiveTruthProbeAttr(
  encoded: string,
): MediaPlpLiveTruthProbeReport {
  return JSON.parse(decodeURIComponent(encoded)) as MediaPlpLiveTruthProbeReport;
}

/**
 * Server-only finalize: record SSR fingerprints from the applied editorial and
 * return the encoded DOM attr. Safe to call from page.tsx / tests — not during
 * client hydrate of CivicMediaCenterPageContent.
 */
export function finalizeMediaPlpLiveTruthProbeAttrFromApplied(input: {
  readonly overviewSummary: string;
  readonly faq0Question: string;
  readonly faq0Answer: string;
}): string | undefined {
  if (!isMediaPlpLiveTruthProbeEnabled()) {
    return undefined;
  }
  // Ensure a bag exists even if compose skipped begin (defensive).
  if (!activeProbe) {
    beginMediaPlpLiveTruthProbe();
  }
  recordMediaPlpLiveTruthSsr(input);
  const report = finalizeMediaPlpLiveTruthProbe();
  return report ? encodeMediaPlpLiveTruthProbeAttr(report) : undefined;
}
