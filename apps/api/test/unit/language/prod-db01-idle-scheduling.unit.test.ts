import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, it } from "node:test";

import {
  outboxDueTimerCountForTests,
  outboxDueTimerAtMsForTests,
  resetOutboxDispatcherStateForTests,
  runOutboxSafetySweep,
  setOutboxBatchOverrideForTests,
  setOutboxDueReaderForTests,
  settleOutboxDispatcherForTests,
  startOutboxDispatcherForTests,
  useOutboxSchedulerManualTimersForTests,
  fireOutboxDueTimerForTests,
} from "../../../src/infrastructure/outbox/outbox.dispatcher.js";
import { setThinGeminiProviderStateForceMemoryForTests } from "../../../src/modules/language/media-plp-materializer/thin-gemini-provider-state.js";
import {
  enqueuePlpBuildRequest,
  recoverPlpScheduleOnBoot,
  resetPlpBuildRequestQueueForTests,
  runPlpSafetySweep,
  setPlpBuildRequestProcessor,
  settlePlpAutoBuildDrainForTests,
} from "../../../src/modules/language/published-localized-presentation/universal/build-request-queue.js";
import { structuredFailure } from "../../../src/modules/language/published-localized-presentation/universal/plp-auto-build-failure.js";
import {
  firePlpDueTimerForTests,
  plpDueTimerCountForTests,
  resetPlpAutoBuildSchedulerForTests,
  usePlpSchedulerManualTimersForTests,
} from "../../../src/modules/language/published-localized-presentation/universal/plp-auto-build-scheduler.js";
import {
  claimNextPlpAutoBuildWork,
  listPlpAutoBuildWorkForTests,
  markPlpAutoBuildWorkFailed,
  plpProviderAdmissionReadsForTests,
  plpStatusAggregationReadsForTests,
  resetPlpProviderAdmissionReadsForTests,
  resetPlpStatusAggregationReadsForTests,
  setPlpAutoBuildWorkForceMemoryForTests,
  upsertPendingPlpAutoBuildWork,
} from "../../../src/modules/language/published-localized-presentation/universal/plp-auto-build-work.repository.js";

const apiRoot = path.resolve(import.meta.dirname, "../../..");

function source(relativePath: string): string {
  return readFileSync(path.join(apiRoot, relativePath), "utf8");
}

describe("PROD.DB.01 idle scheduling", () => {
  afterEach(() => {
    resetPlpBuildRequestQueueForTests();
    resetPlpAutoBuildSchedulerForTests();
    resetOutboxDispatcherStateForTests();
    setPlpAutoBuildWorkForceMemoryForTests(false);
    setThinGeminiProviderStateForceMemoryForTests(false);
    usePlpSchedulerManualTimersForTests(false);
    useOutboxSchedulerManualTimersForTests(false);
  });

  it("removes the fixed PLP 3s drain and CT 2s dispatcher", () => {
    const register = source(
      "src/modules/language/published-localized-presentation/universal/register-plp-auto-build-processor.ts",
    );
    const dispatcher = source("src/infrastructure/outbox/outbox.dispatcher.ts");
    const scheduler = source(
      "src/modules/language/published-localized-presentation/universal/plp-auto-build-scheduler.ts",
    );
    const queue = source(
      "src/modules/language/published-localized-presentation/universal/build-request-queue.ts",
    );

    assert.equal(register.includes("DRAIN_INTERVAL_MS"), false);
    assert.equal(register.includes("setInterval"), false);
    assert.equal(dispatcher.includes("dispatchTimer = setInterval"), false);
    assert.match(dispatcher, /OUTBOX_SAFETY_SWEEP_MS = 60_000/);
    assert.match(scheduler, /PLP_SAFETY_SWEEP_MS = 60_000/);
    assert.equal(queue.includes("countPlpAutoBuildWorkByStatus"), false);
    assert.equal(queue.includes("refreshPlpAutoBuildQueueDepthFromStore"), false);
    assert.match(
      source(
        "src/modules/language/published-localized-presentation/universal/plp-auto-build-work.repository.ts",
      ),
      /\{\s*\$group:\s*\{\s*_id:\s*"\$status"/,
    );
  });

  it("wakes PLP processing from a durable enqueue without a status group", async () => {
    setPlpAutoBuildWorkForceMemoryForTests(true);
    setThinGeminiProviderStateForceMemoryForTests(true);
    resetPlpStatusAggregationReadsForTests();
    let processed = 0;
    setPlpBuildRequestProcessor(async () => {
      processed += 1;
      return { status: "COMPLETED" };
    });

    await enqueuePlpBuildRequest({
      entityType: "public_news",
      entityId: "news-prod-db01",
      locale: "en",
      canonicalVersion: "v1",
      contentRevision: 1,
      trigger: "ADMIN_REBUILD",
      skipUsableCheck: true,
    });
    await settlePlpAutoBuildDrainForTests();

    assert.equal(processed, 1);
    assert.equal(plpStatusAggregationReadsForTests(), 0);
  });

  it("keeps an idle PLP safety probe off the cooldown and status-group paths", async () => {
    setPlpAutoBuildWorkForceMemoryForTests(true);
    setThinGeminiProviderStateForceMemoryForTests(true);
    resetPlpProviderAdmissionReadsForTests();
    resetPlpStatusAggregationReadsForTests();

    await runPlpSafetySweep();

    assert.equal(plpProviderAdmissionReadsForTests(), 0);
    assert.equal(plpStatusAggregationReadsForTests(), 0);
    assert.equal(plpDueTimerCountForTests(), 0);
  });

  it("arms one future PLP due timer and does not claim before it fires", async () => {
    setPlpAutoBuildWorkForceMemoryForTests(true);
    setThinGeminiProviderStateForceMemoryForTests(true);
    usePlpSchedulerManualTimersForTests(true);
    process.env.HU_PLP_RETRY_BACKOFF_IN_MEMORY = "1";

    const upsert = await upsertPendingPlpAutoBuildWork({
      entityType: "public_news",
      entityId: "news-future",
      locale: "en",
      canonicalVersion: "v1",
      contentRevision: 1,
      trigger: "ADMIN_REBUILD",
      maxAttempts: 5,
    });
    const claimed = await claimNextPlpAutoBuildWork({ skipProviderAdmission: true });
    assert.ok(claimed);
    await markPlpAutoBuildWorkFailed({
      workKey: upsert.record.workKey,
      attempts: 1,
      maxAttempts: 5,
      failure: structuredFailure({
        failureCode: "PROVIDER_FAILURE",
        retryable: true,
        stage: "provider",
        safeReason:
          "PROVIDER_FAILURE;PROVIDER_FAILURE_SUBTYPE=HTTP_FAILURE;PROVIDER_ERROR_CLASS=HTTP_429;PROVIDER_RETRY_AFTER=30",
      }),
    });

    let processed = 0;
    setPlpBuildRequestProcessor(async () => {
      processed += 1;
      return { status: "COMPLETED" };
    });
    await recoverPlpScheduleOnBoot();
    await settlePlpAutoBuildDrainForTests();

    const pending = listPlpAutoBuildWorkForTests().find((row) => row.status === "pending");
    assert.ok(pending?.nextAttemptAt);
    assert.equal(plpDueTimerCountForTests(), 1);
    assert.equal(processed, 0);

    firePlpDueTimerForTests();
    await settlePlpAutoBuildDrainForTests();
    assert.equal(processed, 0);
    assert.equal(listPlpAutoBuildWorkForTests().some((row) => row.status === "running"), false);
  });

  it("arms one CT future-due timer and skips the batch when nothing is due", async () => {
    useOutboxSchedulerManualTimersForTests(true);
    const future = new Date(Date.now() + 60_000).toISOString();
    let batches = 0;
    setOutboxBatchOverrideForTests(async () => {
      batches += 1;
      return 0;
    });
    setOutboxDueReaderForTests(async (input) => ({
      immediatelyDue: false,
      earliestFutureDueAt: input.includeFuture ? future : null,
      includeFuture: input.includeFuture,
    }));

    await startOutboxDispatcherForTests();
    assert.equal(batches, 0);
    assert.equal(outboxDueTimerCountForTests(), 1);
    assert.equal(outboxDueTimerAtMsForTests(), Date.parse(future));

    await runOutboxSafetySweep();
    await settleOutboxDispatcherForTests();
    assert.equal(batches, 0);

    fireOutboxDueTimerForTests();
    await settleOutboxDispatcherForTests();
    assert.equal(batches, 1);
  });
});
