/**
 * HU-MEM-12C / HU-MEM-14D.2 — cgroup v2 memory reads never throw for the sampler.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  CGROUP_V2_MEMORY_CURRENT_PATH,
  CGROUP_V2_MEMORY_EVENTS_PATH,
  CGROUP_V2_MEMORY_MAX_PATH,
  CGROUP_V2_MEMORY_PEAK_PATH,
  CGROUP_V2_MEMORY_STAT_PATH,
  readCgroupMemoryBytes,
  type CgroupMemoryBytes,
} from "./web-cgroup-memory";

const NULL_CGROUP: CgroupMemoryBytes = {
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

describe("web cgroup memory", () => {
  it("parses cgroup v2 current and max bytes", () => {
    const files = new Map<string, string>([
      [CGROUP_V2_MEMORY_CURRENT_PATH, "12345\n"],
      [CGROUP_V2_MEMORY_MAX_PATH, "67890\n"],
    ]);
    assert.deepEqual(readCgroupMemoryBytes((path) => files.get(path) ?? null), {
      ...NULL_CGROUP,
      currentBytes: 12345,
      limitBytes: 67890,
    });
  });

  it("parses memory.stat fields without combining overlapping counters", () => {
    const stat = [
      "anon 82538496",
      "file 51679232",
      "kernel 12763136",
      "sock 0",
      "inactive_file 40000000",
      "active_file 11679232",
      "slab 999",
    ].join("\n");
    const reading = readCgroupMemoryBytes((path) =>
      path === CGROUP_V2_MEMORY_STAT_PATH ? stat : null,
    );
    assert.equal(reading.anonBytes, 82538496);
    assert.equal(reading.fileBytes, 51679232);
    assert.equal(reading.kernelBytes, 12763136);
    assert.equal(reading.socketBytes, 0);
    assert.equal(reading.inactiveFileBytes, 40000000);
    assert.equal(reading.activeFileBytes, 11679232);
    assert.equal(
      Object.prototype.hasOwnProperty.call(reading, "slabBytes"),
      false,
    );
    assert.equal(reading.anonBytes! + reading.fileBytes!, 82538496 + 51679232);
  });

  it("parses memory.events as lifetime counters, including zero", () => {
    const reading = readCgroupMemoryBytes((path) =>
      path === CGROUP_V2_MEMORY_EVENTS_PATH ? "low 0\nhigh 0\nmax 0\noom 0\noom_kill 0\n" : null,
    );
    assert.equal(reading.maxEvents, 0);
    assert.equal(reading.oomEvents, 0);
    assert.equal(reading.oomKillEvents, 0);
  });

  it("parses memory.peak and keeps a missing stat field null", () => {
    const reading = readCgroupMemoryBytes((path) => {
      if (path === CGROUP_V2_MEMORY_PEAK_PATH) {
        return "0\n";
      }
      if (path === CGROUP_V2_MEMORY_STAT_PATH) {
        return "anon 10\nfile not-a-number\nkernel -1\n";
      }
      return null;
    });
    assert.equal(reading.peakBytes, 0);
    assert.equal(reading.anonBytes, 10);
    assert.equal(reading.fileBytes, null);
    assert.equal(reading.kernelBytes, null);
    assert.equal(reading.socketBytes, null);
  });

  it("returns null for missing files, max, and reader faults", () => {
    assert.deepEqual(readCgroupMemoryBytes(() => null), NULL_CGROUP);
    assert.deepEqual(
      readCgroupMemoryBytes((path) =>
        path === CGROUP_V2_MEMORY_MAX_PATH ? "max\n" : path === CGROUP_V2_MEMORY_CURRENT_PATH ? "9\n" : null,
      ),
      { ...NULL_CGROUP, currentBytes: 9, limitBytes: null },
    );
    assert.deepEqual(
      readCgroupMemoryBytes(() => {
        throw new Error("EACCES");
      }),
      NULL_CGROUP,
    );
  });
});
