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
  buildProposalCreatedEventId,
  buildProposalSubmittedEventId,
  createProposal,
  deleteProposalsByCreatorMemberIdPrefix,
  deleteProposalsByProposalIdPrefix,
  submitProposal,
} from "../../src/modules/proposal/index.js";
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
import {
  handleProposalCreatedWorkspaceProjection,
  WORKSPACE_PROPOSAL_CREATED_CONSUMER_ID,
} from "../../src/modules/workspace/application/proposal-created.workspace-handler.js";
import {
  handleProposalSubmittedWorkspaceProjection,
  WORKSPACE_PROPOSAL_SUBMITTED_CONSUMER_ID,
} from "../../src/modules/workspace/application/proposal-submitted.workspace-handler.js";
import type { WorkspaceProjectionRecord } from "../../src/modules/workspace/domain/workspace-projection.types.js";
import { WorkspaceProjectionOrderingNotReadyError } from "../../src/modules/workspace/workspace.errors.js";
import {
  countWorkspaceProjectionsByMemberId,
  deleteWorkspaceProjectionByMemberId,
  deleteWorkspaceProjectionsByMemberIdPrefix,
  findWorkspaceProjectionByMemberId,
  setForceWorkspaceProposalSubmissionUpdateFailureForTests,
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

const TEST_PREFIX = createTestId("proposal-submitted-workspace");

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

const PROPOSAL_COMMAND = {
  title: "Water Quality Proposal",
  summary: "A structured proposal to improve local water quality reporting.",
  proposalText:
    "This proposal recommends coordinated review of municipal water quality disclosures with community oversight.",
};

function createTestEmail(suffix: string): string {
  return `${TEST_PREFIX}-${suffix}@proposal-submitted-workspace.test`;
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

  registerDomainEventHandler({
    consumerId: WORKSPACE_PROPOSAL_CREATED_CONSUMER_ID,
    eventName: CATALOGUE_EVENTS.proposalCreated,
    handle: handleProposalCreatedWorkspaceProjection,
  });

  registerDomainEventHandler({
    consumerId: WORKSPACE_PROPOSAL_SUBMITTED_CONSUMER_ID,
    eventName: CATALOGUE_EVENTS.proposalSubmitted,
    handle: handleProposalSubmittedWorkspaceProjection,
  });
}

async function seedProposalFlow(user: { memberId: string; userId: string }) {
  const activity = await createActivity({
    creatorMemberId: user.memberId,
    actorId: user.userId,
    command: ACTIVITY_COMMAND,
  });

  await dispatchOutboxOnceForTests();

  const discussion = await createDiscussion({
    creatorMemberId: user.memberId,
    actorId: user.userId,
    command: {
      ...DISCUSSION_COMMAND,
      activityId: activity.activity.activityId,
    },
  });

  await dispatchOutboxOnceForTests();

  const created = await createProposal({
    creatorMemberId: user.memberId,
    actorId: user.userId,
    command: {
      ...PROPOSAL_COMMAND,
      activityId: activity.activity.activityId,
      discussionId: discussion.discussion.discussionId,
    },
  });

  await dispatchOutboxOnceForTests();

  const submitted = await submitProposal({
    memberId: user.memberId,
    actorId: user.userId,
    command: { proposalId: created.proposal.proposalId },
  });

  return {
    activity,
    discussion,
    created,
    submitted,
  };
}

describe("ProposalSubmitted Workspace projection integration", () => {
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
    await deleteProcessedEventsByConsumerIdPrefix(WORKSPACE_PROPOSAL_SUBMITTED_CONSUMER_ID);
    await deleteProcessedEventsByConsumerIdPrefix(WORKSPACE_PROPOSAL_CREATED_CONSUMER_ID);
    await deleteProcessedEventsByConsumerIdPrefix(WORKSPACE_DISCUSSION_CREATED_CONSUMER_ID);
    await deleteProcessedEventsByConsumerIdPrefix(WORKSPACE_ACTIVITY_CREATED_CONSUMER_ID);
    await deleteProcessedEventsByConsumerIdPrefix(WORKSPACE_MEMBER_REGISTERED_CONSUMER_ID);
    await deleteProcessedEventsByEventIdPrefix("proposal-submitted:");
    await deleteProcessedEventsByEventIdPrefix("proposal-created:");
    await deleteProcessedEventsByEventIdPrefix("discussion-created:");
    await deleteProcessedEventsByEventIdPrefix("activity-created:");
    await deleteProcessedEventsByEventIdPrefix("member-registered:");
    await deleteOutboxRecordsByEventIdPrefix("proposal-submitted:");
    await deleteOutboxRecordsByEventIdPrefix("proposal-created:");
    await deleteOutboxRecordsByEventIdPrefix("discussion-created:");
    await deleteOutboxRecordsByEventIdPrefix("activity-created:");
    await deleteOutboxRecordsByEventIdPrefix("member-registered:");
    await deleteProposalsByProposalIdPrefix(TEST_PREFIX);
    await deleteProposalsByCreatorMemberIdPrefix(TEST_PREFIX);
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

  it("updates existing Proposal card to submitted through outbox dispatch", async () => {
    clearDomainEventHandlers();

    const user = await registerAndConfirm("Submitted Workspace Member", "flow");
    await materializeWorkspaceForMember(user);
    registerWorkspaceHandlers();

    const { created, submitted } = await seedProposalFlow(user);

    assert.equal(await dispatchOutboxOnceForTests(), 1);

    const projection = await findWorkspaceProjectionByMemberId(user.memberId);
    assert.ok(projection);
    assert.equal(projection.participationSummary.activeActivityCount, 1);
    assert.equal(
      projection.recentActivities.filter((entry) => entry.proposalId === created.proposal.proposalId).length,
      1,
    );

    const proposalCard = projection.recentActivities.find(
      (entry) => entry.proposalId === created.proposal.proposalId,
    );
    assert.ok(proposalCard);
    assert.equal(proposalCard.status, "submitted");
    assert.equal(proposalCard.sourceEventId, buildProposalSubmittedEventId(created.proposal.proposalId));

    const overview = await getWorkspaceOverviewForMember(user.memberId);
    assert.equal(overview.recentActivities.length, 3);
    assert.equal(submitted.proposal.status, "submitted");

    const eventId = buildProposalSubmittedEventId(created.proposal.proposalId);
    assert.equal(await isEventProcessed(WORKSPACE_PROPOSAL_SUBMITTED_CONSUMER_ID, eventId), true);
  });

  it("remains idempotent on duplicate ProposalSubmitted delivery", async () => {
    clearDomainEventHandlers();

    const user = await registerAndConfirm("Duplicate Submitted Member", "duplicate");
    await materializeWorkspaceForMember(user);
    registerWorkspaceHandlers();

    const { created } = await seedProposalFlow(user);

    await dispatchOutboxOnceForTests();
    await dispatchOutboxOnceForTests();

    const projection = await findWorkspaceProjectionByMemberId(user.memberId);
    assert.ok(projection);
    assert.equal(
      projection.recentActivities.filter((entry) => entry.proposalId === created.proposal.proposalId).length,
      1,
    );
    assert.equal(
      projection.recentActivities.find((entry) => entry.proposalId === created.proposal.proposalId)?.status,
      "submitted",
    );
  });

  it("retries consumer after Workspace proposal submission projection write failure", async () => {
    resetEventInfrastructureForTests();

    const user = await registerAndConfirm("Retry Submitted Member", "retry");
    await materializeWorkspaceForMember(user);
    registerWorkspaceHandlers();

    const { created } = await seedProposalFlow(user);

    const eventId = buildProposalSubmittedEventId(created.proposal.proposalId);
    const outbox = await getMongoCollection<{ envelope: string }>(MONGO_COLLECTIONS.outbox).findOne({
      eventId,
    });
    assert.ok(outbox);
    const envelope = deserializeDomainEventEnvelope(outbox.envelope);

    setForceWorkspaceProposalSubmissionUpdateFailureForTests(true);
    await assert.rejects(
      () => handleProposalSubmittedWorkspaceProjection(envelope),
      /Forced workspace proposal submission projection update failure/,
    );
    assert.equal(await isEventProcessed(WORKSPACE_PROPOSAL_SUBMITTED_CONSUMER_ID, eventId), false);

    const beforeRetry = await findWorkspaceProjectionByMemberId(user.memberId);
    assert.ok(beforeRetry);
    assert.equal(
      beforeRetry.recentActivities.find((entry) => entry.proposalId === created.proposal.proposalId)?.status,
      "draft",
    );

    setForceWorkspaceProposalSubmissionUpdateFailureForTests(false);
    await dispatchOutboxOnceForTests();

    const afterRetry = await findWorkspaceProjectionByMemberId(user.memberId);
    assert.ok(afterRetry);
    assert.equal(
      afterRetry.recentActivities.find((entry) => entry.proposalId === created.proposal.proposalId)?.status,
      "submitted",
    );
    assert.equal(await isEventProcessed(WORKSPACE_PROPOSAL_SUBMITTED_CONSUMER_ID, eventId), true);
  });

  it("retries ProposalSubmitted when Workspace projection is not yet materialized", async () => {
    clearDomainEventHandlers();

    const user = await registerAndConfirm("Missing Workspace Member", "missing-workspace");
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

    const { created } = await seedProposalFlow(user);
    const eventId = buildProposalSubmittedEventId(created.proposal.proposalId);

    await dispatchOutboxOnceForTests();
    assert.equal(await countWorkspaceProjectionsByMemberId(user.memberId), 0);
    assert.equal(await isEventProcessed(WORKSPACE_PROPOSAL_SUBMITTED_CONSUMER_ID, eventId), false);

    await handleMemberRegisteredWorkspaceProjection(
      deserializeDomainEventEnvelope(memberRegisteredOutbox.envelope),
    );

    for (let attempt = 0; attempt < 3; attempt += 1) {
      await dispatchOutboxOnceForTests();

      if (await isEventProcessed(WORKSPACE_PROPOSAL_SUBMITTED_CONSUMER_ID, eventId)) {
        break;
      }
    }

    const projection = await findWorkspaceProjectionByMemberId(user.memberId);
    assert.ok(projection);
    assert.equal(
      projection.recentActivities.find((entry) => entry.proposalId === created.proposal.proposalId)?.status,
      "submitted",
    );
    assert.equal(await isEventProcessed(WORKSPACE_PROPOSAL_SUBMITTED_CONSUMER_ID, eventId), true);
  });

  it("retries ProposalSubmitted when ProposalCreated projection has not yet run", async () => {
    clearDomainEventHandlers();

    const user = await registerAndConfirm("Ordering Submitted Member", "ordering");
    await materializeWorkspaceForMember(user);

    const activity = await createActivity({
      creatorMemberId: user.memberId,
      actorId: user.userId,
      command: ACTIVITY_COMMAND,
    });

    const activityCreatedOutbox = await getMongoCollection<{ envelope: string }>(
      MONGO_COLLECTIONS.outbox,
    ).findOne({ eventId: buildActivityCreatedEventId(activity.activity.activityId) });
    assert.ok(activityCreatedOutbox);
    await handleActivityCreatedWorkspaceProjection(
      deserializeDomainEventEnvelope(activityCreatedOutbox.envelope),
    );

    const created = await createProposal({
      creatorMemberId: user.memberId,
      actorId: user.userId,
      command: {
        ...PROPOSAL_COMMAND,
        activityId: activity.activity.activityId,
      },
    });

    await submitProposal({
      memberId: user.memberId,
      actorId: user.userId,
      command: { proposalId: created.proposal.proposalId },
    });

    const workspaceBeforeSubmissionProjection = await findWorkspaceProjectionByMemberId(user.memberId);
    assert.ok(workspaceBeforeSubmissionProjection);
    assert.equal(
      workspaceBeforeSubmissionProjection.recentActivities.some(
        (entry) => entry.proposalId === created.proposal.proposalId,
      ),
      false,
    );

    const submittedOutbox = await getMongoCollection<{ envelope: string }>(MONGO_COLLECTIONS.outbox).findOne({
      eventId: buildProposalSubmittedEventId(created.proposal.proposalId),
    });
    assert.ok(submittedOutbox);
    const submittedEnvelope = deserializeDomainEventEnvelope(submittedOutbox.envelope);

    await assert.rejects(
      () => handleProposalSubmittedWorkspaceProjection(submittedEnvelope),
      WorkspaceProjectionOrderingNotReadyError,
    );

    const proposalCreatedOutbox = await getMongoCollection<{ envelope: string }>(MONGO_COLLECTIONS.outbox).findOne({
      eventId: buildProposalCreatedEventId(created.proposal.proposalId),
    });
    assert.ok(proposalCreatedOutbox);
    await handleProposalCreatedWorkspaceProjection(
      deserializeDomainEventEnvelope(proposalCreatedOutbox.envelope),
    );

    await handleProposalSubmittedWorkspaceProjection(submittedEnvelope);

    const projection = await findWorkspaceProjectionByMemberId(user.memberId);
    assert.ok(projection);
    assert.equal(
      projection.recentActivities.filter((entry) => entry.proposalId === created.proposal.proposalId).length,
      1,
    );
    assert.equal(
      projection.recentActivities.find((entry) => entry.proposalId === created.proposal.proposalId)?.status,
      "submitted",
    );
  });

  it("rebuilds Workspace state from MemberRegistered through ProposalSubmitted replay", async () => {
    clearDomainEventHandlers();

    const user = await registerAndConfirm("Rebuild Submitted Member", "rebuild");
    await materializeWorkspaceForMember(user);
    registerWorkspaceHandlers();

    const { activity, discussion, created } = await seedProposalFlow(user);

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
    ).findOne({ eventId: buildDiscussionCreatedEventId(discussion.discussion.discussionId) });
    assert.ok(discussionCreatedOutbox);

    const proposalCreatedOutbox = await getMongoCollection<{ envelope: string }>(
      MONGO_COLLECTIONS.outbox,
    ).findOne({ eventId: buildProposalCreatedEventId(created.proposal.proposalId) });
    assert.ok(proposalCreatedOutbox);

    const proposalSubmittedOutbox = await getMongoCollection<{ envelope: string }>(
      MONGO_COLLECTIONS.outbox,
    ).findOne({ eventId: buildProposalSubmittedEventId(created.proposal.proposalId) });
    assert.ok(proposalSubmittedOutbox);

    await handleMemberRegisteredWorkspaceProjection(
      deserializeDomainEventEnvelope(memberRegisteredOutbox.envelope),
    );
    await handleActivityCreatedWorkspaceProjection(
      deserializeDomainEventEnvelope(activityCreatedOutbox.envelope),
    );
    await handleDiscussionCreatedWorkspaceProjection(
      deserializeDomainEventEnvelope(discussionCreatedOutbox.envelope),
    );
    await handleProposalCreatedWorkspaceProjection(
      deserializeDomainEventEnvelope(proposalCreatedOutbox.envelope),
    );
    await handleProposalSubmittedWorkspaceProjection(
      deserializeDomainEventEnvelope(proposalSubmittedOutbox.envelope),
    );

    const replayed = await findWorkspaceProjectionByMemberId(user.memberId);
    assert.ok(replayed);
    assert.deepEqual(normalizeWorkspaceBusinessState(replayed), expectedState);

    await handleProposalSubmittedWorkspaceProjection(
      deserializeDomainEventEnvelope(proposalSubmittedOutbox.envelope),
    );

    const idempotentReplay = await findWorkspaceProjectionByMemberId(user.memberId);
    assert.ok(idempotentReplay);
    assert.deepEqual(normalizeWorkspaceBusinessState(idempotentReplay), expectedState);
  });
});
