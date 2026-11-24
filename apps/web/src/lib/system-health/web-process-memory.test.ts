/**
 * HU-MEM-14D.2 — process status and selected V8 statistics.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  PROC_SELF_STATUS_PATH,
  parseProcStatusMemory,
  readProcStatusMemory,
  readV8MemorySample,
  v8MemorySampleFrom,
} from "./web-process-memory";

describe("web process memory diagnostics", () => {
  it("converts Linux KiB status fields to bytes and parses the thread count", () => {
    const status = [
      "Name:\tnode",
      "VmRSS:\t103008 kB",
      "RssAnon:\t79332 kB",
      "RssFile:\t23676 kB",
      "RssShmem:\t0 kB",
      "Threads:\t11",
    ].join("\n");
    assert.deepEqual(parseProcStatusMemory(status), {
      rssAnonBytes: 79332 * 1024,
      rssFileBytes: 23676 * 1024,
      rssShmemBytes: 0,
      threadCount: 11,
    });
  });

  it("returns null for a missing status file, a permission failure, and a missing field", () => {
    assert.deepEqual(readProcStatusMemory(() => null), {
      rssAnonBytes: null,
      rssFileBytes: null,
      rssShmemBytes: null,
      threadCount: null,
    });
    assert.deepEqual(
      readProcStatusMemory(() => {
        throw new Error("EACCES");
      }),
      {
        rssAnonBytes: null,
        rssFileBytes: null,
        rssShmemBytes: null,
        threadCount: null,
      },
    );
    const partial = parseProcStatusMemory("RssAnon:\t1 kB\nThreads:\t2 kB\n");
    assert.equal(partial.rssAnonBytes, 1024);
    assert.equal(partial.rssFileBytes, null);
    assert.equal(partial.threadCount, null);
    assert.equal(
      readProcStatusMemory((path) => (path === PROC_SELF_STATUS_PATH ? "Threads:\t0\n" : null))
        .threadCount,
      0,
    );
  });

  it("resolves heap spaces by name and leaves a missing space null", () => {
    const sample = v8MemorySampleFrom(
      {
        total_physical_size: 10,
        total_heap_size: 20,
        used_heap_size: 5,
        heap_size_limit: 30,
        malloced_memory: 0,
        peak_malloced_memory: 7,
        external_memory: 8,
        number_of_native_contexts: 1,
        number_of_detached_contexts: 0,
      },
      [
        { space_name: "read_only_space", space_size: 99, space_used_size: 99 },
        { space_name: "old_space", space_size: 4096, space_used_size: 1024 },
      ],
    );
    assert.equal(sample.totalPhysicalSizeBytes, 10);
    assert.equal(sample.mallocedMemoryBytes, 0);
    assert.equal(sample.detachedContextCount, 0);
    assert.equal(sample.oldSpaceUsedBytes, 1024);
    assert.equal(sample.oldSpaceAllocatedBytes, 4096);
    assert.equal(sample.largeObjectSpaceUsedBytes, null);
    assert.equal(sample.largeObjectSpaceAllocatedBytes, null);
    assert.equal(sample.codeSpaceUsedBytes, null);
    assert.equal(sample.codeSpaceAllocatedBytes, null);
  });

  it("returns null V8 fields when statistics cannot be read", () => {
    const sample = v8MemorySampleFrom(null, null);
    assert.equal(sample.totalHeapSizeBytes, null);
    assert.equal(sample.oldSpaceUsedBytes, null);
    const live = readV8MemorySample();
    assert.equal(typeof live.totalHeapSizeBytes, "number");
    assert.ok((live.oldSpaceAllocatedBytes ?? 0) >= (live.oldSpaceUsedBytes ?? 0));
  });
});
