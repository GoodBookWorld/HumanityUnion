/**
 * Best-effort cgroup v2 memory reads for Web memory samples.
 * Missing or unreadable files yield null. Never throws to callers.
 */

import { readFileSync } from "node:fs";

export const CGROUP_V2_MEMORY_CURRENT_PATH = "/sys/fs/cgroup/memory.current";
export const CGROUP_V2_MEMORY_MAX_PATH = "/sys/fs/cgroup/memory.max";

export interface CgroupMemoryBytes {
  readonly currentBytes: number | null;
  readonly limitBytes: number | null;
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
    return {
      currentBytes: parseCgroupByteCount(readFile(CGROUP_V2_MEMORY_CURRENT_PATH)),
      limitBytes: parseCgroupByteCount(readFile(CGROUP_V2_MEMORY_MAX_PATH)),
    };
  } catch {
    return { currentBytes: null, limitBytes: null };
  }
}
