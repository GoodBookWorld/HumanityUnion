import assert from "node:assert/strict";
import { after, afterEach, before, beforeEach, describe, it } from "node:test";

import { registerAuthUser } from "../../src/modules/auth/auth.service.js";
import { confirmRegistrationEmailCode } from "../../src/modules/auth/auth-email-confirmation.service.js";
import { deleteAuthUsersByEmailPrefix, findAuthUserByEmail } from "../../src/modules/auth/auth-user.repository.js";
import { getLastIssuedConfirmationCodeForTests } from "../../src/modules/email/email-confirmation-code.repository.js";
import { resetSmtpTransportForTests } from "../../src/modules/email/smtp-transport.js";
import { deserializeDomainEventEnvelope } from "../../src/infrastructure/events/event-serialization.js";
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
  isEventProcessed,
  resetOutboxDispatcherStateForTests,
  stopOutboxDispatcher,
} from "../../src/infrastructure/outbox/index.js";
import { buildMemberRegisteredEventId } from "../../src/modules/member/domain/member-registered.event.js";
import { deleteMembersByMemberIdPrefix } from "../../src/modules/member/infrastructure/member.repository.js";
import {
  buildActivityCreatedEventId,
  createActivity,
  deleteActivitiesByActivityIdPrefix,
  deleteActivitiesByCreatorMemberIdPrefix,
} from "../../src/modules/activity/index.js";
import {
  getWorkspaceOverviewForMember,
} from "../../src/modules/workspace/application/workspace-query.service.js";
import {
  handleActivityCreatedWorkspaceProjection,
  WORKSPACE_ACTIVITY_CREATED_CONSUMER_ID,
} from "../../src/modules/workspace/application/activity-created.workspace-handler.js";
import {
  handleMemberRegisteredWorkspaceProjection,
  WORKSPACE_MEMBER_REGISTERED_CONSUMER_ID,
} from "../../src/modules/workspace/application/member-registered.workspace-handler.js";
import type { WorkspaceProjectionRecord } from "../../src/modules/workspace/domain/workspace-projection.types.js";
import {
  countWorkspaceProjectionsByMemberId,
  deleteWorkspaceProjectionByMemberId,
  deleteWorkspaceProjectionsByMemberIdPrefix,
  findWorkspaceProjectionByMemberId,
  setForceWorkspaceActivityUpdateFailureForTests,
} from "../../src/modules/workspace/infrastructure/workspace-projection.repository.js";
import { createTestId, isMongoAvailableForTests, skipIfMongoUnavailable } from "../helpers/test-env.js";
import { resetEventInfrastructureForTests, resetMemberRegisteredOutboxForDispatchTests, markMemberRegisteredOutboxPublishedForTests } from "../helpers/test-events.js";

if (!isMongoAvailableForTests()) {
  skipIfMongoUnavailable();
}

const TEST_PREFIX = createTestId("activity-workspace");

const VALID_COMMAND = {
  title: "Community Water Quality Review",
  description: "A civic participation activity to review local water quality reporting.",
  activityType: "civic_participation" as const,
  visibility: "public" as const,
};

function createTestEmail(suffix: string): string {
  return `${TEST_PREFIX}-${suffix}@activity-workspace.test`;
}

function normalizeWorkspaceBusinessState(record: WorkspaceProjectionRecord) {
  return {
    workspaceId: record.workspaceId,
    memberId: record.memberId,
    memberSummary: record.memberSummary,
    participationSummary: record.participationSummary,
    recentActivities: record.recentActivities,
    nextActions: record.nextActions,
    sourceEventId: record.sourceEventId,
    sourceCorrelationId: record.sourceCorrelationId,
    projectionVersion: record.projectionVersion,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
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

async function publishPendingOutboxForTests(eventName: string): Promise<void> {
  const collection = getMongoCollection<{ status: string; publishedAt?: string }>(
    MONGO_COLLECTIONS.outbox,
  );

  await collection.updateMany(
    {
      eventName,
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

async function materializeWorkspaceForMember(user: { memberId: string; userId: string }) {
  registerDomainEventHandler({
    consumerId: WORKSPACE_MEMBER_REGISTERED_CONSUMER_ID,
    eventName: CATALOGUE_EVENTS.memberRegistered,
    handle: handleMemberRegisteredWorkspaceProjection,
  });

  await resetMemberRegisteredOutboxForDispatchTests(user.memberId);
  await dispatchOutboxOnceForTests();

  if ((await countWorkspaceProjectionsByMemberId(user.memberId)) === 0) {
    const outbox = await getMongoCollection<{ envelope: string }>(MONGO_COLLECTIONS.outbox).findOne({
      eventId: buildMemberRegisteredEventId(user.memberId),
    });
    assert.ok(outbox, "MemberRegistered outbox record is required to materialize Workspace.");
    await handleMemberRegisteredWorkspaceProjection(
      deserializeDomainEventEnvelope(outbox.envelope),
    );
  }

  assert.equal(await countWorkspaceProjectionsByMemberId(user.memberId), 1);
}

describe("ActivityCreated Workspace projection integration", () => {
  before(async () => {
    resetEventInfrastructureForTests();
    await connectMongoClient();
    await ensureMongoIndexes();
    await publishPendingOutboxForTests(CATALOGUE_EVENTS.memberRegistered);
  });

  beforeEach(() => {
    resetEventInfrastructureForTests();
  });

  after(async () => {
    resetEventInfrastructureForTests();
    await deleteProcessedEventsByConsumerIdPrefix(WORKSPACE_ACTIVITY_CREATED_CONSUMER_ID);
    await deleteProcessedEventsByConsumerIdPrefix(WORKSPACE_MEMBER_REGISTERED_CONSUMER_ID);
    await deleteProcessedEventsByEventIdPrefix("activity-created:");
    await deleteProcessedEventsByEventIdPrefix("member-registered:");
    await deleteOutboxRecordsByEventIdPrefix("activity-created:");
    await deleteOutboxRecordsByEventIdPrefix("member-registered:");
    await deleteActivitiesByActivityIdPrefix(TEST_PREFIX);
    await deleteActivitiesByCreatorMemberIdPrefix(TEST_PREFIX);
    await deleteWorkspaceProjectionsByMemberIdPrefix(TEST_PREFIX);
    await deleteMembersByMemberIdPrefix(TEST_PREFIX);
    await deleteAuthUsersByEmailPrefix(`${TEST_PREFIX}-`);
    resetSmtpTransportForTests();
    await disconnectMongoClient();
  });

  it("updates Workspace from ActivityCreated through outbox dispatch", async () => {
    clearDomainEventHandlers();

    const user = await registerAndConfirm("Workspace Activity Member", "flow");
    await materializeWorkspaceForMember(user);

    registerDomainEventHandler({
      consumerId: WORKSPACE_ACTIVITY_CREATED_CONSUMER_ID,
      eventName: CATALOGUE_EVENTS.activityCreated,
      handle: handleActivityCreatedWorkspaceProjection,
    });

    const created = await createActivity({
      creatorMemberId: user.memberId,
      actorId: user.userId,
      command: VALID_COMMAND,
    });

    assert.equal(await dispatchOutboxOnceForTests(), 1);

    const projection = await findWorkspaceProjectionByMemberId(user.memberId);
    assert.ok(projection);
    assert.equal(projection.participationSummary.activeActivityCount, 1);
    assert.equal(projection.participationSummary.awaitingMemberActionCount, 0);
    assert.equal(projection.participationSummary.completedActivityCount, 0);
    assert.equal(projection.recentActivities.length, 1);
    assert.equal(projection.recentActivities[0]?.activityId, created.activity.activityId);
    assert.equal(projection.recentActivities[0]?.title, VALID_COMMAND.title);

    const overview = await getWorkspaceOverviewForMember(user.memberId);
    assert.equal(overview.participationSummary.activeActivityCount, 1);
    assert.equal(overview.recentActivities.length, 1);

    const eventId = buildActivityCreatedEventId(created.activity.activityId);
    assert.equal(await isEventProcessed(WORKSPACE_ACTIVITY_CREATED_CONSUMER_ID, eventId), true);
  });

  it("remains idempotent on duplicate ActivityCreated delivery", async () => {
    clearDomainEventHandlers();

    const user = await registerAndConfirm("Duplicate Activity Member", "duplicate");
    await materializeWorkspaceForMember(user);

    registerDomainEventHandler({
      consumerId: WORKSPACE_ACTIVITY_CREATED_CONSUMER_ID,
      eventName: CATALOGUE_EVENTS.activityCreated,
      handle: handleActivityCreatedWorkspaceProjection,
    });

    const created = await createActivity({
      creatorMemberId: user.memberId,
      actorId: user.userId,
      command: VALID_COMMAND,
    });

    await dispatchOutboxOnceForTests();
    await dispatchOutboxOnceForTests();

    const projection = await findWorkspaceProjectionByMemberId(user.memberId);
    assert.ok(projection);
    assert.equal(projection.participationSummary.activeActivityCount, 1);
    assert.equal(projection.recentActivities.length, 1);
    assert.equal(projection.recentActivities[0]?.activityId, created.activity.activityId);
  });

  it("retries consumer after Workspace activity projection write failure", async () => {
    resetEventInfrastructureForTests();

    const user = await registerAndConfirm("Retry Activity Member", "retry");
    await materializeWorkspaceForMember(user);

    registerDomainEventHandler({
      consumerId: WORKSPACE_ACTIVITY_CREATED_CONSUMER_ID,
      eventName: CATALOGUE_EVENTS.activityCreated,
      handle: handleActivityCreatedWorkspaceProjection,
    });

    const created = await createActivity({
      creatorMemberId: user.memberId,
      actorId: user.userId,
      command: VALID_COMMAND,
    });

    const eventId = buildActivityCreatedEventId(created.activity.activityId);
    const outbox = await getMongoCollection<{ envelope: string }>(MONGO_COLLECTIONS.outbox).findOne({
      eventId,
    });
    assert.ok(outbox);
    const envelope = deserializeDomainEventEnvelope(outbox.envelope);

    setForceWorkspaceActivityUpdateFailureForTests(true);
    await assert.rejects(
      () => handleActivityCreatedWorkspaceProjection(envelope),
      /Forced workspace activity projection update failure/,
    );
    assert.equal(await isEventProcessed(WORKSPACE_ACTIVITY_CREATED_CONSUMER_ID, eventId), false);

    const beforeRetry = await findWorkspaceProjectionByMemberId(user.memberId);
    assert.ok(beforeRetry);
    assert.equal(beforeRetry.participationSummary.activeActivityCount, 0);
    assert.equal(beforeRetry.recentActivities.length, 0);

    setForceWorkspaceActivityUpdateFailureForTests(false);
    await dispatchOutboxOnceForTests();

    const afterRetry = await findWorkspaceProjectionByMemberId(user.memberId);
    assert.ok(afterRetry);
    assert.equal(afterRetry.participationSummary.activeActivityCount, 1);
    assert.equal(afterRetry.recentActivities.length, 1);
    assert.equal(await isEventProcessed(WORKSPACE_ACTIVITY_CREATED_CONSUMER_ID, eventId), true);
  });

  it("retries ActivityCreated when Workspace projection is not yet materialized", async () => {
    clearDomainEventHandlers();

    const user = await registerAndConfirm("Ordering Activity Member", "ordering");
    assert.equal(await countWorkspaceProjectionsByMemberId(user.memberId), 0);

    const memberRegisteredOutbox = await getMongoCollection<{ envelope: string; status: string }>(
      MONGO_COLLECTIONS.outbox,
    ).findOne({ eventId: buildMemberRegisteredEventId(user.memberId) });
    assert.ok(memberRegisteredOutbox);

    await getMongoCollection(MONGO_COLLECTIONS.outbox).updateOne(
      { eventId: buildMemberRegisteredEventId(user.memberId) },
      {
        $set: {
          status: "published",
          publishedAt: new Date().toISOString(),
        },
      },
    );

    registerDomainEventHandler({
      consumerId: WORKSPACE_ACTIVITY_CREATED_CONSUMER_ID,
      eventName: CATALOGUE_EVENTS.activityCreated,
      handle: handleActivityCreatedWorkspaceProjection,
    });

    const created = await createActivity({
      creatorMemberId: user.memberId,
      actorId: user.userId,
      command: VALID_COMMAND,
    });

    const eventId = buildActivityCreatedEventId(created.activity.activityId);

    await dispatchOutboxOnceForTests();
    assert.equal(await countWorkspaceProjectionsByMemberId(user.memberId), 0);
    assert.equal(await isEventProcessed(WORKSPACE_ACTIVITY_CREATED_CONSUMER_ID, eventId), false);

    await handleMemberRegisteredWorkspaceProjection(
      deserializeDomainEventEnvelope(memberRegisteredOutbox.envelope),
    );

    await dispatchOutboxOnceForTests();

    const projection = await findWorkspaceProjectionByMemberId(user.memberId);
    assert.ok(projection);
    assert.equal(projection.participationSummary.activeActivityCount, 1);
    assert.equal(projection.recentActivities[0]?.activityId, created.activity.activityId);
    assert.equal(await isEventProcessed(WORKSPACE_ACTIVITY_CREATED_CONSUMER_ID, eventId), true);
  });

  it("rebuilds Workspace state from MemberRegistered then ActivityCreated replay", async () => {
    clearDomainEventHandlers();

    const user = await registerAndConfirm("Rebuild Activity Member", "rebuild");
    await materializeWorkspaceForMember(user);

    registerDomainEventHandler({
      consumerId: WORKSPACE_ACTIVITY_CREATED_CONSUMER_ID,
      eventName: CATALOGUE_EVENTS.activityCreated,
      handle: handleActivityCreatedWorkspaceProjection,
    });

    const created = await createActivity({
      creatorMemberId: user.memberId,
      actorId: user.userId,
      command: VALID_COMMAND,
    });

    await dispatchOutboxOnceForTests();

    const beforeDelete = await findWorkspaceProjectionByMemberId(user.memberId);
    assert.ok(beforeDelete);
    const expectedState = normalizeWorkspaceBusinessState(beforeDelete);

    await deleteWorkspaceProjectionByMemberId(user.memberId);
    assert.equal(await countWorkspaceProjectionsByMemberId(user.memberId), 0);

    const memberRegisteredOutbox = await getMongoCollection<{ envelope: string }>(
      MONGO_COLLECTIONS.outbox,
    ).findOne({ eventId: buildMemberRegisteredEventId(user.memberId) });
    assert.ok(memberRegisteredOutbox);

    const activityCreatedOutbox = await getMongoCollection<{ envelope: string }>(
      MONGO_COLLECTIONS.outbox,
    ).findOne({ eventId: buildActivityCreatedEventId(created.activity.activityId) });
    assert.ok(activityCreatedOutbox);

    const memberRegisteredEnvelope = deserializeDomainEventEnvelope(memberRegisteredOutbox.envelope);
    const activityCreatedEnvelope = deserializeDomainEventEnvelope(activityCreatedOutbox.envelope);

    await handleMemberRegisteredWorkspaceProjection(memberRegisteredEnvelope);
    await handleActivityCreatedWorkspaceProjection(activityCreatedEnvelope);

    const replayed = await findWorkspaceProjectionByMemberId(user.memberId);
    assert.ok(replayed);
    assert.deepEqual(normalizeWorkspaceBusinessState(replayed), expectedState);
  });
});
