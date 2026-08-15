import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import {
  connectMongoClient,
  disconnectMongoClient,
} from "../../../src/infrastructure/mongodb/mongo-connection.js";
import { ensureMongoIndexes } from "../../../src/infrastructure/mongodb/mongo-indexes.js";
import { deleteAuthUsersByEmailPrefix } from "../../../src/modules/auth/auth-user.repository.js";
import { deleteMemberProfilesByUserIdPrefix } from "../../../src/modules/member-profile/member-profile.repository.js";
import {
  drainInitiativeCollaborationNotificationsForTests,
  emitInitiativeCollaborationNotification,
} from "../../../src/modules/initiative-discussion-collaboration/initiative-discussion-collaboration-notifications.js";
import {
  clearMemoryNotificationRecipientsForTests,
  registerMemoryNotificationRecipient,
  resolveRecipientIdentity,
} from "../../../src/modules/notifications/notification.recipients.js";
import {
  createNotification,
  createNotificationsForEvent,
  listMyNotifications,
  notificationPersistenceForTests,
} from "../../../src/modules/notifications/notification.service.js";
import { registerAndConfirmMemberForTests } from "../../helpers/test-auth.js";
import { createTestId, isMongoAvailableForTests, skipIfMongoUnavailable } from "../../helpers/test-env.js";

/**
 * Reliability Task — Fix Notification Recipient Identity in Memory Mode.
 *
 * Root cause (see `notification.recipients.ts`, `resolveRecipientIdentity`):
 * the Mongo-backed `memberId` (a.k.a. `participantId`) -> auth `userId`
 * bridge used to require `NOTIFICATION_PERSISTENCE === "mongodb"`, a flag
 * that only controls where *notification records* are stored. Since the
 * platform's actual configured default is `NOTIFICATION_PERSISTENCE=memory`
 * (see `apps/api/.env.example`), that bridge was skipped in the default
 * configuration even when Mongo itself (the real `auth-users` source of
 * truth) was fully configured — so every notification silently recorded
 * `recipientUserId = memberId` instead of the authenticated `userId`,
 * making it unretrievable by the real signed-in user.
 *
 * These tests run under the suite's actual default environment
 * (`NOTIFICATION_PERSISTENCE` unset -> "memory" notification *storage*,
 * real Mongo `auth-users` backing store) precisely so they fail against the
 * pre-fix behavior and pass against the fix, without any environment
 * trickery.
 */

if (!isMongoAvailableForTests()) {
  skipIfMongoUnavailable();
}

const TEST_PREFIX = createTestId("notif-identity");
const createdAuthUserIds: string[] = [];

interface TestParticipant {
  userId: string;
  /** Domain-wide this is the same identifier other modules call `participantId`. */
  memberId: string;
}

async function registerParticipant(label: string): Promise<TestParticipant> {
  const email = `${TEST_PREFIX}-${label}@notifications.test`;
  const user = await registerAndConfirmMemberForTests({ email, displayName: `Fixture ${label}` });
  createdAuthUserIds.push(user.userId);

  return { userId: user.userId, memberId: user.memberId };
}

describe("Notification recipient identity (Reliability Task)", () => {
  before(async () => {
    await connectMongoClient();
    await ensureMongoIndexes();
  });

  after(async () => {
    for (const userId of createdAuthUserIds) {
      await deleteMemberProfilesByUserIdPrefix(userId);
    }
    await deleteAuthUsersByEmailPrefix(`${TEST_PREFIX}-`);
    await disconnectMongoClient();
  });

  describe("resolveRecipientIdentity — the single shared identity bridge", () => {
    it("resolves the real authenticated userId (never the raw participant/member id) under the platform's default memory notification-persistence mode", async () => {
      assert.equal(process.env.NOTIFICATION_PERSISTENCE ?? "memory", "memory");

      const alice = await registerParticipant("bridge-a");
      const identity = await resolveRecipientIdentity(alice.memberId);

      assert.ok(identity);
      assert.equal(identity!.userId, alice.userId);
      assert.notEqual(identity!.userId, alice.memberId);
    });

    it("resolves identically when NOTIFICATION_PERSISTENCE is explicitly 'mongodb' — every persistence mode must agree", async () => {
      const bob = await registerParticipant("bridge-b");
      const original = process.env.NOTIFICATION_PERSISTENCE;
      process.env.NOTIFICATION_PERSISTENCE = "mongodb";

      try {
        const identity = await resolveRecipientIdentity(bob.memberId);
        assert.ok(identity);
        assert.equal(identity!.userId, bob.userId);
      } finally {
        if (original === undefined) {
          delete process.env.NOTIFICATION_PERSISTENCE;
        } else {
          process.env.NOTIFICATION_PERSISTENCE = original;
        }
      }
    });

    it("resolves multiple distinct participants independently, with no cross-user identity leakage (same-shape member, different auth users)", async () => {
      const carol = await registerParticipant("bridge-multi-c");
      const dave = await registerParticipant("bridge-multi-d");

      const [carolIdentity, daveIdentity] = await Promise.all([
        resolveRecipientIdentity(carol.memberId),
        resolveRecipientIdentity(dave.memberId),
      ]);

      assert.equal(carolIdentity!.userId, carol.userId);
      assert.equal(daveIdentity!.userId, dave.userId);
      assert.notEqual(carolIdentity!.userId, daveIdentity!.userId);
    });

    it("a pre-registered memory-directory mapping takes priority over the Mongo bridge (legacy/offline test seam)", async () => {
      const fixtureMemberId = `${TEST_PREFIX}-cache-member`;
      registerMemoryNotificationRecipient({
        memberId: fixtureMemberId,
        userId: `${TEST_PREFIX}-cache-user`,
        profileId: `${TEST_PREFIX}-cache-profile`,
      });

      try {
        const identity = await resolveRecipientIdentity(fixtureMemberId);
        assert.deepEqual(identity, {
          userId: `${TEST_PREFIX}-cache-user`,
          profileId: `${TEST_PREFIX}-cache-profile`,
        });
      } finally {
        clearMemoryNotificationRecipientsForTests();
      }
    });

    it("a missing participant / missing member / missing auth user (invalid recipient) never crashes and never resolves to another real user's identity", async () => {
      const invalidMemberId = `${TEST_PREFIX}-does-not-exist`;
      const identity = await resolveRecipientIdentity(invalidMemberId);

      assert.ok(identity);
      assert.equal(identity!.userId, invalidMemberId);
      assert.equal(identity!.profileId, invalidMemberId);
    });

    it("is idempotent: resolving the same member id repeatedly always returns the identical identity", async () => {
      const erin = await registerParticipant("bridge-idempotent");

      const first = await resolveRecipientIdentity(erin.memberId);
      const second = await resolveRecipientIdentity(erin.memberId);
      const third = await resolveRecipientIdentity(erin.memberId);

      assert.deepEqual(first, second);
      assert.deepEqual(second, third);
      assert.equal(first!.userId, erin.userId);
    });
  });

  describe("End-to-end civic notification pipeline (Event -> Recipient Resolution -> Persistence -> Retrieval)", () => {
    it("a civic notification is owned by the actor's real userId and retrievable only by that userId — never by the participant/member id", async () => {
      const frank = await registerParticipant("civic-frank");
      const entityId = createTestId("nomination");

      await createNotificationsForEvent({
        eventType: "civic_nomination_submitted",
        entityType: "civic_nomination",
        entityId,
        actorMemberId: frank.memberId,
      });

      const byRealUserId = await listMyNotifications({ userId: frank.userId, status: "all" });
      const matching = byRealUserId.notifications.filter(
        (notification) =>
          notification.eventType === "civic_nomination_submitted" &&
          notification.relatedEntityId === entityId,
      );
      assert.equal(matching.length, 1);

      // The historical bug: querying by the participant/member id (the
      // pre-fix owner) must no longer find the notification.
      const byMemberId = await listMyNotifications({ userId: frank.memberId, status: "all" });
      const leaked = byMemberId.notifications.filter(
        (notification) => notification.relatedEntityId === entityId,
      );
      assert.equal(leaked.length, 0);
    });

    it("multiple participants each receive their own correctly-owned notification, with no leakage between them", async () => {
      const grace = await registerParticipant("civic-multi-grace");
      const hank = await registerParticipant("civic-multi-hank");
      const graceEntityId = createTestId("nomination-grace");
      const hankEntityId = createTestId("nomination-hank");

      await createNotificationsForEvent({
        eventType: "civic_nomination_submitted",
        entityType: "civic_nomination",
        entityId: graceEntityId,
        actorMemberId: grace.memberId,
      });
      await createNotificationsForEvent({
        eventType: "civic_nomination_submitted",
        entityType: "civic_nomination",
        entityId: hankEntityId,
        actorMemberId: hank.memberId,
      });

      const graceNotifications = await listMyNotifications({ userId: grace.userId, status: "all" });
      const hankNotifications = await listMyNotifications({ userId: hank.userId, status: "all" });

      assert.equal(
        graceNotifications.notifications.filter((n) => n.relatedEntityId === graceEntityId).length,
        1,
      );
      assert.equal(
        graceNotifications.notifications.filter((n) => n.relatedEntityId === hankEntityId).length,
        0,
      );
      assert.equal(
        hankNotifications.notifications.filter((n) => n.relatedEntityId === hankEntityId).length,
        1,
      );
      assert.equal(
        hankNotifications.notifications.filter((n) => n.relatedEntityId === graceEntityId).length,
        0,
      );
    });

    it("duplicate/retried events resolve to the identical recipient identity every time", async () => {
      const ivan = await registerParticipant("civic-duplicate");
      const entityId = createTestId("nomination-duplicate");

      await createNotificationsForEvent({
        eventType: "civic_nomination_submitted",
        entityType: "civic_nomination",
        entityId,
        actorMemberId: ivan.memberId,
      });
      await createNotificationsForEvent({
        eventType: "civic_nomination_submitted",
        entityType: "civic_nomination",
        entityId,
        actorMemberId: ivan.memberId,
      });

      const notifications = await listMyNotifications({ userId: ivan.userId, status: "all" });
      const matching = notifications.notifications.filter(
        (notification) => notification.relatedEntityId === entityId,
      );

      // Retry-safety of *identity*, not deduplication of notification
      // records (record-level deduplication is a separate, out-of-scope
      // concern) — both retried notifications must resolve to, and stay
      // owned by, the exact same real user.
      assert.equal(matching.length, 2);
      assert.ok(matching.every((notification) => notification.eventType === "civic_nomination_submitted"));
    });
  });

  describe("Every notification-creating caller shares the same identity bridge", () => {
    it("an Initiative Collaboration notification (Ready to Collaborate / Accept / Decline) is owned by the recipient's real userId, not their participant id", async () => {
      const requester = await registerParticipant("collab-requester");
      const steward = await registerParticipant("collab-steward");
      const initiativeId = createTestId("initiative");

      emitInitiativeCollaborationNotification({
        recipientParticipantId: steward.memberId,
        actorParticipantId: requester.memberId,
        eventType: "initiative_collaboration_interest_expressed",
        initiativeId,
      });

      await drainInitiativeCollaborationNotificationsForTests();

      const stewardNotifications = await listMyNotifications({ userId: steward.userId, status: "all" });
      const matching = stewardNotifications.notifications.filter(
        (notification) =>
          notification.eventType === "initiative_collaboration_interest_expressed" &&
          notification.relatedEntityId === initiativeId,
      );
      assert.equal(matching.length, 1);

      const stewardByParticipantId = await listMyNotifications({
        userId: steward.memberId,
        status: "all",
      });
      assert.equal(
        stewardByParticipantId.notifications.filter((n) => n.relatedEntityId === initiativeId).length,
        0,
      );

      const requesterNotifications = await listMyNotifications({ userId: requester.userId, status: "all" });
      assert.equal(
        requesterNotifications.notifications.filter((n) => n.relatedEntityId === initiativeId).length,
        0,
      );
    });

    it("a Membership (member badge) notification created directly with a real userId is retrievable by that authenticated user", async () => {
      const judy = await registerParticipant("membership-judy");
      const entityId = createTestId("badge-contribution");

      await createNotification({
        recipientUserId: judy.userId,
        recipientProfileId: judy.userId,
        eventType: "member_badge_shipped",
        title: "Official Member item shipped",
        message: "Your official Humanity Union Member item request has shipped.",
        relatedEntityType: "member_badge_contribution",
        relatedEntityId: entityId,
        relatedUrl: `/membership/member-badge/requests/${entityId}`,
        priority: "important",
      });

      // Reads via the raw persistence adapter (bypassing
      // `sanitizeNotificationResponse`) — this test verifies
      // recipient-identity plumbing only. `sanitizeNotificationResponse`'s
      // gamification-term guard incidentally also matches the substring
      // "badge" inside `member_badge_contribution` / `member-badge`
      // (pre-existing, unrelated to recipient identity and out of scope
      // for this reliability fix; the same collision already exists in the
      // real `markMemberBadgeContributionShipped` production payload).
      const notifications = await notificationPersistenceForTests.list({
        userId: judy.userId,
        status: "all",
      });
      assert.equal(
        notifications.filter((notification) => notification.relatedEntityId === entityId).length,
        1,
      );
      assert.equal(
        notifications.find((notification) => notification.relatedEntityId === entityId)!.recipientUserId,
        judy.userId,
      );
    });
  });
});
