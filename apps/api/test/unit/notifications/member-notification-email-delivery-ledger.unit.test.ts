/**
 * HU-NOTIF-02C.1 — durable member notification email delivery ledger.
 */
import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";

import type { AuthUserRecord } from "../../../src/modules/auth/auth-user.repository.js";
import { setFindAuthUserByIdForTests } from "../../../src/modules/auth/auth-user.repository.js";
import {
  getMockEmailSendCount,
  resetMockEmailOutboxForTests,
} from "../../../src/modules/email/email-test-helpers.js";
import { MongoTransactionUnavailableError } from "../../../src/infrastructure/mongodb/mongo-transaction.js";
import {
  enqueueMemberNotificationEmailDelivery,
  isMemberNotificationEmailDeliveryEnabled,
  listMemberNotificationEmailDeliveriesForTests,
  listMemberNotificationEmailDeliveryGaps,
  listRecoverableMemberNotificationEmailDeliveryGaps,
  recoverMemberNotificationEmailDeliveryGap,
  resetMemberNotificationEmailDeliveryIndexReadinessForTests,
  resetMemberNotificationEmailDeliveryStoreForTests,
  setMemberNotificationEmailDeliveryEnabledForTests,
  setMemberNotificationEmailDeliveryForceMemoryForTests,
  setMemberNotificationEmailDeliveryIndexesReadyForTests,
  setRunMongoTransactionForEmailIntentTests,
} from "../../../src/modules/notifications/email-delivery/index.js";
import { persistNotificationWithOptionalEmailIntent } from "../../../src/modules/notifications/email-delivery/persist-notification-with-email-intent.js";
import { recordMemberNotificationEmailDeliveryGap } from "../../../src/modules/notifications/email-delivery/member-notification-email-delivery.repository.js";
import { createNotification } from "../../../src/modules/notifications/notification.service.js";
import { resolveNotificationPersistenceAdapter } from "../../../src/modules/notifications/persistence/resolve-notification-persistence.js";
import { buildDefaultMemberPreferences } from "../../../src/modules/preferences/preferences.defaults.js";
import {
  insertPreferences,
  resetPreferencesMemoryStoreForTests,
  setPreferencesForceMemoryForTests,
} from "../../../src/modules/preferences/preferences.repository.js";

const USER_ID = "user-ledger-01";
const PROFILE_ID = "member-ledger-01";

function makeUser(): AuthUserRecord {
  const now = new Date().toISOString();
  return {
    userId: USER_ID,
    email: "owner@example.com",
    passwordHash: "hash",
    displayName: "Owner",
    role: "member",
    status: "active",
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
  const prefs = buildDefaultMemberPreferences({ memberId: PROFILE_ID, userId: USER_ID });
  prefs.communicationPreferences = {
    ...prefs.communicationPreferences,
    ...overrides,
  };
  await insertPreferences(prefs);
}

describe("HU-NOTIF-02C.1 member notification email delivery ledger", () => {
  beforeEach(async () => {
    process.env.NODE_TEST_ENV = "true";
    setMemberNotificationEmailDeliveryForceMemoryForTests(true);
    setPreferencesForceMemoryForTests(true);
    resetPreferencesMemoryStoreForTests();
    resetMemberNotificationEmailDeliveryStoreForTests();
    resetMemberNotificationEmailDeliveryIndexReadinessForTests();
    setMemberNotificationEmailDeliveryIndexesReadyForTests(true);
    setMemberNotificationEmailDeliveryEnabledForTests(null);
    resetMockEmailOutboxForTests();
    setFindAuthUserByIdForTests(async (userId) => (userId === USER_ID ? makeUser() : null));
    resolveNotificationPersistenceAdapter().clearForTests?.();
    await seedPrefs();
  });

  afterEach(() => {
    setMemberNotificationEmailDeliveryEnabledForTests(null);
    setMemberNotificationEmailDeliveryIndexesReadyForTests(null);
    setRunMongoTransactionForEmailIntentTests(null);
    resetMemberNotificationEmailDeliveryStoreForTests();
    resetMemberNotificationEmailDeliveryIndexReadinessForTests();
    setFindAuthUserByIdForTests(null);
    resetMockEmailOutboxForTests();
    resetPreferencesMemoryStoreForTests();
    resolveNotificationPersistenceAdapter().clearForTests?.();
    delete process.env.HU_MEMBER_NOTIFICATION_EMAIL_DELIVERY_ACTIVATION_AT;
  });

  it("keeps delivery flag OFF by default", () => {
    assert.equal(isMemberNotificationEmailDeliveryEnabled(), false);
  });

  it("does not enqueue when flag is OFF", async () => {
    setMemberNotificationEmailDeliveryEnabledForTests(false);
    const notification = await createNotification({
      recipientUserId: USER_ID,
      recipientProfileId: PROFILE_ID,
      eventType: "initiative_published",
      title: "Published",
      message: "An initiative was published.",
      relatedEntityType: "initiative",
      relatedEntityId: "init-1",
      relatedUrl: "/initiatives/init-1",
      priority: "normal",
    });
    assert.ok(notification.notificationId);
    assert.equal((await listMemberNotificationEmailDeliveriesForTests()).length, 0);
    assert.equal(getMockEmailSendCount(), 0);
  });

  it("enqueues pending digest intent when flag ON and prefs eligible", async () => {
    setMemberNotificationEmailDeliveryEnabledForTests(true);
    await seedPrefs({
      notificationEmailCopiesOptIn: true,
      emailNotificationsEnabled: true,
      notificationFrequency: "daily_digest",
    });

    const notification = await createNotification({
      recipientUserId: USER_ID,
      recipientProfileId: PROFILE_ID,
      eventType: "initiative_published",
      title: "Published",
      message: "An initiative was published.",
      relatedEntityType: "initiative",
      relatedEntityId: "init-2",
      relatedUrl: "/initiatives/init-2",
      priority: "normal",
    });

    const rows = await listMemberNotificationEmailDeliveriesForTests();
    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.notificationId, notification.notificationId);
    assert.equal(rows[0]?.channel, "digest_daily");
    assert.equal(rows[0]?.status, "pending");
    assert.equal(rows[0]?.destinationHash?.includes("@"), false);
    assert.ok(rows[0]?.destinationHash);
    assert.equal(getMockEmailSendCount(), 0);
  });

  it("routes immediate and weekly digest without converting digest to immediate", async () => {
    setMemberNotificationEmailDeliveryEnabledForTests(true);

    await seedPrefs({
      notificationEmailCopiesOptIn: true,
      notificationFrequency: "immediate",
    });
    const immediate = await createNotification({
      recipientUserId: USER_ID,
      recipientProfileId: PROFILE_ID,
      eventType: "analysis_published",
      title: "Analysis",
      message: "Analysis published.",
      relatedEntityType: "analysis",
      relatedEntityId: "a-1",
      relatedUrl: "/analysis/a-1",
      priority: "normal",
    });

    await seedPrefs({
      notificationEmailCopiesOptIn: true,
      notificationFrequency: "weekly_digest",
    });
    const weekly = await createNotification({
      recipientUserId: USER_ID,
      recipientProfileId: PROFILE_ID,
      eventType: "decision_opened",
      title: "Decision",
      message: "Decision opened.",
      relatedEntityType: "collective_decision",
      relatedEntityId: "d-1",
      relatedUrl: "/decisions/d-1",
      priority: "normal",
    });

    const rows = await listMemberNotificationEmailDeliveriesForTests();
    const byId = new Map(rows.map((row) => [row.notificationId, row]));
    assert.equal(byId.get(immediate.notificationId)?.channel, "immediate");
    assert.equal(byId.get(weekly.notificationId)?.channel, "digest_weekly");
    assert.equal(byId.get(weekly.notificationId)?.status, "pending");
  });

  it("creates no sendable intent for platform_only", async () => {
    setMemberNotificationEmailDeliveryEnabledForTests(true);
    await seedPrefs({
      notificationEmailCopiesOptIn: true,
      notificationFrequency: "platform_only",
    });

    await createNotification({
      recipientUserId: USER_ID,
      recipientProfileId: PROFILE_ID,
      eventType: "initiative_published",
      title: "Published",
      message: "An initiative was published.",
      relatedEntityType: "initiative",
      relatedEntityId: "init-3",
      relatedUrl: "/initiatives/init-3",
      priority: "normal",
    });

    const rows = await listMemberNotificationEmailDeliveriesForTests();
    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.status, "skipped");
    assert.equal(rows[0]?.skipReason, "platform_only");
  });

  it("skips when opt-in is false (default)", async () => {
    setMemberNotificationEmailDeliveryEnabledForTests(true);
    await createNotification({
      recipientUserId: USER_ID,
      recipientProfileId: PROFILE_ID,
      eventType: "initiative_published",
      title: "Published",
      message: "An initiative was published.",
      relatedEntityType: "initiative",
      relatedEntityId: "init-4",
      relatedUrl: "/initiatives/init-4",
      priority: "normal",
    });
    const rows = await listMemberNotificationEmailDeliveriesForTests();
    assert.equal(rows[0]?.status, "skipped");
    assert.equal(rows[0]?.skipReason, "opt_out");
  });

  it("does not enqueue privacy-excluded direct message events", async () => {
    setMemberNotificationEmailDeliveryEnabledForTests(true);
    await seedPrefs({ notificationEmailCopiesOptIn: true, notificationFrequency: "immediate" });

    await createNotification({
      recipientUserId: USER_ID,
      recipientProfileId: PROFILE_ID,
      eventType: "direct_message_received",
      title: "Message",
      message: "You have a new message.",
      relatedEntityType: "direct_conversation",
      relatedEntityId: "dm-1",
      relatedUrl: "/messages/dm-1",
      priority: "normal",
    });

    assert.equal((await listMemberNotificationEmailDeliveriesForTests()).length, 0);
  });

  it("handles duplicate enqueue idempotently", async () => {
    setMemberNotificationEmailDeliveryEnabledForTests(true);
    await seedPrefs({
      notificationEmailCopiesOptIn: true,
      notificationFrequency: "immediate",
    });

    const notification = await createNotification({
      recipientUserId: USER_ID,
      recipientProfileId: PROFILE_ID,
      eventType: "impact_verified",
      title: "Impact",
      message: "Impact verified.",
      relatedEntityType: "public_impact",
      relatedEntityId: "imp-1",
      relatedUrl: "/impact/imp-1",
      priority: "normal",
    });

    const second = await enqueueMemberNotificationEmailDelivery(notification, {
      skipMongoIndexCheck: true,
    });
    assert.equal(second.outcome, "duplicate");
    assert.equal((await listMemberNotificationEmailDeliveriesForTests()).length, 1);
  });

  it("handles concurrent enqueue without duplicate rows", async () => {
    setMemberNotificationEmailDeliveryEnabledForTests(true);
    await seedPrefs({
      notificationEmailCopiesOptIn: true,
      notificationFrequency: "immediate",
    });

    const notification = {
      notificationId: "notif-concurrent-1",
      recipientUserId: USER_ID,
      recipientProfileId: PROFILE_ID,
      eventType: "archive_published" as const,
      title: "Archive",
      message: "Archive published.",
      relatedEntityType: "civic_archive" as const,
      relatedEntityId: "arc-1",
      relatedUrl: "/archive/arc-1",
      priority: "normal" as const,
      status: "unread" as const,
      createdAt: new Date().toISOString(),
    };

    const results = await Promise.all([
      enqueueMemberNotificationEmailDelivery(notification, { skipMongoIndexCheck: true }),
      enqueueMemberNotificationEmailDelivery(notification, { skipMongoIndexCheck: true }),
    ]);

    const enqueued = results.filter((row) => row.outcome === "enqueued");
    const duplicates = results.filter((row) => row.outcome === "duplicate");
    assert.equal(enqueued.length + duplicates.length, 2);
    assert.equal(enqueued.length, 1);
    assert.equal((await listMemberNotificationEmailDeliveriesForTests()).length, 1);
  });

  it("fails closed for ledger writes when required indexes are not ready", async () => {
    setMemberNotificationEmailDeliveryEnabledForTests(true);
    setMemberNotificationEmailDeliveryIndexesReadyForTests(false);
    await seedPrefs({
      notificationEmailCopiesOptIn: true,
      notificationFrequency: "immediate",
    });

    const notification = await createNotification({
      recipientUserId: USER_ID,
      recipientProfileId: PROFILE_ID,
      eventType: "initiative_published",
      title: "Published",
      message: "An initiative was published.",
      relatedEntityType: "initiative",
      relatedEntityId: "init-5",
      relatedUrl: "/initiatives/init-5",
      priority: "normal",
    });

    assert.ok(notification.notificationId);
    assert.equal((await listMemberNotificationEmailDeliveriesForTests()).length, 0);
    const gaps = await listMemberNotificationEmailDeliveryGaps();
    assert.equal(gaps.length, 1);
    assert.match(gaps[0]?.reason ?? "", /index_not_ready/);
  });

  it("does not backfill historical notifications and gates gap recovery", async () => {
    setMemberNotificationEmailDeliveryEnabledForTests(false);
    await createNotification({
      recipientUserId: USER_ID,
      recipientProfileId: PROFILE_ID,
      eventType: "initiative_published",
      title: "Old",
      message: "Historical.",
      relatedEntityType: "initiative",
      relatedEntityId: "init-old",
      relatedUrl: "/initiatives/init-old",
      priority: "normal",
    });

    setMemberNotificationEmailDeliveryEnabledForTests(true);
    assert.equal((await listMemberNotificationEmailDeliveriesForTests()).length, 0);

    delete process.env.HU_MEMBER_NOTIFICATION_EMAIL_DELIVERY_ACTIVATION_AT;
    const gated = await listRecoverableMemberNotificationEmailDeliveryGaps();
    assert.equal(gated.activationAt, null);
    assert.equal(gated.gaps.length, 0);
  });

  it("preserves in-app notification creation when delivery path errors", async () => {
    setMemberNotificationEmailDeliveryEnabledForTests(true);
    setMemberNotificationEmailDeliveryIndexesReadyForTests(false);

    const notification = await createNotification({
      recipientUserId: USER_ID,
      recipientProfileId: PROFILE_ID,
      eventType: "tracking_updated",
      title: "Tracking",
      message: "Tracking updated.",
      relatedEntityType: "tracking",
      relatedEntityId: "trk-1",
      relatedUrl: "/tracking/trk-1",
      priority: "normal",
    });

    assert.ok(notification.notificationId);
    assert.equal(notification.status, "unread");
    assert.equal(getMockEmailSendCount(), 0);
  });

  it("never stores notification body or plaintext destination on ledger rows", async () => {
    setMemberNotificationEmailDeliveryEnabledForTests(true);
    await seedPrefs({
      notificationEmailCopiesOptIn: true,
      notificationFrequency: "immediate",
    });

    await createNotification({
      recipientUserId: USER_ID,
      recipientProfileId: PROFILE_ID,
      eventType: "commitment_published",
      title: "Secret title should not matter",
      message: "PRIVATE BODY MUST NOT BE STORED",
      relatedEntityType: "implementation_commitment",
      relatedEntityId: "c-1",
      relatedUrl: "/commitments/c-1",
      priority: "normal",
    });

    const serialized = JSON.stringify(await listMemberNotificationEmailDeliveriesForTests());
    assert.equal(serialized.includes("PRIVATE BODY MUST NOT BE STORED"), false);
    assert.equal(serialized.includes("owner@example.com"), false);
  });

  it("uses stable gap identities and dedupes re-records for the same notification", async () => {
    const first = await recordMemberNotificationEmailDeliveryGap({
      notificationId: "notif-gap-stable",
      recipientUserId: USER_ID,
      eventType: "initiative_published",
      reason: "first",
    });
    const second = await recordMemberNotificationEmailDeliveryGap({
      notificationId: "notif-gap-stable",
      recipientUserId: USER_ID,
      eventType: "initiative_published",
      reason: "second",
    });
    assert.equal(first.gapId, "notif-gap-stable");
    assert.equal(second.gapId, "notif-gap-stable");
    assert.equal(second.reason, "second");
    const gaps = await listMemberNotificationEmailDeliveryGaps();
    assert.equal(gaps.filter((gap) => gap.notificationId === "notif-gap-stable").length, 1);
  });

  it("falls back sequentially on transaction unavailable without duplicate notification inserts", async () => {
    setMemberNotificationEmailDeliveryEnabledForTests(true);
    await seedPrefs({
      notificationEmailCopiesOptIn: true,
      notificationFrequency: "immediate",
    });

    setRunMongoTransactionForEmailIntentTests(async () => {
      throw new MongoTransactionUnavailableError();
    });

    const notification = {
      notificationId: "notif-txn-unavailable",
      recipientUserId: USER_ID,
      recipientProfileId: PROFILE_ID,
      eventType: "initiative_published" as const,
      title: "Published",
      message: "Published.",
      relatedEntityType: "initiative" as const,
      relatedEntityId: "init-txn",
      relatedUrl: "/initiatives/init-txn",
      priority: "normal" as const,
      status: "unread" as const,
      createdAt: new Date().toISOString(),
    };

    let insertCount = 0;
    const result = await persistNotificationWithOptionalEmailIntent({
      notification,
      persistenceMode: "mongodb",
      skipMongoIndexCheck: true,
      insertNotification: async () => {
        insertCount += 1;
      },
      findNotificationById: async () => null,
    });

    assert.equal(result.emailIntentAtomic, false);
    assert.equal(insertCount, 1);
    assert.equal((await listMemberNotificationEmailDeliveriesForTests()).length, 1);
    assert.equal(getMockEmailSendCount(), 0);
  });

  it("does not re-insert when a non-unavailable transaction error leaves the notification visible", async () => {
    setMemberNotificationEmailDeliveryEnabledForTests(true);
    await seedPrefs({
      notificationEmailCopiesOptIn: true,
      notificationFrequency: "immediate",
    });

    const notification = {
      notificationId: "notif-txn-visible",
      recipientUserId: USER_ID,
      recipientProfileId: PROFILE_ID,
      eventType: "analysis_published" as const,
      title: "Analysis",
      message: "Analysis.",
      relatedEntityType: "analysis" as const,
      relatedEntityId: "a-txn",
      relatedUrl: "/analysis/a-txn",
      priority: "normal" as const,
      status: "unread" as const,
      createdAt: new Date().toISOString(),
    };

    setRunMongoTransactionForEmailIntentTests(async () => {
      throw new Error("post-commit wake failure");
    });

    let insertCount = 0;
    const result = await persistNotificationWithOptionalEmailIntent({
      notification,
      persistenceMode: "mongodb",
      skipMongoIndexCheck: true,
      insertNotification: async () => {
        insertCount += 1;
      },
      findNotificationById: async () => notification,
    });

    assert.equal(insertCount, 0);
    assert.equal(result.emailIntentAtomic, false);
    assert.equal((await listMemberNotificationEmailDeliveriesForTests()).length, 1);
  });

  it("recovery respects activation boundary and live preference/allowlist gates", async () => {
    setMemberNotificationEmailDeliveryEnabledForTests(true);
    const activationAt = "2026-01-01T00:00:00.000Z";
    process.env.HU_MEMBER_NOTIFICATION_EMAIL_DELIVERY_ACTIVATION_AT = activationAt;

    const historical = {
      notificationId: "notif-hist",
      recipientUserId: USER_ID,
      recipientProfileId: PROFILE_ID,
      eventType: "initiative_published" as const,
      title: "Old",
      message: "Old",
      relatedEntityType: "initiative" as const,
      relatedEntityId: "init-hist",
      relatedUrl: "/initiatives/init-hist",
      priority: "normal" as const,
      status: "unread" as const,
      createdAt: "2025-12-01T00:00:00.000Z",
    };

    const blocked = await recoverMemberNotificationEmailDeliveryGap({
      notificationId: historical.notificationId,
      loadNotification: async () => historical,
      skipMongoIndexCheck: true,
    });
    assert.equal(blocked.outcome, "historical_blocked");

    await seedPrefs({
      notificationEmailCopiesOptIn: false,
      notificationFrequency: "immediate",
    });

    const eligibleTime = {
      notificationId: "notif-recover-optout",
      recipientUserId: USER_ID,
      recipientProfileId: PROFILE_ID,
      eventType: "initiative_published" as const,
      title: "New",
      message: "New",
      relatedEntityType: "initiative" as const,
      relatedEntityId: "init-new",
      relatedUrl: "/initiatives/init-new",
      priority: "normal" as const,
      status: "unread" as const,
      createdAt: "2026-02-01T00:00:00.000Z",
    };

    const recovered = await recoverMemberNotificationEmailDeliveryGap({
      notificationId: eligibleTime.notificationId,
      loadNotification: async () => eligibleTime,
      skipMongoIndexCheck: true,
    });
    assert.equal(recovered.outcome, "recovered");
    if (recovered.outcome === "recovered") {
      assert.equal(recovered.enqueue.outcome, "skipped");
      if (recovered.enqueue.outcome === "skipped") {
        assert.equal(recovered.enqueue.record.skipReason, "opt_out");
      }
    }

    const dm = {
      ...eligibleTime,
      notificationId: "notif-recover-dm",
      eventType: "direct_message_received" as const,
      relatedEntityType: "direct_conversation" as const,
    };
    const privacy = await recoverMemberNotificationEmailDeliveryGap({
      notificationId: dm.notificationId,
      loadNotification: async () => dm,
      skipMongoIndexCheck: true,
    });
    assert.equal(privacy.outcome, "recovered");
    if (privacy.outcome === "recovered") {
      assert.equal(privacy.enqueue.outcome, "not_allowlisted");
    }
    assert.equal(getMockEmailSendCount(), 0);
  });
});
