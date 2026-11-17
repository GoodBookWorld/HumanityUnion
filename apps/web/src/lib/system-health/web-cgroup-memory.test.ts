/**
 * HU-MEM-12C — cgroup v2 memory reads never throw for the sampler.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  CGROUP_V2_MEMORY_CURRENT_PATH,
  CGROUP_V2_MEMORY_MAX_PATH,
  readCgroupMemoryBytes,
} from "./web-cgroup-memory";

describe("web cgroup memory", () => {
  it("parses cgroup v2 current and max bytes", () => {
    const files = new Map<string, string>([
      [CGROUP_V2_MEMORY_CURRENT_PATH, "12345\n"],
      [CGROUP_V2_MEMORY_MAX_PATH, "67890\n"],
    ]);
    assert.deepEqual(
      readCgroupMemoryBytes((path) => files.get(path) ?? null),
      { currentBytes: 12345, limitBytes: 67890 },
    );
  });

  it("returns null for missing files, max, and reader faults", () => {
    assert.deepEqual(
      readCgroupMemoryBytes(() => null),
      { currentBytes: null, limitBytes: null },
    );
    assert.deepEqual(
      readCgroupMemoryBytes((path) =>
        path === CGROUP_V2_MEMORY_MAX_PATH ? "max\n" : "9\n",
      ),
      { currentBytes: 9, limitBytes: null },
    );
    assert.deepEqual(
      readCgroupMemoryBytes(() => {
        throw new Error("EACCES");
      }),
      { currentBytes: null, limitBytes: null },
    );
  });
});
