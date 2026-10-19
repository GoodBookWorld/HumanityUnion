/**
 * Process-lifetime Web memory samples for Render Logs.
 * One unref'd timer. Samples are stdout JSON only — never Mongo, never request data.
 */

import { writeSync } from "node:fs";

import {
  readWebWorkloadGauges,
  enterSeoEligibilityOperation,
  enterSeoMetadataOperation,
  leaveSeoEligibilityOperation,
  leaveSeoMetadataOperation,
  resetSeoOperationGaugesForTests,
} from "./web-memory-gauges";
import { readWebProcessMemorySnapshot } from "./web-process-memory";

export const WEB_MEMORY_SAMPLE_INTERVAL_MS = 30_000;
export const WEB_MEMORY_RSS_STEP_BYTES = 32 * 1024 * 1024;
export const WEB_MEMORY_RSS_STEP_MIN_GAP_MS = 10_000;
export const WEB_MEMORY_RSS_STEP_MAX_PER_MINUTE = 6;
const RSS_STEP_WINDOW_MS = 60_000;

const SAMPLER_STATE_KEY = "__huWebMemorySamplerState";

export type WebMemorySampleReason = "interval" | "rss_step" | "sitemap_boundary";
export type SitemapMemoryBoundary = "start" | "completion";

export interface WebMemorySamplerTimer {
  unref?: () => void;
}

export interface WebMemorySamplerDependencies {
  readonly nowMs: () => number;
  readonly readMemory: () => NodeJS.MemoryUsage;
  readonly readEnv: () => NodeJS.ProcessEnv;
  readonly readUptimeSeconds: () => number;
  readonly readPid: () => number;
  readonly writeLine: (line: string) => void;
}

interface SamplerState {
  started: boolean;
  timer: WebMemorySamplerTimer | null;
  clearTimer: () => void;
  lastEmittedRss: number | null;
  stepAtMs: number[];
  deps: WebMemorySamplerDependencies;
}

export interface WebMemorySamplerStartOptions {
  readonly setIntervalFn?: (callback: () => void, delayMs: number) => WebMemorySamplerTimer;
  readonly clearIntervalFn?: (timer: WebMemorySamplerTimer) => void;
  readonly nowMs?: () => number;
  readonly readMemory?: () => NodeJS.MemoryUsage;
  readonly readEnv?: () => NodeJS.ProcessEnv;
  readonly readUptimeSeconds?: () => number;
  readonly readPid?: () => number;
  readonly writeLine?: (line: string) => void;
}

const MEMORY_SAMPLE_FIELDS = [
  "kind",
  "source",
  "operation",
  "reason",
  "boundary",
  "occurredAt",
  "pid",
  "instanceId",
  "processStartedAt",
  "uptimeSeconds",
  "rss",
  "heapUsed",
  "heapTotal",
  "external",
  "limitBytes",
  "pressure",
  "activeSitemapBuilds",
  "activeSeoMetadataOperations",
  "activeSeoEligibilityOperations",
] as const;

export function shouldStartWebMemorySampler(runtime: string | undefined): boolean {
  return runtime === "nodejs";
}

export function writeMemorySampleStdout(line: string): void {
  try {
    const text = line.endsWith("\n") ? line : `${line}\n`;
    writeSync(1, text);
  } catch {
    // A closed or broken stdout must not fail the request that triggered the sample.
  }
}

function defaultDependencies(): WebMemorySamplerDependencies {
  return {
    nowMs: () => Date.now(),
    readMemory: () => process.memoryUsage(),
    readEnv: () => process.env,
    readUptimeSeconds: () => process.uptime(),
    readPid: () => process.pid,
    writeLine: writeMemorySampleStdout,
  };
}

function samplerState(): SamplerState {
  const host = globalThis as unknown as Record<string, SamplerState | undefined>;
  const existing = host[SAMPLER_STATE_KEY];
  if (existing) {
    return existing;
  }
  const created: SamplerState = {
    started: false,
    timer: null,
    clearTimer: () => undefined,
    lastEmittedRss: null,
    stepAtMs: [],
    deps: defaultDependencies(),
  };
  host[SAMPLER_STATE_KEY] = created;
  return created;
}

function applyDependencies(options: WebMemorySamplerStartOptions | undefined): void {
  if (!options) {
    return;
  }
  const current = samplerState().deps;
  samplerState().deps = {
    nowMs: options.nowMs ?? current.nowMs,
    readMemory: options.readMemory ?? current.readMemory,
    readEnv: options.readEnv ?? current.readEnv,
    readUptimeSeconds: options.readUptimeSeconds ?? current.readUptimeSeconds,
    readPid: options.readPid ?? current.readPid,
    writeLine: options.writeLine ?? current.writeLine,
  };
}

function pruneStepTimestamps(nowMs: number): number[] {
  const current = samplerState();
  current.stepAtMs = current.stepAtMs.filter((stamp) => nowMs - stamp <= RSS_STEP_WINDOW_MS);
  return current.stepAtMs;
}

function recordEmittedRss(rss: number): void {
  samplerState().lastEmittedRss = rss;
}

export function buildWebMemorySampleRecord(input: {
  readonly reason: WebMemorySampleReason;
  readonly boundary?: SitemapMemoryBoundary;
  readonly nowMs?: number;
}): Record<string, string | number | null> {
  const deps = samplerState().deps;
  const nowMs = input.nowMs ?? deps.nowMs();
  const snapshot = readWebProcessMemorySnapshot(
    deps.readEnv(),
    deps.readMemory(),
    nowMs,
    deps.readUptimeSeconds(),
    deps.readPid(),
  );
  const workload = readWebWorkloadGauges();
  const record: Record<string, string | number | null> = {
    kind: "web_system_health",
    source: "web",
    operation: "memory_sample",
    reason: input.reason,
    occurredAt: new Date(nowMs).toISOString(),
    pid: snapshot.pid,
    instanceId: snapshot.instanceId,
    processStartedAt: snapshot.processStartedAt,
    uptimeSeconds: snapshot.uptimeSeconds,
    rss: snapshot.rss,
    heapUsed: snapshot.heapUsed,
    heapTotal: snapshot.heapTotal,
    external: snapshot.external,
    limitBytes: snapshot.limitBytes,
    pressure: snapshot.pressure,
    activeSitemapBuilds: workload.activeSitemapBuilds,
    activeSeoMetadataOperations: workload.activeSeoMetadataOperations,
    activeSeoEligibilityOperations: workload.activeSeoEligibilityOperations,
  };
  if (input.boundary) {
    record.boundary = input.boundary;
  }
  return record;
}

function emitSample(input: {
  readonly reason: WebMemorySampleReason;
  readonly boundary?: SitemapMemoryBoundary;
  readonly nowMs?: number;
}): boolean {
  try {
    const record = buildWebMemorySampleRecord(input);
    const line = JSON.stringify(record);
    samplerState().deps.writeLine(line);
    const rss = record.rss;
    if (typeof rss === "number") {
      recordEmittedRss(rss);
    }
    return true;
  } catch {
    return false;
  }
}

export function emitWebMemoryIntervalSample(nowMs?: number): void {
  emitSample({ reason: "interval", ...(nowMs !== undefined ? { nowMs } : {}) });
}

export function recordSitemapMemoryBoundary(boundary: SitemapMemoryBoundary, nowMs?: number): void {
  emitSample({
    reason: "sitemap_boundary",
    boundary,
    ...(nowMs !== undefined ? { nowMs } : {}),
  });
}

export function considerWebMemoryRssStep(nowMs?: number): void {
  try {
    const deps = samplerState().deps;
    const at = nowMs ?? deps.nowMs();
    const rss = readWebProcessMemorySnapshot(
      deps.readEnv(),
      deps.readMemory(),
      at,
      deps.readUptimeSeconds(),
      deps.readPid(),
    ).rss;
    const baseline = samplerState().lastEmittedRss;
    if (baseline === null || rss - baseline < WEB_MEMORY_RSS_STEP_BYTES) {
      return;
    }
    const recent = pruneStepTimestamps(at);
    const previous = recent[recent.length - 1];
    if (previous !== undefined && at - previous < WEB_MEMORY_RSS_STEP_MIN_GAP_MS) {
      return;
    }
    if (recent.length >= WEB_MEMORY_RSS_STEP_MAX_PER_MINUTE) {
      return;
    }
    const wrote = emitSample({ reason: "rss_step", nowMs: at });
    if (wrote) {
      samplerState().stepAtMs.push(at);
      pruneStepTimestamps(at);
    }
  } catch {
    // Step logging is diagnostic only.
  }
}

function intervalTick(): void {
  emitWebMemoryIntervalSample();
}

export function startWebMemorySampler(options?: WebMemorySamplerStartOptions): void {
  const current = samplerState();
  if (current.started) {
    return;
  }
  applyDependencies(options);
  const setIntervalFn =
    options?.setIntervalFn ??
    ((callback, delayMs) => setInterval(callback, delayMs) as unknown as WebMemorySamplerTimer);
  const clearIntervalFn =
    options?.clearIntervalFn ??
    ((timer) => {
      clearInterval(timer as unknown as ReturnType<typeof setInterval>);
    });
  const timer = setIntervalFn(intervalTick, WEB_MEMORY_SAMPLE_INTERVAL_MS);
  try {
    timer.unref?.();
  } catch {
    // unref is an optimization. Sampling still stops with the process.
  }
  current.timer = timer;
  current.clearTimer = () => {
    clearIntervalFn(timer);
  };
  current.started = true;
  intervalTick();
}

export function stopWebMemorySamplerForTests(): void {
  const current = samplerState();
  if (current.timer) {
    try {
      current.clearTimer();
    } catch {
      // Test cleanup must not hide a sampler fault.
    }
  }
  current.timer = null;
  current.clearTimer = () => undefined;
  current.started = false;
}

export function resetWebMemorySamplerForTests(): void {
  stopWebMemorySamplerForTests();
  const current = samplerState();
  current.lastEmittedRss = null;
  current.stepAtMs = [];
  current.deps = defaultDependencies();
  resetSeoOperationGaugesForTests();
}

export function webMemorySamplerStartedForTests(): boolean {
  return samplerState().started;
}

export async function withSeoMetadataOperation<T>(work: () => Promise<T>): Promise<T> {
  enterSeoMetadataOperation();
  try {
    return await work();
  } finally {
    considerWebMemoryRssStep();
    leaveSeoMetadataOperation();
  }
}

export async function withSeoEligibilityOperation<T>(work: () => Promise<T>): Promise<T> {
  enterSeoEligibilityOperation();
  try {
    return await work();
  } finally {
    considerWebMemoryRssStep();
    leaveSeoEligibilityOperation();
  }
}

export function memorySampleFieldNames(): readonly string[] {
  return MEMORY_SAMPLE_FIELDS;
}
