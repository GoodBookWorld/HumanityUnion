import { API_BASE_URL } from "../api-base-url";
import { publishActiveSitemapBuilds } from "./web-memory-gauges";
import {
  readWebProcessMemorySnapshot,
  type WebProcessMemorySnapshot,
} from "./web-process-memory";
import {
  readConfiguredSystemHealthToken,
  WEB_SYSTEM_HEALTH_TOKEN_HEADER,
} from "./system-health-token";

export const SITEMAP_PROVIDER_IDS = [
  "blog-posts",
  "initiatives",
  "knowledge-articles",
  "civic-archive",
  "participant-profiles",
] as const;

export type SitemapProviderId = (typeof SITEMAP_PROVIDER_IDS)[number];

const PROVIDER_ID_SET = new Set<string>(SITEMAP_PROVIDER_IDS);

export type SitemapBuildOutcome =
  | "completed"
  | "provider_failure"
  | "build_failure"
  | "indexing_disallowed"
  | "origin_missing";

export interface SitemapBuildObservation {
  readonly startedAtMs: number;
  readonly overlappingSitemapBuilds: number;
}

export interface SitemapBuildDiagnosticInput {
  readonly observation: SitemapBuildObservation;
  readonly outcome: SitemapBuildOutcome;
  readonly failedProviderIds: readonly string[];
  readonly partialProviderIds: readonly string[];
  readonly canonicalPathCount: number;
  readonly seoLocaleCount: number;
  readonly entityResolveCount: number;
  readonly memoryAtStart: WebProcessMemorySnapshot | null;
  readonly memoryAfterInventory: WebProcessMemorySnapshot | null;
  readonly memoryAfterEligibility: WebProcessMemorySnapshot | null;
}

const INGEST_PATH = "/api/v1/internal/system-health/events";
const INGEST_TIMEOUT_MS = 2_000;

let inFlightBuilds = 0;

function publishSitemapBuildGauge(): void {
  publishActiveSitemapBuilds(inFlightBuilds);
}

export function openSitemapBuildObservation(nowMs: number = Date.now()): SitemapBuildObservation {
  inFlightBuilds += 1;
  publishSitemapBuildGauge();
  return {
    startedAtMs: nowMs,
    overlappingSitemapBuilds: inFlightBuilds,
  };
}

export function closeSitemapBuildObservation(): void {
  inFlightBuilds = Math.max(0, inFlightBuilds - 1);
  publishSitemapBuildGauge();
}

export function resetSitemapBuildOverlapForTests(): void {
  inFlightBuilds = 0;
  publishSitemapBuildGauge();
}

export function allowlistedProviderIds(ids: readonly string[]): SitemapProviderId[] {
  const out: SitemapProviderId[] = [];
  const seen = new Set<string>();
  for (const id of ids) {
    if (!PROVIDER_ID_SET.has(id) || seen.has(id)) {
      continue;
    }
    seen.add(id);
    out.push(id as SitemapProviderId);
  }
  return out.sort();
}

function nonNegativeInt(value: number): number {
  if (!Number.isSafeInteger(value) || value < 0) {
    return 0;
  }
  return value;
}

export function sitemapBuildShouldPersist(input: {
  readonly outcome: SitemapBuildOutcome;
  readonly samples: readonly (WebProcessMemorySnapshot | null)[];
}): { readonly sitemapFailure: boolean; readonly memoryThreshold: boolean } {
  const sitemapFailure = input.outcome === "provider_failure" || input.outcome === "build_failure";
  const memoryThreshold = input.samples.some((sample) => sample?.pressure === "critical");
  return { sitemapFailure, memoryThreshold };
}

export function buildSitemapDiagnosticRecord(
  input: SitemapBuildDiagnosticInput,
  nowMs: number = Date.now(),
): {
  readonly log: Record<string, unknown>;
  readonly persist: Record<string, unknown> | null;
} {
  const failedProviderIds = allowlistedProviderIds(input.failedProviderIds);
  const partialProviderIds = allowlistedProviderIds(input.partialProviderIds);
  const decision = sitemapBuildShouldPersist({
    outcome: input.outcome,
    samples: [input.memoryAtStart, input.memoryAfterInventory, input.memoryAfterEligibility],
  });
  const eventTypes: string[] = [];
  if (decision.sitemapFailure) {
    eventTypes.push("sitemap_failure");
  }
  if (decision.memoryThreshold) {
    eventTypes.push("memory_threshold");
  }

  const counts = {
    canonicalPathCount: nonNegativeInt(input.canonicalPathCount),
    seoLocaleCount: nonNegativeInt(input.seoLocaleCount),
    entityResolveCount: nonNegativeInt(input.entityResolveCount),
    failedProviderCount: failedProviderIds.length,
    partialProviderCount: partialProviderIds.length,
    overlappingSitemapBuilds: nonNegativeInt(input.observation.overlappingSitemapBuilds),
  };
  const durationMs = Math.max(0, nowMs - input.observation.startedAtMs);
  const memory = {
    start: input.memoryAtStart,
    afterInventory: input.memoryAfterInventory,
    afterEligibility: input.memoryAfterEligibility,
  };
  const primary = input.memoryAfterEligibility ?? input.memoryAfterInventory ?? input.memoryAtStart;

  const log = {
    kind: "web_system_health",
    source: "web",
    operation: "sitemap_build",
    outcome: input.outcome,
    occurredAt: new Date(nowMs).toISOString(),
    durationMs,
    pid: primary?.pid ?? null,
    instanceId: primary?.instanceId ?? null,
    processStartedAt: primary?.processStartedAt ?? null,
    uptimeSeconds: primary?.uptimeSeconds ?? null,
    failedProviderIds,
    partialProviderIds,
    counts,
    memory,
    persistRequested: eventTypes.length > 0,
  };

  if (eventTypes.length === 0 || !primary) {
    return { log, persist: null };
  }

  return {
    log,
    persist: {
      source: "web",
      operation: "sitemap_build",
      eventTypes,
      occurredAt: new Date(nowMs).toISOString(),
      instanceId: primary.instanceId,
      pid: primary.pid,
      processStartedAt: primary.processStartedAt,
      uptimeSeconds: primary.uptimeSeconds,
      durationMs,
      memory: {
        rss: primary.rss,
        heapUsed: primary.heapUsed,
        heapTotal: primary.heapTotal,
        external: primary.external,
        limitBytes: primary.limitBytes,
        pressure: primary.pressure,
      },
      phases: memory,
      counts,
      failedProviderIds,
      partialProviderIds,
    },
  };
}

/**
 * One stdout line per sitemap build boundary. Critical persistence is
 * best-effort and is not awaited.
 */
export function emitSitemapBuildDiagnostic(input: SitemapBuildDiagnosticInput): void {
  try {
    const { log, persist } = buildSitemapDiagnosticRecord(input);
    console.log(JSON.stringify(log));
    if (persist) {
      void deliverCriticalEvent(persist).catch(() => undefined);
    }
  } catch {
    // Diagnostics must not change sitemap generation.
  }
}

export function readCurrentSitemapMemory(): WebProcessMemorySnapshot {
  return readWebProcessMemorySnapshot();
}

async function deliverCriticalEvent(body: Record<string, unknown>): Promise<void> {
  const token = readConfiguredSystemHealthToken();
  if (!token) {
    return;
  }
  try {
    await fetch(`${API_BASE_URL}${INGEST_PATH}`, {
      method: "POST",
      cache: "no-store",
      credentials: "omit",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        [WEB_SYSTEM_HEALTH_TOKEN_HEADER]: token,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(INGEST_TIMEOUT_MS),
    });
  } catch {
    // API or Mongo unavailable: the stdout line already recorded the event.
  }
}
