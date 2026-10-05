/**
 * LOAD.03 — event-driven PLP and CT workers. No provider calls and no Mongo writes.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";

import type { ClientSession } from "mongodb";

import {
  discardOutboxDispatcherWake,
  flushOutboxDispatcherWakeAfterCommit,
  requestOutboxDispatcherWake,
} from "../../../src/infrastructure/outbox/outbox-wake.js";
import {
  fireOutboxDueTimerForTests,
  lastOutboxScheduleReadForTests,
  OUTBOX_SAFETY_SWEEP_MS,
  outboxCycleInProgressForTests,
  outboxDueTimerAtMsForTests,
  outboxDueTimerCountForTests,
  outboxSafetySweepArmedForTests,
  outboxScheduleReadsForTests,
  resetOutboxDispatcherStateForTests,
  runOutboxSafetySweep,
  setOutboxBatchOverrideForTests,
  setOutboxDueReaderForTests,
  setOutboxSchedulerNowMsForTests,
  settleOutboxDispatcherForTests,
  startOutboxDispatcherForTests,
  useOutboxSchedulerManualTimersForTests,
  type OutboxDueSnapshot,
} from "../../../src/infrastructure/outbox/outbox.dispatcher.js";
import { resolveOutboxFailureStatus } from "../../../src/infrastructure/outbox/outbox.repository.js";
import { setLocalizationProviderPacingIntervalMsForTests } from "../../../src/modules/language/localization-provider-governor.js";
import {
  resetThinGeminiProviderStateForTests,
  setThinGeminiProviderStateForceMemoryForTests,
} from "../../../src/modules/language/media-plp-materializer/index.js";
import { buildPlpBatchCheckpoint } from "../../../src/modules/language/published-localized-presentation/universal/plp-batch-checkpoint.js";
import {
  enqueuePlpBuildRequest,
  kickPlpAutoBuildDrain,
  plpDrainInProgressForTests,
  recoverPlpScheduleOnBoot,
  resetPlpBuildRequestQueueForTests,
  runPlpSafetySweep,
  setPlpBuildRequestProcessor,
  settlePlpAutoBuildDrainForTests,
} from "../../../src/modules/language/published-localized-presentation/universal/build-request-queue.js";
import {
  firePlpDueTimerForTests,
  firePlpSafetySweepForTests,
  PLP_SAFETY_SWEEP_MS,
  plpDueTimerAtMsForTests,
  plpDueTimerCountForTests,
  plpSafetySweepArmedForTests,
  resetPlpAutoBuildSchedulerForTests,
  setPlpSchedulerHandlers,
  setPlpSchedulerNowMsForTests,
  startPlpSafetySweep,
  stopPlpAutoBuildScheduler,
  usePlpSchedulerManualTimersForTests,
} from "../../../src/modules/language/published-localized-presentation/universal/plp-auto-build-scheduler.js";
import { stopPlpAutoBuildRuntimeForTests } from "../../../src/modules/language/published-localized-presentation/universal/register-plp-auto-build-processor.js";
import {
  claimNextPlpAutoBuildWork,
  listPlpAutoBuildWorkForTests,
  PLP_MAX_RECOVERY_GENERATIONS,
  plpProviderAdmissionReadsForTests,
  plpStatusAggregationReadsForTests,
  probePlpAutoBuildImmediatelyDue,
  putPlpAutoBuildWorkForTests,
  resetPlpProviderAdmissionReadsForTests,
  resetPlpStatusAggregationReadsForTests,
  setPlpAutoBuildNowMsForTests,
  setPlpAutoBuildWorkForceMemoryForTests,
  type PlpAutoBuildWorkRecord,
} from "../../../src/modules/language/published-localized-presentation/universal/plp-auto-build-work.repository.js";

const HERE = path.dirname(new URL(import.meta.url).pathname);
const API_SRC = path.resolve(HERE, "../../../src");

function readSrc(relative: string): string {
  return readFileSync(path.join(API_SRC, relative), "utf8");
}

function work(patch: Partial<PlpAutoBuildWorkRecord> = {}): PlpAutoBuildWorkRecord {
  const now = new Date(0).toISOString();
  return {
    workKey: "civic_media_editorial:item:es:v1",
    entityType: "civic_media_editorial",
    entityId: "item",
    locale: "es",
    canonicalVersion: "v1",
    contentRevision: 1,
    trigger: "ADMIN_REBUILD",
    status: "pending",
    attempts: 0,
    maxAttempts: 5,
    lastError: null,
    failureCode: null,
    failureStage: null,
    retryable: null,
    enqueuedAt: now,
    claimedAt: null,
    completedAt: null,
    updatedAt: now,
    lastFailureAt: null,
    nextAttemptAt: null,
    recoveryGeneration: null,
    batchCheckpoint: null,
    ...patch,
  };
}

describe("LOAD.03 idle scheduling", () => {
  let processorCalls = 0;

  beforeEach(async () => {
    stopPlpAutoBuildRuntimeForTests();
    resetPlpBuildRequestQueueForTests();
    resetPlpAutoBuildSchedulerForTests();
    resetOutboxDispatcherStateForTests();
    setPlpAutoBuildWorkForceMemoryForTests(true);
    setThinGeminiProviderStateForceMemoryForTests(true);
    resetThinGeminiProviderStateForTests();
    setLocalizationProviderPacingIntervalMsForTests(0);
    setPlpAutoBuildNowMsForTests(null);
    setPlpSchedulerNowMsForTests(null);
    usePlpSchedulerManualTimersForTests(true);
    resetPlpProviderAdmissionReadsForTests();
    resetPlpStatusAggregationReadsForTests();
    processorCalls = 0;
    setPlpSchedulerHandlers({
      onDue: () => {
        kickPlpAutoBuildDrain();
      },
      onSafety: () => {
        void runPlpSafetySweep();
      },
    });
    setPlpBuildRequestProcessor(async () => {
      processorCalls += 1;
      return { status: "SKIPPED_USABLE" as const };
    });
    await settlePlpAutoBuildDrainForTests();
    processorCalls = 0;
    resetPlpProviderAdmissionReadsForTests();
    resetPlpStatusAggregationReadsForTests();
  });

  afterEach(async () => {
    await settlePlpAutoBuildDrainForTests();
    await settleOutboxDispatcherForTests();
    stopPlpAutoBuildRuntimeForTests();
    resetPlpBuildRequestQueueForTests();
    resetPlpAutoBuildSchedulerForTests();
    resetOutboxDispatcherStateForTests();
    setPlpAutoBuildWorkForceMemoryForTests(false);
    setThinGeminiProviderStateForceMemoryForTests(false);
    setLocalizationProviderPacingIntervalMsForTests(null);
    setPlpAutoBuildNowMsForTests(null);
    setPlpSchedulerNowMsForTests(null);
  });

  it("1–2. no PLP 3s interval and no CT 2s interval", () => {
    const register = readSrc(
      "modules/language/published-localized-presentation/universal/register-plp-auto-build-processor.ts",
    );
    const scheduler = readSrc(
      "modules/language/published-localized-presentation/universal/plp-auto-build-scheduler.ts",
    );
    const dispatcher = readSrc("infrastructure/outbox/outbox.dispatcher.ts");
    assert.equal(register.includes("setInterval"), false);
    assert.equal(register.includes("3_000"), false);
    assert.equal(register.includes("3000"), false);
    assert.equal(scheduler.includes("3_000"), false);
    assert.match(scheduler, /setInterval\([\s\S]*PLP_SAFETY_SWEEP_MS\)/);
    assert.equal(PLP_SAFETY_SWEEP_MS, 60_000);
    assert.equal(/setInterval\([\s\S]{0,240}dispatchIntervalMs/.test(dispatcher), false);
    assert.equal(dispatcher.includes("2_000"), false);
    assert.equal(dispatcher.includes("2000"), false);
    assert.match(dispatcher, /setInterval\([\s\S]*OUTBOX_SAFETY_SWEEP_MS\)/);
    assert.equal(OUTBOX_SAFETY_SWEEP_MS, 60_000);
  });

  it("3. PLP enqueue wakes only after the durable write", async () => {
    const queue = readSrc(
      "modules/language/published-localized-presentation/universal/build-request-queue.ts",
    );
    const upsertAt = queue.indexOf("upsertPendingPlpAutoBuildWork({");
    const thenAt = queue.indexOf(".then(finalizeUpsertResult)", upsertAt);
    assert.ok(upsertAt > 0 && thenAt > upsertAt);
    let sawDurableRow = false;
    setPlpBuildRequestProcessor(async (request) => {
      processorCalls += 1;
      sawDurableRow = listPlpAutoBuildWorkForTests().some(
        (row) => row.workKey === request.workKey,
      );
      return { status: "SKIPPED_USABLE" };
    });
    await enqueuePlpBuildRequest({
      entityType: "civic_media_editorial",
      entityId: "fresh",
      locale: "es",
      canonicalVersion: "v-new",
      contentRevision: 1,
      trigger: "ADMIN_REBUILD",
      skipUsableCheck: true,
    });
    await settlePlpAutoBuildDrainForTests();
    assert.equal(processorCalls, 1);
    assert.equal(sawDurableRow, true);
  });

  it("4. CT enqueue wakes only after the durable write is requested", async () => {
    const repository = readSrc("infrastructure/outbox/outbox.repository.ts");
    const insertAt = repository.indexOf("await collection.insertOne");
    const wakeAt = repository.indexOf("requestOutboxDispatcherWake", insertAt);
    assert.ok(insertAt > 0 && wakeAt > insertAt);
    const batches: string[] = [];
    useOutboxSchedulerManualTimersForTests(true);
    setOutboxDueReaderForTests(async (input) => ({
      immediatelyDue: false,
      earliestFutureDueAt: null,
      includeFuture: input.includeFuture,
    }));
    setOutboxBatchOverrideForTests(async () => {
      batches.push("batch");
      return 0;
    });
    await startOutboxDispatcherForTests();
    assert.equal(batches.length, 0);
    let durable = false;
    const insertThenWake = () => {
      durable = true;
      requestOutboxDispatcherWake();
    };
    insertThenWake();
    await settleOutboxDispatcherForTests();
    assert.equal(durable, true);
    assert.equal(batches.length, 1);
  });

  it("5–10. idle safety sweeps are due-only, write nothing, and call no provider", async () => {
    const historical = [
      work({ workKey: "done", status: "completed", attempts: 1, completedAt: "t" }),
      work({ workKey: "failed", status: "failed", attempts: 5 }),
      work({ workKey: "superseded", status: "superseded", attempts: 1 }),
      work({ workKey: "skipped", status: "skipped_usable", attempts: 0 }),
    ];
    for (const row of historical) {
      putPlpAutoBuildWorkForTests(row);
    }
    const before = JSON.stringify(listPlpAutoBuildWorkForTests());
    resetPlpProviderAdmissionReadsForTests();
    resetPlpStatusAggregationReadsForTests();
    processorCalls = 0;
    await runPlpSafetySweep();
    await settlePlpAutoBuildDrainForTests();
    assert.equal(processorCalls, 0);
    assert.equal(plpProviderAdmissionReadsForTests(), 0);
    assert.equal(plpStatusAggregationReadsForTests(), 0);
    assert.equal(JSON.stringify(listPlpAutoBuildWorkForTests()), before);
    assert.equal(await probePlpAutoBuildImmediatelyDue(), false);

    let outboxBatches = 0;
    let outboxReads = 0;
    useOutboxSchedulerManualTimersForTests(true);
    setOutboxDueReaderForTests(async (input) => {
      if (!input.includeFuture) {
        outboxReads += 1;
      }
      return {
        immediatelyDue: false,
        earliestFutureDueAt: null,
        includeFuture: input.includeFuture,
      };
    });
    setOutboxBatchOverrideForTests(async () => {
      outboxBatches += 1;
      throw new Error("provider path must not run while idle");
    });
    await startOutboxDispatcherForTests();
    const readsAfterBoot = outboxScheduleReadsForTests();
    await runOutboxSafetySweep();
    await settleOutboxDispatcherForTests();
    assert.equal(outboxBatches, 0);
    assert.equal(outboxReads, 1);
    assert.equal(outboxScheduleReadsForTests(), readsAfterBoot + 1);
    assert.equal(lastOutboxScheduleReadForTests()?.includeFuture, false);
    assert.equal(lastOutboxScheduleReadForTests()?.immediatelyDue, false);
  });

  it("7. drain source does not count status with a full-history group", () => {
    const queue = readSrc(
      "modules/language/published-localized-presentation/universal/build-request-queue.ts",
    );
    assert.equal(queue.includes("countPlpAutoBuildWorkByStatus"), false);
    assert.equal(queue.includes("$group"), false);
  });

  it("11–14. one PLP due timer arms, fires, and moves earlier without a second timer", async () => {
    const base = Date.parse("2026-10-05T00:00:00.000Z");
    setPlpAutoBuildNowMsForTests(base);
    setPlpSchedulerNowMsForTests(base);
    const soon = new Date(base + 60_000).toISOString();
    const later = new Date(base + 600_000).toISOString();
    putPlpAutoBuildWorkForTests(
      work({
        workKey: "later",
        nextAttemptAt: later,
        attempts: 1,
        retryable: true,
      }),
    );
    await recoverPlpScheduleOnBoot();
    assert.equal(plpDueTimerCountForTests(), 1);
    assert.equal(plpDueTimerAtMsForTests(), Date.parse(later));
    assert.equal(processorCalls, 0);

    putPlpAutoBuildWorkForTests(
      work({
        workKey: "sooner",
        entityId: "sooner",
        nextAttemptAt: soon,
        attempts: 1,
        retryable: true,
      }),
    );
    kickPlpAutoBuildDrain();
    await settlePlpAutoBuildDrainForTests();
    assert.equal(plpDueTimerCountForTests(), 1);
    assert.equal(plpDueTimerAtMsForTests(), Date.parse(soon));
    assert.equal(processorCalls, 0);

    setPlpAutoBuildNowMsForTests(base + 60_000);
    setPlpSchedulerNowMsForTests(base + 60_000);
    firePlpDueTimerForTests();
    await settlePlpAutoBuildDrainForTests();
    assert.equal(processorCalls, 1);
    assert.equal(
      listPlpAutoBuildWorkForTests().find((row) => row.workKey === "sooner")?.status,
      "skipped_usable",
    );
  });

  it("12–14. one CT availableAt timer arms, fires, and moves earlier", async () => {
    const base = Date.parse("2026-10-05T00:00:00.000Z");
    setOutboxSchedulerNowMsForTests(base);
    useOutboxSchedulerManualTimersForTests(true);
    let future = new Date(base + 600_000).toISOString();
    let immediatelyDue = false;
    let batches = 0;
    setOutboxDueReaderForTests(async (input) => ({
      immediatelyDue,
      earliestFutureDueAt: immediatelyDue ? null : future,
      includeFuture: input.includeFuture,
    }));
    setOutboxBatchOverrideForTests(async () => {
      batches += 1;
      return 0;
    });
    await startOutboxDispatcherForTests();
    assert.equal(batches, 0);
    assert.equal(outboxDueTimerCountForTests(), 1);
    assert.equal(outboxDueTimerAtMsForTests(), Date.parse(future));

    future = new Date(base + 60_000).toISOString();
    requestOutboxDispatcherWake();
    await settleOutboxDispatcherForTests();
    assert.equal(outboxDueTimerCountForTests(), 1);
    assert.equal(outboxDueTimerAtMsForTests(), Date.parse(future));

    immediatelyDue = true;
    future = new Date(base + 60_000).toISOString();
    fireOutboxDueTimerForTests();
    await settleOutboxDispatcherForTests();
    assert.ok(batches >= 1);
  });

  it("15–16. process-local drains coalesce overlapping wakes", async () => {
    let release: (() => void) | null = null;
    setPlpBuildRequestProcessor(
      () =>
        new Promise((resolve) => {
          processorCalls += 1;
          release = () => resolve({ status: "SKIPPED_USABLE" });
        }),
    );
    const first = enqueuePlpBuildRequest({
      entityType: "civic_media_editorial",
      entityId: "one",
      locale: "es",
      canonicalVersion: "v1",
      contentRevision: 1,
      trigger: "ADMIN_REBUILD",
      skipUsableCheck: true,
    });
    for (let i = 0; i < 20 && processorCalls === 0; i += 1) {
      await new Promise((resolve) => setImmediate(resolve));
    }
    assert.equal(processorCalls, 1);
    assert.equal(plpDrainInProgressForTests() || processorCalls === 1, true);
    kickPlpAutoBuildDrain();
    kickPlpAutoBuildDrain();
    kickPlpAutoBuildDrain();
    assert.equal(processorCalls, 1);
    assert.ok(release);
    release();
    await first;
    await settlePlpAutoBuildDrainForTests();
    assert.equal(processorCalls, 1);

    let holdOutbox = true;
    const outboxWaiters: Array<() => void> = [];
    let outboxBatches = 0;
    useOutboxSchedulerManualTimersForTests(true);
    setOutboxDueReaderForTests(async (input) => ({
      immediatelyDue: false,
      earliestFutureDueAt: null,
      includeFuture: input.includeFuture,
    }));
    setOutboxBatchOverrideForTests(
      () =>
        new Promise((resolve) => {
          outboxBatches += 1;
          if (!holdOutbox) {
            resolve(0);
            return;
          }
          outboxWaiters.push(() => resolve(0));
        }),
    );
    await startOutboxDispatcherForTests();
    requestOutboxDispatcherWake();
    for (let i = 0; i < 20 && outboxBatches === 0; i += 1) {
      await new Promise((resolve) => setImmediate(resolve));
    }
    assert.equal(outboxBatches, 1);
    assert.equal(outboxCycleInProgressForTests(), true);
    requestOutboxDispatcherWake();
    requestOutboxDispatcherWake();
    assert.equal(outboxBatches, 1);
    holdOutbox = false;
    for (const resume of outboxWaiters) {
      resume();
    }
    await settleOutboxDispatcherForTests();
    assert.equal(outboxBatches, 2);
  });

  it("17–19. boot recovery processes due work and preserves future-due work across restart", async () => {
    const base = Date.parse("2026-10-05T01:00:00.000Z");
    setPlpAutoBuildNowMsForTests(base);
    setPlpSchedulerNowMsForTests(base);
    putPlpAutoBuildWorkForTests(work({ workKey: "due-now", nextAttemptAt: null }));
    await recoverPlpScheduleOnBoot();
    await settlePlpAutoBuildDrainForTests();
    assert.equal(processorCalls, 1);
    assert.equal(
      listPlpAutoBuildWorkForTests().find((row) => row.workKey === "due-now")?.status,
      "skipped_usable",
    );

    processorCalls = 0;
    const future = new Date(base + 120_000).toISOString();
    putPlpAutoBuildWorkForTests(
      work({
        workKey: "future",
        entityId: "future",
        nextAttemptAt: future,
        attempts: 1,
        retryable: true,
      }),
    );
    await recoverPlpScheduleOnBoot();
    assert.equal(processorCalls, 0);
    assert.equal(plpDueTimerAtMsForTests(), Date.parse(future));
    stopPlpAutoBuildScheduler();
    assert.equal(plpDueTimerAtMsForTests(), null);
    assert.equal(
      listPlpAutoBuildWorkForTests().find((row) => row.workKey === "future")?.status,
      "pending",
    );
    setPlpSchedulerHandlers({
      onDue: () => kickPlpAutoBuildDrain(),
      onSafety: () => {
        void runPlpSafetySweep();
      },
    });
    await recoverPlpScheduleOnBoot();
    assert.equal(processorCalls, 0);
    assert.equal(plpDueTimerAtMsForTests(), Date.parse(future));

    const availableAt = new Date(base + 90_000).toISOString();
    useOutboxSchedulerManualTimersForTests(true);
    setOutboxSchedulerNowMsForTests(base);
    setOutboxDueReaderForTests(async (input) => ({
      immediatelyDue: false,
      earliestFutureDueAt: input.includeFuture ? availableAt : null,
      includeFuture: input.includeFuture,
    }));
    let batches = 0;
    setOutboxBatchOverrideForTests(async () => {
      batches += 1;
      return 0;
    });
    await startOutboxDispatcherForTests();
    assert.equal(batches, 0);
    assert.equal(outboxDueTimerAtMsForTests(), Date.parse(availableAt));
    resetOutboxDispatcherStateForTests();
    useOutboxSchedulerManualTimersForTests(true);
    setOutboxSchedulerNowMsForTests(base);
    setOutboxDueReaderForTests(async (input) => ({
      immediatelyDue: false,
      earliestFutureDueAt: input.includeFuture ? availableAt : null,
      includeFuture: input.includeFuture,
    }));
    setOutboxBatchOverrideForTests(async () => {
      batches += 1;
      return 0;
    });
    await startOutboxDispatcherForTests();
    assert.equal(batches, 0);
    assert.equal(outboxDueTimerAtMsForTests(), Date.parse(availableAt));
  });

  it("20–21. pacing and checkpoint stay on the row and arm one due timer", async () => {
    const pacingUntil = new Date(Date.now() + 120_000).toISOString();
    const checkpoint = buildPlpBatchCheckpoint({
      sourceVersion: "v-pace",
      nextBatchIndex: 1,
      batches: [{ title: "alpha" }, { body: "beta" }],
      segments: { title: "alfa" },
    });
    assert.ok(checkpoint);
    setPlpBuildRequestProcessor(async () => {
      processorCalls += 1;
      return { status: "BATCH_PROGRESS", checkpoint, pacingUntil };
    });
    await enqueuePlpBuildRequest({
      entityType: "civic_media_editorial",
      entityId: "paced",
      locale: "es",
      canonicalVersion: "v-pace",
      contentRevision: 1,
      trigger: "ADMIN_REBUILD",
      skipUsableCheck: true,
    });
    await settlePlpAutoBuildDrainForTests();
    assert.equal(processorCalls, 1);
    const row = listPlpAutoBuildWorkForTests().find((item) => item.entityId === "paced");
    assert.equal(row?.status, "pending");
    assert.equal(row?.nextAttemptAt, pacingUntil);
    assert.equal(row?.batchCheckpoint?.nextBatchIndex, 1);
    assert.equal(row?.batchCheckpoint?.segments.title, "alfa");
    assert.equal(plpDueTimerCountForTests(), 1);
    assert.equal(plpDueTimerAtMsForTests(), Date.parse(pacingUntil));
    const repository = readSrc(
      "modules/language/published-localized-presentation/universal/plp-auto-build-work.repository.ts",
    );
    assert.match(repository, /readPlpProviderNotBeforeMs/);
    assert.match(repository, /promoteDueRecoveryWindow/);
    assert.match(repository, /findOneAndUpdate/);
  });

  it("22. ES.03 recovery cap still refuses a capped window", async () => {
    assert.equal(PLP_MAX_RECOVERY_GENERATIONS, 2);
    const base = Date.parse("2026-10-05T02:00:00.000Z");
    setPlpAutoBuildNowMsForTests(base);
    putPlpAutoBuildWorkForTests(
      work({
        status: "pending",
        attempts: 5,
        maxAttempts: 5,
        retryable: true,
        recoveryGeneration: "2",
        nextAttemptAt: new Date(base - 1_000).toISOString(),
      }),
    );
    assert.equal(await probePlpAutoBuildImmediatelyDue(), false);
    assert.equal(await claimNextPlpAutoBuildWork(), null);
    assert.equal(listPlpAutoBuildWorkForTests()[0]?.recoveryGeneration, "2");
    assert.equal(listPlpAutoBuildWorkForTests()[0]?.status, "pending");
  });

  it("23. CT retry attempt cap is unchanged", () => {
    assert.equal(
      resolveOutboxFailureStatus({ attempts: 4, maxAttempts: 5, immediateTerminal: false }),
      "pending",
    );
    assert.equal(
      resolveOutboxFailureStatus({ attempts: 5, maxAttempts: 5, immediateTerminal: false }),
      "failed",
    );
    const repository = readSrc("infrastructure/outbox/outbox.repository.ts");
    assert.match(repository, /resolveOutboxFailureStatus/);
    assert.match(repository, /maxAttempts/);
  });

  it("24. completed PLP rows are not reclaimed", async () => {
    putPlpAutoBuildWorkForTests(
      work({
        status: "completed",
        attempts: 1,
        completedAt: new Date().toISOString(),
      }),
    );
    assert.equal(await probePlpAutoBuildImmediatelyDue(), false);
    assert.equal(await claimNextPlpAutoBuildWork(), null);
    assert.equal(listPlpAutoBuildWorkForTests()[0]?.status, "completed");
    assert.equal(listPlpAutoBuildWorkForTests()[0]?.attempts, 1);
  });

  it("25. READY history does not run status aggregation or the safety provider path", async () => {
    putPlpAutoBuildWorkForTests(
      work({ status: "completed", attempts: 1, completedAt: "t", workKey: "history" }),
    );
    startPlpSafetySweep();
    assert.equal(plpSafetySweepArmedForTests(), true);
    resetPlpStatusAggregationReadsForTests();
    firePlpSafetySweepForTests();
    await settlePlpAutoBuildDrainForTests();
    assert.equal(plpStatusAggregationReadsForTests(), 0);
    assert.equal(outboxSafetySweepArmedForTests(), false);
  });

  it("26. no new PLP or CT index is added", () => {
    const indexes = readSrc("infrastructure/mongodb/mongo-indexes.ts");
    const plpAt = indexes.indexOf("MONGO_COLLECTIONS.plpAutoBuildWork");
    const nextAt = indexes.indexOf("MONGO_COLLECTIONS.plpThinGeminiProviderState");
    const plp = indexes.slice(plpAt, nextAt);
    assert.match(plp, /plp_auto_build_work_workKey_unique/);
    assert.match(plp, /plp_auto_build_work_status_enqueuedAt/);
    assert.equal(plp.includes("nextAttemptAt"), false);
    const outboxAt = indexes.indexOf("MONGO_COLLECTIONS.outbox");
    const processedAt = indexes.indexOf("MONGO_COLLECTIONS.processedEvents");
    const outbox = indexes.slice(outboxAt, processedAt);
    assert.match(outbox, /outbox_event_id_unique/);
    assert.match(outbox, /outbox_status_created_at/);
    assert.match(outbox, /outbox_aggregate_ref/);
    assert.equal(outbox.includes("availableAt"), false);
  });

  it("transactional outbox wake waits for commit", async () => {
    useOutboxSchedulerManualTimersForTests(true);
    setOutboxDueReaderForTests(async (input) => ({
      immediatelyDue: false,
      earliestFutureDueAt: null,
      includeFuture: input.includeFuture,
    }));
    let batches = 0;
    setOutboxBatchOverrideForTests(async () => {
      batches += 1;
      return 0;
    });
    await startOutboxDispatcherForTests();
    const session = {} as ClientSession;
    requestOutboxDispatcherWake(session);
    await settleOutboxDispatcherForTests();
    assert.equal(batches, 0);
    discardOutboxDispatcherWake(session);
    await settleOutboxDispatcherForTests();
    assert.equal(batches, 0);
    requestOutboxDispatcherWake(session);
    flushOutboxDispatcherWakeAfterCommit(session);
    await settleOutboxDispatcherForTests();
    assert.equal(batches, 1);
  });
});
