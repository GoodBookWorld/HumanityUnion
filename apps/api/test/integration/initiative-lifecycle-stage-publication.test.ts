import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import { registerAuthUser } from "../../src/modules/auth/auth.service.js";
import { confirmRegistrationEmailCode } from "../../src/modules/auth/auth-email-confirmation.service.js";
import { deleteAuthUsersByEmailPrefix, findAuthUserByEmail } from "../../src/modules/auth/auth-user.repository.js";
import { getLastIssuedConfirmationCodeForTests } from "../../src/modules/email/email-confirmation-code.repository.js";
import { connectMongoClient, disconnectMongoClient } from "../../src/infrastructure/mongodb/mongo-connection.js";
import { ensureMongoIndexes } from "../../src/infrastructure/mongodb/mongo-indexes.js";
import { MONGO_COLLECTIONS } from "../../src/infrastructure/mongodb/mongo-collections.js";
import { getMongoCollection } from "../../src/infrastructure/mongodb/mongo-database.js";
import {
  deleteOutboxRecordsByEventIdPrefix,
  deleteProcessedEventsByConsumerIdPrefix,
  dispatchOutboxOnceForTests,
} from "../../src/infrastructure/outbox/index.js";
import { registerDomainEventHandler } from "../../src/infrastructure/integration/event-handler-registry.js";
import { CATALOGUE_EVENTS } from "../../src/infrastructure/events/catalogue-events.js";
import { upsertAlly, resetInitiativeAlliesStoreForTests } from "../../src/modules/initiative-discussion-collaboration/initiative-ally.store.js";
import {
  deleteNotificationsByRelatedEntity,
  listMyNotifications,
} from "../../src/modules/notifications/notification.service.js";
import {
  buildInitiativeLifecycleStagePublishedEventId,
} from "../../src/shared/initiative-lifecycle-stage/initiative-lifecycle-stage-published.event.js";
import {
  handleInitiativeLifecycleStagePublishedNotification,
  INITIATIVE_LIFECYCLE_STAGE_NOTIFICATION_CONSUMER_ID,
} from "../../src/shared/initiative-lifecycle-stage/initiative-lifecycle-stage-notification.consumer.js";
import { publishInitiativeLifecycleStage } from "../../src/shared/initiative-lifecycle-stage/initiative-lifecycle-stage-publication.service.js";
import { createTestId, isMongoAvailableForTests, skipIfMongoUnavailable } from "../helpers/test-env.js";
import { resetEventInfrastructureForTests } from "../helpers/test-events.js";

if (!isMongoAvailableForTests()) {
  skipIfMongoUnavailable();
}

const TEST_PREFIX = createTestId("initiative-lifecycle-stage-pub");
// Two distinct Initiative ids — one per test — so a pending outbox record
// left behind by one test (e.g. the first test's event, which that test
// deliberately never dispatches) can never be swept up by a later test's
// `dispatchOutboxOnceForTests()` batch call.
const INITIATIVE_ID_1 = `${TEST_PREFIX}-initiative-1`;
const INITIATIVE_ID_2 = `${TEST_PREFIX}-initiative-2`;

async function registerAndConfirm(displayName: string, suffix: string) {
  const email = `${TEST_PREFIX}-${suffix}@lifecycle-stage-pub.test`;
  await registerAuthUser({ email, password: "Password123!", displayName });
  const user = await findAuthUserByEmail(email);
  assert.ok(user);
  const code = getLastIssuedConfirmationCodeForTests(user.userId);
  assert.ok(code);
  await confirmRegistrationEmailCode({ userId: user.userId, code });
  return user;
}

describe("Initiative Lifecycle Part A — publishInitiativeLifecycleStage + Active Ally notification fan-out", () => {
  before(async () => {
    await connectMongoClient();
    await ensureMongoIndexes();
  });

  after(async () => {
    await deleteOutboxRecordsByEventIdPrefix(`initiative-lifecycle-stage-published:${TEST_PREFIX}`);
    await deleteProcessedEventsByConsumerIdPrefix(INITIATIVE_LIFECYCLE_STAGE_NOTIFICATION_CONSUMER_ID);
    await deleteNotificationsByRelatedEntity("initiative", INITIATIVE_ID_1);
    await deleteNotificationsByRelatedEntity("initiative", INITIATIVE_ID_2);
    await resetInitiativeAlliesStoreForTests(INITIATIVE_ID_1);
    await resetInitiativeAlliesStoreForTests(INITIATIVE_ID_2);
    await deleteAuthUsersByEmailPrefix(TEST_PREFIX);
    resetEventInfrastructureForTests();
    await disconnectMongoClient();
  });

  it("enqueues a durable outbox record, and a same-transition retry is idempotent (no duplicate)", async () => {
    const author = await registerAndConfirm("Author", "author");

    const relatedUrl = `/initiatives/public/${INITIATIVE_ID_1}#collaborative-analysis`;

    const first = await publishInitiativeLifecycleStage({
      initiativeId: INITIATIVE_ID_1,
      initiativeTitle: "Community Water Quality Review",
      stageId: "analysis",
      stageLabel: "Collaborative Analysis",
      stageArtifactId: `${INITIATIVE_ID_1}-analysis`,
      stageVersion: 1,
      actorParticipantId: author.memberId,
      publicationKind: "published",
      relatedUrl,
    });

    assert.equal(first.outcome, "enqueued");

    const eventId = buildInitiativeLifecycleStagePublishedEventId({
      initiativeId: INITIATIVE_ID_1,
      stageId: "analysis",
      stageVersion: 1,
      publicationKind: "published",
    });

    const outboxCollection = getMongoCollection(MONGO_COLLECTIONS.outbox);
    const matchingRecords = await outboxCollection.find({ eventId }).toArray();
    assert.equal(matchingRecords.length, 1);

    const second = await publishInitiativeLifecycleStage({
      initiativeId: INITIATIVE_ID_1,
      initiativeTitle: "Community Water Quality Review",
      stageId: "analysis",
      stageLabel: "Collaborative Analysis",
      stageArtifactId: `${INITIATIVE_ID_1}-analysis`,
      stageVersion: 1,
      actorParticipantId: author.memberId,
      publicationKind: "published",
      relatedUrl,
    });

    assert.equal(second.outcome, "duplicate_ignored");

    const matchingRecordsAfterRetry = await outboxCollection.find({ eventId }).toArray();
    assert.equal(matchingRecordsAfterRetry.length, 1, "an idempotent retry must never create a second outbox row");

    // Deliberately left pending (never dispatched) — proves the second test
    // below, which shares the outbox collection but uses a different
    // Initiative id, is unaffected by this leftover record.
  });

  it("fans out to real Active Allies (excluding the Author) once dispatched, and a redelivery does not double-notify", async () => {
    resetEventInfrastructureForTests();

    const author = await registerAndConfirm("Author Two", "author2");
    const ally = await registerAndConfirm("Ally One", "ally1");

    await upsertAlly({
      initiativeId: INITIATIVE_ID_2,
      participantId: ally.memberId,
      status: "active",
      requestedByParticipantId: ally.memberId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    registerDomainEventHandler({
      consumerId: INITIATIVE_LIFECYCLE_STAGE_NOTIFICATION_CONSUMER_ID,
      eventName: CATALOGUE_EVENTS.initiativeLifecycleStagePublished,
      handle: handleInitiativeLifecycleStagePublishedNotification,
    });

    const relatedUrl = `/initiatives/public/${INITIATIVE_ID_2}#collaborative-analysis`;

    await publishInitiativeLifecycleStage({
      initiativeId: INITIATIVE_ID_2,
      initiativeTitle: "Community Water Quality Review",
      stageId: "analysis",
      stageLabel: "Collaborative Analysis",
      stageArtifactId: `${INITIATIVE_ID_2}-analysis`,
      stageVersion: 1,
      actorParticipantId: author.memberId,
      publicationKind: "published",
      relatedUrl,
    });

    await dispatchOutboxOnceForTests();

    const allyNotifications = await listMyNotifications({ userId: ally.userId });
    const relevant = allyNotifications.notifications.filter((n) => n.relatedEntityId === INITIATIVE_ID_2);
    assert.equal(relevant.length, 1);
    assert.equal(relevant[0]?.relatedUrl, relatedUrl);

    const authorNotifications = await listMyNotifications({ userId: author.userId });
    const authorRelevant = authorNotifications.notifications.filter((n) => n.relatedEntityId === INITIATIVE_ID_2);
    assert.equal(authorRelevant.length, 0, "the acting Author must never notify themself");

    // Simulate an at-least-once redelivery of the already-published outbox
    // record (e.g. a dispatcher retry after a crash before markPublished).
    const eventId = buildInitiativeLifecycleStagePublishedEventId({
      initiativeId: INITIATIVE_ID_2,
      stageId: "analysis",
      stageVersion: 1,
      publicationKind: "published",
    });

    await getMongoCollection(MONGO_COLLECTIONS.outbox).updateOne(
      { eventId },
      { $set: { status: "pending", publishedAt: null } },
    );

    await dispatchOutboxOnceForTests();

    const allyNotificationsAfterRedelivery = await listMyNotifications({ userId: ally.userId });
    const relevantAfterRedelivery = allyNotificationsAfterRedelivery.notifications.filter(
      (n) => n.relatedEntityId === INITIATIVE_ID_2,
    );
    assert.equal(
      relevantAfterRedelivery.length,
      1,
      "a redelivered event must not fan out a second round of notifications",
    );
  });
});
