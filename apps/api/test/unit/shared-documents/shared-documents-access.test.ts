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
import { deleteAuthUsersByEmailPrefix, findAuthUserByEmail } from "../../../src/modules/auth/auth-user.repository.js";
import { getLastIssuedConfirmationCodeForTests } from "../../../src/modules/email/email-confirmation-code.repository.js";
import { openOrCreateDirectConversation } from "../../../src/modules/direct-messaging/direct-messaging.service.js";
import { deleteDirectConversationsByParticipantIdForTests } from "../../../src/modules/direct-messaging/persistence/direct-messaging.repository.js";
import { upsertAlly, resetInitiativeAlliesStoreForTests } from "../../../src/modules/initiative-discussion-collaboration/initiative-ally.store.js";
import { insertCollaborationSessionDocument, deleteCollaborationSessionDataByInitiativeIdForTests } from "../../../src/modules/initiative-collaboration-sessions/persistence/initiative-collaboration-sessions.repository.js";
import {
  SharedDocumentAccessDeniedError,
  SharedDocumentContextNotFoundError,
} from "../../../src/modules/shared-documents/shared-documents.errors.js";
import { resolveSharedDocumentContextAccess } from "../../../src/modules/shared-documents/shared-documents-access.js";

/**
 * Communication UX Pack 03.7 Part 7/14 — the authorization dispatcher,
 * exercised against the REAL underlying stores (Direct Messaging's Mongo
 * conversations, and the in-memory Initiative store + Mongo-backed Ally
 * store the Collaboration Channel/Sessions authorization already relies
 * on). The Shared Documents *service* itself is tested MongoDB-free via
 * injected fakes (`shared-documents-service.test.ts`); this file exists
 * specifically to de-risk the dispatch/error-mapping glue this pack adds
 * on top of those already-tested resolvers.
 */

process.env.INITIATIVE_PERSISTENCE = "memory";

const TEST_PREFIX = `shdoc-access-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
const createdAuthUserIds: string[] = [];
const createdParticipantIds: string[] = [];

async function registerParticipant(label: string): Promise<{ userId: string; participantId: string }> {
  const email = `${TEST_PREFIX}-${label}@shared-documents.test`;
  await registerAuthUser({ email, password: "Password123!", displayName: `Fixture ${label}` });

  const user = (await findAuthUserByEmail(email)) as AuthUserRecord;
  assert.ok(user, `expected auth user to exist for ${email}`);
  createdAuthUserIds.push(user.userId);
  createdParticipantIds.push(user.memberId);

  const code = getLastIssuedConfirmationCodeForTests(user.userId);
  assert.ok(code, "expected a confirmation code to have been issued");
  await confirmRegistrationEmailCode({ userId: user.userId, code: code! });

  return { userId: user.userId, participantId: user.memberId };
}

const INITIATIVE_ID = `${TEST_PREFIX}-initiative`;
const SESSION_ID = `${TEST_PREFIX}-session`;
let authorParticipantId = "";
let allyParticipantId = "";
let outsiderParticipantId = "";

describe("Shared Documents context access dispatcher (Part 7/14)", () => {
  before(async () => {
    await connectMongoClient();
    await ensureMongoIndexes();

    const { createInitiative } = await import("../../../src/modules/initiatives/initiative.store.js");
    const author = await registerParticipant("author");
    const ally = await registerParticipant("ally");
    const outsider = await registerParticipant("outsider");
    authorParticipantId = author.participantId;
    allyParticipantId = ally.participantId;
    outsiderParticipantId = outsider.participantId;

    const now = new Date().toISOString();
    createInitiative({
      initiativeId: INITIATIVE_ID,
      stewardId: authorParticipantId,
      createdAt: now,
      updatedAt: now,
      title: "Fixture Initiative",
      description: "Fixture description.",
      status: "poll",
      lifecyclePhase: "projected",
      visibility: { policy: "public" },
      metadata: {
        category: "environment",
        tags: [],
        region: "Global",
        language: "en",
        communitySlug: "test-community",
        activityArea: "Environment",
      },
      revisions: [],
      contributions: [],
      timeline: [],
    });

    await upsertAlly({
      initiativeId: INITIATIVE_ID,
      participantId: allyParticipantId,
      status: "active",
      requestedByParticipantId: allyParticipantId,
      createdAt: now,
      updatedAt: now,
    });

    await insertCollaborationSessionDocument({
      sessionId: SESSION_ID,
      initiativeId: INITIATIVE_ID,
      title: "Fixture session",
      meetingDate: "2099-01-01",
      meetingTime: "10:00",
      timezone: "UTC",
      estimatedDurationMinutes: 30,
      scheduledAtUtc: "2099-01-01T10:00:00.000Z",
      createdByParticipantId: authorParticipantId,
      createdAt: now,
      updatedAt: now,
    });
  });

  after(async () => {
    await resetInitiativeAlliesStoreForTests(INITIATIVE_ID);
    await deleteCollaborationSessionDataByInitiativeIdForTests(INITIATIVE_ID);
    for (const participantId of createdParticipantIds) {
      await deleteDirectConversationsByParticipantIdForTests(participantId);
    }
    await deleteAuthUsersByEmailPrefix(`${TEST_PREFIX}-`);
    await disconnectMongoClient();
  });

  it("Direct Conversation — grants both participants, denies an outsider, 404s an unknown conversationId", async () => {
    const conversation = await openOrCreateDirectConversation(authorParticipantId, { participantId: allyParticipantId });

    const asAuthor = await resolveSharedDocumentContextAccess(
      { contextType: "direct_conversation", conversationId: conversation.conversationId },
      authorParticipantId,
    );
    assert.deepEqual(asAuthor.otherParticipantIds, [allyParticipantId]);
    assert.equal(asAuthor.relatedUrl, `/workspace/messages/${conversation.conversationId}`);

    await assert.rejects(
      () =>
        resolveSharedDocumentContextAccess(
          { contextType: "direct_conversation", conversationId: conversation.conversationId },
          outsiderParticipantId,
        ),
      SharedDocumentAccessDeniedError,
    );

    await assert.rejects(
      () =>
        resolveSharedDocumentContextAccess(
          { contextType: "direct_conversation", conversationId: "direct-conversation:does-not-exist" },
          authorParticipantId,
        ),
      SharedDocumentContextNotFoundError,
    );
  });

  it("Collaboration Channel — grants Author and Active Ally, denies an outsider, computes otherParticipantIds correctly", async () => {
    const asAuthor = await resolveSharedDocumentContextAccess(
      { contextType: "collaboration_channel", initiativeId: INITIATIVE_ID },
      authorParticipantId,
    );
    assert.deepEqual(asAuthor.otherParticipantIds, [allyParticipantId]);
    assert.equal(
      asAuthor.relatedUrl,
      `/workspace/messages?mode=initiative&initiativeId=${INITIATIVE_ID}&section=channel`,
    );

    const asAlly = await resolveSharedDocumentContextAccess(
      { contextType: "collaboration_channel", initiativeId: INITIATIVE_ID },
      allyParticipantId,
    );
    assert.deepEqual(asAlly.otherParticipantIds, [authorParticipantId]);

    await assert.rejects(
      () =>
        resolveSharedDocumentContextAccess(
          { contextType: "collaboration_channel", initiativeId: INITIATIVE_ID },
          outsiderParticipantId,
        ),
      SharedDocumentAccessDeniedError,
    );

    await assert.rejects(
      () => resolveSharedDocumentContextAccess({ contextType: "collaboration_channel", initiativeId: "missing" }, authorParticipantId),
      SharedDocumentContextNotFoundError,
    );
  });

  it("Collaboration Session — same Author/Active-Ally boundary as the Channel, plus a real sessionId existence check", async () => {
    const asAuthor = await resolveSharedDocumentContextAccess(
      { contextType: "collaboration_session", initiativeId: INITIATIVE_ID, sessionId: SESSION_ID },
      authorParticipantId,
    );
    assert.deepEqual(asAuthor.otherParticipantIds, [allyParticipantId]);
    assert.equal(
      asAuthor.relatedUrl,
      `/workspace/messages?mode=initiative&initiativeId=${INITIATIVE_ID}&section=sessions`,
    );

    await assert.rejects(
      () =>
        resolveSharedDocumentContextAccess(
          { contextType: "collaboration_session", initiativeId: INITIATIVE_ID, sessionId: SESSION_ID },
          outsiderParticipantId,
        ),
      SharedDocumentAccessDeniedError,
    );

    await assert.rejects(
      () =>
        resolveSharedDocumentContextAccess(
          { contextType: "collaboration_session", initiativeId: INITIATIVE_ID, sessionId: "missing-session" },
          authorParticipantId,
        ),
      SharedDocumentContextNotFoundError,
    );
  });
});
