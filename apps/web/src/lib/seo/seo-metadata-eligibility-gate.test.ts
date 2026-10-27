/**
 * HU-MEM-10D — at most four metadata eligibility operations per process.
 * The evidence fetch gate stays at 8. Sitemap callers do not take this permit.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { afterEach, describe, it } from "node:test";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { readWebWorkloadGauges } from "../system-health/web-memory-gauges";
import { resetWebMemorySamplerForTests } from "../system-health/web-memory-sampler";
import { buildPublicSeoLocalizedVariantPredicate } from "./public-seo-localized-eligibility-loader";
import { SEO_EVIDENCE_FETCH_CONCURRENCY_LIMIT, resetSeoEvidenceFetchGateForTests } from "./seo-evidence-fetch-gate";
import {
  acquireSeoMetadataEligibilityPermit,
  readActiveSeoMetadataEligibilityPermitsForTests,
  readQueuedSeoMetadataEligibilityPermitsForTests,
  releaseSeoMetadataEligibilityPermit,
  resetSeoMetadataEligibilityGateForTests,
  SEO_METADATA_ELIGIBILITY_CONCURRENCY_LIMIT,
} from "./seo-metadata-eligibility-gate";

const webSrc = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function readWeb(relativePath: string): string {
  return readFileSync(path.join(webSrc, relativePath), "utf8");
}

describe("SEO metadata eligibility gate", { concurrency: false }, () => {
  afterEach(() => {
    resetSeoMetadataEligibilityGateForTests();
    resetSeoEvidenceFetchGateForTests();
    resetWebMemorySamplerForTests();
  });

  it("A–C. four permits run, the rest wait in FIFO order, and every waiter runs", async () => {
    assert.equal(SEO_METADATA_ELIGIBILITY_CONCURRENCY_LIMIT, 4);
    const started: number[] = [];
    const finish: Array<() => void> = [];

    const operations = Array.from({ length: 6 }, (_, index) => {
      const id = index + 1;
      return (async () => {
        await acquireSeoMetadataEligibilityPermit();
        started.push(id);
        try {
          await new Promise<void>((resolve) => {
            finish.push(resolve);
          });
        } finally {
          releaseSeoMetadataEligibilityPermit();
        }
      })();
    });

    await new Promise((resolve) => setTimeout(resolve, 20));
    assert.deepEqual(started, [1, 2, 3, 4]);
    assert.equal(readActiveSeoMetadataEligibilityPermitsForTests(), 4);
    assert.equal(readQueuedSeoMetadataEligibilityPermitsForTests(), 2);

    const firstQueued = finish.shift();
    assert.ok(firstQueued);
    firstQueued();
    await new Promise((resolve) => setTimeout(resolve, 20));
    assert.deepEqual(started, [1, 2, 3, 4, 5]);
    assert.equal(readQueuedSeoMetadataEligibilityPermitsForTests(), 1);

    while (finish.length > 0) {
      const next = finish.shift();
      assert.ok(next);
      next();
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
    await Promise.all(operations);
    assert.deepEqual(started, [1, 2, 3, 4, 5, 6]);
    assert.equal(readActiveSeoMetadataEligibilityPermitsForTests(), 0);
    assert.equal(readQueuedSeoMetadataEligibilityPermitsForTests(), 0);
  });

  it("D. a thrown metadata body releases its permit", async () => {
    await acquireSeoMetadataEligibilityPermit();
    await acquireSeoMetadataEligibilityPermit();
    await acquireSeoMetadataEligibilityPermit();
    await acquireSeoMetadataEligibilityPermit();

    let fifthStarted = false;
    const fifth = (async () => {
      await acquireSeoMetadataEligibilityPermit();
      fifthStarted = true;
      releaseSeoMetadataEligibilityPermit();
    })();
    await new Promise((resolve) => setTimeout(resolve, 10));
    assert.equal(fifthStarted, false);

    let permitHeld = true;
    try {
      throw new Error("metadata eligibility failed");
    } catch {
      // The metadata resolver returns the locale-free fallback from this path.
    } finally {
      if (permitHeld) {
        permitHeld = false;
        releaseSeoMetadataEligibilityPermit();
      }
    }

    await fifth;
    assert.equal(fifthStarted, true);
    assert.equal(readActiveSeoMetadataEligibilityPermitsForTests(), 3);
    releaseSeoMetadataEligibilityPermit();
    releaseSeoMetadataEligibilityPermit();
    releaseSeoMetadataEligibilityPermit();
    assert.equal(readActiveSeoMetadataEligibilityPermitsForTests(), 0);
    assert.equal(readQueuedSeoMetadataEligibilityPermitsForTests(), 0);
  });

  it("E. the evidence fetch gate remains capped at 8", () => {
    assert.equal(SEO_EVIDENCE_FETCH_CONCURRENCY_LIMIT, 8);
    const evidenceGate = readWeb("lib/seo/seo-evidence-fetch-gate.ts");
    assert.match(evidenceGate, /SEO_EVIDENCE_FETCH_CONCURRENCY_LIMIT = 8/);
    assert.doesNotMatch(evidenceGate, /seo-metadata-eligibility-gate/);
  });

  it("G. sitemap predicate calls do not take the metadata permit", async () => {
    const sitemap = readWeb("lib/seo/sitemap/build-public-sitemap.ts");
    const loader = readWeb("lib/seo/public-seo-localized-eligibility-loader.ts");
    const metadata = readWeb("lib/seo/build-public-page-metadata-for-request.ts");
    assert.doesNotMatch(sitemap, /seo-metadata-eligibility-gate/);
    assert.doesNotMatch(loader, /acquireSeoMetadataEligibilityPermit/);
    assert.equal(metadata.match(/acquireSeoMetadataEligibilityPermit\(/g)?.length, 1);

    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => {
      await new Promise((resolve) => setTimeout(resolve, 30));
      return new Response(JSON.stringify({ success: false }), {
        status: 404,
        headers: { "content-type": "application/json" },
      });
    };
    try {
      const pending = Array.from({ length: 6 }, (_, index) =>
        buildPublicSeoLocalizedVariantPredicate({
          localeFreePaths: ["/institutions"],
          locales: [`direct-${index}`],
        }),
      );
      await new Promise((resolve) => setTimeout(resolve, 10));
      assert.equal(readWebWorkloadGauges().activeSeoEligibilityOperations, 6);
      assert.equal(readActiveSeoMetadataEligibilityPermitsForTests(), 0);
      await Promise.all(pending);
      assert.equal(readWebWorkloadGauges().activeSeoEligibilityOperations, 0);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
