/**
 * Server-only reading of this Web Node process.
 * The limit is used only when WEB_PROCESS_MEMORY_LIMIT_BYTES is an explicit
 * positive integer. No plan size is assumed.
 */

export const WEB_PROCESS_MEMORY_LIMIT_ENV = "WEB_PROCESS_MEMORY_LIMIT_BYTES";
export const RENDER_INSTANCE_ID_ENV = "RENDER_INSTANCE_ID";

export type WebMemoryPressure = "unknown" | "below" | "critical";

export interface WebProcessMemorySnapshot {
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

const INSTANCE_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

export function readConfiguredMemoryLimitBytes(
  raw: string | undefined,
): number | null {
  if (raw === undefined) {
    return null;
  }
  const trimmed = raw.trim();
  if (!/^[1-9][0-9]*$/.test(trimmed)) {
    return null;
  }
  const value = Number(trimmed);
  if (!Number.isSafeInteger(value) || value <= 0) {
    return null;
  }
  return value;
}

export function readRenderInstanceId(raw: string | undefined): string | null {
  const trimmed = raw?.trim() ?? "";
  if (!INSTANCE_ID_PATTERN.test(trimmed)) {
    return null;
  }
  return trimmed;
}

/** Critical when RSS is at least 90% of an explicitly configured limit. */
export function resolveWebMemoryPressure(
  rss: number,
  limitBytes: number | null,
): WebMemoryPressure {
  if (limitBytes === null || !Number.isSafeInteger(rss) || rss < 0) {
    return "unknown";
  }
  if (rss * 10 >= limitBytes * 9) {
    return "critical";
  }
  return "below";
}

export function readWebProcessMemorySnapshot(
  env: NodeJS.ProcessEnv = process.env,
  memory: NodeJS.MemoryUsage = process.memoryUsage(),
  nowMs: number = Date.now(),
  uptimeSeconds: number = process.uptime(),
  pid: number = process.pid,
): WebProcessMemorySnapshot {
  const limitBytes = readConfiguredMemoryLimitBytes(env[WEB_PROCESS_MEMORY_LIMIT_ENV]);
  const rss = finiteByteCount(memory.rss);
  const safeUptime = Number.isFinite(uptimeSeconds) && uptimeSeconds > 0 ? uptimeSeconds : 0;
  const startedMs = nowMs - safeUptime * 1000;

  return {
    rss,
    heapUsed: finiteByteCount(memory.heapUsed),
    heapTotal: finiteByteCount(memory.heapTotal),
    external: finiteByteCount(memory.external),
    pid: Number.isSafeInteger(pid) && pid > 0 ? pid : 0,
    uptimeSeconds: Math.floor(safeUptime),
    processStartedAt: new Date(startedMs).toISOString(),
    instanceId: readRenderInstanceId(env[RENDER_INSTANCE_ID_ENV]),
    limitBytes,
    pressure: resolveWebMemoryPressure(rss, limitBytes),
  };
}

function finiteByteCount(value: number): number {
  if (!Number.isFinite(value) || value < 0) {
    return 0;
  }
  return Math.floor(value);
}
