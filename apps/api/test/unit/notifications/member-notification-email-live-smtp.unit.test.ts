/**
 * HU-NOTIF-02C.5 — controlled SMTP delivery (mock provider only).
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
  assertMemberNotificationEmailSendRateLimitIndexesReady,
  classifyProviderDeliveryResult,
  consumeMemberNotificationEmailSendBudget,
  getMemberNotificationEmailMetricsForTests,
  insertMemberNotificationEmailDelivery,
  listMemberNotificationEmailDeliveriesForTests,
  listMemberNotificationEmailDigestRunsForTests,
  resetMemberNotificationEmailDeliveryStoreForTests,
  resetMemberNotificationEmailDigestRunStoreForTests,
  resetMemberNotificationEmailMetricsForTests,
  resetMemberNotificationEmailSendRateLimitStoreForTests,
  resolveMemberNotificationDigestBucketKey,
  resolveMemberNotificationDigestPeriodEndsAt,
  runMemberNotificationEmailDeliveryWorkerTick,
  runMemberNotificationEmailDigestWorkerTick,
  setMemberNotificationEmailDeliveryEnabledForTests,
  setMemberNotificationEmailDeliveryForceMemoryForTests,
  setMemberNotificationEmailDeliveryIndexesReadyForTests,
  setMemberNotificationEmailDeliveryModeForTests,
  setMemberNotificationEmailDigestRunForceMemoryForTests,
  setMemberNotificationEmailLiveApprovedForTests,
  setMemberNotificationEmailLiveRecipientAllowlistForTests,
  setMemberNotificationEmailSendRateLimitForceMemoryForTests,
  setMemberNotificationEmailSendRateLimitIndexesReadyForTests,
} from "../../../src/modules/notifications/email-delivery/index.js";
import { MEMBER_NOTIFICATION_EMAIL_DELIVERY_MAX_ATTEMPTS } from "../../../src/modules/notifications/email-delivery/member-notification-email-delivery.constants.js";
import { MEMBER_NOTIFICATION_EMAIL_PER_RECIPIENT_DAILY_LIMIT } from "../../../src/modules/notifications/email-delivery/send-rate-limit.js";
import { buildDefaultMemberPreferences } from "../../../src/modules/preferences/preferences.defaults.js";
import {
  insertPreferences,
  resetPreferencesMemoryStoreForTests,
  setPreferencesForceMemoryForTests,
} from "../../../src/modules/preferences/preferences.repository.js";
import type { MemberNotificationEmailDeliveryRecord } from "@hu/types";

const USER_ID = "user-live-01";
const MEMBER_ID = "member-live-01";
const OTHER_MEMBER = "member-live-other";
const ACTIVATION = "2026-01-01T00:00:00.000Z";

function makeUser(status: AuthUserRecord["status"] = "active"): AuthUserRecord {
  const now = new Date().toISOString();
  return {
    userId: USER_ID,
    email: "live@example.com",
    passwordHash: "hash",
    displayName: "Live User",
    role: "member",
    status,
    memberId: MEMBER_ID,
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
  const prefs = buildDefaultMemberPreferences({ memberId: MEMBER_ID, userId: USER_ID });
  prefs.communicationPreferences = {
    ...prefs.communicationPreferences,
    notificationEmailCopiesOptIn: true,
    emailNotificationsEnabled: true,
    notificationFrequency: "immediate",
    ...overrides,
  };
  await insertPreferences(prefs);
}

function immediateRecord(
  overrides: Partial<MemberNotificationEmailDeliveryRecord> = {},
): MemberNotificationEmailDeliveryRecord {
  const now = new Date().toISOString();
  return {
    deliveryId: overrides.deliveryId ?? `del-${Math.random().toString(16).slice(2)}`,
    notificationId: overrides.notificationId ?? `notif-${Math.random().toString(16).slice(2)}`,
    recipientUserId: USER_ID,
    recipientMemberId: MEMBER_ID,
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

function digestRecord(
  overrides: Partial<MemberNotificationEmailDeliveryRecord> & {
    createdAt: string;
    channel: "digest_daily" | "digest_weekly";
  },
): MemberNotificationEmailDeliveryRecord {
  const digestBucketKey =
    overrides.digestBucketKey ??
    resolveMemberNotificationDigestBucketKey({
      recipientUserId: USER_ID,
      channel: overrides.channel,
      createdAt: overrides.createdAt,
    });
  return {
    deliveryId: overrides.deliveryId ?? `ddel-${Math.random().toString(16).slice(2)}`,
    notificationId: overrides.notificationId ?? `dnotif-${Math.random().toString(16).slice(2)}`,
    recipientUserId: USER_ID,
    recipientMemberId: MEMBER_ID,
    eventType: overrides.eventType ?? "initiative_published",
    channel: overrides.channel,
    status: "pending",
    attemptCount: 0,
    maxAttempts: MEMBER_NOTIFICATION_EMAIL_DELIVERY_MAX_ATTEMPTS,
    nextAttemptAt: overrides.createdAt,
    leaseOwner: null,
    leaseExpiresAt: null,
    digestBucketKey,
    digestPeriodEndsAt:
      overrides.digestPeriodEndsAt ??
      resolveMemberNotificationDigestPeriodEndsAt({
        recipientUserId: USER_ID,
        channel: overrides.channel,
        createdAt: overrides.createdAt,
      }),
    destinationHash: null,
    providerEmailId: null,
    skipReason: null,
    lastErrorCode: null,
    createdAt: overrides.createdAt,
    updatedAt: overrides.createdAt,
  };
}

function enableLiveAllowlisted(): void {
  setMemberNotificationEmailDeliveryEnabledForTests(true);
  setMemberNotificationEmailDeliveryModeForTests("live");
  setMemberNotificationEmailLiveApprovedForTests(true);
  setMemberNotificationEmailLiveRecipientAllowlistForTests([MEMBER_ID]);
}

describe("HU-NOTIF-02C.5 controlled live SMTP delivery", () => {
  beforeEach(async () => {
    process.env.NODE_TEST_ENV = "true";
    process.env.WEB_ORIGIN = "https://hu.example";
    process.env.HU_MEMBER_NOTIFICATION_EMAIL_DELIVERY_ACTIVATION_AT = ACTIVATION;
    setMemberNotificationEmailDeliveryForceMemoryForTests(true);
    setMemberNotificationEmailDigestRunForceMemoryForTests(true);
    setMemberNotificationEmailSendRateLimitForceMemoryForTests(true);
    setPreferencesForceMemoryForTests(true);
    resetPreferencesMemoryStoreForTests();
    resetMemberNotificationEmailDeliveryStoreForTests();
    resetMemberNotificationEmailDigestRunStoreForTests();
    resetMemberNotificationEmailSendRateLimitStoreForTests();
    resetMemberNotificationEmailMetricsForTests();
    setMemberNotificationEmailDeliveryIndexesReadyForTests(true);
    setMemberNotificationEmailDeliveryEnabledForTests(null);
    setMemberNotificationEmailDeliveryModeForTests(null);
    setMemberNotificationEmailLiveApprovedForTests(null);
    setMemberNotificationEmailLiveRecipientAllowlistForTests(null);
    setMemberNotificationEmailSendRateLimitIndexesReadyForTests(null);
    resetMockEmailOutboxForTests();
    setFindAuthUserByIdForTests(async (id) => (id === USER_ID ? makeUser() : null));
    await seedPrefs();
  });

  afterEach(() => {
    setMemberNotificationEmailDeliveryEnabledForTests(null);
    setMemberNotificationEmailDeliveryModeForTests(null);
    setMemberNotificationEmailLiveApprovedForTests(null);
    setMemberNotificationEmailLiveRecipientAllowlistForTests(null);
    setMemberNotificationEmailSendRateLimitIndexesReadyForTests(null);
    setMemberNotificationEmailSendRateLimitForceMemoryForTests(true);
    resetMemberNotificationEmailDeliveryStoreForTests();
    resetMemberNotificationEmailDigestRunStoreForTests();
    resetMemberNotificationEmailSendRateLimitStoreForTests();
    resetMemberNotificationEmailMetricsForTests();
    resetPreferencesMemoryStoreForTests();
    setFindAuthUserByIdForTests(null);
    resetMockEmailOutboxForTests();
    delete process.env.HU_MEMBER_NOTIFICATION_EMAIL_DELIVERY_ACTIVATION_AT;
  });

  it("does not send when any live gate is OFF", async () => {
    setMemberNotificationEmailDeliveryEnabledForTests(true);
    setMemberNotificationEmailDeliveryModeForTests("live");
    setMemberNotificationEmailLiveApprovedForTests(false);
    setMemberNotificationEmailLiveRecipientAllowlistForTests([MEMBER_ID]);
    await insertMemberNotificationEmailDelivery(immediateRecord());

    const tick = await runMemberNotificationEmailDeliveryWorkerTick({ batchSize: 5 });
    assert.equal(tick.liveBlocked, 1);
    assert.equal(getMockEmailSendCount(), 0);
  });

  it("does not send when allowlist is empty", async () => {
    enableLiveAllowlisted();
    setMemberNotificationEmailLiveRecipientAllowlistForTests([]);
    await insertMemberNotificationEmailDelivery(immediateRecord());

    const tick = await runMemberNotificationEmailDeliveryWorkerTick({ batchSize: 5 });
    assert.equal(tick.liveBlocked, 1);
    assert.equal(getMockEmailSendCount(), 0);
    const rows = await listMemberNotificationEmailDeliveriesForTests();
    assert.equal(rows[0]?.skipReason, "live_recipient_not_allowlisted");
  });

  it("does not send for non-allowlisted recipients", async () => {
    enableLiveAllowlisted();
    setMemberNotificationEmailLiveRecipientAllowlistForTests([OTHER_MEMBER]);
    await insertMemberNotificationEmailDelivery(immediateRecord());

    const tick = await runMemberNotificationEmailDeliveryWorkerTick({ batchSize: 5 });
    assert.equal(tick.liveBlocked, 1);
    assert.equal(getMockEmailSendCount(), 0);
  });

  it("sends immediate copy for allowlisted recipient via mock provider", async () => {
    enableLiveAllowlisted();
    await insertMemberNotificationEmailDelivery(immediateRecord({ deliveryId: "live-ok-1" }));

    const tick = await runMemberNotificationEmailDeliveryWorkerTick({ batchSize: 5 });
    assert.equal(tick.sent, 1);
    assert.equal(getMockEmailSendCount(), 1);

    const rows = await listMemberNotificationEmailDeliveriesForTests();
    assert.equal(rows[0]?.status, "sent");
    assert.ok(rows[0]?.providerEmailId);
    assert.equal(rows[0]?.providerEmailId?.includes("@"), false);

    const metrics = getMemberNotificationEmailMetricsForTests();
    assert.ok(metrics.accepted >= 1);
  });

  it("cancels on opt-out without sending", async () => {
    enableLiveAllowlisted();
    await seedPrefs({ notificationEmailCopiesOptIn: false });
    await insertMemberNotificationEmailDelivery(immediateRecord());

    const tick = await runMemberNotificationEmailDeliveryWorkerTick({ batchSize: 5 });
    assert.equal(tick.cancelled, 1);
    assert.equal(getMockEmailSendCount(), 0);
  });

  it("cancels when destination is no longer verified", async () => {
    enableLiveAllowlisted();
    setFindAuthUserByIdForTests(async (id) =>
      id === USER_ID
        ? { ...makeUser(), emailVerificationStatus: "unverified", emailVerifiedAt: null }
        : null,
    );
    await insertMemberNotificationEmailDelivery(immediateRecord());

    const tick = await runMemberNotificationEmailDeliveryWorkerTick({ batchSize: 5 });
    assert.equal(tick.cancelled, 1);
    assert.equal(getMockEmailSendCount(), 0);
  });

  it("cancels when frequency changes away from immediate", async () => {
    enableLiveAllowlisted();
    await seedPrefs({ notificationFrequency: "daily_digest" });
    await insertMemberNotificationEmailDelivery(immediateRecord());

    const tick = await runMemberNotificationEmailDeliveryWorkerTick({ batchSize: 5 });
    assert.equal(tick.cancelled, 1);
    assert.equal(getMockEmailSendCount(), 0);
  });

  it("sends daily digest for allowlisted recipient", async () => {
    enableLiveAllowlisted();
    await seedPrefs({ notificationFrequency: "daily_digest" });
    await insertMemberNotificationEmailDelivery(
      digestRecord({
        channel: "digest_daily",
        createdAt: "2026-03-10T08:00:00.000Z",
      }),
    );

    const tick = await runMemberNotificationEmailDigestWorkerTick({
      now: new Date("2026-03-11T02:00:00.000Z"),
    });
    assert.equal(tick.sent, 1);
    assert.equal(getMockEmailSendCount(), 1);

    const runs = await listMemberNotificationEmailDigestRunsForTests();
    assert.equal(runs[0]?.status, "sent");
    assert.ok(runs[0]?.providerEmailId);

    const children = await listMemberNotificationEmailDeliveriesForTests();
    assert.equal(children[0]?.status, "sent");
  });

  it("sends weekly digest for allowlisted recipient", async () => {
    enableLiveAllowlisted();
    await seedPrefs({ notificationFrequency: "weekly_digest" });
    await insertMemberNotificationEmailDelivery(
      digestRecord({
        channel: "digest_weekly",
        createdAt: "2026-03-10T08:00:00.000Z",
        eventType: "decision_opened",
      }),
    );

    const tick = await runMemberNotificationEmailDigestWorkerTick({
      now: new Date("2026-03-16T00:00:00.000Z"),
    });
    assert.equal(tick.sent, 1);
    assert.equal(getMockEmailSendCount(), 1);
  });

  it("prevents duplicate immediate sends for the same delivery", async () => {
    enableLiveAllowlisted();
    await insertMemberNotificationEmailDelivery(immediateRecord({ deliveryId: "dup-1" }));

    const first = await runMemberNotificationEmailDeliveryWorkerTick({ batchSize: 5 });
    const second = await runMemberNotificationEmailDeliveryWorkerTick({ batchSize: 5 });
    assert.equal(first.sent, 1);
    assert.equal(second.processed, 0);
    assert.equal(getMockEmailSendCount(), 1);
  });

  it("kill switch disables further provider sends", async () => {
    enableLiveAllowlisted();
    await insertMemberNotificationEmailDelivery(immediateRecord({ deliveryId: "kill-1" }));
    setMemberNotificationEmailLiveApprovedForTests(false);

    const tick = await runMemberNotificationEmailDeliveryWorkerTick({ batchSize: 5 });
    assert.equal(tick.liveBlocked, 1);
    assert.equal(getMockEmailSendCount(), 0);
  });

  it("enforces per-recipient daily rate limits", async () => {
    enableLiveAllowlisted();
    for (let index = 0; index < MEMBER_NOTIFICATION_EMAIL_PER_RECIPIENT_DAILY_LIMIT + 1; index += 1) {
      await insertMemberNotificationEmailDelivery(
        immediateRecord({
          deliveryId: `rate-${index}`,
          notificationId: `n-rate-${index}`,
        }),
      );
    }

    const tick = await runMemberNotificationEmailDeliveryWorkerTick({
      batchSize: MEMBER_NOTIFICATION_EMAIL_PER_RECIPIENT_DAILY_LIMIT + 2,
    });
    assert.equal(tick.sent, MEMBER_NOTIFICATION_EMAIL_PER_RECIPIENT_DAILY_LIMIT);
    assert.equal(tick.rateLimited, 1);
    assert.equal(getMockEmailSendCount(), MEMBER_NOTIFICATION_EMAIL_PER_RECIPIENT_DAILY_LIMIT);
  });

  it("does not process historical rows before activation", async () => {
    enableLiveAllowlisted();
    await insertMemberNotificationEmailDelivery(
      immediateRecord({
        createdAt: "2025-01-01T00:00:00.000Z",
        nextAttemptAt: "2025-01-01T00:00:00.000Z",
      }),
    );
    const tick = await runMemberNotificationEmailDeliveryWorkerTick({ batchSize: 5 });
    assert.equal(tick.processed, 0);
    assert.equal(getMockEmailSendCount(), 0);
  });

  it("does not leak PII into metrics snapshot", async () => {
    enableLiveAllowlisted();
    await insertMemberNotificationEmailDelivery(immediateRecord());
    await runMemberNotificationEmailDeliveryWorkerTick({ batchSize: 5 });
    const serialized = JSON.stringify(getMemberNotificationEmailMetricsForTests());
    assert.equal(serialized.includes("live@example.com"), false);
    assert.equal(serialized.includes("Live User"), false);
  });

  it("never sends for platform_only preference", async () => {
    enableLiveAllowlisted();
    await seedPrefs({ notificationFrequency: "platform_only" });
    await insertMemberNotificationEmailDelivery(immediateRecord());
    const tick = await runMemberNotificationEmailDeliveryWorkerTick({ batchSize: 5 });
    assert.equal(tick.cancelled, 1);
    assert.equal(getMockEmailSendCount(), 0);
  });

  it("fails closed when rate-limit TTL index readiness is false", async () => {
    enableLiveAllowlisted();
    setMemberNotificationEmailSendRateLimitForceMemoryForTests(false);
    setMemberNotificationEmailSendRateLimitIndexesReadyForTests(false);
    assert.equal(await assertMemberNotificationEmailSendRateLimitIndexesReady(), false);

    await insertMemberNotificationEmailDelivery(immediateRecord({ deliveryId: "idx-fail-1" }));
    const tick = await runMemberNotificationEmailDeliveryWorkerTick({ batchSize: 5 });
    assert.equal(getMockEmailSendCount(), 0);
    assert.ok(tick.rateLimited + tick.failed + tick.liveBlocked >= 1);
    const rows = await listMemberNotificationEmailDeliveriesForTests();
    assert.ok(
      rows[0]?.skipReason === "index_not_ready" ||
        rows[0]?.skipReason === "rate_limited" ||
        rows[0]?.lastErrorCode === "index_not_ready" ||
        rows[0]?.lastErrorCode === "rate_limited",
    );
  });

  it("enforces atomic multi-worker rate-limit consumption", async () => {
    resetMemberNotificationEmailSendRateLimitStoreForTests();
    setMemberNotificationEmailSendRateLimitForceMemoryForTests(true);
    const results = await Promise.all(
      Array.from({ length: MEMBER_NOTIFICATION_EMAIL_PER_RECIPIENT_DAILY_LIMIT + 3 }, () =>
        consumeMemberNotificationEmailSendBudget({ recipientMemberId: MEMBER_ID }),
      ),
    );
    const allowed = results.filter((result) => result.allowed).length;
    const denied = results.filter((result) => !result.allowed).length;
    assert.equal(allowed, MEMBER_NOTIFICATION_EMAIL_PER_RECIPIENT_DAILY_LIMIT);
    assert.equal(denied, 3);
  });

  it("honors kill switch at send boundary after claim", async () => {
    enableLiveAllowlisted();
    await insertMemberNotificationEmailDelivery(immediateRecord({ deliveryId: "boundary-1" }));
    // Disable approval after enqueue/claim path setup — worker rechecks at send.
    setMemberNotificationEmailLiveApprovedForTests(false);
    const tick = await runMemberNotificationEmailDeliveryWorkerTick({ batchSize: 5 });
    assert.equal(tick.liveBlocked, 1);
    assert.equal(getMockEmailSendCount(), 0);
  });

  it("honors opt-out at send boundary", async () => {
    enableLiveAllowlisted();
    await insertMemberNotificationEmailDelivery(immediateRecord({ deliveryId: "opt-1" }));
    await seedPrefs({ notificationEmailCopiesOptIn: false });
    const tick = await runMemberNotificationEmailDeliveryWorkerTick({ batchSize: 5 });
    assert.equal(tick.cancelled, 1);
    assert.equal(getMockEmailSendCount(), 0);
  });

  it("does not confirm delivery for ambiguous provider responses", () => {
    const ambiguous = classifyProviderDeliveryResult({
      emailId: "e-amb",
      emailSent: false,
      status: "queued",
    });
    assert.equal(ambiguous.outcome, "provider_ambiguous");
    assert.equal(ambiguous.skipReason, "provider_ambiguous");
    assert.equal(ambiguous.terminal, false);

    const mismatched = classifyProviderDeliveryResult({
      emailId: "e-mis",
      emailSent: true,
      status: "failed",
    });
    assert.notEqual(mismatched.outcome, "sent");

    const temporary = classifyProviderDeliveryResult({
      emailId: "e-tmp",
      emailSent: false,
      status: "deferred",
      emailDeliveryError: "temporary",
    });
    assert.equal(temporary.outcome, "provider_deferred");
    assert.equal(temporary.terminal, false);

    const accepted = classifyProviderDeliveryResult({
      emailId: "e-ok",
      emailSent: true,
      status: "sent",
    });
    assert.equal(accepted.outcome, "sent");
  });

  it("prevents duplicate digest sends for the same period", async () => {
    enableLiveAllowlisted();
    await seedPrefs({ notificationFrequency: "daily_digest" });
    await insertMemberNotificationEmailDelivery(
      digestRecord({
        deliveryId: "dig-dup-1",
        notificationId: "ndig-dup-1",
        channel: "digest_daily",
        createdAt: "2026-03-10T08:00:00.000Z",
      }),
    );
    const first = await runMemberNotificationEmailDigestWorkerTick({
      now: new Date("2026-03-11T02:00:00.000Z"),
    });
    const second = await runMemberNotificationEmailDigestWorkerTick({
      now: new Date("2026-03-11T03:00:00.000Z"),
    });
    assert.equal(first.sent, 1);
    assert.equal(second.sent, 0);
    assert.equal(getMockEmailSendCount(), 1);
    const runs = await listMemberNotificationEmailDigestRunsForTests();
    assert.equal(runs.length, 1);
    assert.equal(runs[0]?.status, "sent");
  });

  it("blocks digest live send when allowlist is empty", async () => {
    enableLiveAllowlisted();
    setMemberNotificationEmailLiveRecipientAllowlistForTests([]);
    await seedPrefs({ notificationFrequency: "daily_digest" });
    await insertMemberNotificationEmailDelivery(
      digestRecord({
        channel: "digest_daily",
        createdAt: "2026-03-10T08:00:00.000Z",
      }),
    );
    const tick = await runMemberNotificationEmailDigestWorkerTick({
      now: new Date("2026-03-11T02:00:00.000Z"),
    });
    assert.equal(tick.liveBlocked, 1);
    assert.equal(getMockEmailSendCount(), 0);
  });
});
