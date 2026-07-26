import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";

import { registerAuthUser } from "../../src/modules/auth/auth.service.js";
import { confirmRegistrationEmailCode } from "../../src/modules/auth/auth-email-confirmation.service.js";
import { deleteAuthUsersByEmailPrefix } from "../../src/modules/auth/auth-user.repository.js";
import { getLastIssuedConfirmationCodeForTests } from "../../src/modules/email/email-confirmation-code.repository.js";
import { confirmMemberRegistration } from "../../src/modules/member/application/confirm-member-registration.service.js";
import { buildMemberRegisteredEventId } from "../../src/modules/member/domain/member-registered.event.js";
import {
  countMembersByIdentityId,
  countMembersByMemberId,
  countOutboxEventsForMember,
  deleteMembersByMemberIdPrefix,
  findMemberByIdentityId,
} from "../../src/modules/member/infrastructure/member.repository.js";
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
import {
  deleteOutboxRecordsByEventIdPrefix,
  deleteProcessedEventsByConsumerIdPrefix,
  deleteProcessedEventsByEventIdPrefix,
  dispatchOutboxOnceForTests,
  isEventProcessed,
  resetOutboxDispatcherStateForTests,
  setForceEnqueueFailureForTests,
  stopOutboxDispatcher,
} from "../../src/infrastructure/outbox/index.js";
import { MONGO_COLLECTIONS } from "../../src/infrastructure/mongodb/mongo-collections.js";
import { getMongoCollection } from "../../src/infrastructure/mongodb/mongo-database.js";
import { findAuthUserByEmail } from "../../src/modules/auth/auth-user.repository.js";
import { resetSmtpTransportForTests } from "../../src/modules/email/smtp-transport.js";
import { createTestId, isMongoAvailableForTests, skipIfMongoUnavailable } from "../helpers/test-env.js";
import { resetEventInfrastructureForTests, drainPendingOutboxForTests } from "../helpers/test-events.js";

if (!isMongoAvailableForTests()) {
  skipIfMongoUnavailable();
}

const TEST_PREFIX = createTestId("member-reg");

function createTestEmail(suffix: string): string {
  return `${TEST_PREFIX}-${suffix}@member-reg.test`;
}

async function registerPendingUser(displayName: string, suffix: string) {
  const email = createTestEmail(suffix);

  await registerAuthUser({
    email,
    password: "Password123!",
    displayName,
  });

  const user = await findAuthUserByEmail(email);
  assert.ok(user);

  return user;
}

async function confirmUserRegistration(userId: string) {
  const code = getLastIssuedConfirmationCodeForTests(userId);
  assert.ok(code, "confirmation code should exist");

  return confirmRegistrationEmailCode({ userId, code });
}

describe("MemberRegistered transactional registration integration", () => {
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
    await deleteProcessedEventsByConsumerIdPrefix(TEST_PREFIX);
    await deleteProcessedEventsByEventIdPrefix("member-registered:");
    await deleteOutboxRecordsByEventIdPrefix("member-registered:");
    await deleteMembersByMemberIdPrefix(TEST_PREFIX);
    await deleteAuthUsersByEmailPrefix(`${TEST_PREFIX}-`);
    resetSmtpTransportForTests();
    await disconnectMongoClient();
  });

  it("creates one Member and one MemberRegistered outbox record on confirmation", async () => {
    const user = await registerPendingUser("Integration Member", "success");
    const correlationId = `${TEST_PREFIX}-corr-success`;

    const session = await confirmMemberRegistration(user, { correlationId });
    assert.equal(session.outcome, "created");

    assert.equal(await countMembersByMemberId(user.memberId), 1);
    assert.equal(await countMembersByIdentityId(user.userId), 1);
    assert.equal(await countOutboxEventsForMember(user.memberId), 1);

    const member = await findMemberByIdentityId(user.userId);
    assert.ok(member);

    const collection = getMongoCollection<{ envelope: string; correlationId: string }>(
      MONGO_COLLECTIONS.outbox,
    );

    const outboxRecord = await collection.findOne({
      aggregateId: user.memberId,
      eventName: CATALOGUE_EVENTS.memberRegistered,
    });

    assert.ok(outboxRecord);
    assert.equal(outboxRecord.correlationId, correlationId);

    const envelope = deserializeDomainEventEnvelope(outboxRecord.envelope);
    assert.equal(envelope.eventName, CATALOGUE_EVENTS.memberRegistered);
    assert.equal(envelope.aggregateId, user.memberId);
    assert.equal(envelope.payload.memberId, user.memberId);
    assert.equal(envelope.payload.identityId, user.userId);
    assert.equal(envelope.metadata.correlationId, correlationId);
    assert.equal("password" in envelope.payload, false);
    assert.equal("passwordHash" in envelope.payload, false);
    assert.equal("email" in envelope.payload, false);
  });

  it("rolls back Member and outbox writes when outbox enqueue fails", async () => {
    const user = await registerPendingUser("Rollback Member", "rollback");

    setForceEnqueueFailureForTests(true);

    await assert.rejects(
      () => confirmMemberRegistration(user),
      /Member registration transaction failed|Forced outbox enqueue failure/,
    );

    setForceEnqueueFailureForTests(false);

    assert.equal(await countMembersByMemberId(user.memberId), 0);
    assert.equal(await countOutboxEventsForMember(user.memberId), 0);

    const authUser = await findAuthUserByEmail(user.email);
    assert.equal(authUser?.emailVerificationStatus, "pending");
  });

  it("returns deterministic idempotent replay on duplicate confirmation", async () => {
    const user = await registerPendingUser("Idempotent Member", "idempotent");

    const first = await confirmMemberRegistration(user);
    const second = await confirmMemberRegistration(user);

    assert.equal(first.outcome, "created");
    assert.equal(second.outcome, "idempotent_replay");
    assert.equal(first.member.memberId, second.member.memberId);
    assert.equal(await countMembersByMemberId(user.memberId), 1);
    assert.equal(await countOutboxEventsForMember(user.memberId), 1);
  });

  it("creates only one Member and event under concurrent confirmation", async () => {
    const user = await registerPendingUser("Concurrent Member", "concurrent");

    const results = await Promise.allSettled([
      confirmMemberRegistration(user),
      confirmMemberRegistration(user),
    ]);

    const fulfilled = results.filter((result) => result.status === "fulfilled");

    assert.ok(fulfilled.length >= 1);
    assert.equal(await countMembersByMemberId(user.memberId), 1);
    assert.equal(await countOutboxEventsForMember(user.memberId), 1);
  });

  it("dispatches MemberRegistered to consumers with completed idempotency marker", async () => {
    clearDomainEventHandlers();
    await publishPendingMemberRegisteredOutboxForTests();

    const user = await registerPendingUser("Dispatch Member", "dispatch");
    await confirmMemberRegistration(user);

    const consumerId = `${TEST_PREFIX}-dispatch-consumer`;
    const eventId = buildMemberRegisteredEventId(user.memberId);
    let handlerCalls = 0;

    registerDomainEventHandler({
      consumerId,
      eventName: CATALOGUE_EVENTS.memberRegistered,
      handle: async (envelope) => {
        handlerCalls += 1;
        assert.equal(envelope.eventId, eventId);
        assert.equal(envelope.payload.memberId, user.memberId);
      },
    });

    const firstDispatch = await dispatchOutboxOnceForTests();
    assert.equal(firstDispatch, 1);
    assert.equal(handlerCalls, 1);
    assert.equal(await isEventProcessed(consumerId, eventId), true);

    const secondDispatch = await dispatchOutboxOnceForTests();
    assert.equal(secondDispatch, 0);
    assert.equal(handlerCalls, 1);
  });

  it("retries handler failures without permanently marking events completed", async () => {
    resetEventInfrastructureForTests();
    await drainPendingOutboxForTests();

    const user = await registerPendingUser("Retry Member", "retry");
    const registration = await confirmMemberRegistration(user);
    assert.equal(registration.outcome, "created");

    const consumerId = `${TEST_PREFIX}-retry-consumer`;
    const eventId = buildMemberRegisteredEventId(user.memberId);
    let handlerCalls = 0;

    registerDomainEventHandler({
      consumerId,
      eventName: CATALOGUE_EVENTS.memberRegistered,
      handle: async () => {
        handlerCalls += 1;

        if (handlerCalls === 1) {
          throw new Error("Simulated handler failure");
        }
      },
    });

    await dispatchOutboxOnceForTests();
    assert.equal(handlerCalls, 1);
    assert.equal(await isEventProcessed(consumerId, eventId), false);

    await dispatchOutboxOnceForTests();
    assert.equal(handlerCalls, 2);
    assert.equal(await isEventProcessed(consumerId, eventId), true);

    const published = await findOutboxRecordByEventNameForMember(user.memberId);
    assert.equal(published?.status, "published");
  });

  it("completes end-to-end registration confirmation through auth service", async () => {
    const user = await registerPendingUser("Auth Flow Member", "auth-flow");

    const session = await confirmUserRegistration(user.userId);
    assert.equal(session.kind, "session");
    assert.equal(session.user.memberId, user.memberId);

    assert.equal(await countMembersByMemberId(user.memberId), 1);
    assert.equal(await countOutboxEventsForMember(user.memberId), 1);

    const replaySession = await confirmUserRegistration(user.userId);
    assert.equal(replaySession.kind, "session");
    assert.equal(await countMembersByMemberId(user.memberId), 1);
    assert.equal(await countOutboxEventsForMember(user.memberId), 1);
  });
});

async function findOutboxRecordByEventNameForMember(memberId: string) {
  const collection = getMongoCollection<{
    _id: string;
    status: string;
  }>(MONGO_COLLECTIONS.outbox);

  return collection.findOne({
    aggregateId: memberId,
    eventName: CATALOGUE_EVENTS.memberRegistered,
  });
}

/** Clears undispatched MemberRegistered backlog so dispatch tests observe only their own event. */
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
