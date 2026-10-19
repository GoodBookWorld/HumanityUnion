/**
 * HU-MEM-08 — process-lifetime Web memory samples.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { isPublicSeoLocalizedVariantEligible } from "../seo/public-seo-localized-eligibility";
import {
  collectPublicSitemapPathEntries,
} from "../seo/sitemap/build-public-sitemap";
import { dedupeSitemapPathEntries } from "../seo/sitemap/dedupe-sitemap-entries";
import { listCountrySitemapEntries } from "../seo/sitemap/providers/countries";
import { listStaticPublicSitemapEntries } from "../seo/sitemap/providers/static-public-pages";
import { buildPublicSeoLocalizedVariantPredicate } from "../seo/public-seo-localized-eligibility-loader";
import {
  openSitemapBuildObservation,
  closeSitemapBuildObservation,
  resetSitemapBuildOverlapForTests,
} from "./sitemap-build-diagnostic";
import { readWebWorkloadGauges } from "./web-memory-gauges";
import {
  WEB_MEMORY_RSS_STEP_BYTES,
  WEB_MEMORY_SAMPLE_INTERVAL_MS,
  buildWebMemorySampleRecord,
  considerWebMemoryRssStep,
  emitWebMemoryIntervalSample,
  memorySampleFieldNames,
  recordSitemapMemoryBoundary,
  resetWebMemorySamplerForTests,
  shouldStartWebMemorySampler,
  startWebMemorySampler,
  stopWebMemorySamplerForTests,
  webMemorySamplerStartedForTests,
  withSeoEligibilityOperation,
  withSeoMetadataOperation,
  writeMemorySampleStdout,
  type WebMemorySamplerTimer,
} from "./web-memory-sampler";

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

function memory(rss: number): NodeJS.MemoryUsage {
  return { rss, heapUsed: 11, heapTotal: 22, external: 33, arrayBuffers: 0 };
}

function install(input: {
  readonly lines: string[];
  readonly rss: () => number;
  readonly nowMs?: () => number;
  readonly writeLine?: (line: string) => void;
}): void {
  resetWebMemorySamplerForTests();
  startWebMemorySampler({
    setIntervalFn: () => ({ unref() {} }),
    clearIntervalFn: () => undefined,
    nowMs: input.nowMs ?? (() => 0),
    readMemory: () => memory(input.rss()),
    readEnv: () =>
      ({
        WEB_PROCESS_MEMORY_LIMIT_BYTES: String(512 * 1024 * 1024),
        RENDER_INSTANCE_ID: "4ng7s",
      }) as unknown as NodeJS.ProcessEnv,
    readUptimeSeconds: () => 90,
    readPid: () => 4242,
    writeLine: input.writeLine ?? ((line) => input.lines.push(line)),
  });
  stopWebMemorySamplerForTests();
}

describe("HU-MEM-08 web memory sampler", () => {
  it("starts one unref'd 30-second timer per process", () => {
    resetWebMemorySamplerForTests();
    const timers: Array<
      WebMemorySamplerTimer & { unrefed: boolean; delayMs: number; callback: () => void }
    > = [];
    const lines: string[] = [];
    const setIntervalFn = (callback: () => void, delayMs: number) => {
      const timer = {
        unrefed: false,
        delayMs,
        callback,
        unref() {
          this.unrefed = true;
        },
      };
      timers.push(timer);
      return timer;
    };
    try {
      startWebMemorySampler({
        setIntervalFn,
        clearIntervalFn: () => undefined,
        nowMs: () => Date.parse("2026-10-18T18:34:22.000Z"),
        readMemory: () => memory(200 * 1024 * 1024),
        readEnv: () => ({ RENDER_INSTANCE_ID: "4ng7s" }) as unknown as NodeJS.ProcessEnv,
        readUptimeSeconds: () => 293,
        readPid: () => 7,
        writeLine: (line) => lines.push(line),
      });
      startWebMemorySampler({
        setIntervalFn,
        writeLine: (line) => lines.push(line),
      });
      assert.equal(timers.length, 1);
      assert.equal(timers[0]?.delayMs, WEB_MEMORY_SAMPLE_INTERVAL_MS);
      assert.equal(timers[0]?.unrefed, true);
      assert.equal(webMemorySamplerStartedForTests(), true);
      assert.equal(lines.length, 1);
      timers[0]?.callback();
      assert.equal(lines.length, 2);
      assert.equal(JSON.parse(lines[0] ?? "{}").reason, "interval");
      assert.equal(JSON.parse(lines[1] ?? "{}").reason, "interval");
    } finally {
      resetWebMemorySamplerForTests();
    }
  });

  it("activates only for the Node.js runtime", () => {
    assert.equal(shouldStartWebMemorySampler("nodejs"), true);
    assert.equal(shouldStartWebMemorySampler("edge"), false);
    assert.equal(shouldStartWebMemorySampler(undefined), false);
    const source = readFileSync(path.join(webRoot, "src/instrumentation.ts"), "utf8");
    assert.match(source, /NEXT_RUNTIME !== "nodejs"/);
    assert.doesNotMatch(source, /onRequestError/);
    const sampler = readFileSync(
      path.join(webRoot, "src/lib/system-health/web-memory-sampler.ts"),
      "utf8",
    );
    assert.doesNotMatch(sampler, /mongodb|system-health\/events|fetch\(/);
  });

  it("counts overlapping SEO work and clears the counters after rejection", async () => {
    resetWebMemorySamplerForTests();
    const lines: string[] = [];
    let rss = 0;
    install({ lines, rss: () => rss, nowMs: () => 0 });
    let releaseFirst: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    const first = withSeoEligibilityOperation(async () => {
      await gate;
      return "first";
    });
    await Promise.resolve();
    assert.equal(readWebWorkloadGauges().activeSeoEligibilityOperations, 1);

    let seenDuringSecond = 0;
    const second = withSeoEligibilityOperation(async () => {
      seenDuringSecond = readWebWorkloadGauges().activeSeoEligibilityOperations;
      return "second";
    });
    assert.equal(await second, "second");
    assert.equal(seenDuringSecond, 2);
    assert.equal(readWebWorkloadGauges().activeSeoEligibilityOperations, 1);

    releaseFirst();
    assert.equal(await first, "first");
    assert.equal(readWebWorkloadGauges().activeSeoEligibilityOperations, 0);

    await assert.rejects(
      () =>
        withSeoMetadataOperation(async () => {
          await withSeoEligibilityOperation(async () => {
            throw new Error("eligibility failed");
          });
        }),
      /eligibility failed/,
    );
    assert.deepEqual(readWebWorkloadGauges(), {
      activeSitemapBuilds: 0,
      activeSeoMetadataOperations: 0,
      activeSeoEligibilityOperations: 0,
    });
    resetWebMemorySamplerForTests();
  });

  it("limits RSS step records to 32 MiB, 10 seconds, and six per minute", () => {
    const lines: string[] = [];
    let rss = 0;
    let now = 0;
    install({ lines, rss: () => rss, nowMs: () => now });
    lines.length = 0;
    emitWebMemoryIntervalSample(0);
    assert.equal(JSON.parse(lines.at(-1) ?? "{}").reason, "interval");

    rss = WEB_MEMORY_RSS_STEP_BYTES - 1;
    considerWebMemoryRssStep(0);
    assert.equal(lines.length, 1);

    now = 0;
    rss = WEB_MEMORY_RSS_STEP_BYTES;
    considerWebMemoryRssStep(0);
    assert.equal(lines.filter((line) => JSON.parse(line).reason === "rss_step").length, 1);

    now = 5_000;
    rss = WEB_MEMORY_RSS_STEP_BYTES * 2;
    considerWebMemoryRssStep(5_000);
    assert.equal(lines.filter((line) => JSON.parse(line).reason === "rss_step").length, 1);

    const laterSteps = [10_000, 20_000, 30_000, 40_000, 50_000];
    for (const [index, at] of laterSteps.entries()) {
      now = at;
      rss = WEB_MEMORY_RSS_STEP_BYTES * (index + 2);
      considerWebMemoryRssStep(at);
    }
    assert.equal(lines.filter((line) => JSON.parse(line).reason === "rss_step").length, 6);

    now = 60_000;
    rss = WEB_MEMORY_RSS_STEP_BYTES * 8;
    considerWebMemoryRssStep(60_000);
    assert.equal(lines.filter((line) => JSON.parse(line).reason === "rss_step").length, 6);

    now = 70_000;
    rss = WEB_MEMORY_RSS_STEP_BYTES * 9;
    considerWebMemoryRssStep(70_000);
    assert.equal(lines.filter((line) => JSON.parse(line).reason === "rss_step").length, 7);
    resetWebMemorySamplerForTests();
  });

  it("omits request data and keeps the sample field set closed", () => {
    const lines: string[] = [];
    install({
      lines,
      rss: () => 198 * 1024 * 1024,
      nowMs: () => Date.parse("2026-10-18T18:34:22.000Z"),
    });
    lines.length = 0;
    const record = buildWebMemorySampleRecord({ reason: "interval", nowMs: Date.parse("2026-10-18T18:34:22.000Z") });
    for (const key of Object.keys(record)) {
      assert.ok(memorySampleFieldNames().includes(key), key);
    }
    const serialized = JSON.stringify(record);
    assert.equal(serialized.includes("http"), false);
    assert.equal(serialized.includes("token"), false);
    assert.equal(serialized.includes("password"), false);
    assert.equal(serialized.includes("@"), false);
    assert.equal(serialized.includes("/blog"), false);
    assert.equal(record.kind, "web_system_health");
    assert.equal(record.operation, "memory_sample");
    assert.equal(record.instanceId, "4ng7s");
    assert.equal(record.pid, 4242);
    assert.equal(record.heapUsed, 11);
    assert.equal(record.heapTotal, 22);
    assert.equal(record.external, 33);
    assert.equal(record.uptimeSeconds, 90);
    assert.equal(record.pressure, "below");
    recordSitemapMemoryBoundary("start");
    const boundary = JSON.parse(lines.at(-1) ?? "{}") as { boundary?: string; reason?: string };
    assert.equal(boundary.reason, "sitemap_boundary");
    assert.equal(boundary.boundary, "start");
    resetWebMemorySamplerForTests();
  });

  it("keeps sitemap paths and eligibility decisions unchanged", async () => {
    const lines: string[] = [];
    install({ lines, rss: () => 10, nowMs: () => 1_000 });
    resetSitemapBuildOverlapForTests();
    const entries = await collectPublicSitemapPathEntries({
      includeDynamicProviders: false,
      seoIndexableLocales: [],
    });
    assert.deepEqual(
      entries,
      dedupeSitemapPathEntries([
        ...listStaticPublicSitemapEntries(),
        ...listCountrySitemapEntries(),
      ]),
    );
    const boundaries = lines
      .map((line) => JSON.parse(line) as { reason?: string; boundary?: string; activeSitemapBuilds?: number })
      .filter((record) => record.reason === "sitemap_boundary");
    assert.deepEqual(
      boundaries.map((record) => [record.boundary, record.activeSitemapBuilds]),
      [
        ["start", 1],
        ["completion", 0],
      ],
    );
    assert.equal(lines.some((line) => line.includes("system-health/events")), false);

    const predicate = await buildPublicSeoLocalizedVariantPredicate({
      localeFreePaths: ["/blog/post", "/knowledge/article"],
      locales: [],
    });
    assert.equal(predicate("/blog/post", "uk"), false);
    assert.equal(predicate("/knowledge/article", "uk"), false);
    assert.equal(
      isPublicSeoLocalizedVariantEligible({
        localeFreePath: "/knowledge/article",
        evidence: {
          webUiPublished: true,
          brandPublishedForLocale: true,
          legalPrivacyPublished: true,
          legalTermsPublished: true,
          civicMediaCurrent: true,
          entityCurrent: true,
        },
      }),
      false,
    );
    assert.equal(readWebWorkloadGauges().activeSeoEligibilityOperations, 0);
    resetWebMemorySamplerForTests();
    resetSitemapBuildOverlapForTests();
  });

  it("does not fail the caller when stdout cannot be written", async () => {
    install({
      lines: [],
      rss: () => WEB_MEMORY_RSS_STEP_BYTES * 4,
      nowMs: () => 30_000,
      writeLine: () => {
        throw new Error("EPIPE stdout unavailable");
      },
    });
    assert.equal(await withSeoEligibilityOperation(async () => "ok"), "ok");
    assert.equal(readWebWorkloadGauges().activeSeoEligibilityOperations, 0);
    assert.doesNotThrow(() => emitWebMemoryIntervalSample());
    assert.doesNotThrow(() => recordSitemapMemoryBoundary("completion"));
    assert.doesNotThrow(() => writeMemorySampleStdout("{}\n"));
    resetWebMemorySamplerForTests();
  });

  it("samples one thousand interval records well under a millisecond each", () => {
    const lines: string[] = [];
    install({ lines, rss: () => 1024, nowMs: () => 1 });
    lines.length = 0;
    const started = performance.now();
    for (let index = 0; index < 1000; index += 1) {
      emitWebMemoryIntervalSample(index);
    }
    const elapsedMs = performance.now() - started;
    assert.equal(lines.length, 1000);
    assert.ok(elapsedMs < 1000, `1000 samples took ${elapsedMs}ms`);
    resetWebMemorySamplerForTests();
  });

  it("publishes the sitemap gauge for overlapping builds", () => {
    resetSitemapBuildOverlapForTests();
    openSitemapBuildObservation();
    openSitemapBuildObservation();
    assert.equal(readWebWorkloadGauges().activeSitemapBuilds, 2);
    closeSitemapBuildObservation();
    assert.equal(readWebWorkloadGauges().activeSitemapBuilds, 1);
    closeSitemapBuildObservation();
    assert.equal(readWebWorkloadGauges().activeSitemapBuilds, 0);
    resetSitemapBuildOverlapForTests();
  });
});
