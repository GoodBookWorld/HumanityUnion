import { apiRequest } from "../../lib/api-client";

export type WebMemoryPressure = "unknown" | "below" | "critical";

export interface AdminWebMemorySnapshot {
  readonly rss: number;
  readonly heapUsed: number;
  readonly heapTotal: number;
  readonly external: number;
  readonly pid: number;
  readonly uptimeSeconds: number;
  readonly processStartedAt: string;
  readonly instanceId: string | null;
  readonly limitBytes: number | null;
  readonly pressure: WebMemoryPressure;
}

export interface AdminWebMemorySnapshotView {
  readonly renderTerminationReason: "UNKNOWN";
  readonly available: boolean;
  readonly unavailableReason: "NOT_CONFIGURED" | "UNAVAILABLE" | null;
  readonly snapshot: AdminWebMemorySnapshot | null;
}

export interface AdminWebSystemHealthEvent {
  readonly eventId: string;
  readonly source: "web";
  readonly operation: "sitemap_build";
  readonly eventTypes: readonly ("sitemap_failure" | "memory_threshold")[];
  readonly occurredAt: string;
  readonly expiresAt: string;
  readonly instanceId: string | null;
  readonly pid: number;
  readonly processStartedAt: string;
  readonly uptimeSeconds: number;
  readonly durationMs: number | null;
  readonly memory: {
    readonly rss: number;
    readonly heapUsed: number;
    readonly heapTotal: number;
    readonly external: number;
    readonly limitBytes: number | null;
    readonly pressure: WebMemoryPressure;
  };
  readonly phases: {
    readonly start: PhaseMemory | null;
    readonly afterInventory: PhaseMemory | null;
    readonly afterEligibility: PhaseMemory | null;
  };
  readonly counts: {
    readonly canonicalPathCount: number;
    readonly seoLocaleCount: number;
    readonly entityResolveCount: number;
    readonly failedProviderCount: number;
    readonly partialProviderCount: number;
    readonly overlappingSitemapBuilds: number;
  };
  readonly failedProviderIds: readonly string[];
  readonly partialProviderIds: readonly string[];
}

interface PhaseMemory {
  readonly rss: number;
  readonly heapUsed: number;
  readonly heapTotal: number;
  readonly external: number;
  readonly limitBytes: number | null;
  readonly pressure: WebMemoryPressure;
}

export interface AdminWebSystemHealthEventList {
  readonly renderTerminationReason: "UNKNOWN";
  readonly retentionDays: number;
  readonly maxEvents: number;
  readonly events: readonly AdminWebSystemHealthEvent[];
}

export function fetchAdminWebMemorySnapshot(): Promise<AdminWebMemorySnapshotView> {
  return apiRequest<AdminWebMemorySnapshotView>("/api/v1/admin/system-health/snapshot");
}

export function fetchAdminWebSystemHealthEvents(): Promise<AdminWebSystemHealthEventList> {
  return apiRequest<AdminWebSystemHealthEventList>("/api/v1/admin/system-health/events");
}

export function formatByteCount(bytes: number | null | undefined): string {
  if (typeof bytes !== "number" || !Number.isFinite(bytes) || bytes < 0) {
    return "UNKNOWN";
  }
  const mib = bytes / (1024 * 1024);
  return `${mib.toFixed(1)} MiB (${bytes} bytes)`;
}

export function formatUptime(uptimeSeconds: number | null | undefined): string {
  if (typeof uptimeSeconds !== "number" || !Number.isFinite(uptimeSeconds) || uptimeSeconds < 0) {
    return "UNKNOWN";
  }
  const total = Math.floor(uptimeSeconds);
  const days = Math.floor(total / 86_400);
  const hours = Math.floor((total % 86_400) / 3_600);
  const minutes = Math.floor((total % 3_600) / 60);
  const seconds = total % 60;
  return `${days}d ${hours}h ${minutes}m ${seconds}s`;
}

export function formatPressure(pressure: WebMemoryPressure | null | undefined): string {
  if (pressure === "critical") {
    return "Threshold crossed";
  }
  if (pressure === "below") {
    return "Below threshold";
  }
  return "UNKNOWN";
}

export function formatInstanceId(instanceId: string | null | undefined): string {
  return instanceId?.trim() ? instanceId : "UNKNOWN";
}
