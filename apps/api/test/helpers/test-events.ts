import { clearDomainEventHandlers } from "../../src/infrastructure/integration/event-handler-registry.js";
import { CATALOGUE_EVENTS } from "../../src/infrastructure/events/catalogue-events.js";
import { MONGO_COLLECTIONS } from "../../src/infrastructure/mongodb/mongo-collections.js";
import { isMongoConfigured } from "../../src/infrastructure/mongodb/mongo-config.js";
import { connectMongoClient } from "../../src/infrastructure/mongodb/mongo-connection.js";
import { getMongoCollection } from "../../src/infrastructure/mongodb/mongo-database.js";
import {
  resetOutboxDispatcherStateForTests,
  setForceEnqueueFailureForTests,
  stopOutboxDispatcher,
} from "../../src/infrastructure/outbox/index.js";
import { buildMemberRegisteredEventId } from "../../src/modules/member/domain/member-registered.event.js";
import { WORKSPACE_MEMBER_REGISTERED_CONSUMER_ID } from "../../src/modules/workspace/application/member-registered.workspace-handler.js";
import { resetWorkspaceProjectionHandlersForTests } from "../../src/modules/workspace/index.js";
import {
  setForceWorkspaceActivityUpdateFailureForTests,
  setForceWorkspaceDiscussionUpdateFailureForTests,
  setForceWorkspaceProposalUpdateFailureForTests,
  setForceWorkspaceProposalSubmissionUpdateFailureForTests,
  setForceWorkspaceProjectionInsertFailureForTests,
} from "../../src/modules/workspace/infrastructure/workspace-projection.repository.js";

export function resetEventInfrastructureForTests(): void {
  stopOutboxDispatcher();
  resetOutboxDispatcherStateForTests();
  clearDomainEventHandlers();
  resetWorkspaceProjectionHandlersForTests();
  setForceEnqueueFailureForTests(false);
  setForceWorkspaceProjectionInsertFailureForTests(false);
  setForceWorkspaceActivityUpdateFailureForTests(false);
  setForceWorkspaceDiscussionUpdateFailureForTests(false);
  setForceWorkspaceProposalUpdateFailureForTests(false);
  setForceWorkspaceProposalSubmissionUpdateFailureForTests(false);
  setForceWorkspaceDecisionUpdateFailureForTests(false);
}

export async function drainPendingOutboxForTests(): Promise<void> {
  if (!isMongoConfigured()) {
    return;
  }

  await connectMongoClient();
  await getMongoCollection(MONGO_COLLECTIONS.outbox).updateMany(
    { status: { $in: ["pending", "failed"] } },
    {
      $set: {
        status: "published",
        publishedAt: new Date().toISOString(),
      },
    },
  );
}

/** Prevent external dispatchers from consuming registration events during tests. */
export async function markMemberRegisteredOutboxPublishedForTests(memberId: string): Promise<void> {
  if (!isMongoConfigured()) {
    return;
  }

  await connectMongoClient();
  const eventId = buildMemberRegisteredEventId(memberId);

  await getMongoCollection(MONGO_COLLECTIONS.processedEvents).deleteOne({
    consumerId: WORKSPACE_MEMBER_REGISTERED_CONSUMER_ID,
    eventId,
  });

  await getMongoCollection(MONGO_COLLECTIONS.outbox).updateOne(
    { eventId, eventName: CATALOGUE_EVENTS.memberRegistered },
    {
      $set: {
        status: "published",
        publishedAt: new Date().toISOString(),
        attempts: 0,
        lastError: null,
      },
    },
  );
}

/** Re-queue a MemberRegistered outbox record for deterministic dispatch in integration tests. */
export async function resetMemberRegisteredOutboxForDispatchTests(memberId: string): Promise<void> {
  if (!isMongoConfigured()) {
    return;
  }

  await connectMongoClient();
  const eventId = buildMemberRegisteredEventId(memberId);

  await getMongoCollection(MONGO_COLLECTIONS.processedEvents).deleteOne({
    consumerId: WORKSPACE_MEMBER_REGISTERED_CONSUMER_ID,
    eventId,
  });

  await getMongoCollection(MONGO_COLLECTIONS.outbox).updateOne(
    { eventId, eventName: CATALOGUE_EVENTS.memberRegistered },
    {
      $set: {
        status: "pending",
        attempts: 0,
        lastError: null,
        publishedAt: null,
      },
    },
  );
}
