import assert from "node:assert/strict";
import http from "node:http";
import { after, before, beforeEach, describe, it } from "node:test";

import express from "express";

import { registerAuthUser } from "../../src/modules/auth/auth.service.js";
import { buildMemberRegisteredEventId } from "../../src/modules/member/domain/member-registered.event.js";
import { confirmRegistrationEmailCode } from "../../src/modules/auth/auth-email-confirmation.service.js";
import { createAccessToken } from "../../src/modules/auth/auth-tokens.js";
import { deleteAuthUsersByEmailPrefix, findAuthUserByEmail } from "../../src/modules/auth/auth-user.repository.js";
import { getLastIssuedConfirmationCodeForTests } from "../../src/modules/email/email-confirmation-code.repository.js";
import { resetSmtpTransportForTests } from "../../src/modules/email/smtp-transport.js";
import { CATALOGUE_EVENTS } from "../../src/infrastructure/events/catalogue-events.js";
import {
  clearDomainEventHandlers,
  registerDomainEventHandler,
} from "../../src/infrastructure/integration/event-handler-registry.js";
import {
  connectMongoClient,
  disconnectMongoClient,
} from "../../src/infrastructure/mongodb/mongo-connection.js";
import { ensureMongoIndexes } from "../../src/infrastructure/mongodb/mongo-indexes.js";
import { MONGO_COLLECTIONS } from "../../src/infrastructure/mongodb/mongo-collections.js";
import { getMongoCollection } from "../../src/infrastructure/mongodb/mongo-database.js";
import {
  deleteOutboxRecordsByEventIdPrefix,
  deleteProcessedEventsByConsumerIdPrefix,
  deleteProcessedEventsByEventIdPrefix,
  dispatchOutboxOnceForTests,
  resetOutboxDispatcherStateForTests,
  stopOutboxDispatcher,
} from "../../src/infrastructure/outbox/index.js";
import { deleteMembersByMemberIdPrefix } from "../../src/modules/member/infrastructure/member.repository.js";
import { buildMemberRegisteredEventId } from "../../src/modules/member/domain/member-registered.event.js";
import workspaceRouter from "../../src/modules/workspace/api/workspace.routes.js";
import {
  handleMemberRegisteredWorkspaceProjection,
  WORKSPACE_MEMBER_REGISTERED_CONSUMER_ID,
} from "../../src/modules/workspace/application/member-registered.workspace-handler.js";
import {
  deleteWorkspaceProjectionsByMemberIdPrefix,
  countWorkspaceProjectionsByMemberId,
  deleteWorkspaceProjectionByMemberId,
} from "../../src/modules/workspace/infrastructure/workspace-projection.repository.js";
import {
  getWorkspaceOverviewForMember,
} from "../../src/modules/workspace/application/workspace-query.service.js";
import { createTestId, isMongoAvailableForTests, skipIfMongoUnavailable } from "../helpers/test-env.js";
import { resetEventInfrastructureForTests, resetMemberRegisteredOutboxForDispatchTests, markMemberRegisteredOutboxPublishedForTests } from "../helpers/test-events.js";

if (!isMongoAvailableForTests()) {
  skipIfMongoUnavailable();
}

const TEST_PREFIX = createTestId("workspace-api");

function createTestEmail(suffix: string): string {
  return `${TEST_PREFIX}-${suffix}@workspace-api.test`;
}

async function registerAndConfirm(displayName: string, suffix: string) {
  const email = createTestEmail(suffix);
  await registerAuthUser({ email, password: "Password123!", displayName });
  const user = await findAuthUserByEmail(email);
  assert.ok(user);
  const code = getLastIssuedConfirmationCodeForTests(user.userId);
  assert.ok(code);
  await confirmRegistrationEmailCode({ userId: user.userId, code });
  await deleteWorkspaceProjectionByMemberId(user.memberId);
  await markMemberRegisteredOutboxPublishedForTests(user.memberId);
  return user;
}

async function publishPendingMemberRegisteredOutboxForTests(): Promise<void> {
  const collection = getMongoCollection<{ status: string; publishedAt?: string }>(
    MONGO_COLLECTIONS.outbox,
  );

  await collection.updateMany(
    {
      eventName: CATALOGUE_EVENTS.memberRegistered,
      status: { $in: ["pending", "failed"] },
    },
    {
      $set: {
        status: "published",
        publishedAt: new Date().toISOString(),
      },
    },
  );
}

async function getWorkspaceViaHttp(accessToken: string): Promise<{
  status: number;
  body: Record<string, unknown>;
}> {
  const app = express();
  app.use("/api/v1/workspace", workspaceRouter);

  const server = http.createServer(app);

  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve());
  });

  const address = server.address();

  if (!address || typeof address === "string") {
    throw new Error("Failed to bind HTTP test server.");
  }

  try {
    const response = await fetch(`http://127.0.0.1:${address.port}/api/v1/workspace`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const body = (await response.json()) as Record<string, unknown>;

    return {
      status: response.status,
      body,
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

describe("canonical Workspace API integration", () => {
  before(async () => {
    resetEventInfrastructureForTests();
    await connectMongoClient();
    await ensureMongoIndexes();
    await publishPendingMemberRegisteredOutboxForTests();
  });

  beforeEach(() => {
    resetEventInfrastructureForTests();
  });

  after(async () => {
    resetEventInfrastructureForTests();
    await deleteProcessedEventsByConsumerIdPrefix(WORKSPACE_MEMBER_REGISTERED_CONSUMER_ID);
    await deleteProcessedEventsByEventIdPrefix("member-registered:");
    await deleteOutboxRecordsByEventIdPrefix("member-registered:");
    await deleteWorkspaceProjectionsByMemberIdPrefix(TEST_PREFIX);
    await deleteMembersByMemberIdPrefix(TEST_PREFIX);
    await deleteAuthUsersByEmailPrefix(`${TEST_PREFIX}-`);
    resetSmtpTransportForTests();
    await disconnectMongoClient();
  });

  it("returns projection-pending overview before dispatch", async () => {
    clearDomainEventHandlers();

    const user = await registerAndConfirm("API Pending Member", "pending");
    assert.equal(await countWorkspaceProjectionsByMemberId(user.memberId), 0);

    const overview = await getWorkspaceOverviewForMember(user.memberId);

    registerDomainEventHandler({
      consumerId: WORKSPACE_MEMBER_REGISTERED_CONSUMER_ID,
      eventName: CATALOGUE_EVENTS.memberRegistered,
      handle: handleMemberRegisteredWorkspaceProjection,
    });

    assert.equal(overview.projectionStatus, "pending");
    assert.equal(overview.memberSummary.displayName, "API Pending Member");
    assert.equal(overview.participationSummary.completedActivityCount, 0);
  });

  it("returns materialized Workspace overview for authenticated registered Member", async () => {
    const user = await registerAndConfirm("API Workspace Member", "materialized");

    registerDomainEventHandler({
      consumerId: WORKSPACE_MEMBER_REGISTERED_CONSUMER_ID,
      eventName: CATALOGUE_EVENTS.memberRegistered,
      handle: handleMemberRegisteredWorkspaceProjection,
    });

    await resetMemberRegisteredOutboxForDispatchTests(user.memberId);
    await dispatchOutboxOnceForTests();

    const accessToken = createAccessToken({
      sub: user.userId,
      memberId: user.memberId,
      role: user.role,
      displayName: user.displayName,
      email: user.email,
    });

    const response = await getWorkspaceViaHttp(accessToken);

    assert.equal(response.status, 200);
    assert.equal(response.body.success, true);

    const data = response.body.data as Record<string, unknown>;
    assert.equal(data.projectionStatus, "materialized");
    assert.equal(data.memberId, user.memberId);
    assert.equal((data.memberSummary as Record<string, unknown>).displayName, "API Workspace Member");
    assert.equal((data.participationSummary as Record<string, unknown>).activeActivityCount, 0);
    assert.equal("password" in data, false);
    assert.equal("initiatives" in data, false);
  });
});
