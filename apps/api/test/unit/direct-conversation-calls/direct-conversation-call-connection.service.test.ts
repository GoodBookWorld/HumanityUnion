import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { TokenVerifier } from "livekit-server-sdk";

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
  assertLiveKitDeploymentBoundary,
  resolveLiveKitConfig,
} from "../../../src/config/livekit.config.js";
import {
  DirectConversationCallExpiredError,
  DirectConversationCallNotFoundError,
  DirectConversationCallTransitionError,
  LiveKitConfigurationError,
  acceptDirectConversationCall,
  clearDirectConversationCallCreateRateLimitForTests,
  createDirectConversationCall,
  declineDirectConversationCall,
  deleteDirectConversationCallsByConversationIdForTests,
  endDirectConversationCall,
  getCurrentDirectConversationCall,
  insertDirectConversationCall,
  issueDirectConversationCallConnection,
  listDirectConversationCallHistory,
  setDirectConversationCallCreateRateLimitForTests,
  setDirectConversationCallInvitationTtlMsForTests,
  setLiveKitRoomDeleterForTests,
} from "../../../src/modules/direct-conversation-calls/index.js";
import { DirectMessagingAccessDeniedError } from "../../../src/modules/direct-messaging/direct-messaging.errors.js";
import { openOrCreateDirectConversation } from "../../../src/modules/direct-messaging/direct-messaging.service.js";
import { deleteDirectConversationsByParticipantIdForTests } from "../../../src/modules/direct-messaging/persistence/direct-messaging.repository.js";
import {
  deleteMemberProfilesByUserIdPrefix,
  findMemberProfileByUserId,
} from "../../../src/modules/member-profile/member-profile.repository.js";
import { updateMemberProfilePrivacyForUser } from "../../../src/modules/member-profile/member-profile.service.js";
import { createTestId, isMongoAvailableForTests } from "../../helpers/test-env.js";

const LIVEKIT_KEY = "test-livekit-key";
const LIVEKIT_SECRET = "test-livekit-secret-value";
const LIVEKIT_URL = "wss://livekit.invalid";
const routesPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../src/modules/direct-conversation-calls/direct-conversation-call.routes.ts",
);

function withPlatformMode(mode: string, run: () => void): void {
  const previous = process.env.PLATFORM_MODE;
  process.env.PLATFORM_MODE = mode;
  try {
    run();
  } finally {
    if (previous === undefined) {
      delete process.env.PLATFORM_MODE;
    } else {
      process.env.PLATFORM_MODE = previous;
    }
  }
}

describe("LiveKit configuration contract", () => {
  it("N — missing LiveKit configuration fails closed without revealing a secret", () => {
    const previous = {
      key: process.env.LIVEKIT_API_KEY,
      secret: process.env.LIVEKIT_API_SECRET,
      url: process.env.LIVEKIT_URL,
    };
    process.env.LIVEKIT_API_SECRET = LIVEKIT_SECRET;
    delete process.env.LIVEKIT_API_KEY;
    delete process.env.LIVEKIT_URL;

    try {
      assert.throws(() => resolveLiveKitConfig(), (error: unknown) => {
        assert.ok(error instanceof LiveKitConfigurationError);
        assert.equal(error.message.includes(LIVEKIT_SECRET), false);
        return true;
      });
    } finally {
      restoreEnv(previous);
    }
  });

  it("rejects non-wss URLs, the public R2 host, and cross-deployment web hosts", () => {
    assert.throws(
      () => assertLiveKitDeploymentBoundary(new URL("https://livekit.invalid")),
      LiveKitConfigurationError,
    );
    assert.throws(
      () => assertLiveKitDeploymentBoundary(new URL("wss://media-staging.huws.org")),
      LiveKitConfigurationError,
    );
    withPlatformMode("staging", () => {
      assert.throws(
        () => assertLiveKitDeploymentBoundary(new URL("wss://huws.org")),
        LiveKitConfigurationError,
      );
      assert.throws(
        () => assertLiveKitDeploymentBoundary(new URL("wss://api.huws.org")),
        LiveKitConfigurationError,
      );
      assert.doesNotThrow(() => assertLiveKitDeploymentBoundary(new URL(LIVEKIT_URL)));
    });
    withPlatformMode("production", () => {
      assert.throws(
        () => assertLiveKitDeploymentBoundary(new URL("wss://staging.huws.org")),
        LiveKitConfigurationError,
      );
      assert.throws(
        () => assertLiveKitDeploymentBoundary(new URL("wss://api-staging.huws.org")),
        LiveKitConfigurationError,
      );
      assert.doesNotThrow(() => assertLiveKitDeploymentBoundary(new URL(LIVEKIT_URL)));
    });
  });

  it("K/L — the connection route does not read a request body", () => {
    const source = readFileSync(routesPath, "utf8");
    const connection = source.slice(source.indexOf('"/connection"'));
    assert.ok(connection.length > 0);
    assert.equal(connection.includes("req.body"), false);
  });
});

function restoreEnv(previous: { key?: string; secret?: string; url?: string }): void {
  if (previous.key === undefined) {
    delete process.env.LIVEKIT_API_KEY;
  } else {
    process.env.LIVEKIT_API_KEY = previous.key;
  }
  if (previous.secret === undefined) {
    delete process.env.LIVEKIT_API_SECRET;
  } else {
    process.env.LIVEKIT_API_SECRET = previous.secret;
  }
  if (previous.url === undefined) {
    delete process.env.LIVEKIT_URL;
  } else {
    process.env.LIVEKIT_URL = previous.url;
  }
}

function installLiveKitEnv(): { key?: string; secret?: string; url?: string } {
  const previous = {
    key: process.env.LIVEKIT_API_KEY,
    secret: process.env.LIVEKIT_API_SECRET,
    url: process.env.LIVEKIT_URL,
  };
  process.env.LIVEKIT_API_KEY = LIVEKIT_KEY;
  process.env.LIVEKIT_API_SECRET = LIVEKIT_SECRET;
  process.env.LIVEKIT_URL = LIVEKIT_URL;
  return previous;
}

const TEST_PREFIX = createTestId("lk-call");
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

async function openConversation(label: string): Promise<{
  alice: TestParticipant;
  bob: TestParticipant;
  conversationId: string;
}> {
  const alice = await registerParticipant(`${label}-a`);
  const bob = await registerParticipant(`${label}-b`);
  await updateMemberProfilePrivacyForUser(bob.userId, { messagingPolicy: "registered_participants" });
  const conversation = await openOrCreateDirectConversation(alice.participantId, bob.publicName);
  createdConversationIds.push(conversation.conversationId);
  return { alice, bob, conversationId: conversation.conversationId };
}

async function acceptCall(label: string): Promise<{
  alice: TestParticipant;
  bob: TestParticipant;
  conversationId: string;
  callId: string;
}> {
  const { alice, bob, conversationId } = await openConversation(label);
  const call = await createDirectConversationCall({
    conversationId,
    initiatorParticipantId: alice.participantId,
  });
  await acceptDirectConversationCall({
    conversationId,
    callId: call.callId,
    participantId: bob.participantId,
  });
  return { alice, bob, conversationId, callId: call.callId };
}

describe("Direct Conversation call connection (VC-04B.1)", { concurrency: 1, skip: !isMongoAvailableForTests() }, () => {
  let previousEnv: { key?: string; secret?: string; url?: string };

  before(async () => {
    previousEnv = installLiveKitEnv();
    setDirectConversationCallCreateRateLimitForTests({ maxAttempts: 40, windowMs: 60_000 });
    setLiveKitRoomDeleterForTests(async () => undefined);
    await connectMongoClient();
    await ensureMongoIndexes();
  });

  after(async () => {
    setLiveKitRoomDeleterForTests(null);
    setDirectConversationCallInvitationTtlMsForTests(null);
    clearDirectConversationCallCreateRateLimitForTests();
    restoreEnv(previousEnv);
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

  it("A/I/J/M/O/P — an accepted member receives a room-scoped token", async () => {
    const { alice, conversationId, callId } = await acceptCall("accepted");
    const connection = await issueDirectConversationCallConnection({
      conversationId,
      callId,
      participantId: alice.participantId,
    });

    assert.equal(connection.url, LIVEKIT_URL);
    assert.equal(connection.token.includes(LIVEKIT_SECRET), false);
    assert.equal(JSON.stringify(connection).includes(LIVEKIT_SECRET), false);

    const claims = await new TokenVerifier(LIVEKIT_KEY, LIVEKIT_SECRET).verify(connection.token);
    assert.equal(claims.sub, alice.participantId);
    assert.equal(claims.name, undefined);
    assert.equal(claims.video?.room, callId);
    assert.equal(claims.video?.roomJoin, true);
    assert.equal(claims.video?.canPublish, true);
    assert.equal(claims.video?.canSubscribe, true);
    assert.equal(claims.video?.canPublishData, false);
    assert.equal(claims.video?.roomAdmin, false);
    assert.equal(claims.video?.roomRecord, false);
    assert.equal(claims.video?.recorder, false);
    assert.equal(claims.video?.ingressAdmin, false);
    assert.deepEqual(claims.video?.canPublishSources, ["camera", "microphone"]);
    await assert.rejects(
      () => new TokenVerifier(LIVEKIT_KEY, "dev-jwt-access-secret-change-before-production").verify(connection.token),
    );
    await endDirectConversationCall({
      conversationId,
      callId,
      participantId: alice.participantId,
    });
  });

  it("B/C/D/E — invited, declined, ended, and missed calls do not receive a token", async () => {
    const { alice, bob, conversationId } = await openConversation("lifecycle");
    const invited = await createDirectConversationCall({
      conversationId,
      initiatorParticipantId: alice.participantId,
    });
    await assert.rejects(
      () =>
        issueDirectConversationCallConnection({
          conversationId,
          callId: invited.callId,
          participantId: bob.participantId,
        }),
      DirectConversationCallTransitionError,
    );

    await declineDirectConversationCall({
      conversationId,
      callId: invited.callId,
      participantId: bob.participantId,
    });
    await assert.rejects(
      () =>
        issueDirectConversationCallConnection({
          conversationId,
          callId: invited.callId,
          participantId: bob.participantId,
        }),
      DirectConversationCallTransitionError,
    );

    const accepted = await createDirectConversationCall({
      conversationId,
      initiatorParticipantId: alice.participantId,
    });
    await acceptDirectConversationCall({
      conversationId,
      callId: accepted.callId,
      participantId: bob.participantId,
    });
    await endDirectConversationCall({
      conversationId,
      callId: accepted.callId,
      participantId: alice.participantId,
    });
    await assert.rejects(
      () =>
        issueDirectConversationCallConnection({
          conversationId,
          callId: accepted.callId,
          participantId: alice.participantId,
        }),
      DirectConversationCallTransitionError,
    );

    setDirectConversationCallInvitationTtlMsForTests(20);
    try {
      const expiring = await createDirectConversationCall({
        conversationId,
        initiatorParticipantId: alice.participantId,
      });
      await new Promise((resolve) => setTimeout(resolve, 40));
      await assert.rejects(
        () =>
          issueDirectConversationCallConnection({
            conversationId,
            callId: expiring.callId,
            participantId: bob.participantId,
          }),
        DirectConversationCallExpiredError,
      );
    } finally {
      setDirectConversationCallInvitationTtlMsForTests(null);
    }
  });

  it("F/G/H — non-members, outsiders on the call row, and conversation mismatches get no token", async () => {
    const { alice, bob, conversationId, callId } = await acceptCall("authz");
    const charlie = await registerParticipant("charlie");
    await assert.rejects(
      () =>
        issueDirectConversationCallConnection({
          conversationId,
          callId,
          participantId: charlie.participantId,
        }),
      DirectMessagingAccessDeniedError,
    );

    const outsideCallId = `direct-conversation-call-${createTestId("outside")}`;
    await endDirectConversationCall({ conversationId, callId, participantId: alice.participantId });
    const now = new Date().toISOString();
    await insertDirectConversationCall({
      callId: outsideCallId,
      contextType: "direct_conversation",
      conversationId,
      participantIds: [alice.participantId, "participant-outside-pair"],
      initiatorParticipantId: alice.participantId,
      status: "accepted",
      createdAt: now,
      updatedAt: now,
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      acceptedAt: now,
    });
    await assert.rejects(
      () =>
        issueDirectConversationCallConnection({
          conversationId,
          callId: outsideCallId,
          participantId: bob.participantId,
        }),
      DirectConversationCallNotFoundError,
    );

    const carol = await registerParticipant("carol");
    await updateMemberProfilePrivacyForUser(carol.userId, { messagingPolicy: "registered_participants" });
    const other = await openOrCreateDirectConversation(alice.participantId, carol.publicName);
    createdConversationIds.push(other.conversationId);
    await assert.rejects(
      () =>
        issueDirectConversationCallConnection({
          conversationId: other.conversationId,
          callId: outsideCallId,
          participantId: alice.participantId,
        }),
      DirectConversationCallNotFoundError,
    );
  });

  it("N — an accepted call still fails closed when LiveKit config is removed", async () => {
    const { alice, conversationId, callId } = await acceptCall("unconfigured");
    const previous = {
      key: process.env.LIVEKIT_API_KEY,
      secret: process.env.LIVEKIT_API_SECRET,
      url: process.env.LIVEKIT_URL,
    };
    delete process.env.LIVEKIT_API_KEY;
    delete process.env.LIVEKIT_API_SECRET;
    delete process.env.LIVEKIT_URL;
    try {
      await assert.rejects(
        () =>
          issueDirectConversationCallConnection({
            conversationId,
            callId,
            participantId: alice.participantId,
          }),
        LiveKitConfigurationError,
      );
    } finally {
      restoreEnv(previous);
    }
  });

  it("Q — end stays ended when LiveKit room deletion fails", async () => {
    const { alice, conversationId, callId } = await acceptCall("delete-fails");
    setLiveKitRoomDeleterForTests(async () => {
      throw new Error("media host unavailable");
    });
    try {
      const ended = await endDirectConversationCall({
        conversationId,
        callId,
        participantId: alice.participantId,
      });
      assert.equal(ended.status, "ended");
      assert.equal(await getCurrentDirectConversationCall(conversationId, alice.participantId), null);
      const history = await listDirectConversationCallHistory(conversationId, alice.participantId);
      assert.equal(history[0]?.callId, callId);
      assert.equal(history[0]?.status, "ended");
    } finally {
      setLiveKitRoomDeleterForTests(async () => undefined);
    }
  });
});
