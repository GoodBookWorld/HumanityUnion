import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";

import { registerAuthUser } from "../../src/modules/auth/auth.service.js";
import { confirmRegistrationEmailCode } from "../../src/modules/auth/auth-email-confirmation.service.js";
import { deleteAuthUsersByEmailPrefix } from "../../src/modules/auth/auth-user.repository.js";
import { getLastIssuedConfirmationCodeForTests } from "../../src/modules/email/email-confirmation-code.repository.js";
import { resetSmtpTransportForTests } from "../../src/modules/email/smtp-transport.js";
import { deserializeDomainEventEnvelope } from "../../src/infrastructure/events/event-serialization.js";
import { CATALOGUE_EVENTS } from "../../src/infrastructure/events/catalogue-events.js";
import { clearDomainEventHandlers } from "../../src/infrastructure/integration/event-handler-registry.js";
import {
  connectMongoClient,
  disconnectMongoClient,
} from "../../src/infrastructure/mongodb/mongo-connection.js";
import { MONGO_COLLECTIONS } from "../../src/infrastructure/mongodb/mongo-collections.js";
import { getMongoCollection } from "../../src/infrastructure/mongodb/mongo-database.js";
import { ensureMongoIndexes } from "../../src/infrastructure/mongodb/mongo-indexes.js";
import {
  deleteOutboxRecordsByEventIdPrefix,
  deleteProcessedEventsByConsumerIdPrefix,
  deleteProcessedEventsByEventIdPrefix,
  isEventProcessed,
} from "../../src/infrastructure/outbox/index.js";
import { buildMemberRegisteredEventId } from "../../src/modules/member/domain/member-registered.event.js";
import { deleteMembersByMemberIdPrefix } from "../../src/modules/member/infrastructure/member.repository.js";
import { findAuthUserByEmail } from "../../src/modules/auth/auth-user.repository.js";
import type { WorkspaceProjectionRecord } from "../../src/modules/workspace/domain/workspace-projection.types.js";
import {
  initializeWorkspaceFromMemberRegisteredEnvelope,
  WORKSPACE_MEMBER_REGISTERED_CONSUMER_ID,
} from "../../src/modules/workspace/application/member-registered.workspace-handler.js";
import {
  getWorkspaceOverviewForMember,
} from "../../src/modules/workspace/application/workspace-query.service.js";
import {
  countWorkspaceProjectionsByMemberId,
  deleteWorkspaceProjectionByMemberId,
  deleteWorkspaceProjectionsByMemberIdPrefix,
  findWorkspaceProjectionByMemberId,
  setForceWorkspaceProjectionInsertFailureForTests,
} from "../../src/modules/workspace/infrastructure/workspace-projection.repository.js";
import { createTestId, isMongoAvailableForTests, skipIfMongoUnavailable } from "../helpers/test-env.js";
import { resetEventInfrastructureForTests, markMemberRegisteredOutboxPublishedForTests } from "../helpers/test-events.js";

if (!isMongoAvailableForTests()) {
  skipIfMongoUnavailable();
}

const TEST_PREFIX = createTestId("workspace-rebuild");

/**
 * Deterministic business-state snapshot for rebuild equality.
 * Excludes only Mongo `_id` (not present on domain record).
 * `createdAt` / `updatedAt` are derived from the source event `occurredAt`
 * and must match on replay when the same envelope is used.
 */
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

function createTestEmail(suffix: string): string {
  return `${TEST_PREFIX}-${suffix}@workspace-rebuild.test`;
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

describe("Workspace MemberRegistered rebuild verification gate", () => {
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

  it("reconstructs identical business state from preserved MemberRegistered envelope", async () => {
    clearDomainEventHandlers();

    const user = await registerAndConfirm("Rebuild Gate Member", "gate");
    const eventId = buildMemberRegisteredEventId(user.memberId);

    const outbox = await getMongoCollection<{ envelope: string }>(MONGO_COLLECTIONS.outbox).findOne({
      eventId,
    });
    assert.ok(outbox);
    const envelope = deserializeDomainEventEnvelope(outbox.envelope);

    await deleteWorkspaceProjectionByMemberId(user.memberId);
    await deleteProcessedEventForConsumer(WORKSPACE_MEMBER_REGISTERED_CONSUMER_ID, eventId);
    assert.equal(await countWorkspaceProjectionsByMemberId(user.memberId), 0);
    assert.equal(await initializeWorkspaceFromMemberRegisteredEnvelope(envelope), "created");

    const original = await findWorkspaceProjectionByMemberId(user.memberId);
    assert.ok(original);
    const originalState = normalizeWorkspaceBusinessState(original);

    assert.equal(await deleteWorkspaceProjectionByMemberId(user.memberId), true);
    assert.equal(await countWorkspaceProjectionsByMemberId(user.memberId), 0);
    await deleteProcessedEventForConsumer(WORKSPACE_MEMBER_REGISTERED_CONSUMER_ID, eventId);
    assert.equal(await isEventProcessed(WORKSPACE_MEMBER_REGISTERED_CONSUMER_ID, eventId), false);

    const outcome = await initializeWorkspaceFromMemberRegisteredEnvelope(envelope);
    assert.equal(outcome, "created");

    const rebuilt = await findWorkspaceProjectionByMemberId(user.memberId);
    assert.ok(rebuilt);
    assert.deepEqual(normalizeWorkspaceBusinessState(rebuilt), originalState);

    const overview = await getWorkspaceOverviewForMember(user.memberId);
    assert.equal(overview.projectionStatus, "materialized");
    assert.equal(overview.workspaceId, originalState.workspaceId);
    assert.equal(overview.participationSummary.activeActivityCount, 0);
    assert.equal("password" in overview, false);
    assert.equal("initiatives" in overview, false);
    assert.equal(await countWorkspaceProjectionsByMemberId(user.memberId), 1);
  });

  it("reports idempotent replay without resetting projection on second envelope delivery", async () => {
    clearDomainEventHandlers();

    const user = await registerAndConfirm("Rebuild Idempotent Member", "idempotent");
    const eventId = buildMemberRegisteredEventId(user.memberId);

    const outbox = await getMongoCollection<{ envelope: string }>(MONGO_COLLECTIONS.outbox).findOne({
      eventId,
    });
    assert.ok(outbox);
    const envelope = deserializeDomainEventEnvelope(outbox.envelope);

    await deleteWorkspaceProjectionByMemberId(user.memberId);
    assert.equal(await countWorkspaceProjectionsByMemberId(user.memberId), 0);

    assert.equal(await initializeWorkspaceFromMemberRegisteredEnvelope(envelope), "created");
    const original = await findWorkspaceProjectionByMemberId(user.memberId);
    assert.ok(original);
    const originalState = normalizeWorkspaceBusinessState(original);

    await deleteWorkspaceProjectionByMemberId(user.memberId);
    await deleteProcessedEventForConsumer(WORKSPACE_MEMBER_REGISTERED_CONSUMER_ID, eventId);
    assert.equal(await countWorkspaceProjectionsByMemberId(user.memberId), 0);

    assert.equal(await initializeWorkspaceFromMemberRegisteredEnvelope(envelope), "created");
    const replayOutcome = await initializeWorkspaceFromMemberRegisteredEnvelope(envelope);
    assert.equal(replayOutcome, "idempotent_replay");

    const afterReplay = await findWorkspaceProjectionByMemberId(user.memberId);
    assert.ok(afterReplay);
    assert.deepEqual(normalizeWorkspaceBusinessState(afterReplay), originalState);
    assert.equal(afterReplay.projectionVersion, original.projectionVersion);
    assert.equal(await countWorkspaceProjectionsByMemberId(user.memberId), 1);
  });

  it("retries handler replay after forced projection write failure", async () => {
    clearDomainEventHandlers();

    const user = await registerAndConfirm("Rebuild Retry Member", "retry");
    const eventId = buildMemberRegisteredEventId(user.memberId);

    const outbox = await getMongoCollection<{ envelope: string }>(MONGO_COLLECTIONS.outbox).findOne({
      eventId,
    });
    assert.ok(outbox);
    const envelope = deserializeDomainEventEnvelope(outbox.envelope);

    await deleteWorkspaceProjectionByMemberId(user.memberId);
    assert.equal(await countWorkspaceProjectionsByMemberId(user.memberId), 0);
    assert.equal(await initializeWorkspaceFromMemberRegisteredEnvelope(envelope), "created");

    await deleteWorkspaceProjectionByMemberId(user.memberId);
    await deleteProcessedEventForConsumer(WORKSPACE_MEMBER_REGISTERED_CONSUMER_ID, eventId);

    setForceWorkspaceProjectionInsertFailureForTests(true);
    await assert.rejects(
      () => initializeWorkspaceFromMemberRegisteredEnvelope(envelope),
      /Forced workspace projection insert failure/,
    );
    assert.equal(await countWorkspaceProjectionsByMemberId(user.memberId), 0);

    setForceWorkspaceProjectionInsertFailureForTests(false);
    assert.equal(await initializeWorkspaceFromMemberRegisteredEnvelope(envelope), "created");
    assert.equal(await countWorkspaceProjectionsByMemberId(user.memberId), 1);
  });
});
