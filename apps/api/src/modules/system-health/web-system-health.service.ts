import {
  AdministrationForbiddenError,
  AdministrationUnauthorizedError,
} from "../administration/administration.errors.js";
import { findAuthUserById } from "../auth/auth-user.repository.js";
import {
  readConfiguredSystemHealthToken,
  systemHealthTokenMatches,
  WEB_SYSTEM_HEALTH_TOKEN_HEADER,
} from "./system-health-token.js";
import {
  parseWebSystemHealthIngest,
  WEB_SYSTEM_HEALTH_MAX_READ_EVENTS,
  WEB_SYSTEM_HEALTH_RETENTION_MS,
  type WebMemoryPressure,
  type WebSystemHealthEventView,
} from "./web-system-health-event.js";
import {
  insertWebSystemHealthEvent,
  listWebSystemHealthEvents,
} from "./web-system-health-event.repository.js";

export const RENDER_TERMINATION_REASON = "UNKNOWN" as const;
const SNAPSHOT_PATH = "/api/internal/system-health/snapshot";
const SNAPSHOT_TIMEOUT_MS = 2_000;

export type WebMemoryUnavailableReason = "NOT_CONFIGURED" | "UNAVAILABLE";

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

export interface AdminWebMemorySnapshotResult {
  readonly renderTerminationReason: typeof RENDER_TERMINATION_REASON;
  readonly available: boolean;
  readonly unavailableReason: WebMemoryUnavailableReason | null;
  readonly snapshot: AdminWebMemorySnapshot | null;
}

export interface AdminWebSystemHealthEventList {
  readonly renderTerminationReason: typeof RENDER_TERMINATION_REASON;
  readonly retentionDays: number;
  readonly maxEvents: number;
  readonly events: readonly WebSystemHealthEventView[];
}

type AdminUser = { status: string; role: string } | null;

async function authorize(
  actorUserId: string,
  loadUser?: (userId: string) => Promise<AdminUser>,
): Promise<void> {
  const user = actorUserId.trim()
    ? await (loadUser ?? ((id: string) => findAuthUserById(id)))(actorUserId)
    : null;
  if (!actorUserId.trim()) {
    throw new AdministrationUnauthorizedError("Authentication is required.");
  }
  if (!user || user.status !== "active" || user.role !== "admin") {
    throw new AdministrationForbiddenError("Administrator access is required.");
  }
}

export async function readAdminWebSystemHealthEvents(input: {
  actorUserId: string;
  loadUser?: (userId: string) => Promise<AdminUser>;
  now?: Date;
}): Promise<AdminWebSystemHealthEventList> {
  await authorize(input.actorUserId, input.loadUser);
  const events = await listWebSystemHealthEvents(input.now);
  return {
    renderTerminationReason: RENDER_TERMINATION_REASON,
    retentionDays: WEB_SYSTEM_HEALTH_RETENTION_MS / (24 * 60 * 60 * 1000),
    maxEvents: WEB_SYSTEM_HEALTH_MAX_READ_EVENTS,
    events,
  };
}

export async function readAdminWebMemorySnapshot(input: {
  actorUserId: string;
  loadUser?: (userId: string) => Promise<AdminUser>;
  fetchImpl?: typeof fetch;
  env?: NodeJS.ProcessEnv;
}): Promise<AdminWebMemorySnapshotResult> {
  await authorize(input.actorUserId, input.loadUser);
  const env = input.env ?? process.env;
  const token = readConfiguredSystemHealthToken(env);
  const origin = resolveExplicitWebOrigin(env);
  if (!token || !origin) {
    return unavailable("NOT_CONFIGURED");
  }

  try {
    const response = await (input.fetchImpl ?? fetch)(`${origin}${SNAPSHOT_PATH}`, {
      method: "GET",
      cache: "no-store",
      headers: {
        Accept: "application/json",
        [WEB_SYSTEM_HEALTH_TOKEN_HEADER]: token,
      },
      signal: AbortSignal.timeout(SNAPSHOT_TIMEOUT_MS),
    });
    if (!response.ok) {
      return unavailable("UNAVAILABLE");
    }
    const snapshot = parseAdminWebMemorySnapshot(await response.json());
    if (!snapshot) {
      return unavailable("UNAVAILABLE");
    }
    return {
      renderTerminationReason: RENDER_TERMINATION_REASON,
      available: true,
      unavailableReason: null,
      snapshot,
    };
  } catch {
    return unavailable("UNAVAILABLE");
  }
}

export type SystemHealthIngestDecision = "stored" | "closed" | "unauthorized" | "invalid" | "unavailable";

export async function acceptWebSystemHealthEvent(input: {
  presentedToken: string | null;
  body: unknown;
  env?: NodeJS.ProcessEnv;
  now?: Date;
}): Promise<SystemHealthIngestDecision> {
  const env = input.env ?? process.env;
  if (!readConfiguredSystemHealthToken(env)) {
    return "closed";
  }
  if (!systemHealthTokenMatches(input.presentedToken, env)) {
    return "unauthorized";
  }
  const record = parseWebSystemHealthIngest(input.body, input.now ?? new Date());
  if (!record) {
    return "invalid";
  }
  try {
    await insertWebSystemHealthEvent(record);
  } catch {
    return "unavailable";
  }
  return "stored";
}

export function resolveExplicitWebOrigin(env: NodeJS.ProcessEnv = process.env): string | null {
  const raw = env.CORS_ORIGIN?.trim() || env.WEB_ORIGIN?.trim() || "";
  if (!raw) {
    return null;
  }
  const first = raw
    .split(",")
    .map((part) => part.trim())
    .find((part) => part.length > 0);
  if (!first) {
    return null;
  }
  try {
    const url = new URL(first);
    if (url.protocol !== "https:" && url.protocol !== "http:") {
      return null;
    }
    if (url.username || url.password || url.search || url.hash) {
      return null;
    }
    if (url.pathname !== "/" && url.pathname !== "") {
      return null;
    }
    return url.origin;
  } catch {
    return null;
  }
}

function unavailable(reason: WebMemoryUnavailableReason): AdminWebMemorySnapshotResult {
  return {
    renderTerminationReason: RENDER_TERMINATION_REASON,
    available: false,
    unavailableReason: reason,
    snapshot: null,
  };
}

export function parseAdminWebMemorySnapshot(value: unknown): AdminWebMemorySnapshot | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const record = value as Record<string, unknown>;
  const rss = readByte(record.rss);
  const heapUsed = readByte(record.heapUsed);
  const heapTotal = readByte(record.heapTotal);
  const external = readByte(record.external);
  const pid = readByte(record.pid);
  const uptimeSeconds = readByte(record.uptimeSeconds);
  const limitBytes = record.limitBytes === null ? null : readByte(record.limitBytes);
  const processStartedAt = typeof record.processStartedAt === "string" ? Date.parse(record.processStartedAt) : Number.NaN;
  const instanceId =
    record.instanceId === null
      ? null
      : typeof record.instanceId === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(record.instanceId)
        ? record.instanceId
        : undefined;
  const pressure = record.pressure;
  if (
    rss === null ||
    heapUsed === null ||
    heapTotal === null ||
    external === null ||
    pid === null ||
    uptimeSeconds === null ||
    limitBytes === null && record.limitBytes !== null ||
    !Number.isFinite(processStartedAt) ||
    instanceId === undefined ||
    (pressure !== "unknown" && pressure !== "below" && pressure !== "critical")
  ) {
    return null;
  }
  return {
    rss,
    heapUsed,
    heapTotal,
    external,
    pid,
    uptimeSeconds,
    processStartedAt: new Date(processStartedAt).toISOString(),
    instanceId,
    limitBytes,
    pressure,
  };
}

function readByte(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    return null;
  }
  return value;
}
