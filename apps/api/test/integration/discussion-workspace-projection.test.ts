import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";

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
  buildDiscussionCreatedEventId,
  createDiscussion,
  deleteDiscussionsByCreatorMemberIdPrefix,
  deleteDiscussionsByDiscussionIdPrefix,
} from "../../src/modules/discussion/index.js";
import {
  getWorkspaceOverviewForMember,
} from "../../src/modules/workspace/application/workspace-query.service.js";
import {
  handleActivityCreatedWorkspaceProjection,
  WORKSPACE_ACTIVITY_CREATED_CONSUMER_ID,
} from "../../src/modules/workspace/application/activity-created.workspace-handler.js";
import {
  handleDiscussionCreatedWorkspaceProjection,
  WORKSPACE_DISCUSSION_CREATED_CONSUMER_ID,
} from "../../src/modules/workspace/application/discussion-created.workspace-handler.js";
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
  setForceWorkspaceDiscussionUpdateFailureForTests,
} from "../../src/modules/workspace/infrastructure/workspace-projection.repository.js";
import { createTestId, isMongoAvailableForTests, skipIfMongoUnavailable } from "../helpers/test-env.js";
import {
  markMemberRegisteredOutboxPublishedForTests,
  resetEventInfrastructureForTests,
  resetMemberRegisteredOutboxForDispatchTests,
} from "../helpers/test-events.js";

if (!isMongoAvailableForTests()) {
  skipIfMongoUnavailable();
}

const TEST_PREFIX = createTestId("discussion-workspace");

const ACTIVITY_COMMAND = {
  title: "Community Water Quality Review",
  description: "A civic participation activity to review local water quality reporting.",
  activityType: "civic_participation" as const,
  visibility: "public" as const,
};

const DISCUSSION_COMMAND = {
  title: "Water Quality Discussion",
  openingMessage: "Let's review the latest water quality reporting together.",
};

function createTestEmail(suffix: string): string {
  return `${TEST_PREFIX}-${suffix}@discussion-workspace.test`;
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

function registerWorkspaceHandlers() {
  registerDomainEventHandler({
    consumerId: WORKSPACE_ACTIVITY_CREATED_CONSUMER_ID,
    eventName: CATALOGUE_EVENTS.activityCreated,
    handle: handleActivityCreatedWorkspaceProjection,
  });

  registerDomainEventHandler({
    consumerId: WORKSPACE_DISCUSSION_CREATED_CONSUMER_ID,
    eventName: CATALOGUE_EVENTS.discussionCreated,
    handle: handleDiscussionCreatedWorkspaceProjection,
  });
}

describe("DiscussionCreated Workspace projection integration", () => {
  before(async () => {
    resetEventInfrastructureForTests();
    await connectMongoClient();
    await ensureMongoIndexes();
  });

  beforeEach(() => {
    resetEventInfrastructureForTests();
  });

  after(async () => {
    resetEventInfrastructureForTests();
    await deleteProcessedEventsByConsumerIdPrefix(WORKSPACE_DISCUSSION_CREATED_CONSUMER_ID);
    await deleteProcessedEventsByConsumerIdPrefix(WORKSPACE_ACTIVITY_CREATED_CONSUMER_ID);
    await deleteProcessedEventsByConsumerIdPrefix(WORKSPACE_MEMBER_REGISTERED_CONSUMER_ID);
    await deleteProcessedEventsByEventIdPrefix("discussion-created:");
    await deleteProcessedEventsByEventIdPrefix("activity-created:");
    await deleteProcessedEventsByEventIdPrefix("member-registered:");
    await deleteOutboxRecordsByEventIdPrefix("discussion-created:");
    await deleteOutboxRecordsByEventIdPrefix("activity-created:");
    await deleteOutboxRecordsByEventIdPrefix("member-registered:");
    await deleteDiscussionsByDiscussionIdPrefix(TEST_PREFIX);
    await deleteDiscussionsByCreatorMemberIdPrefix(TEST_PREFIX);
    await deleteActivitiesByActivityIdPrefix(TEST_PREFIX);
    await deleteActivitiesByCreatorMemberIdPrefix(TEST_PREFIX);
    await deleteWorkspaceProjectionsByMemberIdPrefix(TEST_PREFIX);
    await deleteMembersByMemberIdPrefix(TEST_PREFIX);
    await deleteAuthUsersByEmailPrefix(`${TEST_PREFIX}-`);
    resetSmtpTransportForTests();
    await disconnectMongoClient();
  });

  it("updates Workspace from DiscussionCreated through outbox dispatch", async () => {
    clearDomainEventHandlers();

    const user = await registerAndConfirm("Workspace Discussion Member", "flow");
    await materializeWorkspaceForMember(user);
    registerWorkspaceHandlers();

    const activity = await createActivity({
      creatorMemberId: user.memberId,
      actorId: user.userId,
      command: ACTIVITY_COMMAND,
    });

    await dispatchOutboxOnceForTests();

    const created = await createDiscussion({
      creatorMemberId: user.memberId,
      actorId: user.userId,
      command: {
        ...DISCUSSION_COMMAND,
        activityId: activity.activity.activityId,
      },
    });

    assert.equal(await dispatchOutboxOnceForTests(), 1);

    const projection = await findWorkspaceProjectionByMemberId(user.memberId);
    assert.ok(projection);
    assert.equal(projection.participationSummary.activeActivityCount, 1);
    assert.equal(projection.recentActivities.length, 2);
    assert.equal(projection.recentActivities[0]?.discussionId, created.discussion.discussionId);
    assert.equal(projection.recentActivities[0]?.referenceType, "discussion");
    assert.equal(projection.recentActivities[0]?.activityId, activity.activity.activityId);
    assert.equal(projection.recentActivities[1]?.activityId, activity.activity.activityId);
    assert.equal(projection.recentActivities[1]?.referenceType, undefined);

    const overview = await getWorkspaceOverviewForMember(user.memberId);
    assert.equal(overview.recentActivities.length, 2);

    const eventId = buildDiscussionCreatedEventId(created.discussion.discussionId);
    assert.equal(await isEventProcessed(WORKSPACE_DISCUSSION_CREATED_CONSUMER_ID, eventId), true);
  });

  it("remains idempotent on duplicate DiscussionCreated delivery", async () => {
    clearDomainEventHandlers();

    const user = await registerAndConfirm("Duplicate Discussion Member", "duplicate");
    await materializeWorkspaceForMember(user);
    registerWorkspaceHandlers();

    const activity = await createActivity({
      creatorMemberId: user.memberId,
      actorId: user.userId,
      command: ACTIVITY_COMMAND,
    });

    await dispatchOutboxOnceForTests();

    const created = await createDiscussion({
      creatorMemberId: user.memberId,
      actorId: user.userId,
      command: {
        ...DISCUSSION_COMMAND,
        activityId: activity.activity.activityId,
      },
    });

    await dispatchOutboxOnceForTests();
    await dispatchOutboxOnceForTests();

    const projection = await findWorkspaceProjectionByMemberId(user.memberId);
    assert.ok(projection);
    assert.equal(projection.recentActivities.length, 2);
    assert.equal(projection.recentActivities[0]?.discussionId, created.discussion.discussionId);
  });

  it("retries consumer after Workspace discussion projection write failure", async () => {
    resetEventInfrastructureForTests();

    const user = await registerAndConfirm("Retry Discussion Member", "retry");
    await materializeWorkspaceForMember(user);
    registerWorkspaceHandlers();

    const activity = await createActivity({
      creatorMemberId: user.memberId,
      actorId: user.userId,
      command: ACTIVITY_COMMAND,
    });

    await dispatchOutboxOnceForTests();

    const created = await createDiscussion({
      creatorMemberId: user.memberId,
      actorId: user.userId,
      command: {
        ...DISCUSSION_COMMAND,
        activityId: activity.activity.activityId,
      },
    });

    const eventId = buildDiscussionCreatedEventId(created.discussion.discussionId);
    const outbox = await getMongoCollection<{ envelope: string }>(MONGO_COLLECTIONS.outbox).findOne({
      eventId,
    });
    assert.ok(outbox);
    const envelope = deserializeDomainEventEnvelope(outbox.envelope);

    setForceWorkspaceDiscussionUpdateFailureForTests(true);
    await assert.rejects(
      () => handleDiscussionCreatedWorkspaceProjection(envelope),
      /Forced workspace discussion projection update failure/,
    );
    assert.equal(await isEventProcessed(WORKSPACE_DISCUSSION_CREATED_CONSUMER_ID, eventId), false);

    const beforeRetry = await findWorkspaceProjectionByMemberId(user.memberId);
    assert.ok(beforeRetry);
    assert.equal(
      beforeRetry.recentActivities.some((entry) => entry.discussionId === created.discussion.discussionId),
      false,
    );

    setForceWorkspaceDiscussionUpdateFailureForTests(false);
    await dispatchOutboxOnceForTests();

    const afterRetry = await findWorkspaceProjectionByMemberId(user.memberId);
    assert.ok(afterRetry);
    assert.equal(afterRetry.recentActivities[0]?.discussionId, created.discussion.discussionId);
    assert.equal(await isEventProcessed(WORKSPACE_DISCUSSION_CREATED_CONSUMER_ID, eventId), true);
  });

  it("retries DiscussionCreated when Workspace projection is not yet materialized", async () => {
    clearDomainEventHandlers();

    const user = await registerAndConfirm("Ordering Discussion Member", "ordering");
    await deleteWorkspaceProjectionByMemberId(user.memberId);
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

    registerWorkspaceHandlers();

    const activity = await createActivity({
      creatorMemberId: user.memberId,
      actorId: user.userId,
      command: ACTIVITY_COMMAND,
    });

    const created = await createDiscussion({
      creatorMemberId: user.memberId,
      actorId: user.userId,
      command: {
        ...DISCUSSION_COMMAND,
        activityId: activity.activity.activityId,
      },
    });

    const eventId = buildDiscussionCreatedEventId(created.discussion.discussionId);

    await dispatchOutboxOnceForTests();
    assert.equal(await countWorkspaceProjectionsByMemberId(user.memberId), 0);
    assert.equal(await isEventProcessed(WORKSPACE_DISCUSSION_CREATED_CONSUMER_ID, eventId), false);

    await handleMemberRegisteredWorkspaceProjection(
      deserializeDomainEventEnvelope(memberRegisteredOutbox.envelope),
    );

    await dispatchOutboxOnceForTests();

    const projection = await findWorkspaceProjectionByMemberId(user.memberId);
    assert.ok(projection);
    assert.equal(projection.recentActivities.some((entry) => entry.discussionId === created.discussion.discussionId), true);
    assert.equal(await isEventProcessed(WORKSPACE_DISCUSSION_CREATED_CONSUMER_ID, eventId), true);
  });

  it("rebuilds Workspace state from MemberRegistered, ActivityCreated, and DiscussionCreated replay", async () => {
    clearDomainEventHandlers();

    const user = await registerAndConfirm("Rebuild Discussion Member", "rebuild");
    await materializeWorkspaceForMember(user);
    registerWorkspaceHandlers();

    const activity = await createActivity({
      creatorMemberId: user.memberId,
      actorId: user.userId,
      command: ACTIVITY_COMMAND,
    });

    await dispatchOutboxOnceForTests();

    const created = await createDiscussion({
      creatorMemberId: user.memberId,
      actorId: user.userId,
      command: {
        ...DISCUSSION_COMMAND,
        activityId: activity.activity.activityId,
      },
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
    ).findOne({ eventId: buildActivityCreatedEventId(activity.activity.activityId) });
    assert.ok(activityCreatedOutbox);

    const discussionCreatedOutbox = await getMongoCollection<{ envelope: string }>(
      MONGO_COLLECTIONS.outbox,
    ).findOne({ eventId: buildDiscussionCreatedEventId(created.discussion.discussionId) });
    assert.ok(discussionCreatedOutbox);

    const memberRegisteredEnvelope = deserializeDomainEventEnvelope(memberRegisteredOutbox.envelope);
    const activityCreatedEnvelope = deserializeDomainEventEnvelope(activityCreatedOutbox.envelope);
    const discussionCreatedEnvelope = deserializeDomainEventEnvelope(discussionCreatedOutbox.envelope);

    await handleMemberRegisteredWorkspaceProjection(memberRegisteredEnvelope);
    await handleActivityCreatedWorkspaceProjection(activityCreatedEnvelope);
    await handleDiscussionCreatedWorkspaceProjection(discussionCreatedEnvelope);

    const replayed = await findWorkspaceProjectionByMemberId(user.memberId);
    assert.ok(replayed);
    assert.deepEqual(normalizeWorkspaceBusinessState(replayed), expectedState);
  });
});
