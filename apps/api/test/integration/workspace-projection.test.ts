import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";

import { deserializeDomainEventEnvelope } from "../../src/infrastructure/events/event-serialization.js";
import { registerAuthUser } from "../../src/modules/auth/auth.service.js";
import { confirmRegistrationEmailCode } from "../../src/modules/auth/auth-email-confirmation.service.js";
import { deleteAuthUsersByEmailPrefix } from "../../src/modules/auth/auth-user.repository.js";
import { getLastIssuedConfirmationCodeForTests } from "../../src/modules/email/email-confirmation-code.repository.js";
import { buildMemberRegisteredEventId } from "../../src/modules/member/domain/member-registered.event.js";
import { findMemberByIdentityId } from "../../src/modules/member/infrastructure/member.repository.js";
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
import { findAuthUserByEmail } from "../../src/modules/auth/auth-user.repository.js";
import {
  countWorkspaceProjectionsByMemberId,
  deleteWorkspaceProjectionByMemberId,
  deleteWorkspaceProjectionsByMemberIdPrefix,
  findWorkspaceProjectionByMemberId,
  insertWorkspaceProjectionIfAbsent,
  setForceWorkspaceProjectionInsertFailureForTests,
} from "../../src/modules/workspace/infrastructure/workspace-projection.repository.js";
import {
  buildWorkspaceProjectionFromMemberRegistered,
  toWorkspaceOverviewDto,
} from "../../src/modules/workspace/infrastructure/workspace-projection.persistence.js";
import {
  getWorkspaceOverviewForMember,
  rebuildWorkspaceProjectionFromMemberRegistered,
} from "../../src/modules/workspace/application/workspace-query.service.js";
import {
  handleMemberRegisteredWorkspaceProjection,
  WORKSPACE_MEMBER_REGISTERED_CONSUMER_ID,
} from "../../src/modules/workspace/application/member-registered.workspace-handler.js";
import { deleteMembersByMemberIdPrefix } from "../../src/modules/member/infrastructure/member.repository.js";
import { resetSmtpTransportForTests } from "../../src/modules/email/smtp-transport.js";
import { createTestId, isMongoAvailableForTests, skipIfMongoUnavailable } from "../helpers/test-env.js";
import { resetEventInfrastructureForTests, resetMemberRegisteredOutboxForDispatchTests, markMemberRegisteredOutboxPublishedForTests } from "../helpers/test-events.js";

if (!isMongoAvailableForTests()) {
  skipIfMongoUnavailable();
}

const TEST_PREFIX = createTestId("workspace-flow");

function createTestEmail(suffix: string): string {
  return `${TEST_PREFIX}-${suffix}@workspace.test`;
}

async function registerAndConfirm(displayName: string, suffix: string) {
  const email = createTestEmail(suffix);
  await registerAuthUser({ email, password: "Password123!", displayName });
  const user = await findAuthUserByEmail(email);
  assert.ok(user);
  const code = getLastIssuedConfirmationCodeForTests(user.userId);
  assert.ok(code);
  const session = await confirmRegistrationEmailCode({ userId: user.userId, code });
  await deleteWorkspaceProjectionByMemberId(user.memberId);
  await markMemberRegisteredOutboxPublishedForTests(user.memberId);
  return { user, session };
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

async function deleteProcessedEventForConsumer(
  consumerId: string,
  eventId: string,
): Promise<void> {
  const collection = getMongoCollection(MONGO_COLLECTIONS.processedEvents);
  await collection.deleteOne({ consumerId, eventId });
}

describe("Workspace projection integration", () => {
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

  it("materializes Workspace from registration through outbox dispatch", async () => {
    clearDomainEventHandlers();

    const { user } = await registerAndConfirm("Workspace Flow Member", "flow");

    assert.equal(await countWorkspaceProjectionsByMemberId(user.memberId), 0);

    registerDomainEventHandler({
      consumerId: WORKSPACE_MEMBER_REGISTERED_CONSUMER_ID,
      eventName: CATALOGUE_EVENTS.memberRegistered,
      handle: handleMemberRegisteredWorkspaceProjection,
    });

    await resetMemberRegisteredOutboxForDispatchTests(user.memberId);
    const dispatched = await dispatchOutboxOnceForTests();
    assert.equal(dispatched, 1);

    const projection = await findWorkspaceProjectionByMemberId(user.memberId);
    assert.ok(projection);
    assert.equal(projection.memberSummary.displayName, "Workspace Flow Member");
    assert.equal(projection.participationSummary.activeActivityCount, 0);
    assert.equal(projection.sourceEventId, buildMemberRegisteredEventId(user.memberId));

    const eventId = buildMemberRegisteredEventId(user.memberId);
    assert.equal(
      await isEventProcessed(WORKSPACE_MEMBER_REGISTERED_CONSUMER_ID, eventId),
      true,
    );

    const overview = await getWorkspaceOverviewForMember(user.memberId);
    assert.equal(overview.projectionStatus, "materialized");
    assert.equal(overview.memberSummary.displayName, "Workspace Flow Member");
    assert.equal(overview.participationSummary.awaitingMemberActionCount, 0);
    assert.equal("password" in overview, false);
    assert.equal("initiatives" in overview, false);
  });

  it("returns projection-pending overview before dispatch", async () => {
    clearDomainEventHandlers();

    const { user } = await registerAndConfirm("Pending Workspace Member", "pending");
    await deleteWorkspaceProjectionByMemberId(user.memberId);
    assert.equal(await countWorkspaceProjectionsByMemberId(user.memberId), 0);

    const overview = await getWorkspaceOverviewForMember(user.memberId);

    registerDomainEventHandler({
      consumerId: WORKSPACE_MEMBER_REGISTERED_CONSUMER_ID,
      eventName: CATALOGUE_EVENTS.memberRegistered,
      handle: handleMemberRegisteredWorkspaceProjection,
    });

    assert.equal(overview.projectionStatus, "pending");
    assert.equal(overview.memberSummary.displayName, "Pending Workspace Member");
    assert.equal(overview.participationSummary.completedActivityCount, 0);
    assert.equal(await countWorkspaceProjectionsByMemberId(user.memberId), 0);
  });

  it("remains idempotent on duplicate MemberRegistered delivery", async () => {
    await publishPendingMemberRegisteredOutboxForTests();
    const { user } = await registerAndConfirm("Duplicate Workspace Member", "duplicate");

    registerDomainEventHandler({
      consumerId: WORKSPACE_MEMBER_REGISTERED_CONSUMER_ID,
      eventName: CATALOGUE_EVENTS.memberRegistered,
      handle: handleMemberRegisteredWorkspaceProjection,
    });

    await resetMemberRegisteredOutboxForDispatchTests(user.memberId);
    await dispatchOutboxOnceForTests();
    await dispatchOutboxOnceForTests();

    assert.equal(await countWorkspaceProjectionsByMemberId(user.memberId), 1);
  });

  it("retries consumer after projection write failure", async () => {
    clearDomainEventHandlers();
    const { user } = await registerAndConfirm("Retry Workspace Member", "retry");
    const eventId = buildMemberRegisteredEventId(user.memberId);

    await deleteWorkspaceProjectionByMemberId(user.memberId);
    await deleteProcessedEventForConsumer(WORKSPACE_MEMBER_REGISTERED_CONSUMER_ID, eventId);

    const outbox = await getMongoCollection<{ envelope: string }>(MONGO_COLLECTIONS.outbox).findOne({
      eventId,
    });
    assert.ok(outbox);
    const envelope = deserializeDomainEventEnvelope(outbox.envelope);

    assert.equal(await countWorkspaceProjectionsByMemberId(user.memberId), 0);

    setForceWorkspaceProjectionInsertFailureForTests(true);
    await assert.rejects(
      () => handleMemberRegisteredWorkspaceProjection(envelope),
      /Forced workspace projection insert failure/,
    );
    assert.equal(await countWorkspaceProjectionsByMemberId(user.memberId), 0);
    assert.equal(await isEventProcessed(WORKSPACE_MEMBER_REGISTERED_CONSUMER_ID, eventId), false);

    setForceWorkspaceProjectionInsertFailureForTests(false);
    await handleMemberRegisteredWorkspaceProjection(envelope);
    assert.equal(await countWorkspaceProjectionsByMemberId(user.memberId), 1);
    assert.equal(await isEventProcessed(WORKSPACE_MEMBER_REGISTERED_CONSUMER_ID, eventId), false);
  });

  it("rebuilds projection deterministically from MemberRegistered", async () => {
    await publishPendingMemberRegisteredOutboxForTests();
    const { user } = await registerAndConfirm("Rebuild Workspace Member", "rebuild");

    registerDomainEventHandler({
      consumerId: WORKSPACE_MEMBER_REGISTERED_CONSUMER_ID,
      eventName: CATALOGUE_EVENTS.memberRegistered,
      handle: handleMemberRegisteredWorkspaceProjection,
    });

    await dispatchOutboxOnceForTests();

    const member = await findMemberByIdentityId(user.userId);
    assert.ok(member);

    const { deserializeDomainEventEnvelope } = await import(
      "../../src/infrastructure/events/event-serialization.js"
    );
    const { getMongoCollection } = await import(
      "../../src/infrastructure/mongodb/mongo-database.js"
    );
    const { MONGO_COLLECTIONS } = await import(
      "../../src/infrastructure/mongodb/mongo-collections.js"
    );

    const outbox = await getMongoCollection<{ envelope: string }>(
      MONGO_COLLECTIONS.outbox,
    ).findOne({ eventId: buildMemberRegisteredEventId(user.memberId) });

    assert.ok(outbox);
    const envelope = deserializeDomainEventEnvelope(outbox.envelope);

    await rebuildWorkspaceProjectionFromMemberRegistered(envelope);
    assert.equal(await countWorkspaceProjectionsByMemberId(user.memberId), 1);
  });

  it("persists repository records without leaking Mongo fields", async () => {
    const memberId = `${TEST_PREFIX}-repo-member`;
    const record = buildWorkspaceProjectionFromMemberRegistered({
      payload: {
        memberId,
        identityId: `${TEST_PREFIX}-repo-identity`,
        displayName: "Repo Member",
        uniqueName: `${TEST_PREFIX}-repo-unique`,
        verificationLevel: "email",
        registeredAt: new Date().toISOString(),
      },
      eventId: `member-registered:${memberId}`,
      correlationId: `${TEST_PREFIX}-repo-corr`,
      occurredAt: new Date().toISOString(),
    });

    assert.equal(await insertWorkspaceProjectionIfAbsent(record), "created");
    assert.equal(await insertWorkspaceProjectionIfAbsent(record), "idempotent_replay");

    const loaded = await findWorkspaceProjectionByMemberId(memberId);
    assert.ok(loaded);

    const dto = toWorkspaceOverviewDto(loaded);
    assert.equal(dto.workspaceId, record.workspaceId);
    assert.equal(dto.memberId, memberId);
    assert.equal("_id" in (dto as Record<string, unknown>), false);
  });
});
