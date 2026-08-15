import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import type { AuthUserRecord } from "../../../src/modules/auth/auth-user.repository.js";
import {
  connectMongoClient,
  disconnectMongoClient,
} from "../../../src/infrastructure/mongodb/mongo-connection.js";
import { ensureMongoIndexes } from "../../../src/infrastructure/mongodb/mongo-indexes.js";
import { confirmRegistrationEmailCode } from "../../../src/modules/auth/auth-email-confirmation.service.js";
import { registerAuthUser } from "../../../src/modules/auth/auth.service.js";
import {
  deleteAuthUsersByEmailPrefix,
  findAuthUserByEmail,
} from "../../../src/modules/auth/auth-user.repository.js";
import { getLastIssuedConfirmationCodeForTests } from "../../../src/modules/email/email-confirmation-code.repository.js";
import { findMembershipByUserId } from "../../../src/modules/membership/membership.repository.js";
import {
  DirectMessagingAccessDeniedError,
  DirectMessagingBlockedError,
  DirectMessagingParticipantNotFoundError,
  DirectMessagingSelfMessageError,
  DirectMessagingValidationError,
} from "../../../src/modules/direct-messaging/direct-messaging.errors.js";
import {
  drainDirectMessageNotificationsForTests,
} from "../../../src/modules/direct-messaging/direct-messaging-notifications.js";
import {
  getDirectConversationDetail,
  listMyDirectConversations,
  listOlderDirectMessages,
  markDirectConversationRead,
  openOrCreateDirectConversation,
  sendDirectMessage,
} from "../../../src/modules/direct-messaging/direct-messaging.service.js";
import { deleteDirectConversationsByParticipantIdForTests } from "../../../src/modules/direct-messaging/persistence/direct-messaging.repository.js";
import {
  deleteMemberProfilesByUserIdPrefix,
  findMemberProfileByUserId,
} from "../../../src/modules/member-profile/member-profile.repository.js";
import { updateMemberProfilePrivacyForUser } from "../../../src/modules/member-profile/member-profile.service.js";
import {
  countUnreadNotifications,
  listMyNotifications,
} from "../../../src/modules/notifications/notification.service.js";
import { createTestId, isMongoAvailableForTests, skipIfMongoUnavailable } from "../../helpers/test-env.js";

/**
 * Profile UX Pack 03 Parts 2-4/11-13/20-21 — Mongo-backed service-level
 * tests. Uses the real repository/service stack end to end (no dependency
 * injection here, unlike the eligibility suite), against the isolated
 * per-run test database `test/helpers/test-setup.ts` establishes. Test
 * numbers reference Part 25 of the task spec.
 */

if (!isMongoAvailableForTests()) {
  skipIfMongoUnavailable();
}

const TEST_PREFIX = createTestId("dm-service");
const createdAuthUserIds: string[] = [];
const createdParticipantIds: string[] = [];

interface TestParticipant {
  userId: string;
  participantId: string;
  publicName: string;
  email: string;
}

async function registerParticipant(label: string): Promise<TestParticipant> {
  const email = `${TEST_PREFIX}-${label}@direct-messaging.test`;
  await registerAuthUser({ email, password: "Password123!", displayName: `Fixture ${label}` });

  const user = (await findAuthUserByEmail(email)) as AuthUserRecord;
  assert.ok(user, `expected auth user to exist for ${email}`);
  createdAuthUserIds.push(user.userId);
  createdParticipantIds.push(user.memberId);

  const code = getLastIssuedConfirmationCodeForTests(user.userId);
  assert.ok(code, "expected a confirmation code to have been issued");
  await confirmRegistrationEmailCode({ userId: user.userId, code: code! });

  const profile = await findMemberProfileByUserId(user.userId);
  assert.ok(profile, "expected a default Member Profile to already exist after registration");

  return {
    userId: user.userId,
    participantId: user.memberId,
    publicName: profile!.publicName,
    email,
  };
}

async function setMessagingPolicy(
  userId: string,
  messagingPolicy: "active_allies" | "registered_participants" | "nobody",
): Promise<void> {
  await updateMemberProfilePrivacyForUser(userId, { messagingPolicy });
}

describe("Direct Messaging service (Profile UX Pack 03)", () => {
  before(async () => {
    await connectMongoClient();
    await ensureMongoIndexes();
  });

  after(async () => {
    for (const participantId of createdParticipantIds) {
      await deleteDirectConversationsByParticipantIdForTests(participantId);
    }
    for (const userId of createdAuthUserIds) {
      await deleteMemberProfilesByUserIdPrefix(userId);
    }
    await deleteAuthUsersByEmailPrefix(`${TEST_PREFIX}-`);
    await disconnectMongoClient();
  });

  describe("Opening a conversation (Parts 2-3-5)", () => {
    it("test 1 — a Participant can open a permitted conversation (default Active Allies policy is bypassed here via Registered Participants)", async () => {
      const alice = await registerParticipant("open-a");
      const bob = await registerParticipant("open-b");
      await setMessagingPolicy(bob.userId, "registered_participants");

      const conversation = await openOrCreateDirectConversation(alice.participantId, bob.publicName);

      assert.equal(conversation.otherParticipant.participantId, bob.participantId);
      assert.equal(conversation.messages.length, 0);
    });

    it("test 29 — projects the other Participant's public profile URL correctly when their profile is public", async () => {
      const alice = await registerParticipant("url-a");
      const bob = await registerParticipant("url-b");
      await setMessagingPolicy(bob.userId, "registered_participants");
      // profileUrl is only ever projected for a `public`-visibility profile
      // (see `resolvePublicAuthorIdentity`) — the default for a freshly
      // registered profile is `members_only`, which test 30 covers below.
      await updateMemberProfilePrivacyForUser(bob.userId, { profileVisibility: "public" });

      const conversation = await openOrCreateDirectConversation(alice.participantId, bob.publicName);

      assert.equal(conversation.otherParticipant.profileUrl, `/member/${bob.publicName}`);
    });

    it("test 30 — falls back to a safe, undefined profileUrl (no broken link) when the profile is not public", async () => {
      const alice = await registerParticipant("nourl-a");
      const bob = await registerParticipant("nourl-b");
      await setMessagingPolicy(bob.userId, "registered_participants");
      // Default profile visibility ("members_only") is left untouched here.

      const conversation = await openOrCreateDirectConversation(alice.participantId, bob.publicName);

      assert.equal(conversation.otherParticipant.profileUrl, undefined);
      assert.ok(conversation.otherParticipant.displayName);
    });

    it("test 3 — a Participant cannot message themselves", async () => {
      const alice = await registerParticipant("self");

      await assert.rejects(
        () => openOrCreateDirectConversation(alice.participantId, alice.publicName),
        DirectMessagingSelfMessageError,
      );
    });

    it("test 7 / test 24 — Privacy Nobody blocks a new conversation and persists nothing", async () => {
      const alice = await registerParticipant("nobody-a");
      const bob = await registerParticipant("nobody-b");
      await setMessagingPolicy(bob.userId, "nobody");

      await assert.rejects(
        () => openOrCreateDirectConversation(alice.participantId, bob.publicName),
        DirectMessagingBlockedError,
      );

      const aliceConversations = await listMyDirectConversations(alice.participantId);
      assert.equal(aliceConversations.conversations.length, 0);
    });

    it("test 6 — Privacy Registered Participants permits any authenticated Participant", async () => {
      const alice = await registerParticipant("registered-a");
      const bob = await registerParticipant("registered-b");
      await setMessagingPolicy(bob.userId, "registered_participants");

      const conversation = await openOrCreateDirectConversation(alice.participantId, bob.publicName);
      assert.ok(conversation.conversationId);
    });

    it("test 5 — Privacy Active Allies rejects a non-Ally (the recommended default policy)", async () => {
      const alice = await registerParticipant("allies-reject-a");
      const bob = await registerParticipant("allies-reject-b");
      // Bob keeps the default "active_allies" policy; Alice and Bob share no
      // Initiative Ally relationship, so this must be blocked.
      await assert.rejects(
        () => openOrCreateDirectConversation(alice.participantId, bob.publicName),
        DirectMessagingBlockedError,
      );
    });

    it("test 8 / test 40 — concurrent conversation creation for the same pair produces exactly one conversation", async () => {
      const alice = await registerParticipant("concurrent-a");
      const bob = await registerParticipant("concurrent-b");
      await setMessagingPolicy(bob.userId, "registered_participants");

      const [first, second] = await Promise.all([
        openOrCreateDirectConversation(alice.participantId, bob.publicName),
        openOrCreateDirectConversation(alice.participantId, bob.publicName),
      ]);

      assert.equal(first.conversationId, second.conversationId);

      const aliceConversations = await listMyDirectConversations(alice.participantId);
      assert.equal(aliceConversations.conversations.length, 1);
    });

    it("reuses the same conversation regardless of who initiates first (A->B then B->A)", async () => {
      const alice = await registerParticipant("reuse-a");
      const bob = await registerParticipant("reuse-b");
      await setMessagingPolicy(bob.userId, "registered_participants");
      await setMessagingPolicy(alice.userId, "registered_participants");

      const opened = await openOrCreateDirectConversation(alice.participantId, bob.publicName);
      const reopened = await openOrCreateDirectConversation(bob.participantId, alice.publicName);

      assert.equal(opened.conversationId, reopened.conversationId);
    });

    /**
     * Communication UX Pack 03.8 Part 5/15 — reproduces the exact reported
     * flow end to end at the service layer (no conversation exists ->
     * open/create -> the exact returned `conversationId` is immediately
     * fetchable by BOTH participants), so a regression that reintroduces
     * a "Conversation not found" immediately after creation fails this
     * test rather than only being caught by a live manual check.
     */
    it("Part 5 — a brand-new conversation is immediately fetchable by its exact returned conversationId, for both participants", async () => {
      const alice = await registerParticipant("immediate-fetch-a");
      const bob = await registerParticipant("immediate-fetch-b");
      await setMessagingPolicy(bob.userId, "registered_participants");

      const alicesConversations = await listMyDirectConversations(alice.participantId);
      assert.equal(alicesConversations.conversations.length, 0);

      const created = await openOrCreateDirectConversation(alice.participantId, bob.publicName);
      assert.ok(created.conversationId);

      const fetchedByCreator = await getDirectConversationDetail(created.conversationId, alice.participantId);
      assert.equal(fetchedByCreator.conversationId, created.conversationId);
      assert.equal(fetchedByCreator.messages.length, 0);

      const fetchedByRecipient = await getDirectConversationDetail(created.conversationId, bob.participantId);
      assert.equal(fetchedByRecipient.conversationId, created.conversationId);
    });
  });

  describe("Opening a conversation by participantId (Communication UX Pack 03.2 Part 2/3/5)", () => {
    it("opens a conversation using participantId alone, with no public profile required", async () => {
      const alice = await registerParticipant("byid-a");
      const bob = await registerParticipant("byid-b");
      await setMessagingPolicy(bob.userId, "registered_participants");
      // Default profile visibility ("members_only") is left untouched —
      // this is exactly the case a Workspace Ally card must still support,
      // since an Ally is not required to have a public profile.

      const conversation = await openOrCreateDirectConversation(alice.participantId, {
        participantId: bob.participantId,
      });

      assert.equal(conversation.otherParticipant.participantId, bob.participantId);
      assert.equal(conversation.messages.length, 0);
    });

    it("resolves to the exact same conversation regardless of whether the opener used publicName or participantId", async () => {
      const alice = await registerParticipant("byid-same-a");
      const bob = await registerParticipant("byid-same-b");
      await setMessagingPolicy(bob.userId, "registered_participants");

      const byPublicName = await openOrCreateDirectConversation(alice.participantId, bob.publicName);
      const byParticipantId = await openOrCreateDirectConversation(alice.participantId, {
        participantId: bob.participantId,
      });

      assert.equal(byPublicName.conversationId, byParticipantId.conversationId);
    });

    it("rejects a self-message attempted via participantId", async () => {
      const alice = await registerParticipant("byid-self");

      await assert.rejects(
        () =>
          openOrCreateDirectConversation(alice.participantId, { participantId: alice.participantId }),
        DirectMessagingSelfMessageError,
      );
    });

    it("Privacy Nobody blocks a new conversation opened via participantId", async () => {
      const alice = await registerParticipant("byid-nobody-a");
      const bob = await registerParticipant("byid-nobody-b");
      await setMessagingPolicy(bob.userId, "nobody");

      await assert.rejects(
        () =>
          openOrCreateDirectConversation(alice.participantId, { participantId: bob.participantId }),
        DirectMessagingBlockedError,
      );
    });

    it("a non-existent participantId is rejected, never silently creating a conversation", async () => {
      const alice = await registerParticipant("byid-missing");

      await assert.rejects(
        () =>
          openOrCreateDirectConversation(alice.participantId, {
            participantId: "participant-does-not-exist",
          }),
        DirectMessagingParticipantNotFoundError,
      );
    });

    it("rejects the request when neither publicName nor participantId is provided", async () => {
      const alice = await registerParticipant("byid-empty");

      await assert.rejects(
        () => openOrCreateDirectConversation(alice.participantId, {}),
        DirectMessagingParticipantNotFoundError,
      );
    });
  });

  describe("Conversation membership / access control (Part 5/21)", () => {
    it("test 9 / test 10 — the conversation list contains only the viewer's own conversations, and a non-member cannot read it", async () => {
      const alice = await registerParticipant("membership-a");
      const bob = await registerParticipant("membership-b");
      const carol = await registerParticipant("membership-c");
      await setMessagingPolicy(bob.userId, "registered_participants");

      const conversation = await openOrCreateDirectConversation(alice.participantId, bob.publicName);

      const carolConversations = await listMyDirectConversations(carol.participantId);
      assert.equal(carolConversations.conversations.length, 0);

      await assert.rejects(
        () => getDirectConversationDetail(conversation.conversationId, carol.participantId),
        DirectMessagingAccessDeniedError,
      );
    });
  });

  describe("Sending messages (Part 11/15/21)", () => {
    it("test 11 — the sender can send a valid message, and it is durably persisted", async () => {
      const alice = await registerParticipant("send-a");
      const bob = await registerParticipant("send-b");
      await setMessagingPolicy(bob.userId, "registered_participants");

      const conversation = await openOrCreateDirectConversation(alice.participantId, bob.publicName);
      const message = await sendDirectMessage({
        conversationId: conversation.conversationId,
        senderParticipantId: alice.participantId,
        text: "Hello Bob, ready to collaborate?",
      });

      assert.equal(message.text, "Hello Bob, ready to collaborate?");
      assert.equal(message.senderParticipantId, alice.participantId);
      assert.equal(message.isOwnMessage, true);

      const detail = await getDirectConversationDetail(conversation.conversationId, alice.participantId);
      assert.equal(detail.messages.length, 1);
      assert.equal(detail.messages[0]?.messageId, message.messageId);
    });

    it("test 12 — an empty message is rejected", async () => {
      const alice = await registerParticipant("empty-a");
      const bob = await registerParticipant("empty-b");
      await setMessagingPolicy(bob.userId, "registered_participants");
      const conversation = await openOrCreateDirectConversation(alice.participantId, bob.publicName);

      await assert.rejects(
        () =>
          sendDirectMessage({
            conversationId: conversation.conversationId,
            senderParticipantId: alice.participantId,
            text: "   ",
          }),
        DirectMessagingValidationError,
      );
    });

    it("test 13 — an oversized message is rejected", async () => {
      const alice = await registerParticipant("oversized-a");
      const bob = await registerParticipant("oversized-b");
      await setMessagingPolicy(bob.userId, "registered_participants");
      const conversation = await openOrCreateDirectConversation(alice.participantId, bob.publicName);

      await assert.rejects(
        () =>
          sendDirectMessage({
            conversationId: conversation.conversationId,
            senderParticipantId: alice.participantId,
            text: "a".repeat(2001),
          }),
        DirectMessagingValidationError,
      );
    });

    it("test 14 — HTML/script content is rejected outright, never stored or rendered", async () => {
      const alice = await registerParticipant("html-a");
      const bob = await registerParticipant("html-b");
      await setMessagingPolicy(bob.userId, "registered_participants");
      const conversation = await openOrCreateDirectConversation(alice.participantId, bob.publicName);

      await assert.rejects(
        () =>
          sendDirectMessage({
            conversationId: conversation.conversationId,
            senderParticipantId: alice.participantId,
            text: "<script>alert(document.cookie)</script>",
          }),
        DirectMessagingValidationError,
      );

      const detail = await getDirectConversationDetail(conversation.conversationId, alice.participantId);
      assert.equal(detail.messages.length, 0);
    });

    it("a non-member cannot send into a conversation they do not belong to", async () => {
      const alice = await registerParticipant("nonmember-a");
      const bob = await registerParticipant("nonmember-b");
      const carol = await registerParticipant("nonmember-c");
      await setMessagingPolicy(bob.userId, "registered_participants");
      const conversation = await openOrCreateDirectConversation(alice.participantId, bob.publicName);

      await assert.rejects(
        () =>
          sendDirectMessage({
            conversationId: conversation.conversationId,
            senderParticipantId: carol.participantId,
            text: "I should not be able to send this.",
          }),
        DirectMessagingAccessDeniedError,
      );
    });

    it("test 20 — message ordering is chronological (oldest to newest)", async () => {
      const alice = await registerParticipant("order-a");
      const bob = await registerParticipant("order-b");
      await setMessagingPolicy(bob.userId, "registered_participants");
      const conversation = await openOrCreateDirectConversation(alice.participantId, bob.publicName);

      await sendDirectMessage({
        conversationId: conversation.conversationId,
        senderParticipantId: alice.participantId,
        text: "First",
      });
      await sendDirectMessage({
        conversationId: conversation.conversationId,
        senderParticipantId: bob.participantId,
        text: "Second",
      });
      await sendDirectMessage({
        conversationId: conversation.conversationId,
        senderParticipantId: alice.participantId,
        text: "Third",
      });

      const detail = await getDirectConversationDetail(conversation.conversationId, alice.participantId);
      assert.deepEqual(
        detail.messages.map((message) => message.text),
        ["First", "Second", "Third"],
      );
    });

    it("test 23 — an idempotent send retry with the same clientMessageId creates exactly one message", async () => {
      const alice = await registerParticipant("idempotent-a");
      const bob = await registerParticipant("idempotent-b");
      await setMessagingPolicy(bob.userId, "registered_participants");
      const conversation = await openOrCreateDirectConversation(alice.participantId, bob.publicName);

      const first = await sendDirectMessage({
        conversationId: conversation.conversationId,
        senderParticipantId: alice.participantId,
        text: "Retry-safe message",
        clientMessageId: "client-key-1",
      });
      const second = await sendDirectMessage({
        conversationId: conversation.conversationId,
        senderParticipantId: alice.participantId,
        text: "Retry-safe message",
        clientMessageId: "client-key-1",
      });

      assert.equal(first.messageId, second.messageId);

      const detail = await getDirectConversationDetail(conversation.conversationId, alice.participantId);
      assert.equal(detail.messages.length, 1);
    });

    it("test 24 — a blocked send (recipient switched to Nobody after the conversation already exists) persists nothing new", async () => {
      const alice = await registerParticipant("blocked-send-a");
      const bob = await registerParticipant("blocked-send-b");
      await setMessagingPolicy(bob.userId, "registered_participants");
      const conversation = await openOrCreateDirectConversation(alice.participantId, bob.publicName);

      await sendDirectMessage({
        conversationId: conversation.conversationId,
        senderParticipantId: alice.participantId,
        text: "Before the policy change.",
      });

      await setMessagingPolicy(bob.userId, "nobody");

      await assert.rejects(
        () =>
          sendDirectMessage({
            conversationId: conversation.conversationId,
            senderParticipantId: alice.participantId,
            text: "After the policy change.",
          }),
        DirectMessagingBlockedError,
      );

      const detail = await getDirectConversationDetail(conversation.conversationId, alice.participantId);
      assert.equal(detail.messages.length, 1);
      assert.equal(detail.messages[0]?.text, "Before the policy change.");
    });

    it("test 40 — concurrent sends into the same conversation are all preserved, with no loss or duplication", async () => {
      const alice = await registerParticipant("concurrent-send-a");
      const bob = await registerParticipant("concurrent-send-b");
      await setMessagingPolicy(bob.userId, "registered_participants");
      const conversation = await openOrCreateDirectConversation(alice.participantId, bob.publicName);

      await Promise.all([
        sendDirectMessage({
          conversationId: conversation.conversationId,
          senderParticipantId: alice.participantId,
          text: "Concurrent message one",
          clientMessageId: "concurrent-key-1",
        }),
        sendDirectMessage({
          conversationId: conversation.conversationId,
          senderParticipantId: bob.participantId,
          text: "Concurrent message two",
          clientMessageId: "concurrent-key-2",
        }),
      ]);

      const detail = await getDirectConversationDetail(conversation.conversationId, alice.participantId);
      assert.equal(detail.messages.length, 2);
      const messageIds = new Set(detail.messages.map((message) => message.messageId));
      assert.equal(messageIds.size, 2);
    });

    it("test 38 — no Member status (paid Membership) is required to send a message", async () => {
      const alice = await registerParticipant("no-membership-a");
      const bob = await registerParticipant("no-membership-b");
      await setMessagingPolicy(bob.userId, "registered_participants");

      const membership = await findMembershipByUserId(alice.userId);
      assert.ok(!membership || membership.status !== "active_member");

      const conversation = await openOrCreateDirectConversation(alice.participantId, bob.publicName);
      const message = await sendDirectMessage({
        conversationId: conversation.conversationId,
        senderParticipantId: alice.participantId,
        text: "Membership is not required to collaborate directly.",
      });

      assert.ok(message.messageId);
    });
  });

  describe("Unread state (Part 12)", () => {
    it("test 15 / test 16 — the recipient sees unread, the sender does not, for the sender's own message", async () => {
      const alice = await registerParticipant("unread-a");
      const bob = await registerParticipant("unread-b");
      await setMessagingPolicy(bob.userId, "registered_participants");
      const conversation = await openOrCreateDirectConversation(alice.participantId, bob.publicName);

      await sendDirectMessage({
        conversationId: conversation.conversationId,
        senderParticipantId: alice.participantId,
        text: "Marking unread for Bob only.",
      });

      const aliceList = await listMyDirectConversations(alice.participantId);
      const bobList = await listMyDirectConversations(bob.participantId);

      assert.equal(aliceList.conversations[0]?.unread, false);
      assert.equal(bobList.conversations[0]?.unread, true);
    });

    it("test 17 / test 18 — opening (mark-read) clears unread, and repeated mark-read is idempotent", async () => {
      const alice = await registerParticipant("markread-a");
      const bob = await registerParticipant("markread-b");
      await setMessagingPolicy(bob.userId, "registered_participants");
      const conversation = await openOrCreateDirectConversation(alice.participantId, bob.publicName);

      await sendDirectMessage({
        conversationId: conversation.conversationId,
        senderParticipantId: alice.participantId,
        text: "Please read this.",
      });

      await markDirectConversationRead(conversation.conversationId, bob.participantId);
      const firstRead = await listMyDirectConversations(bob.participantId);
      assert.equal(firstRead.conversations[0]?.unread, false);

      // Idempotent repeat — must not throw and must leave the same state.
      await markDirectConversationRead(conversation.conversationId, bob.participantId);
      const secondRead = await listMyDirectConversations(bob.participantId);
      assert.equal(secondRead.conversations[0]?.unread, false);
    });
  });

  describe("Conversation ordering (Part 9/19)", () => {
    it("test 19 — the conversation list orders by last activity, most recent first", async () => {
      const alice = await registerParticipant("ordering-a");
      const bob = await registerParticipant("ordering-b");
      const carol = await registerParticipant("ordering-c");
      await setMessagingPolicy(bob.userId, "registered_participants");
      await setMessagingPolicy(carol.userId, "registered_participants");

      const withBob = await openOrCreateDirectConversation(alice.participantId, bob.publicName);
      const withCarol = await openOrCreateDirectConversation(alice.participantId, carol.publicName);

      // Bob's conversation is touched first, then Carol's — Carol's should sort first.
      await sendDirectMessage({
        conversationId: withBob.conversationId,
        senderParticipantId: alice.participantId,
        text: "To Bob first.",
      });
      await sendDirectMessage({
        conversationId: withCarol.conversationId,
        senderParticipantId: alice.participantId,
        text: "To Carol second.",
      });

      const list = await listMyDirectConversations(alice.participantId);
      assert.equal(list.conversations[0]?.conversationId, withCarol.conversationId);
      assert.equal(list.conversations[1]?.conversationId, withBob.conversationId);
    });
  });

  describe("Pagination (Part 10/21 #5)", () => {
    it("test 21 — older-message pagination does not duplicate or skip records", async () => {
      const alice = await registerParticipant("pagination-a");
      const bob = await registerParticipant("pagination-b");
      await setMessagingPolicy(bob.userId, "registered_participants");
      const conversation = await openOrCreateDirectConversation(alice.participantId, bob.publicName);

      const TOTAL_MESSAGES = 33; // exceeds the 30-message recent-page size, forcing a second page.
      for (let index = 0; index < TOTAL_MESSAGES; index += 1) {
        await sendDirectMessage({
          conversationId: conversation.conversationId,
          senderParticipantId: index % 2 === 0 ? alice.participantId : bob.participantId,
          text: `Message number ${index}`,
        });
      }

      const detail = await getDirectConversationDetail(conversation.conversationId, alice.participantId);
      assert.equal(detail.hasMoreOlderMessages, true);
      assert.equal(detail.messages.length, 30);
      assert.equal(detail.messages[0]?.text, "Message number 3");
      assert.equal(detail.messages[29]?.text, "Message number 32");

      const olderPage = await listOlderDirectMessages(
        conversation.conversationId,
        alice.participantId,
        detail.messages[0]!.messageId,
      );

      assert.equal(olderPage.hasMoreOlderMessages, false);
      assert.equal(olderPage.messages.length, 3);
      assert.deepEqual(
        olderPage.messages.map((message) => message.text),
        ["Message number 0", "Message number 1", "Message number 2"],
      );

      const allMessageIds = new Set([
        ...olderPage.messages.map((message) => message.messageId),
        ...detail.messages.map((message) => message.messageId),
      ]);
      assert.equal(allMessageIds.size, TOTAL_MESSAGES);
    });
  });

  describe("Notifications (Part 13)", () => {
    it("test 22 — the recipient receives exactly one notification per new message", async () => {
      const alice = await registerParticipant("notify-a");
      const bob = await registerParticipant("notify-b");
      await setMessagingPolicy(bob.userId, "registered_participants");
      const conversation = await openOrCreateDirectConversation(alice.participantId, bob.publicName);

      await sendDirectMessage({
        conversationId: conversation.conversationId,
        senderParticipantId: alice.participantId,
        text: "You should be notified once.",
      });

      await drainDirectMessageNotificationsForTests();

      // Reliability Task — Fix Notification Recipient Identity in Memory
      // Mode fixed `resolveRecipientIdentity` (`notification.recipients.ts`)
      // to always bridge `participantId` -> the real authenticated `userId`
      // whenever Mongo is configured, regardless of
      // `NOTIFICATION_PERSISTENCE`. Notifications are therefore now owned
      // by, and retrievable by, the recipient's real `userId`.
      const notifications = await listMyNotifications({ userId: bob.userId, status: "all" });
      const matching = notifications.notifications.filter(
        (notification) =>
          notification.eventType === "direct_message_received" &&
          notification.relatedEntityId === conversation.conversationId,
      );

      assert.equal(matching.length, 1);
      // Part 13 — the notification body never embeds the private message text.
      assert.ok(!matching[0]!.message.includes("You should be notified once."));
      // Communication UX Pack 03.2 Part 7 — carries enough safe metadata to
      // open the exact conversation directly, with no second selection step.
      assert.equal(
        matching[0]!.relatedUrl,
        `/workspace/messages/${encodeURIComponent(conversation.conversationId)}`,
      );
    });

    it("never notifies the sender for their own message", async () => {
      const alice = await registerParticipant("no-self-notify-a");
      const bob = await registerParticipant("no-self-notify-b");
      await setMessagingPolicy(bob.userId, "registered_participants");
      const conversation = await openOrCreateDirectConversation(alice.participantId, bob.publicName);

      await sendDirectMessage({
        conversationId: conversation.conversationId,
        senderParticipantId: alice.participantId,
        text: "Should not notify myself.",
      });

      await drainDirectMessageNotificationsForTests();

      const notifications = await listMyNotifications({ userId: alice.userId, status: "all" });
      const matching = notifications.notifications.filter(
        (notification) => notification.eventType === "direct_message_received",
      );

      assert.equal(matching.length, 0);
    });

    /**
     * UX Completion Pack 04 Part 7 — regression for the header-bell
     * "sticky unread" bug: opening a conversation from the Messenger
     * (never the Notification Center) previously left the matching
     * `direct_message_received` notification(s) permanently unread, even
     * though the conversation's own durable unread marker was correctly
     * cleared by `markDirectConversationRead`.
     */
    it("marking a conversation read also marks its direct_message_received notifications read", async () => {
      const alice = await registerParticipant("read-sync-a");
      const bob = await registerParticipant("read-sync-b");
      await setMessagingPolicy(bob.userId, "registered_participants");
      const conversation = await openOrCreateDirectConversation(alice.participantId, bob.publicName);

      await sendDirectMessage({
        conversationId: conversation.conversationId,
        senderParticipantId: alice.participantId,
        text: "First unread message.",
      });
      await sendDirectMessage({
        conversationId: conversation.conversationId,
        senderParticipantId: alice.participantId,
        text: "Second unread message.",
      });

      await drainDirectMessageNotificationsForTests();

      const beforeRead = await listMyNotifications({ userId: bob.userId, status: "all" });
      const matchingBeforeRead = beforeRead.notifications.filter(
        (notification) =>
          notification.eventType === "direct_message_received" &&
          notification.relatedEntityId === conversation.conversationId,
      );
      assert.equal(matchingBeforeRead.length, 2);
      assert.ok(matchingBeforeRead.every((notification) => notification.status === "unread"));

      const unreadCountBeforeRead = await countUnreadNotifications(bob.userId);
      assert.ok(unreadCountBeforeRead >= 2);

      await markDirectConversationRead(conversation.conversationId, bob.participantId);

      const afterRead = await listMyNotifications({ userId: bob.userId, status: "all" });
      const matchingAfterRead = afterRead.notifications.filter(
        (notification) =>
          notification.eventType === "direct_message_received" &&
          notification.relatedEntityId === conversation.conversationId,
      );
      assert.equal(matchingAfterRead.length, 2);
      assert.ok(matchingAfterRead.every((notification) => notification.status === "read"));

      const unreadCountAfterRead = await countUnreadNotifications(bob.userId);
      assert.equal(unreadCountAfterRead, unreadCountBeforeRead - 2);
    });

    it("marking a conversation read never touches notifications for a different conversation", async () => {
      const alice = await registerParticipant("read-sync-scope-a");
      const bob = await registerParticipant("read-sync-scope-b");
      const carol = await registerParticipant("read-sync-scope-c");
      await setMessagingPolicy(alice.userId, "registered_participants");
      await setMessagingPolicy(carol.userId, "registered_participants");

      const withAlice = await openOrCreateDirectConversation(bob.participantId, alice.publicName);
      const withCarol = await openOrCreateDirectConversation(bob.participantId, carol.publicName);

      await sendDirectMessage({
        conversationId: withAlice.conversationId,
        senderParticipantId: alice.participantId,
        text: "From Alice.",
      });
      await sendDirectMessage({
        conversationId: withCarol.conversationId,
        senderParticipantId: carol.participantId,
        text: "From Carol.",
      });

      await drainDirectMessageNotificationsForTests();

      await markDirectConversationRead(withAlice.conversationId, bob.participantId);

      const afterRead = await listMyNotifications({ userId: bob.userId, status: "all" });
      const fromAlice = afterRead.notifications.find(
        (notification) => notification.relatedEntityId === withAlice.conversationId,
      );
      const fromCarol = afterRead.notifications.find(
        (notification) => notification.relatedEntityId === withCarol.conversationId,
      );

      assert.equal(fromAlice?.status, "read");
      assert.equal(fromCarol?.status, "unread");
    });
  });
});
