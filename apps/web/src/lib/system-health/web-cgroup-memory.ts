/**
 * Best-effort cgroup v2 memory reads for Web memory samples.
 * Missing or unreadable files yield null. Never throws to callers.
 *
 * memory.events values are cgroup-lifetime counters. They are reported as read
 * and are not differenced between samples. memory.stat fields are reported
 * separately; overlapping counters are not added together.
 */

import { readFileSync } from "node:fs";

export const CGROUP_V2_MEMORY_CURRENT_PATH = "/sys/fs/cgroup/memory.current";
export const CGROUP_V2_MEMORY_MAX_PATH = "/sys/fs/cgroup/memory.max";
export const CGROUP_V2_MEMORY_STAT_PATH = "/sys/fs/cgroup/memory.stat";
export const CGROUP_V2_MEMORY_EVENTS_PATH = "/sys/fs/cgroup/memory.events";
export const CGROUP_V2_MEMORY_PEAK_PATH = "/sys/fs/cgroup/memory.peak";

const STAT_KEYS = [
  "anon",
  "file",
  "kernel",
  "sock",
  "inactive_file",
  "active_file",
] as const;

const EVENT_KEYS = ["max", "oom", "oom_kill"] as const;

export interface CgroupMemoryBytes {
  readonly currentBytes: number | null;
  readonly limitBytes: number | null;
  readonly anonBytes: number | null;
  readonly fileBytes: number | null;
  readonly kernelBytes: number | null;
  readonly socketBytes: number | null;
  readonly inactiveFileBytes: number | null;
  readonly activeFileBytes: number | null;
  readonly peakBytes: number | null;
  readonly maxEvents: number | null;
  readonly oomEvents: number | null;
  readonly oomKillEvents: number | null;
}

export type CgroupMemoryFileReader = (path: string) => string | null;

function parseCgroupByteCount(raw: string | null): number | null {
  if (raw === null) {
    return null;
  }
  const trimmed = raw.trim();
  if (trimmed.length === 0 || trimmed === "max") {
    return null;
  }
  if (!/^[0-9]+$/.test(trimmed)) {
    return null;
  }
  const value = Number(trimmed);
  if (!Number.isSafeInteger(value) || value < 0) {
    return null;
  }
  return value;
}

function emptyNamedCounts(keys: readonly string[]): Record<string, number | null> {
  const counts: Record<string, number | null> = {};
  for (const key of keys) {
    counts[key] = null;
  }
  return counts;
}

/** First valid occurrence of each known key wins. Unknown and malformed lines are ignored. */
function parseNamedCounts(raw: string | null, keys: readonly string[]): Record<string, number | null> {
  const counts = emptyNamedCounts(keys);
  if (raw === null) {
    return counts;
  }
  const known = new Set(keys);
  const seen = new Set<string>();
  for (const line of raw.split("\n")) {
    const parts = line.trim().split(/\s+/);
    if (parts.length !== 2) {
      continue;
    }
    const key = parts[0];
    const value = parts[1];
    if (!key || value === undefined || !known.has(key) || seen.has(key)) {
      continue;
    }
    seen.add(key);
    counts[key] = parseCgroupByteCount(value);
  }
  return counts;
}

function readCgroupText(readFile: CgroupMemoryFileReader, path: string): string | null {
  try {
    return readFile(path);
  } catch {
    return null;
  }
}

export function defaultCgroupMemoryFileReader(path: string): string | null {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return null;
  }
}

export function readCgroupMemoryBytes(
  readFile: CgroupMemoryFileReader = defaultCgroupMemoryFileReader,
): CgroupMemoryBytes {
  try {
    const stat = parseNamedCounts(readCgroupText(readFile, CGROUP_V2_MEMORY_STAT_PATH), STAT_KEYS);
    const events = parseNamedCounts(
      readCgroupText(readFile, CGROUP_V2_MEMORY_EVENTS_PATH),
      EVENT_KEYS,
    );
    return {
      currentBytes: parseCgroupByteCount(readCgroupText(readFile, CGROUP_V2_MEMORY_CURRENT_PATH)),
      limitBytes: parseCgroupByteCount(readCgroupText(readFile, CGROUP_V2_MEMORY_MAX_PATH)),
      anonBytes: stat.anon ?? null,
      fileBytes: stat.file ?? null,
      kernelBytes: stat.kernel ?? null,
      socketBytes: stat.sock ?? null,
      inactiveFileBytes: stat.inactive_file ?? null,
      activeFileBytes: stat.active_file ?? null,
      peakBytes: parseCgroupByteCount(readCgroupText(readFile, CGROUP_V2_MEMORY_PEAK_PATH)),
      maxEvents: events.max ?? null,
      oomEvents: events.oom ?? null,
      oomKillEvents: events.oom_kill ?? null,
    };
  } catch {
    return {
      currentBytes: null,
      limitBytes: null,
      anonBytes: null,
      fileBytes: null,
      kernelBytes: null,
      socketBytes: null,
      inactiveFileBytes: null,
      activeFileBytes: null,
      peakBytes: null,
      maxEvents: null,
      oomEvents: null,
      oomKillEvents: null,
    };
  }
}
