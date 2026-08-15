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
import { listUnreadDirectMessageSenderParticipantIds } from "../../../src/modules/direct-messaging/direct-messaging.projection.js";
import {
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
import { createTestId, isMongoAvailableForTests, skipIfMongoUnavailable } from "../../helpers/test-env.js";

/**
 * Communication UX Pack 03.2 Part 4/5 — `listUnreadDirectMessageSenderParticipantIds`
 * is the single batch query behind the Workspace Allies unread marker. It
 * must reuse the exact same durable Direct Messaging read state the
 * Workspace Messages conversation list's `unread` field already uses
 * (never a second/new definition), and must be safe to call once per
 * Workspace Home load regardless of how many conversations exist.
 */

if (!isMongoAvailableForTests()) {
  skipIfMongoUnavailable();
}

const TEST_PREFIX = createTestId("dm-unread-participants");
const createdAuthUserIds: string[] = [];
const createdParticipantIds: string[] = [];

interface TestParticipant {
  userId: string;
  participantId: string;
  publicName: string;
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

  return { userId: user.userId, participantId: user.memberId, publicName: profile!.publicName };
}

async function setMessagingPolicy(userId: string, messagingPolicy: "registered_participants"): Promise<void> {
  await updateMemberProfilePrivacyForUser(userId, { messagingPolicy });
}

describe("listUnreadDirectMessageSenderParticipantIds (Communication UX Pack 03.2 Part 4/5)", () => {
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

  it("includes the sender of an unread message", async () => {
    const alice = await registerParticipant("unread-a");
    const bob = await registerParticipant("unread-b");
    await setMessagingPolicy(bob.userId, "registered_participants");
    const conversation = await openOrCreateDirectConversation(alice.participantId, bob.publicName);

    await sendDirectMessage({
      conversationId: conversation.conversationId,
      senderParticipantId: alice.participantId,
      text: "You have an unread message now.",
    });

    const unreadForBob = await listUnreadDirectMessageSenderParticipantIds(bob.participantId);
    assert.ok(unreadForBob.has(alice.participantId));
  });

  it("never includes the sender's own view of their own message", async () => {
    const alice = await registerParticipant("own-a");
    const bob = await registerParticipant("own-b");
    await setMessagingPolicy(bob.userId, "registered_participants");
    const conversation = await openOrCreateDirectConversation(alice.participantId, bob.publicName);

    await sendDirectMessage({
      conversationId: conversation.conversationId,
      senderParticipantId: alice.participantId,
      text: "Alice sent this, so Alice must never see her own unread marker.",
    });

    const unreadForAlice = await listUnreadDirectMessageSenderParticipantIds(alice.participantId);
    assert.equal(unreadForAlice.has(bob.participantId), false);
  });

  it("clears once the conversation is marked read, and stays cleared", async () => {
    const alice = await registerParticipant("clear-a");
    const bob = await registerParticipant("clear-b");
    await setMessagingPolicy(bob.userId, "registered_participants");
    const conversation = await openOrCreateDirectConversation(alice.participantId, bob.publicName);

    await sendDirectMessage({
      conversationId: conversation.conversationId,
      senderParticipantId: alice.participantId,
      text: "Please read this.",
    });

    assert.ok((await listUnreadDirectMessageSenderParticipantIds(bob.participantId)).has(alice.participantId));

    await markDirectConversationRead(conversation.conversationId, bob.participantId);

    const unreadAfterRead = await listUnreadDirectMessageSenderParticipantIds(bob.participantId);
    assert.equal(unreadAfterRead.has(alice.participantId), false);
  });

  it("only includes Participants with an actual unread conversation, never an unrelated one", async () => {
    const alice = await registerParticipant("scoped-a");
    const bob = await registerParticipant("scoped-b");
    const carol = await registerParticipant("scoped-c");
    await setMessagingPolicy(bob.userId, "registered_participants");
    await setMessagingPolicy(carol.userId, "registered_participants");

    const conversationWithBob = await openOrCreateDirectConversation(alice.participantId, bob.publicName);
    await openOrCreateDirectConversation(alice.participantId, carol.publicName);

    await sendDirectMessage({
      conversationId: conversationWithBob.conversationId,
      senderParticipantId: bob.participantId,
      text: "Only this conversation has an unread message for Alice.",
    });

    const unreadForAlice = await listUnreadDirectMessageSenderParticipantIds(alice.participantId);
    assert.deepEqual([...unreadForAlice], [bob.participantId]);
  });

  it("returns an empty set for a Participant with no conversations at all", async () => {
    const solo = await registerParticipant("solo");

    const unread = await listUnreadDirectMessageSenderParticipantIds(solo.participantId);
    assert.equal(unread.size, 0);
  });
});
