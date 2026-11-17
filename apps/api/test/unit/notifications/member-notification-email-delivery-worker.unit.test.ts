/**
 * HU-NOTIF-02C.2 — member notification email delivery worker.
 */
import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";

import type { AuthUserRecord } from "../../../src/modules/auth/auth-user.repository.js";
import { setFindAuthUserByIdForTests } from "../../../src/modules/auth/auth-user.repository.js";
import {
  getMockEmailSendCount,
  resetMockEmailOutboxForTests,
} from "../../../src/modules/email/email-test-helpers.js";
import {
  claimNextMemberNotificationEmailDelivery,
  insertMemberNotificationEmailDelivery,
  listMemberNotificationEmailDeliveriesForTests,
  processMemberNotificationEmailDeliveryClaim,
  requeueDryRunOkMemberNotificationEmailDeliveries,
  resetMemberNotificationEmailDeliveryStoreForTests,
  runMemberNotificationEmailDeliveryWorkerTick,
  setMemberNotificationEmailDeliveryEnabledForTests,
  setMemberNotificationEmailDeliveryForceMemoryForTests,
  setMemberNotificationEmailDeliveryIndexesReadyForTests,
  setMemberNotificationEmailDeliveryModeForTests,
} from "../../../src/modules/notifications/email-delivery/index.js";
import {
  MEMBER_NOTIFICATION_EMAIL_DELIVERY_MAX_ATTEMPTS,
  resolveMemberNotificationEmailDeliveryBackoffMs,
} from "../../../src/modules/notifications/email-delivery/member-notification-email-delivery.constants.js";
import { executeMemberNotificationEmailDeliveryAdapter } from "../../../src/modules/notifications/email-delivery/delivery-adapter.js";
import { createNotification } from "../../../src/modules/notifications/notification.service.js";
import { resolveNotificationPersistenceAdapter } from "../../../src/modules/notifications/persistence/resolve-notification-persistence.js";
import { buildDefaultMemberPreferences } from "../../../src/modules/preferences/preferences.defaults.js";
import {
  insertPreferences,
  resetPreferencesMemoryStoreForTests,
  setPreferencesForceMemoryForTests,
} from "../../../src/modules/preferences/preferences.repository.js";
import type { MemberNotificationEmailDeliveryRecord } from "@hu/types";

const USER_ID = "user-worker-01";
const PROFILE_ID = "member-worker-01";
const ACTIVATION = "2026-01-01T00:00:00.000Z";

function makeUser(status: AuthUserRecord["status"] = "active"): AuthUserRecord {
  const now = new Date().toISOString();
  return {
    userId: USER_ID,
    email: "worker@example.com",
    passwordHash: "hash",
    displayName: "Worker",
    role: "member",
    status,
    memberId: PROFILE_ID,
    emailVerificationStatus: "verified",
    emailVerifiedAt: now,
    createdAt: now,
    updatedAt: now,
  };
}

async function seedPrefs(
  overrides: Partial<
    ReturnType<typeof buildDefaultMemberPreferences>["communicationPreferences"]
  > = {},
): Promise<void> {
  resetPreferencesMemoryStoreForTests();
  const prefs = buildDefaultMemberPreferences({ memberId: PROFILE_ID, userId: USER_ID });
  prefs.communicationPreferences = {
    ...prefs.communicationPreferences,
    notificationEmailCopiesOptIn: true,
    emailNotificationsEnabled: true,
    notificationFrequency: "immediate",
    ...overrides,
  };
  await insertPreferences(prefs);
}

function baseRecord(
  overrides: Partial<MemberNotificationEmailDeliveryRecord> = {},
): MemberNotificationEmailDeliveryRecord {
  const now = new Date().toISOString();
  return {
    deliveryId: overrides.deliveryId ?? `del-${Math.random().toString(16).slice(2)}`,
    notificationId: overrides.notificationId ?? `notif-${Math.random().toString(16).slice(2)}`,
    recipientUserId: USER_ID,
    recipientMemberId: PROFILE_ID,
    eventType: "initiative_published",
    channel: "immediate",
    status: "pending",
    attemptCount: 0,
    maxAttempts: MEMBER_NOTIFICATION_EMAIL_DELIVERY_MAX_ATTEMPTS,
    nextAttemptAt: now,
    leaseOwner: null,
    leaseExpiresAt: null,
    destinationHash: null,
    providerEmailId: null,
    skipReason: null,
    lastErrorCode: null,
    createdAt: "2026-02-01T00:00:00.000Z",
    updatedAt: now,
    ...overrides,
  };
}

describe("HU-NOTIF-02C.2 member notification email delivery worker", () => {
  beforeEach(async () => {
    process.env.NODE_TEST_ENV = "true";
    process.env.HU_MEMBER_NOTIFICATION_EMAIL_DELIVERY_ACTIVATION_AT = ACTIVATION;
    setMemberNotificationEmailDeliveryForceMemoryForTests(true);
    setPreferencesForceMemoryForTests(true);
    resetPreferencesMemoryStoreForTests();
    resetMemberNotificationEmailDeliveryStoreForTests();
    setMemberNotificationEmailDeliveryIndexesReadyForTests(true);
    setMemberNotificationEmailDeliveryEnabledForTests(null);
    setMemberNotificationEmailDeliveryModeForTests(null);
    resetMockEmailOutboxForTests();
    setFindAuthUserByIdForTests(async (userId) => (userId === USER_ID ? makeUser() : null));
    resolveNotificationPersistenceAdapter().clearForTests?.();
    await seedPrefs();
  });

  afterEach(() => {
    setMemberNotificationEmailDeliveryEnabledForTests(null);
    setMemberNotificationEmailDeliveryModeForTests(null);
    resetMemberNotificationEmailDeliveryStoreForTests();
    setFindAuthUserByIdForTests(null);
    resetMockEmailOutboxForTests();
    resetPreferencesMemoryStoreForTests();
    resolveNotificationPersistenceAdapter().clearForTests?.();
    delete process.env.HU_MEMBER_NOTIFICATION_EMAIL_DELIVERY_ACTIVATION_AT;
  });

  it("does nothing when flags are OFF", async () => {
    setMemberNotificationEmailDeliveryEnabledForTests(false);
    setMemberNotificationEmailDeliveryModeForTests("dry_run");
    await insertMemberNotificationEmailDelivery(baseRecord());
    const tick = await runMemberNotificationEmailDeliveryWorkerTick();
    assert.equal(tick.processed, 0);
    assert.equal(getMockEmailSendCount(), 0);
  });

  it("dry-run claims and completes without SMTP or sent status", async () => {
    setMemberNotificationEmailDeliveryEnabledForTests(true);
    setMemberNotificationEmailDeliveryModeForTests("dry_run");
    await insertMemberNotificationEmailDelivery(baseRecord({ deliveryId: "dry-1" }));

    const tick = await runMemberNotificationEmailDeliveryWorkerTick({ batchSize: 5 });
    assert.equal(tick.processed, 1);
    assert.equal(tick.dryRunOk, 1);
    assert.equal(getMockEmailSendCount(), 0);

    const rows = await listMemberNotificationEmailDeliveriesForTests();
    assert.equal(rows[0]?.status, "dry_run_ok");
    assert.equal(rows[0]?.providerEmailId, null);
    assert.equal(rows[0]?.skipReason, "dry_run");
  });

  it("live mode fails closed without LIVE_APPROVED and does not mark sent", async () => {
    setMemberNotificationEmailDeliveryEnabledForTests(true);
    setMemberNotificationEmailDeliveryModeForTests("live");
    await insertMemberNotificationEmailDelivery(baseRecord({ deliveryId: "live-1" }));

    const tick = await runMemberNotificationEmailDeliveryWorkerTick({ batchSize: 5 });
    assert.equal(tick.processed, 1);
    assert.equal(tick.liveBlocked, 1);
    assert.equal(getMockEmailSendCount(), 0);

    const rows = await listMemberNotificationEmailDeliveriesForTests();
    assert.equal(rows[0]?.status, "cancelled");
    assert.equal(rows[0]?.skipReason, "live_not_approved");
    assert.notEqual(rows[0]?.status, "sent");
  });

  it("supports concurrent claims without duplicate active leases", async () => {
    setMemberNotificationEmailDeliveryEnabledForTests(true);
    setMemberNotificationEmailDeliveryModeForTests("dry_run");
    await insertMemberNotificationEmailDelivery(baseRecord({ deliveryId: "race-1" }));

    const [a, b] = await Promise.all([
      claimNextMemberNotificationEmailDelivery({
        leaseOwner: "worker-a",
        leaseExpiresAt: new Date(Date.now() + 60_000).toISOString(),
        activationAt: ACTIVATION,
      }),
      claimNextMemberNotificationEmailDelivery({
        leaseOwner: "worker-b",
        leaseExpiresAt: new Date(Date.now() + 60_000).toISOString(),
        activationAt: ACTIVATION,
      }),
    ]);

    const claimed = [a, b].filter(Boolean);
    assert.equal(claimed.length, 1);
    assert.ok(claimed[0]?.leaseOwner === "worker-a" || claimed[0]?.leaseOwner === "worker-b");
  });

  it("recovers expired leases", async () => {
    setMemberNotificationEmailDeliveryEnabledForTests(true);
    setMemberNotificationEmailDeliveryModeForTests("dry_run");
    await insertMemberNotificationEmailDelivery(
      baseRecord({
        deliveryId: "lease-1",
        status: "claimed",
        attemptCount: 1,
        leaseOwner: "stale-worker",
        leaseExpiresAt: new Date(Date.now() - 1000).toISOString(),
      }),
    );

    const claimed = await claimNextMemberNotificationEmailDelivery({
      leaseOwner: "fresh-worker",
      leaseExpiresAt: new Date(Date.now() + 60_000).toISOString(),
      activationAt: ACTIVATION,
    });
    assert.equal(claimed?.leaseOwner, "fresh-worker");
    assert.equal(claimed?.attemptCount, 2);
  });

  it("applies retry backoff and never reclaims terminal failures", async () => {
    setMemberNotificationEmailDeliveryEnabledForTests(true);
    setMemberNotificationEmailDeliveryModeForTests("dry_run");

    assert.equal(resolveMemberNotificationEmailDeliveryBackoffMs(1), 60_000);
    assert.equal(resolveMemberNotificationEmailDeliveryBackoffMs(2), 5 * 60_000);
    assert.equal(resolveMemberNotificationEmailDeliveryBackoffMs(3), 15 * 60_000);

    await insertMemberNotificationEmailDelivery(
      baseRecord({
        deliveryId: "fail-1",
        status: "failed",
        attemptCount: MEMBER_NOTIFICATION_EMAIL_DELIVERY_MAX_ATTEMPTS,
        nextAttemptAt: new Date().toISOString(),
        lastErrorCode: "max_attempts",
      }),
    );

    const claimed = await claimNextMemberNotificationEmailDelivery({
      leaseOwner: "w1",
      leaseExpiresAt: new Date(Date.now() + 60_000).toISOString(),
      activationAt: ACTIVATION,
    });
    assert.equal(claimed, null);

    // Temporary failure remains retryable after backoff.
    await insertMemberNotificationEmailDelivery(
      baseRecord({
        deliveryId: "fail-temp",
        status: "failed",
        attemptCount: 2,
        nextAttemptAt: new Date(Date.now() - 1000).toISOString(),
        lastErrorCode: "processing_error",
      }),
    );
    const retryable = await claimNextMemberNotificationEmailDelivery({
      leaseOwner: "w2",
      leaseExpiresAt: new Date(Date.now() + 60_000).toISOString(),
      activationAt: ACTIVATION,
    });
    assert.equal(retryable?.deliveryId, "fail-temp");
  });

  it("rejects stale worker completion after lease is stolen", async () => {
    setMemberNotificationEmailDeliveryEnabledForTests(true);
    setMemberNotificationEmailDeliveryModeForTests("dry_run");
    await insertMemberNotificationEmailDelivery(
      baseRecord({
        deliveryId: "stale-1",
        status: "claimed",
        attemptCount: 1,
        leaseOwner: "stale-worker",
        leaseExpiresAt: new Date(Date.now() - 1000).toISOString(),
      }),
    );

    const fresh = await claimNextMemberNotificationEmailDelivery({
      leaseOwner: "fresh-worker",
      leaseExpiresAt: new Date(Date.now() + 60_000).toISOString(),
      activationAt: ACTIVATION,
    });
    assert.equal(fresh?.leaseOwner, "fresh-worker");

    const staleOutcome = await processMemberNotificationEmailDeliveryClaim(
      { ...fresh!, leaseOwner: "stale-worker" },
      "stale-worker",
    );
    assert.equal(staleOutcome, "stale_lease");

    const rows = await listMemberNotificationEmailDeliveriesForTests();
    assert.equal(rows[0]?.leaseOwner, "fresh-worker");
    assert.equal(rows[0]?.status, "claimed");
  });

  it("cancels when participant opts out after enqueue", async () => {
    setMemberNotificationEmailDeliveryEnabledForTests(true);
    setMemberNotificationEmailDeliveryModeForTests("dry_run");
    await insertMemberNotificationEmailDelivery(baseRecord({ deliveryId: "optout-1" }));
    await seedPrefs({ notificationEmailCopiesOptIn: false });

    const tick = await runMemberNotificationEmailDeliveryWorkerTick({ batchSize: 5 });
    assert.equal(tick.cancelled, 1);
    const rows = await listMemberNotificationEmailDeliveriesForTests();
    assert.equal(rows[0]?.skipReason, "opt_out");
    assert.equal(getMockEmailSendCount(), 0);
  });

  it("cancels when destination is no longer verified", async () => {
    setMemberNotificationEmailDeliveryEnabledForTests(true);
    setMemberNotificationEmailDeliveryModeForTests("dry_run");
    await insertMemberNotificationEmailDelivery(baseRecord({ deliveryId: "dest-1" }));
    setFindAuthUserByIdForTests(async (userId) => {
      if (userId !== USER_ID) {
        return null;
      }
      return { ...makeUser(), emailVerificationStatus: "pending" as const, emailVerifiedAt: undefined };
    });

    const tick = await runMemberNotificationEmailDeliveryWorkerTick({ batchSize: 5 });
    assert.equal(tick.cancelled, 1);
    const rows = await listMemberNotificationEmailDeliveriesForTests();
    assert.equal(rows[0]?.skipReason, "no_verified_destination");
  });

  it("cancels disabled categories", async () => {
    setMemberNotificationEmailDeliveryEnabledForTests(true);
    setMemberNotificationEmailDeliveryModeForTests("dry_run");
    await insertMemberNotificationEmailDelivery(baseRecord({ deliveryId: "cat-1" }));
    await seedPrefs({
      disabledNotificationCategories: ["initiative_published"],
    });

    const tick = await runMemberNotificationEmailDeliveryWorkerTick({ batchSize: 5 });
    assert.equal(tick.cancelled, 1);
    assert.equal(
      (await listMemberNotificationEmailDeliveriesForTests())[0]?.skipReason,
      "disabled_category",
    );
  });

  it("does not send digest rows or convert them to immediate", async () => {
    setMemberNotificationEmailDeliveryEnabledForTests(true);
    setMemberNotificationEmailDeliveryModeForTests("dry_run");
    await insertMemberNotificationEmailDelivery(
      baseRecord({
        deliveryId: "digest-1",
        channel: "digest_daily",
        status: "pending",
      }),
    );

    const tick = await runMemberNotificationEmailDeliveryWorkerTick({ batchSize: 5 });
    assert.equal(tick.processed, 0);
    const rows = await listMemberNotificationEmailDeliveriesForTests();
    assert.equal(rows[0]?.status, "pending");
    assert.equal(rows[0]?.channel, "digest_daily");
  });

  it("never sends for platform_only preference", async () => {
    setMemberNotificationEmailDeliveryEnabledForTests(true);
    setMemberNotificationEmailDeliveryModeForTests("dry_run");
    await insertMemberNotificationEmailDelivery(baseRecord({ deliveryId: "plat-1" }));
    await seedPrefs({ notificationFrequency: "platform_only" });

    const tick = await runMemberNotificationEmailDeliveryWorkerTick({ batchSize: 5 });
    assert.equal(tick.cancelled, 1);
    assert.equal(
      (await listMemberNotificationEmailDeliveriesForTests())[0]?.skipReason,
      "platform_only",
    );
  });

  it("does not process historical rows before activation boundary", async () => {
    setMemberNotificationEmailDeliveryEnabledForTests(true);
    setMemberNotificationEmailDeliveryModeForTests("dry_run");
    await insertMemberNotificationEmailDelivery(
      baseRecord({
        deliveryId: "hist-1",
        createdAt: "2025-01-01T00:00:00.000Z",
      }),
    );

    const tick = await runMemberNotificationEmailDeliveryWorkerTick({ batchSize: 5 });
    assert.equal(tick.processed, 0);
  });

  it("requires explicit requeue before dry_run_ok can be processed live", async () => {
    setMemberNotificationEmailDeliveryEnabledForTests(true);
    setMemberNotificationEmailDeliveryModeForTests("dry_run");
    await insertMemberNotificationEmailDelivery(baseRecord({ deliveryId: "requeue-1" }));
    await runMemberNotificationEmailDeliveryWorkerTick({ batchSize: 5 });
    assert.equal(
      (await listMemberNotificationEmailDeliveriesForTests())[0]?.status,
      "dry_run_ok",
    );

    setMemberNotificationEmailDeliveryModeForTests("live");
    const withoutRequeue = await runMemberNotificationEmailDeliveryWorkerTick({ batchSize: 5 });
    assert.equal(withoutRequeue.processed, 0);

    const requeued = await requeueDryRunOkMemberNotificationEmailDeliveries({
      limit: 10,
      activationAt: ACTIVATION,
    });
    assert.equal(requeued, 1);
    assert.equal(
      (await listMemberNotificationEmailDeliveriesForTests())[0]?.status,
      "pending",
    );

    // Historical dry_run_ok cannot be requeued past activation boundary.
    await insertMemberNotificationEmailDelivery(
      baseRecord({
        deliveryId: "requeue-hist",
        status: "dry_run_ok",
        createdAt: "2025-01-01T00:00:00.000Z",
        skipReason: "dry_run",
      }),
    );
    const hist = await requeueDryRunOkMemberNotificationEmailDeliveries({
      limit: 10,
      activationAt: ACTIVATION,
    });
    assert.equal(hist, 0);
  });

  it("adapter never invokes SMTP when live approval is off", async () => {
    setMemberNotificationEmailDeliveryEnabledForTests(true);
    setMemberNotificationEmailDeliveryModeForTests("live");

    const dry = await executeMemberNotificationEmailDeliveryAdapter({
      deliveryId: "a1",
      notificationId: "n1",
      eventType: "initiative_published",
      destinationHash: "abc123",
      mode: "dry_run",
      recipientUserId: USER_ID,
      recipientMemberId: PROFILE_ID,
    });
    assert.equal(dry.outcome, "dry_run_validated");
    if (dry.outcome === "dry_run_validated") {
      assert.equal(dry.providerEmailId, null);
    }

    const live = await executeMemberNotificationEmailDeliveryAdapter({
      deliveryId: "a1",
      notificationId: "n1",
      eventType: "initiative_published",
      destinationHash: "abc123",
      mode: "live",
      recipientUserId: USER_ID,
      recipientMemberId: PROFILE_ID,
    });
    assert.equal(live.outcome, "live_gate_failed");
    if (live.outcome === "live_gate_failed") {
      assert.equal(live.errorCode, "live_not_approved");
    }
    assert.equal(getMockEmailSendCount(), 0);
  });

  it("does not regress in-app notification creation", async () => {
    setMemberNotificationEmailDeliveryEnabledForTests(false);
    const notification = await createNotification({
      recipientUserId: USER_ID,
      recipientProfileId: PROFILE_ID,
      eventType: "initiative_published",
      title: "Published",
      message: "Published.",
      relatedEntityType: "initiative",
      relatedEntityId: "init-w1",
      relatedUrl: "/initiatives/init-w1",
      priority: "normal",
    });
    assert.ok(notification.notificationId);
    assert.equal(notification.status, "unread");
    assert.equal(getMockEmailSendCount(), 0);
  });

  it("cancels when frequency changes away from immediate after enqueue", async () => {
    setMemberNotificationEmailDeliveryEnabledForTests(true);
    setMemberNotificationEmailDeliveryModeForTests("dry_run");
    await insertMemberNotificationEmailDelivery(baseRecord({ deliveryId: "freq-1" }));
    await seedPrefs({ notificationFrequency: "daily_digest" });

    const tick = await runMemberNotificationEmailDeliveryWorkerTick({ batchSize: 5 });
    assert.equal(tick.cancelled, 1);
    assert.equal(
      (await listMemberNotificationEmailDeliveriesForTests())[0]?.skipReason,
      "frequency_not_immediate",
    );
  });

  it("updates destination hash on eligibility without storing plaintext", async () => {
    setMemberNotificationEmailDeliveryEnabledForTests(true);
    setMemberNotificationEmailDeliveryModeForTests("dry_run");
    await insertMemberNotificationEmailDelivery(baseRecord({ deliveryId: "hash-1" }));
    await runMemberNotificationEmailDeliveryWorkerTick({ batchSize: 5 });
    const row = (await listMemberNotificationEmailDeliveriesForTests())[0];
    assert.ok(row?.destinationHash);
    assert.equal(row?.destinationHash?.includes("@"), false);
    assert.equal(JSON.stringify(row).includes("worker@example.com"), false);
  });
});
