import assert from "node:assert/strict";
import http from "node:http";
import { after, afterEach, before, beforeEach, describe, it } from "node:test";

import express from "express";

import { registerAuthUser } from "../../src/modules/auth/auth.service.js";
import { confirmRegistrationEmailCode } from "../../src/modules/auth/auth-email-confirmation.service.js";
import { deleteAuthUsersByEmailPrefix, findAuthUserByEmail } from "../../src/modules/auth/auth-user.repository.js";
import { getLastIssuedConfirmationCodeForTests } from "../../src/modules/email/email-confirmation-code.repository.js";
import { resetSmtpTransportForTests } from "../../src/modules/email/smtp-transport.js";
import { deserializeDomainEventEnvelope } from "../../src/infrastructure/events/event-serialization.js";
import { CATALOGUE_EVENTS } from "../../src/infrastructure/events/catalogue-events.js";
import {
  connectMongoClient,
  disconnectMongoClient,
} from "../../src/infrastructure/mongodb/mongo-connection.js";
import { ensureMongoIndexes } from "../../src/infrastructure/mongodb/mongo-indexes.js";
import { MONGO_COLLECTIONS } from "../../src/infrastructure/mongodb/mongo-collections.js";
import { getMongoCollection } from "../../src/infrastructure/mongodb/mongo-database.js";
import {
  deleteOutboxRecordsByEventIdPrefix,
  deleteProcessedEventsByEventIdPrefix,
  setForceEnqueueFailureForTests,
} from "../../src/infrastructure/outbox/index.js";
import { deleteMembersByMemberIdPrefix } from "../../src/modules/member/infrastructure/member.repository.js";
import {
  createActivity,
  deleteActivitiesByActivityIdPrefix,
  deleteActivitiesByCreatorMemberIdPrefix,
} from "../../src/modules/activity/index.js";
import {
  createDiscussion,
  deleteDiscussionsByCreatorMemberIdPrefix,
  deleteDiscussionsByDiscussionIdPrefix,
} from "../../src/modules/discussion/index.js";
import proposalRouter from "../../src/modules/proposal/api/proposal.routes.js";
import {
  countProposals,
  createProposal,
  deleteProposalsByCreatorMemberIdPrefix,
  deleteProposalsByProposalIdPrefix,
} from "../../src/modules/proposal/index.js";
import { buildProposalCreatedEventId } from "../../src/modules/proposal/domain/proposal-created.event.js";
import { createTestId, isMongoAvailableForTests, skipIfMongoUnavailable } from "../helpers/test-env.js";
import { resetEventInfrastructureForTests } from "../helpers/test-events.js";

if (!isMongoAvailableForTests()) {
  skipIfMongoUnavailable();
}

const TEST_PREFIX = createTestId("proposal-create");

const ACTIVITY_BODY = {
  title: "Community Water Quality Review",
  description: "A civic participation activity to review local water quality reporting.",
  activityType: "civic_participation",
  visibility: "public",
};

const DISCUSSION_BODY = {
  title: "Water Quality Discussion",
  openingMessage: "Let's review the latest water quality reporting together.",
};

const PROPOSAL_BODY = {
  title: "Water Quality Proposal",
  summary: "A structured proposal to improve local water quality reporting.",
  proposalText:
    "This proposal recommends coordinated review of municipal water quality disclosures with community oversight.",
};

function createTestEmail(suffix: string): string {
  return `${TEST_PREFIX}-${suffix}@proposal-create.test`;
}

async function registerAndConfirm(displayName: string, suffix: string) {
  const email = createTestEmail(suffix);
  await registerAuthUser({ email, password: "Password123!", displayName });
  const user = await findAuthUserByEmail(email);
  assert.ok(user);
  const code = getLastIssuedConfirmationCodeForTests(user.userId);
  assert.ok(code);
  const session = await confirmRegistrationEmailCode({ userId: user.userId, code });
  return { user, session };
}

function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/v1/proposals", proposalRouter);
  return app;
}

async function requestProposal(
  method: "GET" | "POST",
  path: string,
  accessToken: string | null,
  body?: Record<string, unknown>,
): Promise<{ status: number; body: Record<string, unknown> }> {
  const app = createTestApp();
  const server = http.createServer(app);

  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve());
  });

  const address = server.address();

  if (!address || typeof address === "string") {
    throw new Error("Failed to bind HTTP test server.");
  }

  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (accessToken) {
      headers.Authorization = `Bearer ${accessToken}`;
    }

    const response = await fetch(`http://127.0.0.1:${address.port}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    return {
      status: response.status,
      body: (await response.json()) as Record<string, unknown>,
    };
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });
  }
}

async function seedActivityAndDiscussion(user: { memberId: string; userId: string }) {
  const activity = await createActivity({
    creatorMemberId: user.memberId,
    actorId: user.userId,
    command: ACTIVITY_BODY,
  });

  const discussion = await createDiscussion({
    creatorMemberId: user.memberId,
    actorId: user.userId,
    command: {
      ...DISCUSSION_BODY,
      activityId: activity.activity.activityId,
    },
  });

  return {
    activityId: activity.activity.activityId,
    discussionId: discussion.discussion.discussionId,
  };
}

describe("CreateProposal integration", () => {
  before(async () => {
    resetEventInfrastructureForTests();
    await connectMongoClient();
    await ensureMongoIndexes();
  });

  beforeEach(() => {
    resetEventInfrastructureForTests();
  });

  afterEach(() => {
    setForceEnqueueFailureForTests(false);
  });

  after(async () => {
    setForceEnqueueFailureForTests(false);
    resetEventInfrastructureForTests();
    await deleteOutboxRecordsByEventIdPrefix("proposal-created:");
    await deleteOutboxRecordsByEventIdPrefix("discussion-created:");
    await deleteOutboxRecordsByEventIdPrefix("activity-created:");
    await deleteProcessedEventsByEventIdPrefix("proposal-created:");
    await deleteProcessedEventsByEventIdPrefix("discussion-created:");
    await deleteProcessedEventsByEventIdPrefix("activity-created:");
    await deleteProposalsByProposalIdPrefix(TEST_PREFIX);
    await deleteProposalsByCreatorMemberIdPrefix(TEST_PREFIX);
    await deleteDiscussionsByDiscussionIdPrefix(TEST_PREFIX);
    await deleteDiscussionsByCreatorMemberIdPrefix(TEST_PREFIX);
    await deleteActivitiesByActivityIdPrefix(TEST_PREFIX);
    await deleteActivitiesByCreatorMemberIdPrefix(TEST_PREFIX);
    await deleteMembersByMemberIdPrefix(TEST_PREFIX);
    await deleteAuthUsersByEmailPrefix(`${TEST_PREFIX}-`);
    resetSmtpTransportForTests();
    await disconnectMongoClient();
  });

  it("persists Proposal and ProposalCreated outbox record transactionally", async () => {
    const { user, session } = await registerAndConfirm("Proposal Creator", "success");
    const { activityId, discussionId } = await seedActivityAndDiscussion(user);

    const response = await requestProposal("POST", "/api/v1/proposals", session.tokens.accessToken, {
      ...PROPOSAL_BODY,
      activityId,
      discussionId,
    });

    assert.equal(response.status, 201);
    assert.equal(response.body.success, true);

    const proposal = response.body.data as Record<string, unknown>;
    assert.equal(typeof proposal.proposalId, "string");
    assert.equal(proposal.activityId, activityId);
    assert.equal(proposal.discussionId, discussionId);
    assert.equal(proposal.creatorMemberId, user.memberId);
    assert.equal(proposal.title, PROPOSAL_BODY.title);
    assert.equal(proposal.status, "draft");
    assert.equal(proposal.aggregateVersion, 1);
    assert.equal("_id" in proposal, false);
    assert.equal("initiativeId" in proposal, false);

    assert.equal(await countProposals({ creatorMemberId: user.memberId }), 1);

    const outbox = await getMongoCollection<{ eventName: string; envelope: string }>(
      MONGO_COLLECTIONS.outbox,
    ).findOne({
      eventId: buildProposalCreatedEventId(String(proposal.proposalId)),
    });

    assert.ok(outbox);
    assert.equal(outbox.eventName, CATALOGUE_EVENTS.proposalCreated);

    const envelope = deserializeDomainEventEnvelope(outbox.envelope);
    assert.equal(envelope.eventName, CATALOGUE_EVENTS.proposalCreated);
    assert.equal(envelope.aggregateType, "Proposal");
    assert.equal(envelope.payload.creatorMemberId, user.memberId);
    assert.equal(envelope.metadata.correlationId, user.userId);
    assert.equal("proposalText" in envelope.payload, false);
    assert.equal("summary" in envelope.payload, false);
    assert.equal("password" in envelope.payload, false);
    assert.equal("email" in envelope.payload, false);
  });

  it("rolls back Proposal when outbox enqueue fails", async () => {
    const { user, session } = await registerAndConfirm("Rollback Creator", "rollback");
    const { activityId } = await seedActivityAndDiscussion(user);

    setForceEnqueueFailureForTests(true);

    const response = await requestProposal("POST", "/api/v1/proposals", session.tokens.accessToken, {
      ...PROPOSAL_BODY,
      activityId,
    });

    setForceEnqueueFailureForTests(false);

    assert.equal(response.status, 500);
    assert.equal(await countProposals({ creatorMemberId: user.memberId }), 0);
  });

  it("returns canonical Proposal on GET for creator and public visibility", async () => {
    const owner = await registerAndConfirm("Query Owner", "query-owner");
    const other = await registerAndConfirm("Query Other", "query-other");
    const { activityId } = await seedActivityAndDiscussion(owner.user);

    const createResponse = await requestProposal(
      "POST",
      "/api/v1/proposals",
      owner.session.tokens.accessToken,
      {
        ...PROPOSAL_BODY,
        activityId,
      },
    );
    assert.equal(createResponse.status, 201);

    const proposalId = String((createResponse.body.data as Record<string, unknown>).proposalId);

    const ownerGet = await requestProposal(
      "GET",
      `/api/v1/proposals/${proposalId}`,
      owner.session.tokens.accessToken,
    );
    assert.equal(ownerGet.status, 200);
    assert.equal((ownerGet.body.data as Record<string, unknown>).proposalId, proposalId);

    const publicGet = await requestProposal(
      "GET",
      `/api/v1/proposals/${proposalId}`,
      other.session.tokens.accessToken,
    );
    assert.equal(publicGet.status, 200);
    assert.equal((publicGet.body.data as Record<string, unknown>).proposalText, PROPOSAL_BODY.proposalText);
  });

  it("rejects unauthenticated creation and unauthorized query for non-public visibility", async () => {
    const owner = await registerAndConfirm("Auth Owner", "auth-owner");
    const other = await registerAndConfirm("Auth Other", "auth-other");

    const activity = await createActivity({
      creatorMemberId: owner.user.memberId,
      actorId: owner.user.userId,
      command: { ...ACTIVITY_BODY, visibility: "allies" },
    });

    const createResponse = await requestProposal(
      "POST",
      "/api/v1/proposals",
      owner.session.tokens.accessToken,
      {
        ...PROPOSAL_BODY,
        activityId: activity.activity.activityId,
      },
    );
    assert.equal(createResponse.status, 201);

    const proposalId = String((createResponse.body.data as Record<string, unknown>).proposalId);

    const unauthenticatedCreate = await requestProposal("POST", "/api/v1/proposals", null, PROPOSAL_BODY);
    assert.equal(unauthenticatedCreate.status, 401);

    const unauthenticatedGet = await requestProposal("GET", `/api/v1/proposals/${proposalId}`, null);
    assert.equal(unauthenticatedGet.status, 401);

    const forbiddenGet = await requestProposal(
      "GET",
      `/api/v1/proposals/${proposalId}`,
      other.session.tokens.accessToken,
    );
    assert.equal(forbiddenGet.status, 403);
  });

  it("rejects client-supplied trusted fields, malformed input, missing Activity, and mismatched Discussion", async () => {
    const { user, session } = await registerAndConfirm("Validation Creator", "validation");
    const { activityId, discussionId } = await seedActivityAndDiscussion(user);

    const trustedFieldResponse = await requestProposal(
      "POST",
      "/api/v1/proposals",
      session.tokens.accessToken,
      {
        ...PROPOSAL_BODY,
        activityId,
        creatorMemberId: "other-member",
      },
    );
    assert.equal(trustedFieldResponse.status, 400);

    const malformedResponse = await requestProposal(
      "POST",
      "/api/v1/proposals",
      session.tokens.accessToken,
      {
        ...PROPOSAL_BODY,
        activityId: "not-a-uuid",
      },
    );
    assert.equal(malformedResponse.status, 400);

    const missingActivityResponse = await requestProposal(
      "POST",
      "/api/v1/proposals",
      session.tokens.accessToken,
      {
        ...PROPOSAL_BODY,
        activityId: "33333333-3333-4333-8333-333333333333",
      },
    );
    assert.equal(missingActivityResponse.status, 404);

    const missingDiscussionResponse = await requestProposal(
      "POST",
      "/api/v1/proposals",
      session.tokens.accessToken,
      {
        ...PROPOSAL_BODY,
        activityId,
        discussionId: "44444444-4444-4444-8444-444444444444",
      },
    );
    assert.equal(missingDiscussionResponse.status, 404);

    const otherActivity = await createActivity({
      creatorMemberId: user.memberId,
      actorId: user.userId,
      command: ACTIVITY_BODY,
    });

    const mismatchResponse = await requestProposal(
      "POST",
      "/api/v1/proposals",
      session.tokens.accessToken,
      {
        ...PROPOSAL_BODY,
        activityId: otherActivity.activity.activityId,
        discussionId,
      },
    );
    assert.equal(mismatchResponse.status, 400);
  });

  it("creates Proposal through application service with registered Member and existing Activity", async () => {
    const { user } = await registerAndConfirm("Service Creator", "service");
    const { activityId, discussionId } = await seedActivityAndDiscussion(user);

    const result = await createProposal({
      creatorMemberId: user.memberId,
      actorId: user.userId,
      command: {
        ...PROPOSAL_BODY,
        activityId,
        discussionId,
      },
    });

    assert.equal(result.proposal.creatorMemberId, user.memberId);
    assert.equal(result.proposal.activityId, activityId);
    assert.equal(result.proposal.discussionId, discussionId);
    assert.equal(await countProposals({ proposalId: result.proposal.proposalId }), 1);
  });
});
