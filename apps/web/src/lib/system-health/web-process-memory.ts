/**
 * Server-only reading of this Web Node process.
 * The limit is used only when WEB_PROCESS_MEMORY_LIMIT_BYTES is an explicit
 * positive integer. No plan size is assumed.
 *
 * /proc/self/status supplies this process only. Linux reports those sizes in
 * KiB; the sample converts them to bytes. V8 statistics come from node:v8.
 * A missing file or an unavailable statistic is null.
 */

import { readFileSync } from "node:fs";
import { getHeapSpaceStatistics, getHeapStatistics } from "node:v8";

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

export const PROC_SELF_STATUS_PATH = "/proc/self/status";

const KIB_BYTES = 1024;

export interface ProcStatusMemory {
  readonly rssAnonBytes: number | null;
  readonly rssFileBytes: number | null;
  readonly rssShmemBytes: number | null;
  readonly threadCount: number | null;
}

export interface V8MemorySample {
  readonly totalPhysicalSizeBytes: number | null;
  readonly totalHeapSizeBytes: number | null;
  readonly usedHeapSizeBytes: number | null;
  readonly heapSizeLimitBytes: number | null;
  readonly mallocedMemoryBytes: number | null;
  readonly peakMallocedMemoryBytes: number | null;
  readonly externalMemoryBytes: number | null;
  readonly nativeContextCount: number | null;
  readonly detachedContextCount: number | null;
  readonly oldSpaceUsedBytes: number | null;
  readonly oldSpaceAllocatedBytes: number | null;
  readonly largeObjectSpaceUsedBytes: number | null;
  readonly largeObjectSpaceAllocatedBytes: number | null;
  readonly codeSpaceUsedBytes: number | null;
  readonly codeSpaceAllocatedBytes: number | null;
}

export type ProcStatusFileReader = (path: string) => string | null;

interface V8HeapStatisticsInput {
  readonly total_physical_size?: number;
  readonly total_heap_size?: number;
  readonly used_heap_size?: number;
  readonly heap_size_limit?: number;
  readonly malloced_memory?: number;
  readonly peak_malloced_memory?: number;
  readonly external_memory?: number;
  readonly number_of_native_contexts?: number;
  readonly number_of_detached_contexts?: number;
}

interface V8HeapSpaceInput {
  readonly space_name?: string;
  readonly space_size?: number;
  readonly space_used_size?: number;
}

const NULL_PROC_STATUS: ProcStatusMemory = {
  rssAnonBytes: null,
  rssFileBytes: null,
  rssShmemBytes: null,
  threadCount: null,
};

const NULL_V8_MEMORY: V8MemorySample = {
  totalPhysicalSizeBytes: null,
  totalHeapSizeBytes: null,
  usedHeapSizeBytes: null,
  heapSizeLimitBytes: null,
  mallocedMemoryBytes: null,
  peakMallocedMemoryBytes: null,
  externalMemoryBytes: null,
  nativeContextCount: null,
  detachedContextCount: null,
  oldSpaceUsedBytes: null,
  oldSpaceAllocatedBytes: null,
  largeObjectSpaceUsedBytes: null,
  largeObjectSpaceAllocatedBytes: null,
  codeSpaceUsedBytes: null,
  codeSpaceAllocatedBytes: null,
};

const HEAP_SPACE_FIELDS = {
  old_space: ["oldSpaceUsedBytes", "oldSpaceAllocatedBytes"],
  large_object_space: ["largeObjectSpaceUsedBytes", "largeObjectSpaceAllocatedBytes"],
  code_space: ["codeSpaceUsedBytes", "codeSpaceAllocatedBytes"],
} as const;

function nonNegativeNumber(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return null;
  }
  if (!Number.isSafeInteger(Math.floor(value))) {
    return null;
  }
  return Math.floor(value);
}

function kibToBytes(kib: number): number | null {
  const bytes = kib * KIB_BYTES;
  if (!Number.isSafeInteger(bytes) || bytes < 0) {
    return null;
  }
  return bytes;
}

export function defaultProcStatusFileReader(path: string): string | null {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return null;
  }
}

export function parseProcStatusMemory(raw: string | null): ProcStatusMemory {
  if (raw === null) {
    return NULL_PROC_STATUS;
  }
  const values = new Map<string, { amount: number; unit: string | null }>();
  for (const line of raw.split("\n")) {
    const match = /^([A-Za-z0-9_]+):\s+([0-9]+)(?:\s+([A-Za-z]+))?$/.exec(line.trim());
    if (!match || match[1] === undefined || match[2] === undefined) {
      continue;
    }
    const amount = Number(match[2]);
    if (!Number.isSafeInteger(amount) || amount < 0 || values.has(match[1])) {
      continue;
    }
    values.set(match[1], { amount, unit: match[3] ?? null });
  }

  function rssBytes(name: string): number | null {
    const entry = values.get(name);
    if (!entry || entry.unit !== "kB") {
      return null;
    }
    return kibToBytes(entry.amount);
  }

  const threads = values.get("Threads");
  return {
    rssAnonBytes: rssBytes("RssAnon"),
    rssFileBytes: rssBytes("RssFile"),
    rssShmemBytes: rssBytes("RssShmem"),
    threadCount: threads && threads.unit === null ? threads.amount : null,
  };
}

export function readProcStatusMemory(
  readFile: ProcStatusFileReader = defaultProcStatusFileReader,
): ProcStatusMemory {
  try {
    return parseProcStatusMemory(readFile(PROC_SELF_STATUS_PATH));
  } catch {
    return NULL_PROC_STATUS;
  }
}

export function v8MemorySampleFrom(
  heap: V8HeapStatisticsInput | null,
  spaces: readonly V8HeapSpaceInput[] | null,
): V8MemorySample {
  const sample: V8MemorySample = { ...NULL_V8_MEMORY };
  const writable = sample as {
    -readonly [Key in keyof V8MemorySample]: V8MemorySample[Key];
  };
  if (heap) {
    writable.totalPhysicalSizeBytes = nonNegativeNumber(heap.total_physical_size);
    writable.totalHeapSizeBytes = nonNegativeNumber(heap.total_heap_size);
    writable.usedHeapSizeBytes = nonNegativeNumber(heap.used_heap_size);
    writable.heapSizeLimitBytes = nonNegativeNumber(heap.heap_size_limit);
    writable.mallocedMemoryBytes = nonNegativeNumber(heap.malloced_memory);
    writable.peakMallocedMemoryBytes = nonNegativeNumber(heap.peak_malloced_memory);
    writable.externalMemoryBytes = nonNegativeNumber(heap.external_memory);
    writable.nativeContextCount = nonNegativeNumber(heap.number_of_native_contexts);
    writable.detachedContextCount = nonNegativeNumber(heap.number_of_detached_contexts);
  }
  const byName = new Map<string, V8HeapSpaceInput>();
  for (const space of spaces ?? []) {
    if (!space.space_name || byName.has(space.space_name)) {
      continue;
    }
    byName.set(space.space_name, space);
  }
  for (const [name, fields] of Object.entries(HEAP_SPACE_FIELDS)) {
    const space = byName.get(name);
    const usedField = fields[0];
    const allocatedField = fields[1];
    writable[usedField] = space ? nonNegativeNumber(space.space_used_size) : null;
    writable[allocatedField] = space ? nonNegativeNumber(space.space_size) : null;
  }
  return sample;
}

export function readV8MemorySample(): V8MemorySample {
  let heap: V8HeapStatisticsInput | null = null;
  let spaces: readonly V8HeapSpaceInput[] | null = null;
  try {
    heap = getHeapStatistics();
  } catch {
    heap = null;
  }
  try {
    spaces = getHeapSpaceStatistics();
  } catch {
    spaces = null;
  }
  try {
    return v8MemorySampleFrom(heap, spaces);
  } catch {
    return NULL_V8_MEMORY;
  }
}
