/**
 * HU-MEM-12C — evidence gate counters mirror live gate state.
 */
import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import { readWebWorkloadGauges } from "../system-health/web-memory-gauges";
import { resetWebMemorySamplerForTests } from "../system-health/web-memory-sampler";
import {
  readActiveSeoEvidenceFetches,
  readWaitingSeoEvidenceFetches,
  resetSeoEvidenceFetchGateForTests,
  runSeoEvidenceFetch,
  SEO_EVIDENCE_FETCH_CONCURRENCY_LIMIT,
} from "./seo-evidence-fetch-gate";
import { resetSeoMetadataEligibilityGateForTests } from "./seo-metadata-eligibility-gate";

describe("SEO evidence fetch gate gauges", { concurrency: false }, () => {
  afterEach(() => {
    resetSeoEvidenceFetchGateForTests();
    resetSeoMetadataEligibilityGateForTests();
    resetWebMemorySamplerForTests();
  });

  it("HU-MEM-12C. active and waiting evidence counters reflect the gate and return to zero", async () => {
    assert.equal(SEO_EVIDENCE_FETCH_CONCURRENCY_LIMIT, 8);
    const releaseHold: Array<() => void> = [];
    const hold = () =>
      new Promise<void>((resolve) => {
        releaseHold.push(resolve);
      });

    const pending = Array.from({ length: 10 }, (_, index) =>
      runSeoEvidenceFetch(`evidence-key-${index}`, async () => {
        await hold();
        return index;
      }),
    );

    await new Promise((resolve) => setTimeout(resolve, 20));
    assert.equal(readActiveSeoEvidenceFetches(), 8);
    assert.equal(readWaitingSeoEvidenceFetches(), 2);
    assert.equal(readWebWorkloadGauges().activeSeoEvidenceFetches, 8);
    assert.equal(readWebWorkloadGauges().waitingSeoEvidenceFetches, 2);

    for (let round = 0; round < 20; round += 1) {
      for (const release of releaseHold.splice(0)) {
        release();
      }
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
    await Promise.all(pending);

    assert.equal(readActiveSeoEvidenceFetches(), 0);
    assert.equal(readWaitingSeoEvidenceFetches(), 0);
    assert.equal(readWebWorkloadGauges().activeSeoEvidenceFetches, 0);
    assert.equal(readWebWorkloadGauges().waitingSeoEvidenceFetches, 0);
  });
});
