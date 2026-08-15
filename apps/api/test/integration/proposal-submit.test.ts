import assert from "node:assert/strict";
import http from "node:http";
import { after, afterEach, before, beforeEach, describe, it } from "node:test";

import express from "express";

import { registerAuthUser } from "../../src/modules/auth/auth.service.js";
import { createAccessToken } from "../../src/modules/auth/auth-tokens.js";
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
import {
  createActivity,
  deleteActivitiesByActivityIdPrefix,
  deleteActivitiesByCreatorMemberIdPrefix,
} from "../../src/modules/activity/index.js";
import {
  createDiscussion,
  deleteDiscussionsByCreatorMemberIdPrefix,
  deleteDiscussionsByDiscussionIdPrefix,
} from "../../src/modules/discussion/index.js";
import proposalRouter from "../../src/modules/proposal/api/proposal.routes.js";
import {
  buildProposalCreatedEventId,
  buildProposalSubmittedEventId,
  countProposals,
  createProposal,
  deleteProposalsByCreatorMemberIdPrefix,
  deleteProposalsByProposalIdPrefix,
  findProposalById,
} from "../../src/modules/proposal/index.js";
import { createTestId, isMongoAvailableForTests, skipIfMongoUnavailable } from "../helpers/test-env.js";
import { resetEventInfrastructureForTests } from "../helpers/test-events.js";

if (!isMongoAvailableForTests()) {
  skipIfMongoUnavailable();
}

const TEST_PREFIX = createTestId("proposal-submit");

const ACTIVITY_BODY = {
  title: "Community Water Quality Review",
  description: "A civic participation activity to review local water quality reporting.",
  activityType: "civic_participation",
  visibility: "public",
};

const DISCUSSION_BODY = {
  title: "Water Quality Discussion",
  openingMessage: "Let's review the latest water quality reporting together.",
};

const PROPOSAL_BODY = {
  title: "Water Quality Proposal",
  summary: "A structured proposal to improve local water quality reporting.",
  proposalText:
    "This proposal recommends coordinated review of municipal water quality disclosures with community oversight.",
};

function createTestEmail(suffix: string): string {
  return `${TEST_PREFIX}-${suffix}@proposal-submit.test`;
}

async function registerAndConfirm(displayName: string, suffix: string) {
  const email = createTestEmail(suffix);
  const registration = await registerAuthUser({ email, password: "Password123!", displayName });
  const user = await findAuthUserByEmail(email);
  assert.ok(user);
  const code = getLastIssuedConfirmationCodeForTests(user.userId);
  assert.ok(code);
  const session = await confirmRegistrationEmailCode({ userId: user.userId, code });
  return { user, session, registration };
}

function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/v1/proposals", proposalRouter);
  return app;
}

async function requestProposal(
  method: "GET" | "POST",
  path: string,
  accessToken: string | null,
  body?: Record<string, unknown>,
): Promise<{ status: number; body: Record<string, unknown> }> {
  const app = createTestApp();
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

async function seedDraftProposal(user: { memberId: string; userId: string }) {
  const activity = await createActivity({
    creatorMemberId: user.memberId,
    actorId: user.userId,
    command: ACTIVITY_BODY,
  });

  const discussion = await createDiscussion({
    creatorMemberId: user.memberId,
    actorId: user.userId,
    command: {
      ...DISCUSSION_BODY,
      activityId: activity.activity.activityId,
    },
  });

  const created = await createProposal({
    creatorMemberId: user.memberId,
    actorId: user.userId,
    command: {
      ...PROPOSAL_BODY,
      activityId: activity.activity.activityId,
      discussionId: discussion.discussion.discussionId,
    },
  });

  return created.proposal;
}

describe("SubmitProposal integration", () => {
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
    await deleteOutboxRecordsByEventIdPrefix("proposal-submitted:");
    await deleteOutboxRecordsByEventIdPrefix("proposal-created:");
    await deleteOutboxRecordsByEventIdPrefix("discussion-created:");
    await deleteOutboxRecordsByEventIdPrefix("activity-created:");
    await deleteProcessedEventsByEventIdPrefix("proposal-submitted:");
    await deleteProcessedEventsByEventIdPrefix("proposal-created:");
    await deleteProcessedEventsByEventIdPrefix("discussion-created:");
    await deleteProcessedEventsByEventIdPrefix("activity-created:");
    await deleteProposalsByProposalIdPrefix(TEST_PREFIX);
    await deleteProposalsByCreatorMemberIdPrefix(TEST_PREFIX);
    await deleteDiscussionsByDiscussionIdPrefix(TEST_PREFIX);
    await deleteDiscussionsByCreatorMemberIdPrefix(TEST_PREFIX);
    await deleteActivitiesByActivityIdPrefix(TEST_PREFIX);
    await deleteActivitiesByCreatorMemberIdPrefix(TEST_PREFIX);
    await deleteMembersByMemberIdPrefix(TEST_PREFIX);
    await deleteAuthUsersByEmailPrefix(`${TEST_PREFIX}-`);
    resetSmtpTransportForTests();
    await disconnectMongoClient();
  });

  it("submits Proposal transactionally and emits ProposalSubmitted", async () => {
    const { user, session } = await registerAndConfirm("Submit Creator", "success");
    const draft = await seedDraftProposal(user);

    const response = await requestProposal(
      "POST",
      `/api/v1/proposals/${draft.proposalId}/submit`,
      session.tokens.accessToken,
    );

    assert.equal(response.status, 200);
    assert.equal(response.body.success, true);

    const proposal = response.body.data as Record<string, unknown>;
    assert.equal(proposal.proposalId, draft.proposalId);
    assert.equal(proposal.activityId, draft.activityId);
    assert.equal(proposal.discussionId, draft.discussionId);
    assert.equal(proposal.creatorMemberId, user.memberId);
    assert.equal(proposal.status, "submitted");
    assert.equal(proposal.aggregateVersion, 2);
    assert.equal(proposal.createdAt, draft.createdAt);
    assert.equal(proposal.title, draft.title);

    const persisted = await findProposalById(draft.proposalId);
    assert.ok(persisted);
    assert.equal(persisted.status, "submitted");
    assert.equal(persisted.aggregateVersion, 2);

    const createdOutbox = await getMongoCollection<{ eventName: string }>(MONGO_COLLECTIONS.outbox).findOne({
      eventId: buildProposalCreatedEventId(draft.proposalId),
    });
    assert.ok(createdOutbox);
    assert.equal(createdOutbox.eventName, CATALOGUE_EVENTS.proposalCreated);

    const submittedOutbox = await getMongoCollection<{ eventName: string; envelope: string }>(
      MONGO_COLLECTIONS.outbox,
    ).findOne({
      eventId: buildProposalSubmittedEventId(draft.proposalId),
    });

    assert.ok(submittedOutbox);
    assert.equal(submittedOutbox.eventName, CATALOGUE_EVENTS.proposalSubmitted);
    assert.notEqual(
      buildProposalSubmittedEventId(draft.proposalId),
      buildProposalCreatedEventId(draft.proposalId),
    );

    const envelope = deserializeDomainEventEnvelope(submittedOutbox.envelope);
    assert.equal(envelope.eventName, CATALOGUE_EVENTS.proposalSubmitted);
    assert.equal(envelope.aggregateType, "Proposal");
    assert.equal(envelope.aggregateId, draft.proposalId);
    assert.equal(envelope.payload.status, "submitted");
    assert.equal(envelope.payload.aggregateVersion, 2);
    assert.equal("proposalText" in envelope.payload, false);
    assert.equal("summary" in envelope.payload, false);
    assert.equal(await countProposals({ proposalId: draft.proposalId }), 1);
  });

  it("rolls back Proposal when ProposalSubmitted outbox enqueue fails", async () => {
    const { user, session } = await registerAndConfirm("Rollback Submitter", "rollback");
    const draft = await seedDraftProposal(user);

    setForceEnqueueFailureForTests(true);

    const response = await requestProposal(
      "POST",
      `/api/v1/proposals/${draft.proposalId}/submit`,
      session.tokens.accessToken,
    );

    setForceEnqueueFailureForTests(false);

    assert.equal(response.status, 500);

    const persisted = await findProposalById(draft.proposalId);
    assert.ok(persisted);
    assert.equal(persisted.status, "draft");
    assert.equal(persisted.aggregateVersion, 1);

    const submittedOutbox = await getMongoCollection(MONGO_COLLECTIONS.outbox).findOne({
      eventId: buildProposalSubmittedEventId(draft.proposalId),
    });
    assert.equal(submittedOutbox, null);
  });

  it("allows only one successful submission under concurrent requests", async () => {
    const { user, session } = await registerAndConfirm("Concurrent Submitter", "concurrent");
    const draft = await seedDraftProposal(user);

    const results = await Promise.allSettled([
      requestProposal("POST", `/api/v1/proposals/${draft.proposalId}/submit`, session.tokens.accessToken),
      requestProposal("POST", `/api/v1/proposals/${draft.proposalId}/submit`, session.tokens.accessToken),
    ]);

    const statuses = results
      .filter((result): result is PromiseFulfilledResult<{ status: number; body: Record<string, unknown> }> => {
        return result.status === "fulfilled";
      })
      .map((result) => result.value.status);

    assert.equal(statuses.filter((status) => status === 200).length, 1);
    assert.equal(statuses.filter((status) => status === 409).length, 1);

    const persisted = await findProposalById(draft.proposalId);
    assert.ok(persisted);
    assert.equal(persisted.status, "submitted");
    assert.equal(persisted.aggregateVersion, 2);

    const submittedEvents = await getMongoCollection(MONGO_COLLECTIONS.outbox)
      .find({ eventId: buildProposalSubmittedEventId(draft.proposalId) })
      .toArray();
    assert.equal(submittedEvents.length, 1);
  });

  it("returns submitted Proposal on GET after submission", async () => {
    const { user, session } = await registerAndConfirm("Query Submitter", "query");
    const draft = await seedDraftProposal(user);

    const submitResponse = await requestProposal(
      "POST",
      `/api/v1/proposals/${draft.proposalId}/submit`,
      session.tokens.accessToken,
    );
    assert.equal(submitResponse.status, 200);

    const getResponse = await requestProposal(
      "GET",
      `/api/v1/proposals/${draft.proposalId}`,
      session.tokens.accessToken,
    );

    assert.equal(getResponse.status, 200);
    const proposal = getResponse.body.data as Record<string, unknown>;
    assert.equal(proposal.status, "submitted");
    assert.equal(proposal.aggregateVersion, 2);
    assert.equal(proposal.visibility, draft.visibility);
    assert.equal("_id" in proposal, false);
    assert.equal("initiativeId" in proposal, false);
    assert.equal("submittedAt" in proposal, false);
  });

  it("rejects unauthenticated, unverified, non-creator, missing Proposal, and trusted fields", async () => {
    const owner = await registerAndConfirm("Auth Owner", "auth-owner");
    const other = await registerAndConfirm("Auth Other", "auth-other");
    const draft = await seedDraftProposal(owner.user);

    const unauthenticated = await requestProposal(
      "POST",
      `/api/v1/proposals/${draft.proposalId}/submit`,
      null,
    );
    assert.equal(unauthenticated.status, 401);

    const unverifiedRegistration = await registerAuthUser({
      email: createTestEmail("unverified"),
      password: "Password123!",
      displayName: "Unverified Submitter",
    });
    assert.equal(unverifiedRegistration.kind, "email_confirmation_required");
    const unverifiedUser = await findAuthUserByEmail(createTestEmail("unverified"));
    assert.ok(unverifiedUser);
    const unverifiedAccessToken = createAccessToken({
      sub: unverifiedUser.userId,
      memberId: unverifiedUser.memberId,
      role: unverifiedUser.role,
      displayName: unverifiedUser.displayName,
      email: unverifiedUser.email,
    });
    const unverified = await requestProposal(
      "POST",
      `/api/v1/proposals/${draft.proposalId}/submit`,
      unverifiedAccessToken,
    );
    assert.equal(unverified.status, 403);

    const nonCreator = await requestProposal(
      "POST",
      `/api/v1/proposals/${draft.proposalId}/submit`,
      other.session.tokens.accessToken,
    );
    assert.equal(nonCreator.status, 403);

    const missing = await requestProposal(
      "POST",
      `/api/v1/proposals/44444444-4444-4444-8444-444444444444/submit`,
      owner.session.tokens.accessToken,
    );
    assert.equal(missing.status, 404);

    const trustedFields = await requestProposal(
      "POST",
      `/api/v1/proposals/${draft.proposalId}/submit`,
      owner.session.tokens.accessToken,
      { status: "submitted", creatorMemberId: "other-member" },
    );
    assert.equal(trustedFields.status, 400);

    const duplicateSubmit = await requestProposal(
      "POST",
      `/api/v1/proposals/${draft.proposalId}/submit`,
      owner.session.tokens.accessToken,
    );
    assert.equal(duplicateSubmit.status, 200);

    const alreadySubmitted = await requestProposal(
      "POST",
      `/api/v1/proposals/${draft.proposalId}/submit`,
      owner.session.tokens.accessToken,
    );
    assert.equal(alreadySubmitted.status, 409);
  });
});
