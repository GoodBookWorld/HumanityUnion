/**
 * ES.03 — bounded durable recovery after a retryable PLP attempt window.
 * Repository orchestration only. No provider calls.
 */

import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";

import {
  claimNextPlpAutoBuildWork,
  listPlpAutoBuildWorkForTests,
  markPlpAutoBuildWorkFailed,
  PLP_MAX_RECOVERY_GENERATIONS,
  PLP_RECOVERY_COOLDOWN_GENERATION_1_MS,
  PLP_RECOVERY_COOLDOWN_GENERATION_2_MS,
  putPlpAutoBuildWorkForTests,
  resetPlpAutoBuildWorkStoreForTests,
  setPlpAutoBuildNowMsForTests,
  setPlpAutoBuildWorkForceMemoryForTests,
  upsertPendingPlpAutoBuildWork,
  type PlpAutoBuildWorkRecord,
} from "../../../src/modules/language/published-localized-presentation/universal/plp-auto-build-work.repository.js";

const IDENTITY = {
  entityType: "civic_media_editorial",
  entityId: "sample-editorial",
  locale: "uk",
  canonicalVersion: "v1",
  contentRevision: 1,
  trigger: "ADMIN_REBUILD" as const,
  maxAttempts: 5,
};

const RETRYABLE = {
  failureCode: "PROVIDER_FAILURE" as const,
  retryable: true,
  stage: "provider" as const,
  safeReason:
    "PROVIDER_FAILURE;PROVIDER_RESPONSE_SHAPE=INVALID;PROVIDER_FAILURE_SUBTYPE=UNKNOWN_PROVIDER_SHAPE",
};

function row(): PlpAutoBuildWorkRecord {
  const found = listPlpAutoBuildWorkForTests().find(
    (entry) => entry.entityId === IDENTITY.entityId && entry.locale === IDENTITY.locale,
  );
  assert.ok(found);
  return found;
}

async function seed(canonicalVersion = IDENTITY.canonicalVersion) {
  return upsertPendingPlpAutoBuildWork({
    ...IDENTITY,
    canonicalVersion,
  });
}

async function failCurrent(attempts: number, retryable = true) {
  const current = row();
  return markPlpAutoBuildWorkFailed({
    workKey: current.workKey,
    attempts,
    maxAttempts: current.maxAttempts,
    failure: retryable
      ? RETRYABLE
      : {
          failureCode: "PROVIDER_INTEGRITY",
          retryable: false,
          stage: "provider",
          safeReason: "PROVIDER_INTEGRITY:CONTENT_INTEGRITY_FAILURE",
        },
  });
}

/** Burn the immediate window. Memory mode skips the 5s–60s backoff unless opted in. */
async function exhaustWindow(): Promise<PlpAutoBuildWorkRecord> {
  for (let attempt = 1; attempt <= IDENTITY.maxAttempts; attempt += 1) {
    const claimed = await claimNextPlpAutoBuildWork();
    assert.ok(claimed, `expected claim for attempt ${attempt}`);
    assert.equal(claimed.attempts, attempt);
    await failCurrent(claimed.attempts);
    if (attempt < IDENTITY.maxAttempts && row().nextAttemptAt) {
      setPlpAutoBuildNowMsForTests(Date.parse(row().nextAttemptAt!) + 1);
    }
  }
  return row();
}

beforeEach(() => {
  setPlpAutoBuildWorkForceMemoryForTests(true);
  resetPlpAutoBuildWorkStoreForTests();
  delete process.env.HU_PLP_RETRY_BACKOFF_IN_MEMORY;
});

afterEach(() => {
  resetPlpAutoBuildWorkStoreForTests();
  setPlpAutoBuildWorkForceMemoryForTests(false);
  delete process.env.HU_PLP_RETRY_BACKOFF_IN_MEMORY;
});

describe("ES.03 PLP exhausted retryable recovery", () => {
  it("A. attempts 1–4 keep the immediate retry backoff and generation", async () => {
    process.env.HU_PLP_RETRY_BACKOFF_IN_MEMORY = "1";
    await seed();
    let clock = Date.now();
    setPlpAutoBuildNowMsForTests(clock);
    for (let attempt = 1; attempt <= 4; attempt += 1) {
      const claimed = await claimNextPlpAutoBuildWork();
      assert.equal(claimed?.attempts, attempt);
      assert.equal(claimed?.recoveryGeneration ?? null, attempt === 1 ? null : null);
      await failCurrent(attempt);
      const current = row();
      assert.equal(current.status, "pending");
      assert.equal(current.attempts, attempt);
      assert.equal(current.recoveryGeneration, null);
      assert.equal(current.retryable, true);
      assert.ok(current.nextAttemptAt);
      const delay = Date.parse(current.nextAttemptAt) - clock;
      assert.ok(delay >= 5_000, `immediate backoff too short: ${delay}`);
      assert.ok(delay < 5 * 60_000, `immediate backoff replaced by recovery cooldown: ${delay}`);
      clock = Date.parse(current.nextAttemptAt) + 1;
      setPlpAutoBuildNowMsForTests(clock);
    }
  });

  it("B–C. generation 0 exhaustion waits out a durable cooldown and is not claimable", async () => {
    await seed();
    const cooled = await exhaustWindow();
    assert.equal(cooled.status, "pending");
    assert.equal(cooled.attempts, 5);
    assert.equal(cooled.maxAttempts, 5);
    assert.equal(cooled.recoveryGeneration, "0");
    assert.equal(cooled.retryable, true);
    assert.equal(cooled.completedAt, null);
    assert.ok(cooled.nextAttemptAt);
    const delay = Date.parse(cooled.nextAttemptAt) - Date.now();
    assert.ok(Math.abs(delay - PLP_RECOVERY_COOLDOWN_GENERATION_1_MS) < 2_000);

    assert.equal(await claimNextPlpAutoBuildWork(), null);
    assert.equal(row().attempts, 5);
    assert.equal(row().recoveryGeneration, "0");
  });

  it("D–F. cooldown opens generation 1, then generation 2 uses the longer cooldown", async () => {
    await seed();
    const cooled = await exhaustWindow();
    setPlpAutoBuildNowMsForTests(Date.parse(cooled.nextAttemptAt!) + 1_000);
    const opened = await claimNextPlpAutoBuildWork();
    assert.ok(opened);
    assert.equal(opened.attempts, 1);
    assert.equal(opened.recoveryGeneration, "1");
    assert.equal(opened.status, "running");
    assert.equal(opened.nextAttemptAt, null);
    assert.equal(listPlpAutoBuildWorkForTests().length, 1);

    await failCurrent(1);
    assert.equal(row().status, "pending");
    assert.equal(row().attempts, 1);
    assert.equal(row().recoveryGeneration, "1");

    for (let attempt = 2; attempt <= 4; attempt += 1) {
      const claimed = await claimNextPlpAutoBuildWork();
      assert.equal(claimed?.attempts, attempt);
      assert.equal(claimed?.recoveryGeneration, "1");
      await failCurrent(attempt);
      assert.equal(row().recoveryGeneration, "1");
      assert.equal(row().status, "pending");
    }

    const last = await claimNextPlpAutoBuildWork();
    assert.equal(last?.attempts, 5);
    assert.equal(last?.recoveryGeneration, "1");
    await failCurrent(5);
    const generation2Cooldown = row();
    assert.equal(generation2Cooldown.status, "pending");
    assert.equal(generation2Cooldown.attempts, 5);
    assert.equal(generation2Cooldown.recoveryGeneration, "1");
    assert.ok(generation2Cooldown.nextAttemptAt);
    const delay =
      Date.parse(generation2Cooldown.nextAttemptAt) -
      Date.parse(cooled.nextAttemptAt!) -
      1_000;
    assert.ok(
      Math.abs(delay - PLP_RECOVERY_COOLDOWN_GENERATION_2_MS) < 2_000,
      `expected 60 minute cooldown, delta ${delay}`,
    );
    assert.equal(await claimNextPlpAutoBuildWork(), null);
  });

  it("G. generation 2 exhaustion is terminal and cannot be claimed or reopened", async () => {
    await seed();
    const first = await exhaustWindow();
    setPlpAutoBuildNowMsForTests(Date.parse(first.nextAttemptAt!) + 1_000);
    const second = await exhaustWindow();
    assert.equal(second.recoveryGeneration, "1");
    assert.equal(second.status, "pending");
    setPlpAutoBuildNowMsForTests(Date.parse(second.nextAttemptAt!) + 1_000);
    const terminal = await exhaustWindow();
    assert.equal(terminal.status, "failed");
    assert.equal(terminal.attempts, 5);
    assert.equal(terminal.recoveryGeneration, "2");
    assert.equal(terminal.nextAttemptAt, null);
    assert.equal(terminal.retryable, true);
    assert.ok(terminal.lastError);

    setPlpAutoBuildNowMsForTests(Date.parse(terminal.updatedAt) + 24 * 60 * 60 * 1000);
    assert.equal(await claimNextPlpAutoBuildWork(), null);
    const reopened = await upsertPendingPlpAutoBuildWork({
      ...IDENTITY,
      reopenFailedSameVersion: true,
    });
    assert.equal(reopened.deduped, true);
    assert.equal(reopened.record.status, "failed");
    assert.equal(reopened.record.attempts, 5);
    assert.equal(reopened.record.recoveryGeneration, "2");
    assert.equal(reopened.record.nextAttemptAt, null);
    assert.equal(PLP_MAX_RECOVERY_GENERATIONS, 2);
  });

  it("H. same-version coalesce cannot reset the generation cap or cooldown", async () => {
    await seed();
    const cooled = await exhaustWindow();
    const nextAttemptAt = cooled.nextAttemptAt;
    for (let i = 0; i < 3; i += 1) {
      const again = await upsertPendingPlpAutoBuildWork({
        ...IDENTITY,
        reopenFailedSameVersion: true,
      });
      assert.equal(again.deduped, true);
      assert.equal(again.record.nextAttemptAt, nextAttemptAt);
      assert.equal(again.record.recoveryGeneration, "0");
      assert.equal(again.record.attempts, 5);
      assert.equal(again.record.status, "pending");
    }
    const plain = await upsertPendingPlpAutoBuildWork(IDENTITY);
    assert.equal(plain.deduped, true);
    assert.equal(plain.record.nextAttemptAt, nextAttemptAt);
    assert.equal(plain.record.recoveryGeneration, "0");
    assert.equal(listPlpAutoBuildWorkForTests().length, 1);
  });

  it("I. non-retryable failure stays terminal across reopen", async () => {
    await seed();
    const claimed = await claimNextPlpAutoBuildWork();
    assert.ok(claimed);
    await failCurrent(claimed.attempts, false);
    const failed = row();
    assert.equal(failed.status, "failed");
    assert.equal(failed.retryable, false);
    assert.equal(failed.nextAttemptAt, null);
    const reopened = await upsertPendingPlpAutoBuildWork({
      ...IDENTITY,
      reopenFailedSameVersion: true,
    });
    assert.equal(reopened.deduped, true);
    assert.equal(reopened.record.status, "failed");
    assert.equal(reopened.record.attempts, failed.attempts);
    assert.equal(reopened.record.recoveryGeneration, failed.recoveryGeneration);
    assert.equal(await claimNextPlpAutoBuildWork(), null);
  });

  it("J. a new canonical version receives a fresh generation-0 budget", async () => {
    const created = await seed();
    putPlpAutoBuildWorkForTests({
      ...created.record,
      status: "failed",
      attempts: 5,
      retryable: true,
      nextAttemptAt: null,
      recoveryGeneration: "2",
      failureCode: "PROVIDER_FAILURE",
      failureStage: "provider",
      lastError: RETRYABLE.safeReason,
      completedAt: "2026-10-04T03:17:16.126Z",
    });
    const fresh = await upsertPendingPlpAutoBuildWork({
      ...IDENTITY,
      canonicalVersion: "v2",
      reopenFailedSameVersion: true,
    });
    assert.equal(fresh.accepted, true);
    assert.equal(fresh.record.canonicalVersion, "v2");
    assert.equal(fresh.record.status, "pending");
    assert.equal(fresh.record.attempts, 0);
    assert.equal(fresh.record.recoveryGeneration, null);
    assert.equal(fresh.record.nextAttemptAt, null);
    assert.equal(listPlpAutoBuildWorkForTests().length, 1);
    const claimed = await claimNextPlpAutoBuildWork();
    assert.equal(claimed?.attempts, 1);
    assert.equal(claimed?.recoveryGeneration, null);
    assert.equal(claimed?.canonicalVersion, "v2");
  });

  it("K. a legacy exhausted retryable row enters cooldown without a field reset", async () => {
    const created = await seed();
    putPlpAutoBuildWorkForTests({
      ...created.record,
      status: "failed",
      attempts: 5,
      maxAttempts: 5,
      retryable: true,
      nextAttemptAt: null,
      recoveryGeneration: null,
      failureCode: "PROVIDER_FAILURE",
      failureStage: "provider",
      lastError: RETRYABLE.safeReason,
      lastFailureAt: "2026-10-04T03:17:16.126Z",
      completedAt: "2026-10-04T03:17:16.126Z",
    });

    const untouched = await upsertPendingPlpAutoBuildWork(IDENTITY);
    assert.equal(untouched.deduped, true);
    assert.equal(untouched.record.status, "failed");
    assert.equal(untouched.record.attempts, 5);
    assert.equal(untouched.record.recoveryGeneration, null);

    const adopted = await upsertPendingPlpAutoBuildWork({
      ...IDENTITY,
      reopenFailedSameVersion: true,
    });
    assert.equal(adopted.accepted, true);
    assert.equal(adopted.record.status, "pending");
    assert.equal(adopted.record.attempts, 5);
    assert.equal(adopted.record.recoveryGeneration, "0");
    assert.equal(adopted.record.retryable, true);
    assert.ok(adopted.record.nextAttemptAt);
    const delay = Date.parse(adopted.record.nextAttemptAt) - Date.now();
    assert.ok(Math.abs(delay - PLP_RECOVERY_COOLDOWN_GENERATION_1_MS) < 2_000);
    assert.equal(adopted.record.lastError, RETRYABLE.safeReason);
    assert.equal(listPlpAutoBuildWorkForTests().length, 1);
    assert.equal(await claimNextPlpAutoBuildWork(), null);

    const again = await upsertPendingPlpAutoBuildWork({
      ...IDENTITY,
      reopenFailedSameVersion: true,
    });
    assert.equal(again.record.nextAttemptAt, adopted.record.nextAttemptAt);
    assert.equal(again.record.recoveryGeneration, "0");
    assert.equal(again.record.attempts, 5);
  });
});
