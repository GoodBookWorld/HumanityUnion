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
  countActivities,
  createActivity,
  deleteActivitiesByActivityIdPrefix,
  deleteActivitiesByCreatorMemberIdPrefix,
} from "../../src/modules/activity/index.js";
import { buildActivityCreatedEventId } from "../../src/modules/activity/domain/activity-created.event.js";
import { createTestId, isMongoAvailableForTests, skipIfMongoUnavailable } from "../helpers/test-env.js";
import { resetEventInfrastructureForTests } from "../helpers/test-events.js";

if (!isMongoAvailableForTests()) {
  skipIfMongoUnavailable();
}

const TEST_PREFIX = createTestId("activity-create");

const VALID_BODY = {
  title: "Community Water Quality Review",
  description: "A civic participation activity to review local water quality reporting.",
  activityType: "civic_participation",
  visibility: "public",
};

function createTestEmail(suffix: string): string {
  return `${TEST_PREFIX}-${suffix}@activity-create.test`;
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

async function requestActivity(
  method: "GET" | "POST",
  path: string,
  accessToken: string | null,
  body?: Record<string, unknown>,
): Promise<{ status: number; body: Record<string, unknown> }> {
  const app = express();
  app.use(express.json());
  app.use("/api/v1/activities", activityRouter);

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

describe("CreateActivity integration", () => {
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
    await deleteOutboxRecordsByEventIdPrefix("activity-created:");
    await deleteProcessedEventsByEventIdPrefix("activity-created:");
    await deleteActivitiesByActivityIdPrefix(TEST_PREFIX);
    await deleteActivitiesByCreatorMemberIdPrefix(TEST_PREFIX);
    await deleteMembersByMemberIdPrefix(TEST_PREFIX);
    await deleteAuthUsersByEmailPrefix(`${TEST_PREFIX}-`);
    resetSmtpTransportForTests();
    await disconnectMongoClient();
  });

  it("persists Activity and ActivityCreated outbox record transactionally", async () => {
    const { user, session } = await registerAndConfirm("Activity Creator", "success");
    const accessToken = session.tokens.accessToken;

    const response = await requestActivity("POST", "/api/v1/activities", accessToken, VALID_BODY);

    assert.equal(response.status, 201);
    assert.equal(response.body.success, true);

    const activity = response.body.data as Record<string, unknown>;
    assert.equal(typeof activity.activityId, "string");
    assert.equal(activity.creatorMemberId, user.memberId);
    assert.equal(activity.title, VALID_BODY.title);
    assert.equal(activity.status, "open");
    assert.equal(activity.aggregateVersion, 1);
    assert.equal("_id" in activity, false);
    assert.equal("initiativeId" in activity, false);

    assert.equal(await countActivities({ creatorMemberId: user.memberId }), 1);

    const outbox = await getMongoCollection<{ eventName: string; envelope: string }>(
      MONGO_COLLECTIONS.outbox,
    ).findOne({
      eventId: buildActivityCreatedEventId(String(activity.activityId)),
    });

    assert.ok(outbox);
    assert.equal(outbox.eventName, CATALOGUE_EVENTS.activityCreated);

    const envelope = deserializeDomainEventEnvelope(outbox.envelope);
    assert.equal(envelope.eventName, CATALOGUE_EVENTS.activityCreated);
    assert.equal(envelope.aggregateType, "Activity");
    assert.equal(envelope.payload.creatorMemberId, user.memberId);
    assert.equal(envelope.metadata.correlationId, user.userId);
    assert.equal("password" in envelope.payload, false);
    assert.equal("email" in envelope.payload, false);
  });

  it("rolls back Activity when outbox enqueue fails", async () => {
    const { user, session } = await registerAndConfirm("Rollback Creator", "rollback");
    const accessToken = session.tokens.accessToken;

    setForceEnqueueFailureForTests(true);

    const response = await requestActivity("POST", "/api/v1/activities", accessToken, VALID_BODY);

    setForceEnqueueFailureForTests(false);

    assert.equal(response.status, 500);
    assert.equal(await countActivities({ creatorMemberId: user.memberId }), 0);
  });

  it("returns canonical Activity on GET for creator", async () => {
    const { user, session } = await registerAndConfirm("Query Creator", "query");
    const accessToken = session.tokens.accessToken;

    const createResponse = await requestActivity("POST", "/api/v1/activities", accessToken, VALID_BODY);
    assert.equal(createResponse.status, 201);

    const activityId = String((createResponse.body.data as Record<string, unknown>).activityId);
    const getResponse = await requestActivity(
      "GET",
      `/api/v1/activities/${activityId}`,
      accessToken,
    );

    assert.equal(getResponse.status, 200);
    assert.equal(getResponse.body.success, true);

    const activity = getResponse.body.data as Record<string, unknown>;
    assert.equal(activity.activityId, activityId);
    assert.equal(activity.creatorMemberId, user.memberId);
    assert.equal(activity.title, VALID_BODY.title);
    assert.equal("_id" in activity, false);
  });

  it("rejects unauthenticated creation and unauthorized query", async () => {
    const unauthenticatedCreate = await requestActivity("POST", "/api/v1/activities", null, VALID_BODY);
    assert.equal(unauthenticatedCreate.status, 401);

    const unauthenticatedGet = await requestActivity("GET", "/api/v1/activities/missing-id", null);
    assert.equal(unauthenticatedGet.status, 401);
  });

  it("rejects client-supplied trusted fields and malformed input", async () => {
    const { session } = await registerAndConfirm("Validation Creator", "validation");
    const accessToken = session.tokens.accessToken;

    const trustedFieldResponse = await requestActivity("POST", "/api/v1/activities", accessToken, {
      ...VALID_BODY,
      creatorMemberId: "other-member",
    });
    assert.equal(trustedFieldResponse.status, 400);

    const malformedResponse = await requestActivity("POST", "/api/v1/activities", accessToken, {
      ...VALID_BODY,
      activityType: "invalid",
    });
    assert.equal(malformedResponse.status, 400);
  });

  it("returns forbidden when querying another member's Activity", async () => {
    const owner = await registerAndConfirm("Owner Member", "owner");
    const other = await registerAndConfirm("Other Member", "other");

    const createResponse = await requestActivity(
      "POST",
      "/api/v1/activities",
      owner.session.tokens.accessToken,
      VALID_BODY,
    );
    assert.equal(createResponse.status, 201);

    const activityId = String((createResponse.body.data as Record<string, unknown>).activityId);
    const forbiddenResponse = await requestActivity(
      "GET",
      `/api/v1/activities/${activityId}`,
      other.session.tokens.accessToken,
    );

    assert.equal(forbiddenResponse.status, 403);
  });

  it("creates Activity through application service with registered Member", async () => {
    const { user } = await registerAndConfirm("Service Creator", "service");

    const result = await createActivity({
      creatorMemberId: user.memberId,
      actorId: user.userId,
      command: VALID_BODY,
    });

    assert.equal(result.activity.creatorMemberId, user.memberId);
    assert.equal(await countActivities({ activityId: result.activity.activityId }), 1);
  });
});
