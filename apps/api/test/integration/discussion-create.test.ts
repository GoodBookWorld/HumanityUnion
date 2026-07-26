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
import activityRouter from "../../src/modules/activity/api/activity.routes.js";
import {
  createActivity,
  deleteActivitiesByActivityIdPrefix,
  deleteActivitiesByCreatorMemberIdPrefix,
} from "../../src/modules/activity/index.js";
import discussionRouter from "../../src/modules/discussion/api/discussion.routes.js";
import {
  countDiscussions,
  createDiscussion,
  deleteDiscussionsByCreatorMemberIdPrefix,
  deleteDiscussionsByDiscussionIdPrefix,
} from "../../src/modules/discussion/index.js";
import { buildDiscussionCreatedEventId } from "../../src/modules/discussion/domain/discussion-created.event.js";
import { createTestId, isMongoAvailableForTests, skipIfMongoUnavailable } from "../helpers/test-env.js";
import { resetEventInfrastructureForTests } from "../helpers/test-events.js";

if (!isMongoAvailableForTests()) {
  skipIfMongoUnavailable();
}

const TEST_PREFIX = createTestId("discussion-create");

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

function createTestEmail(suffix: string): string {
  return `${TEST_PREFIX}-${suffix}@discussion-create.test`;
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

async function requestJson(
  basePath: string,
  method: "GET" | "POST",
  path: string,
  accessToken: string | null,
  body?: Record<string, unknown>,
): Promise<{ status: number; body: Record<string, unknown> }> {
  const app = express();
  app.use(express.json());
  app.use(basePath, basePath.includes("activities") ? activityRouter : discussionRouter);

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

async function createActivityForUser(accessToken: string): Promise<string> {
  const response = await requestJson(
    "/api/v1/activities",
    "POST",
    "/api/v1/activities",
    accessToken,
    ACTIVITY_BODY,
  );
  assert.equal(response.status, 201);
  return String((response.body.data as Record<string, unknown>).activityId);
}

describe("CreateDiscussion integration", () => {
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
    await deleteOutboxRecordsByEventIdPrefix("discussion-created:");
    await deleteOutboxRecordsByEventIdPrefix("activity-created:");
    await deleteProcessedEventsByEventIdPrefix("discussion-created:");
    await deleteProcessedEventsByEventIdPrefix("activity-created:");
    await deleteDiscussionsByDiscussionIdPrefix(TEST_PREFIX);
    await deleteDiscussionsByCreatorMemberIdPrefix(TEST_PREFIX);
    await deleteActivitiesByActivityIdPrefix(TEST_PREFIX);
    await deleteActivitiesByCreatorMemberIdPrefix(TEST_PREFIX);
    await deleteMembersByMemberIdPrefix(TEST_PREFIX);
    await deleteAuthUsersByEmailPrefix(`${TEST_PREFIX}-`);
    resetSmtpTransportForTests();
    await disconnectMongoClient();
  });

  it("persists Discussion and DiscussionCreated outbox record transactionally", async () => {
    const { user, session } = await registerAndConfirm("Discussion Creator", "success");
    const accessToken = session.tokens.accessToken;
    const activityId = await createActivityForUser(accessToken);

    const response = await requestJson(
      "/api/v1/discussions",
      "POST",
      "/api/v1/discussions",
      accessToken,
      {
        ...DISCUSSION_BODY,
        activityId,
      },
    );

    assert.equal(response.status, 201);
    assert.equal(response.body.success, true);

    const discussion = response.body.data as Record<string, unknown>;
    assert.equal(typeof discussion.discussionId, "string");
    assert.equal(discussion.activityId, activityId);
    assert.equal(discussion.creatorMemberId, user.memberId);
    assert.equal(discussion.title, DISCUSSION_BODY.title);
    assert.equal(discussion.status, "open");
    assert.equal(discussion.aggregateVersion, 1);
    assert.equal("_id" in discussion, false);
    assert.equal("initiativeId" in discussion, false);

    assert.equal(await countDiscussions({ creatorMemberId: user.memberId }), 1);

    const outbox = await getMongoCollection<{ eventName: string; envelope: string }>(
      MONGO_COLLECTIONS.outbox,
    ).findOne({
      eventId: buildDiscussionCreatedEventId(String(discussion.discussionId)),
    });

    assert.ok(outbox);
    assert.equal(outbox.eventName, CATALOGUE_EVENTS.discussionCreated);

    const envelope = deserializeDomainEventEnvelope(outbox.envelope);
    assert.equal(envelope.eventName, CATALOGUE_EVENTS.discussionCreated);
    assert.equal(envelope.aggregateType, "Discussion");
    assert.equal(envelope.payload.creatorMemberId, user.memberId);
    assert.equal(envelope.metadata.correlationId, user.userId);
    assert.equal("openingMessage" in envelope.payload, false);
    assert.equal("password" in envelope.payload, false);
    assert.equal("email" in envelope.payload, false);
  });

  it("rolls back Discussion when outbox enqueue fails", async () => {
    const { user, session } = await registerAndConfirm("Rollback Creator", "rollback");
    const accessToken = session.tokens.accessToken;
    const activityId = await createActivityForUser(accessToken);

    setForceEnqueueFailureForTests(true);

    const response = await requestJson(
      "/api/v1/discussions",
      "POST",
      "/api/v1/discussions",
      accessToken,
      {
        ...DISCUSSION_BODY,
        activityId,
      },
    );

    setForceEnqueueFailureForTests(false);

    assert.equal(response.status, 500);
    assert.equal(await countDiscussions({ creatorMemberId: user.memberId }), 0);
  });

  it("returns canonical Discussion on GET for creator", async () => {
    const { user, session } = await registerAndConfirm("Query Creator", "query");
    const accessToken = session.tokens.accessToken;
    const activityId = await createActivityForUser(accessToken);

    const createResponse = await requestJson(
      "/api/v1/discussions",
      "POST",
      "/api/v1/discussions",
      accessToken,
      {
        ...DISCUSSION_BODY,
        activityId,
      },
    );
    assert.equal(createResponse.status, 201);

    const discussionId = String((createResponse.body.data as Record<string, unknown>).discussionId);
    const getResponse = await requestJson(
      "/api/v1/discussions",
      "GET",
      `/api/v1/discussions/${discussionId}`,
      accessToken,
    );

    assert.equal(getResponse.status, 200);
    assert.equal(getResponse.body.success, true);

    const discussion = getResponse.body.data as Record<string, unknown>;
    assert.equal(discussion.discussionId, discussionId);
    assert.equal(discussion.creatorMemberId, user.memberId);
    assert.equal(discussion.title, DISCUSSION_BODY.title);
    assert.equal("_id" in discussion, false);
  });

  it("rejects unauthenticated creation and unauthorized query", async () => {
    const unauthenticatedCreate = await requestJson(
      "/api/v1/discussions",
      "POST",
      "/api/v1/discussions",
      null,
      DISCUSSION_BODY,
    );
    assert.equal(unauthenticatedCreate.status, 401);

    const unauthenticatedGet = await requestJson(
      "/api/v1/discussions",
      "GET",
      "/api/v1/discussions/missing-id",
      null,
    );
    assert.equal(unauthenticatedGet.status, 401);
  });

  it("rejects client-supplied trusted fields, malformed input, and missing Activity", async () => {
    const { session } = await registerAndConfirm("Validation Creator", "validation");
    const accessToken = session.tokens.accessToken;
    const activityId = await createActivityForUser(accessToken);

    const trustedFieldResponse = await requestJson(
      "/api/v1/discussions",
      "POST",
      "/api/v1/discussions",
      accessToken,
      {
        ...DISCUSSION_BODY,
        activityId,
        creatorMemberId: "other-member",
      },
    );
    assert.equal(trustedFieldResponse.status, 400);

    const malformedResponse = await requestJson(
      "/api/v1/discussions",
      "POST",
      "/api/v1/discussions",
      accessToken,
      {
        ...DISCUSSION_BODY,
        activityId: "not-a-uuid",
      },
    );
    assert.equal(malformedResponse.status, 400);

    const missingActivityResponse = await requestJson(
      "/api/v1/discussions",
      "POST",
      "/api/v1/discussions",
      accessToken,
      {
        ...DISCUSSION_BODY,
        activityId: "33333333-3333-4333-8333-333333333333",
      },
    );
    assert.equal(missingActivityResponse.status, 404);
  });

  it("returns forbidden when querying another member's Discussion", async () => {
    const owner = await registerAndConfirm("Owner Member", "owner");
    const other = await registerAndConfirm("Other Member", "other");

    const activityId = await createActivityForUser(owner.session.tokens.accessToken);

    const createResponse = await requestJson(
      "/api/v1/discussions",
      "POST",
      "/api/v1/discussions",
      owner.session.tokens.accessToken,
      {
        ...DISCUSSION_BODY,
        activityId,
      },
    );
    assert.equal(createResponse.status, 201);

    const discussionId = String((createResponse.body.data as Record<string, unknown>).discussionId);
    const forbiddenResponse = await requestJson(
      "/api/v1/discussions",
      "GET",
      `/api/v1/discussions/${discussionId}`,
      other.session.tokens.accessToken,
    );

    assert.equal(forbiddenResponse.status, 403);
  });

  it("creates Discussion through application service with registered Member and existing Activity", async () => {
    const { user } = await registerAndConfirm("Service Creator", "service");

    const activity = await createActivity({
      creatorMemberId: user.memberId,
      actorId: user.userId,
      command: ACTIVITY_BODY,
    });

    const result = await createDiscussion({
      creatorMemberId: user.memberId,
      actorId: user.userId,
      command: {
        ...DISCUSSION_BODY,
        activityId: activity.activity.activityId,
      },
    });

    assert.equal(result.discussion.creatorMemberId, user.memberId);
    assert.equal(result.discussion.activityId, activity.activity.activityId);
    assert.equal(await countDiscussions({ discussionId: result.discussion.discussionId }), 1);
  });
});
