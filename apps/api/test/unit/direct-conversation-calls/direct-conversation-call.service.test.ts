import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import type { AuthUserRecord } from "../../../src/modules/auth/auth-user.repository.js";
import {
  connectMongoClient,
  disconnectMongoClient,
} from "../../../src/infrastructure/mongodb/mongo-connection.js";
import { ensureMongoIndexes } from "../../../src/infrastructure/mongodb/mongo-indexes.js";
import { registerAuthUser } from "../../../src/modules/auth/auth.service.js";
import {
  deleteAuthUsersByEmailPrefix,
  findAuthUserByEmail,
} from "../../../src/modules/auth/auth-user.repository.js";
import {
  DirectConversationCallConflictError,
  DirectConversationCallExpiredError,
  DirectConversationCallTransitionError,
  acceptDirectConversationCall,
  clearDirectConversationCallCreateRateLimitForTests,
  createDirectConversationCall,
  declineDirectConversationCall,
  deleteDirectConversationCallsByConversationIdForTests,
  endDirectConversationCall,
  findRawDirectConversationCallDocumentForTests,
  getCurrentDirectConversationCall,
  listDirectConversationCallHistory,
  pruneTerminalDirectConversationCalls,
  setDirectConversationCallCreateRateLimitForTests,
  setDirectConversationCallInvitationTtlMsForTests,
} from "../../../src/modules/direct-conversation-calls/index.js";
import {
  DirectMessagingAccessDeniedError,
  DirectMessagingConversationNotFoundError,
} from "../../../src/modules/direct-messaging/direct-messaging.errors.js";
import { openOrCreateDirectConversation } from "../../../src/modules/direct-messaging/direct-messaging.service.js";
import { deleteDirectConversationsByParticipantIdForTests } from "../../../src/modules/direct-messaging/persistence/direct-messaging.repository.js";
import {
  deleteMemberProfilesByUserIdPrefix,
  findMemberProfileByUserId,
} from "../../../src/modules/member-profile/member-profile.repository.js";
import { updateMemberProfilePrivacyForUser } from "../../../src/modules/member-profile/member-profile.service.js";
import { createTestId, isMongoAvailableForTests, skipIfMongoUnavailable } from "../../helpers/test-env.js";

if (!isMongoAvailableForTests()) {
  skipIfMongoUnavailable();
}

const TEST_PREFIX = createTestId("dc-call");
const createdAuthUserIds: string[] = [];
const createdParticipantIds: string[] = [];
const createdConversationIds: string[] = [];

interface TestParticipant {
  userId: string;
  participantId: string;
  publicName: string;
}

async function registerParticipant(label: string): Promise<TestParticipant> {
  const email = `${TEST_PREFIX}-${label}@direct-conversation-call.test`;
  await registerAuthUser({ email, password: "Password123!", displayName: `Fixture ${label}` });
  const user = (await findAuthUserByEmail(email)) as AuthUserRecord;
  assert.ok(user);
  createdAuthUserIds.push(user.userId);
  createdParticipantIds.push(user.memberId);
  const profile = await findMemberProfileByUserId(user.userId);
  assert.ok(profile);
  return { userId: user.userId, participantId: user.memberId, publicName: profile!.publicName };
}

async function openConversation(): Promise<{
  alice: TestParticipant;
  bob: TestParticipant;
  conversationId: string;
}> {
  const alice = await registerParticipant(`a-${createdParticipantIds.length}`);
  const bob = await registerParticipant(`b-${createdParticipantIds.length}`);
  await updateMemberProfilePrivacyForUser(bob.userId, { messagingPolicy: "registered_participants" });
  const conversation = await openOrCreateDirectConversation(alice.participantId, bob.publicName);
  createdConversationIds.push(conversation.conversationId);
  return { alice, bob, conversationId: conversation.conversationId };
}

describe("Direct Conversation calls (VC-03)", { concurrency: 1 }, () => {
  before(async () => {
    await connectMongoClient();
    await ensureMongoIndexes();
    setDirectConversationCallCreateRateLimitForTests({ maxAttempts: 50, windowMs: 60_000 });
  });

  after(async () => {
    setDirectConversationCallInvitationTtlMsForTests(null);
    clearDirectConversationCallCreateRateLimitForTests();
    for (const conversationId of createdConversationIds) {
      await deleteDirectConversationCallsByConversationIdForTests(conversationId);
    }
    for (const participantId of createdParticipantIds) {
      await deleteDirectConversationsByParticipantIdForTests(participantId);
    }
    for (const userId of createdAuthUserIds) {
      await deleteMemberProfilesByUserIdPrefix(userId);
    }
    await deleteAuthUsersByEmailPrefix(`${TEST_PREFIX}-`);
    await disconnectMongoClient();
  });

  it("A/B — a member creates a call whose pair is the conversation pair", async () => {
    const { alice, bob, conversationId } = await openConversation();
    const call = await createDirectConversationCall({
      conversationId,
      initiatorParticipantId: alice.participantId,
    });

    assert.match(call.callId, /^direct-conversation-call-[0-9a-f-]{36}$/);
    assert.equal(call.callId.includes(conversationId), false);
    assert.equal(call.contextType, "direct_conversation");
    assert.equal(call.conversationId, conversationId);
    assert.equal(call.initiatorParticipantId, alice.participantId);
    assert.equal(call.status, "invited");
    assert.deepEqual([...call.participantIds].sort(), [alice.participantId, bob.participantId].sort());
    assert.equal("peerParticipantId" in call, false);
    await declineDirectConversationCall({
      conversationId,
      callId: call.callId,
      participantId: bob.participantId,
    });
  });

  it("C — a non-member cannot inspect or mutate the call", async () => {
    const { alice, bob, conversationId } = await openConversation();
    const charlie = await registerParticipant("charlie");
    const call = await createDirectConversationCall({
      conversationId,
      initiatorParticipantId: alice.participantId,
    });

    await assert.rejects(
      () => getCurrentDirectConversationCall(conversationId, charlie.participantId),
      DirectMessagingAccessDeniedError,
    );
    await assert.rejects(
      () => listDirectConversationCallHistory(conversationId, charlie.participantId),
      DirectMessagingAccessDeniedError,
    );
    await assert.rejects(
      () =>
        createDirectConversationCall({
          conversationId,
          initiatorParticipantId: charlie.participantId,
        }),
      DirectMessagingAccessDeniedError,
    );
    await assert.rejects(
      () =>
        acceptDirectConversationCall({
          conversationId,
          callId: call.callId,
          participantId: charlie.participantId,
        }),
      DirectMessagingAccessDeniedError,
    );
    await assert.rejects(
      () =>
        declineDirectConversationCall({
          conversationId,
          callId: call.callId,
          participantId: charlie.participantId,
        }),
      DirectMessagingAccessDeniedError,
    );
    await assert.rejects(
      () =>
        endDirectConversationCall({
          conversationId,
          callId: call.callId,
          participantId: charlie.participantId,
        }),
      DirectMessagingAccessDeniedError,
    );
    await assert.rejects(
      () => getCurrentDirectConversationCall("direct-conversation:missing::pair", alice.participantId),
      DirectMessagingConversationNotFoundError,
    );

    await declineDirectConversationCall({
      conversationId,
      callId: call.callId,
      participantId: bob.participantId,
    });
  });

  it("D/E/F/G/H — accept, decline, end, and invalid transitions", async () => {
    const { alice, bob, conversationId } = await openConversation();
    const invited = await createDirectConversationCall({
      conversationId,
      initiatorParticipantId: alice.participantId,
    });

    await assert.rejects(
      () =>
        acceptDirectConversationCall({
          conversationId,
          callId: invited.callId,
          participantId: alice.participantId,
        }),
      DirectConversationCallTransitionError,
    );
    await assert.rejects(
      () =>
        endDirectConversationCall({
          conversationId,
          callId: invited.callId,
          participantId: alice.participantId,
        }),
      DirectConversationCallTransitionError,
    );
    await assert.rejects(
      () =>
        declineDirectConversationCall({
          conversationId,
          callId: invited.callId,
          participantId: alice.participantId,
        }),
      DirectConversationCallTransitionError,
    );

    const declined = await declineDirectConversationCall({
      conversationId,
      callId: invited.callId,
      participantId: bob.participantId,
    });
    assert.equal(declined.status, "declined");
    await assert.rejects(
      () =>
        acceptDirectConversationCall({
          conversationId,
          callId: invited.callId,
          participantId: bob.participantId,
        }),
      DirectConversationCallTransitionError,
    );

    const second = await createDirectConversationCall({
      conversationId,
      initiatorParticipantId: alice.participantId,
    });
    const accepted = await acceptDirectConversationCall({
      conversationId,
      callId: second.callId,
      participantId: bob.participantId,
    });
    assert.equal(accepted.status, "accepted");
    assert.equal(typeof accepted.acceptedAt, "string");
    await assert.rejects(
      () =>
        declineDirectConversationCall({
          conversationId,
          callId: second.callId,
          participantId: bob.participantId,
        }),
      DirectConversationCallTransitionError,
    );

    const endedByInitiator = await endDirectConversationCall({
      conversationId,
      callId: second.callId,
      participantId: alice.participantId,
    });
    assert.equal(endedByInitiator.status, "ended");
    assert.equal(typeof endedByInitiator.durationMs, "number");

    const third = await createDirectConversationCall({
      conversationId,
      initiatorParticipantId: bob.participantId,
    });
    await acceptDirectConversationCall({
      conversationId,
      callId: third.callId,
      participantId: alice.participantId,
    });
    const endedByPeer = await endDirectConversationCall({
      conversationId,
      callId: third.callId,
      participantId: alice.participantId,
    });
    assert.equal(endedByPeer.status, "ended");
    assert.equal(endedByPeer.initiatorParticipantId, bob.participantId);
  });

  it("I/J — an overdue invitation cannot be accepted and becomes missed", async () => {
    const { alice, bob, conversationId } = await openConversation();
    setDirectConversationCallInvitationTtlMsForTests(30);
    try {
      const call = await createDirectConversationCall({
        conversationId,
        initiatorParticipantId: alice.participantId,
      });
      await new Promise((resolve) => setTimeout(resolve, 50));

      await assert.rejects(
        () =>
          acceptDirectConversationCall({
            conversationId,
            callId: call.callId,
            participantId: bob.participantId,
          }),
        DirectConversationCallExpiredError,
      );

      const current = await getCurrentDirectConversationCall(conversationId, alice.participantId);
      assert.equal(current, null);
      const history = await listDirectConversationCallHistory(conversationId, bob.participantId);
      assert.equal(history[0]?.callId, call.callId);
      assert.equal(history[0]?.status, "missed");
    } finally {
      setDirectConversationCallInvitationTtlMsForTests(null);
    }
  });

  it("K — two concurrent creates leave one non-terminal call", async () => {
    const { alice, bob, conversationId } = await openConversation();
    const results = await Promise.allSettled([
      createDirectConversationCall({
        conversationId,
        initiatorParticipantId: alice.participantId,
      }),
      createDirectConversationCall({
        conversationId,
        initiatorParticipantId: bob.participantId,
      }),
    ]);

    const fulfilled = results.filter((result) => result.status === "fulfilled");
    const rejected = results.filter((result) => result.status === "rejected");
    assert.equal(fulfilled.length, 1);
    assert.equal(rejected.length, 1);
    assert.ok(rejected[0]?.status === "rejected");
    assert.ok(rejected[0].reason instanceof DirectConversationCallConflictError);

    const current = await getCurrentDirectConversationCall(conversationId, alice.participantId);
    assert.ok(current);
    assert.equal(current?.status, "invited");
    await declineDirectConversationCall({
      conversationId,
      callId: current!.callId,
      participantId: current!.initiatorParticipantId === alice.participantId
        ? bob.participantId
        : alice.participantId,
    });
  });

  it("L/M/N — latest 20, prune keeps the live row, and media fields are absent", async () => {
    const { alice, bob, conversationId } = await openConversation();
    const createdIds: string[] = [];

    for (let index = 0; index < 21; index += 1) {
      const call = await createDirectConversationCall({
        conversationId,
        initiatorParticipantId: alice.participantId,
      });
      createdIds.push(call.callId);
      await declineDirectConversationCall({
        conversationId,
        callId: call.callId,
        participantId: bob.participantId,
      });
    }

    const history = await listDirectConversationCallHistory(conversationId, alice.participantId);
    assert.equal(history.length, 20);
    assert.equal(history.some((call) => call.callId === createdIds[0]), false);
    assert.equal(history[0]?.callId, createdIds[20]);
    for (let index = 1; index < history.length; index += 1) {
      assert.ok(history[index - 1]!.createdAt >= history[index]!.createdAt);
    }

    const live = await createDirectConversationCall({
      conversationId,
      initiatorParticipantId: alice.participantId,
    });
    await pruneTerminalDirectConversationCalls(conversationId);
    const current = await getCurrentDirectConversationCall(conversationId, bob.participantId);
    assert.equal(current?.callId, live.callId);
    assert.equal(current?.status, "invited");
    const historyWhileLive = await listDirectConversationCallHistory(conversationId, alice.participantId);
    assert.equal(historyWhileLive.length, 20);
    assert.equal(historyWhileLive.some((call) => call.callId === live.callId), false);

    const raw = await findRawDirectConversationCallDocumentForTests(live.callId);
    assert.ok(raw);
    const keys = Object.keys(raw!).filter((key) => key !== "_id");
    assert.deepEqual(keys.sort(), [
      "callId",
      "contextType",
      "conversationId",
      "createdAt",
      "expiresAt",
      "initiatorParticipantId",
      "participantIds",
      "status",
      "updatedAt",
    ]);

    await declineDirectConversationCall({
      conversationId,
      callId: live.callId,
      participantId: bob.participantId,
    });
    const afterPrune = await listDirectConversationCallHistory(conversationId, alice.participantId);
    assert.equal(afterPrune.length, 20);
    assert.equal(afterPrune[0]?.callId, live.callId);
    assert.equal(await getCurrentDirectConversationCall(conversationId, alice.participantId), null);
  });
});
