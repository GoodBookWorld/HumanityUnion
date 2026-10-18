import type { IndexDescription } from "mongodb";

export const WEB_SYSTEM_HEALTH_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
export const WEB_SYSTEM_HEALTH_MAX_STORED_EVENTS = 100;
export const WEB_SYSTEM_HEALTH_MAX_READ_EVENTS = 100;

export const SITEMAP_PROVIDER_IDS = [
  "blog-posts",
  "initiatives",
  "knowledge-articles",
  "civic-archive",
  "participant-profiles",
] as const;

export type SitemapProviderId = (typeof SITEMAP_PROVIDER_IDS)[number];
export type WebSystemHealthEventType = "sitemap_failure" | "memory_threshold";
export type WebMemoryPressure = "unknown" | "below" | "critical";

export interface WebMemorySample {
  readonly rss: number;
  readonly heapUsed: number;
  readonly heapTotal: number;
  readonly external: number;
  readonly limitBytes: number | null;
  readonly pressure: WebMemoryPressure;
  readonly pid?: number;
  readonly uptimeSeconds?: number;
  readonly processStartedAt?: string;
  readonly instanceId?: string | null;
}

export interface WebSystemHealthEventCounts {
  readonly canonicalPathCount: number;
  readonly seoLocaleCount: number;
  readonly entityResolveCount: number;
  readonly failedProviderCount: number;
  readonly partialProviderCount: number;
  readonly overlappingSitemapBuilds: number;
}

export interface WebSystemHealthEventRecord {
  readonly eventId: string;
  readonly source: "web";
  readonly operation: "sitemap_build";
  readonly eventTypes: readonly WebSystemHealthEventType[];
  readonly occurredAt: string;
  readonly expiresAt: Date;
  readonly instanceId: string | null;
  readonly pid: number;
  readonly processStartedAt: string;
  readonly uptimeSeconds: number;
  readonly durationMs: number | null;
  readonly memory: WebMemorySample;
  readonly phases: {
    readonly start: WebMemorySample | null;
    readonly afterInventory: WebMemorySample | null;
    readonly afterEligibility: WebMemorySample | null;
  };
  readonly counts: WebSystemHealthEventCounts;
  readonly failedProviderIds: readonly SitemapProviderId[];
  readonly partialProviderIds: readonly SitemapProviderId[];
}

export interface WebSystemHealthEventView extends Omit<WebSystemHealthEventRecord, "expiresAt"> {
  readonly expiresAt: string;
}

export const WEB_SYSTEM_HEALTH_EVENT_INDEXES: IndexDescription[] = [
  {
    key: { expiresAt: 1 },
    expireAfterSeconds: 0,
    name: "web_system_health_events_expires_at_ttl",
  },
  {
    key: { occurredAt: -1 },
    name: "web_system_health_events_occurred_at",
  },
  {
    key: { eventId: 1 },
    unique: true,
    name: "web_system_health_events_event_id_unique",
  },
];

const PROVIDER_ID_SET = new Set<string>(SITEMAP_PROVIDER_IDS);
const EVENT_TYPES = new Set<string>(["sitemap_failure", "memory_threshold"]);
const PRESSURES = new Set<string>(["unknown", "below", "critical"]);

export function toWebSystemHealthEventView(
  record: WebSystemHealthEventRecord,
): WebSystemHealthEventView {
  return {
    ...record,
    expiresAt: record.expiresAt.toISOString(),
  };
}

export function parseWebSystemHealthIngest(
  body: unknown,
  now: Date = new Date(),
): WebSystemHealthEventRecord | null {
  if (!isPlainObject(body)) {
    return null;
  }
  if (body.source !== "web" || body.operation !== "sitemap_build") {
    return null;
  }
  const eventTypes = readEventTypes(body.eventTypes);
  if (!eventTypes) {
    return null;
  }
  const occurredAt = readIsoTimestamp(body.occurredAt) ?? now.toISOString();
  const memory = readMemorySample(body.memory);
  const phases = readPhases(body.phases);
  const counts = readCounts(body.counts);
  const failedProviderIds = readProviderIds(body.failedProviderIds);
  const partialProviderIds = readProviderIds(body.partialProviderIds);
  const processStartedAt = readIsoTimestamp(body.processStartedAt);
  const pid = readNonNegativeInt(body.pid);
  const uptimeSeconds = readNonNegativeInt(body.uptimeSeconds);
  const durationMs = readOptionalDuration(body.durationMs);
  const instanceId = readInstanceId(body.instanceId);

  if (
    !memory ||
    !phases ||
    !counts ||
    !failedProviderIds ||
    !partialProviderIds ||
    !processStartedAt ||
    pid === null ||
    uptimeSeconds === null ||
    durationMs === undefined ||
    instanceId === undefined
  ) {
    return null;
  }

  const occurredMs = Date.parse(occurredAt);
  const clampedOccurredMs = clampOccurredAt(occurredMs, now.getTime());

  return {
    eventId: "",
    source: "web",
    operation: "sitemap_build",
    eventTypes,
    occurredAt: new Date(clampedOccurredMs).toISOString(),
    expiresAt: new Date(clampedOccurredMs + WEB_SYSTEM_HEALTH_RETENTION_MS),
    instanceId,
    pid,
    processStartedAt,
    uptimeSeconds,
    durationMs,
    memory,
    phases,
    counts,
    failedProviderIds,
    partialProviderIds,
  };
}

function clampOccurredAt(occurredMs: number, nowMs: number): number {
  if (!Number.isFinite(occurredMs)) {
    return nowMs;
  }
  const earliest = nowMs - 10 * 60 * 1000;
  const latest = nowMs + 60 * 1000;
  if (occurredMs < earliest || occurredMs > latest) {
    return nowMs;
  }
  return occurredMs;
}

function readEventTypes(value: unknown): WebSystemHealthEventType[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > 2) {
    return null;
  }
  const out: WebSystemHealthEventType[] = [];
  for (const entry of value) {
    if (typeof entry !== "string" || !EVENT_TYPES.has(entry) || out.includes(entry as WebSystemHealthEventType)) {
      return null;
    }
    out.push(entry as WebSystemHealthEventType);
  }
  return out;
}

function readProviderIds(value: unknown): SitemapProviderId[] | null {
  if (!Array.isArray(value) || value.length > SITEMAP_PROVIDER_IDS.length) {
    return null;
  }
  const out: SitemapProviderId[] = [];
  for (const entry of value) {
    if (typeof entry !== "string" || !PROVIDER_ID_SET.has(entry) || out.includes(entry as SitemapProviderId)) {
      return null;
    }
    out.push(entry as SitemapProviderId);
  }
  return out;
}

function readCounts(value: unknown): WebSystemHealthEventCounts | null {
  if (!isPlainObject(value)) {
    return null;
  }
  const canonicalPathCount = readNonNegativeInt(value.canonicalPathCount);
  const seoLocaleCount = readNonNegativeInt(value.seoLocaleCount);
  const entityResolveCount = readNonNegativeInt(value.entityResolveCount);
  const failedProviderCount = readNonNegativeInt(value.failedProviderCount);
  const partialProviderCount = readNonNegativeInt(value.partialProviderCount);
  const overlappingSitemapBuilds = readNonNegativeInt(value.overlappingSitemapBuilds);
  if (
    canonicalPathCount === null ||
    seoLocaleCount === null ||
    entityResolveCount === null ||
    failedProviderCount === null ||
    partialProviderCount === null ||
    overlappingSitemapBuilds === null
  ) {
    return null;
  }
  return {
    canonicalPathCount,
    seoLocaleCount,
    entityResolveCount,
    failedProviderCount,
    partialProviderCount,
    overlappingSitemapBuilds,
  };
}

function readPhases(value: unknown): WebSystemHealthEventRecord["phases"] | null {
  if (!isPlainObject(value)) {
    return null;
  }
  const start = value.start === null ? null : readMemorySample(value.start);
  const afterInventory = value.afterInventory === null ? null : readMemorySample(value.afterInventory);
  const afterEligibility =
    value.afterEligibility === null ? null : readMemorySample(value.afterEligibility);
  if (start === undefined || afterInventory === undefined || afterEligibility === undefined) {
    return null;
  }
  if (
    (value.start !== null && start === null) ||
    (value.afterInventory !== null && afterInventory === null) ||
    (value.afterEligibility !== null && afterEligibility === null)
  ) {
    return null;
  }
  return { start, afterInventory, afterEligibility };
}

function readMemorySample(value: unknown): WebMemorySample | null {
  if (!isPlainObject(value)) {
    return null;
  }
  const rss = readNonNegativeInt(value.rss);
  const heapUsed = readNonNegativeInt(value.heapUsed);
  const heapTotal = readNonNegativeInt(value.heapTotal);
  const external = readNonNegativeInt(value.external);
  const limitBytes = value.limitBytes === null ? null : readNonNegativeInt(value.limitBytes);
  if (
    rss === null ||
    heapUsed === null ||
    heapTotal === null ||
    external === null ||
    limitBytes === undefined ||
    (value.limitBytes !== null && limitBytes === null) ||
    typeof value.pressure !== "string" ||
    !PRESSURES.has(value.pressure)
  ) {
    return null;
  }
  return {
    rss,
    heapUsed,
    heapTotal,
    external,
    limitBytes,
    pressure: value.pressure as WebMemoryPressure,
  };
}

function readOptionalDuration(value: unknown): number | null | undefined {
  if (value === null || value === undefined) {
    return null;
  }
  return readNonNegativeInt(value) ?? undefined;
}

function readInstanceId(value: unknown): string | null | undefined {
  if (value === null) {
    return null;
  }
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(value)) {
    return undefined;
  }
  return value;
}

function readIsoTimestamp(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 40) {
    return null;
  }
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    return null;
  }
  return new Date(parsed).toISOString();
}

function readNonNegativeInt(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0 || value > 10_000_000_000) {
    return null;
  }
  return value;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
