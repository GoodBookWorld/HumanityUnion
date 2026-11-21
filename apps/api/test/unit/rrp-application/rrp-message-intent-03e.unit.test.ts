/**
 * HU-RRP-03E — request-information messaging, durable intents, bounded retry.
 */
process.env.NODE_TEST_ENV = "true";

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { RRP_APPLICATION_CONSENT_VERSION } from "@hu/types";

import { isNewDirectConversationAllowed } from "../../../src/modules/direct-messaging/direct-messaging-eligibility.js";

import { setFindAuthUserByIdForTests } from "../../../src/modules/auth/auth-user.repository.js";
import type { AuthUserRecord } from "../../../src/modules/auth/auth-user.types.js";
import { RrpApplicationAccessDeniedError } from "../../../src/modules/rrp-application/rrp-application.errors.js";
import {
  resetRrpApplicationIndexReadinessForTests,
  setRrpApplicationActiveUniqueIndexReadyForTests,
} from "../../../src/modules/rrp-application/rrp-application.index-readiness.js";
import {
  resetRrpApplicationMemoryForTests,
  setRrpApplicationForceMemoryForTests,
} from "../../../src/modules/rrp-application/rrp-application.repository.js";
import { setRrpApplicationWritesEnabledForTests } from "../../../src/modules/rrp-application/rrp-application-writes.activation.js";
import {
  createRrpApplicationDraftForUser,
  reviewRrpApplicationForAdminActor,
  submitOwnRrpApplicationForUser,
} from "../../../src/modules/rrp-application/rrp-application.service.js";
import { confirmRrpAppointmentForAdminActor } from "../../../src/modules/rrp-application/rrp-appointment.service.js";
import {
  claimNextRrpMessageIntent,
  findRrpMessageIntentByClientMessageId,
  findRrpMessageIntentById,
  listRetryableRrpMessageIntents,
  recordRrpMessageIntentDeliveryAttempt,
  resetRrpAppointmentMessageIntentMemoryForTests,
  setRrpAppointmentMessageIntentForceMemoryForTests,
} from "../../../src/modules/rrp-application/rrp-appointment-message-intent.repository.js";
import {
  resetRrpAppointmentMemoryForTests,
  setRrpAppointmentForceMemoryForTests,
} from "../../../src/modules/rrp-application/rrp-appointment.repository.js";
import {
  buildRrpRequestInformationClientMessageId,
  RRP_MESSAGE_INTENT_MAX_DELIVERY_ATTEMPTS,
} from "../../../src/modules/rrp-application/rrp-message-intent.constants.js";
import {
  buildSafeApprovalMessageText,
  buildSafeRequestInformationMessageText,
  deliverRrpMessageIntentBestEffort,
  RRP_DELIVERY_WARNING,
  retryRrpMessageIntentDeliveryById,
} from "../../../src/modules/rrp-application/rrp-message-intent.delivery.js";
import { reconcilePendingRrpMessageIntents } from "../../../src/modules/rrp-application/rrp-message-intent.reconciliation.js";

function makeUser(overrides: Partial<AuthUserRecord> = {}): AuthUserRecord {
  const now = new Date().toISOString();
  return {
    userId: "user-applicant-1",
    email: "applicant@example.com",
    passwordHash: "hash",
    displayName: "Applicant One",
    role: "member",
    status: "active",
    memberId: "participant-1",
    emailVerificationStatus: "verified",
    emailVerifiedAt: now,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function adultDob(): string {
  const d = new Date();
  d.setUTCFullYear(d.getUTCFullYear() - 25);
  return d.toISOString().slice(0, 10);
}

async function createSubmittedApplication(): Promise<{
  applicationId: string;
  revision: number;
}> {
  const draft = await createRrpApplicationDraftForUser("user-applicant-1", {
    representCountryCode: "CA",
    legalFirstName: "Ada",
    legalLastName: "Lovelace",
    profession: "Engineer",
    residenceCountryCode: "CA",
    dateOfBirth: adultDob(),
    fundingModel: "SELF",
    annualRequestedAmountCad: null,
    teamMemberCount: 1,
    relevantExperience: "Community organizing experience.",
    motivation: "To support regional civic participation.",
  });
  const submitted = await submitOwnRrpApplicationForUser({
    userId: "user-applicant-1",
    applicationId: draft.applicationId,
    body: {
      expectedRevision: draft.revision,
      consentAccepted: true,
      consentVersion: RRP_APPLICATION_CONSENT_VERSION,
    },
  });
  return { applicationId: submitted.applicationId, revision: submitted.revision };
}

const apiSrc = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../src");

function readApi(relative: string): string {
  return readFileSync(path.join(apiSrc, relative), "utf8");
}

describe("HU-RRP-03E message intents and retry", () => {
  beforeEach(() => {
    setRrpApplicationWritesEnabledForTests(true);
    setRrpApplicationForceMemoryForTests(true);
    setRrpAppointmentForceMemoryForTests(true);
    setRrpAppointmentMessageIntentForceMemoryForTests(true);
    setRrpApplicationActiveUniqueIndexReadyForTests(true);
    resetRrpApplicationMemoryForTests();
    resetRrpAppointmentMemoryForTests();
    resetRrpAppointmentMessageIntentMemoryForTests();
    resetRrpApplicationIndexReadinessForTests();
    setRrpApplicationActiveUniqueIndexReadyForTests(true);

    const applicant = makeUser();
    const admin = makeUser({
      userId: "user-admin-1",
      memberId: "participant-admin-1",
      email: "admin@example.com",
      role: "admin",
      displayName: "Admin One",
    });
    setFindAuthUserByIdForTests(async (userId) => {
      if (userId === applicant.userId) return applicant;
      if (userId === admin.userId) return admin;
      return null;
    });
  });

  afterEach(() => {
    setFindAuthUserByIdForTests(null);
    setRrpApplicationWritesEnabledForTests(null);
    resetRrpApplicationMemoryForTests();
    resetRrpAppointmentMemoryForTests();
    resetRrpAppointmentMessageIntentMemoryForTests();
    resetRrpApplicationIndexReadinessForTests();
  });

  it("documents Admin DM eligibility: allies bypass only, nobody absolute, reply into existing", async () => {
    const deps = {
      listWorkspaceAlliesForParticipant: async () => [],
    };
    assert.equal(
      await isNewDirectConversationAllowed("admin-p", "applicant-p", "nobody", deps, {
        viewerIsAdmin: true,
      }),
      false,
    );
    assert.equal(
      await isNewDirectConversationAllowed("admin-p", "applicant-p", "active_allies", deps, {
        viewerIsAdmin: true,
      }),
      true,
    );
    assert.equal(
      await isNewDirectConversationAllowed("member-p", "applicant-p", "active_allies", deps, {
        viewerIsAdmin: false,
      }),
      false,
    );
    assert.equal(
      await isNewDirectConversationAllowed("admin-p", "applicant-p", "registered_participants", deps, {
        viewerIsAdmin: true,
      }),
      true,
    );

    const service = readApi("modules/direct-messaging/direct-messaging.service.ts");
    assert.match(service, /resolveViewerIsAdmin/);
    assert.match(service, /isNewDirectConversationAllowed/);
    assert.match(service, /clientMessageId/);
    assert.match(service, /isSendIntoExistingConversationAllowed/);

    const delivery = readApi("modules/rrp-application/rrp-message-intent.delivery.ts");
    assert.match(delivery, /openOrCreateDirectConversation/);
    assert.match(delivery, /sendDirectMessage/);
    assert.doesNotMatch(delivery, /smtp|nodemailer|sendMail/i);
  });

  it("denies participant request-information", async () => {
    const submitted = await createSubmittedApplication();
    await assert.rejects(
      () =>
        reviewRrpApplicationForAdminActor({
          actorUserId: "user-applicant-1",
          applicationId: submitted.applicationId,
          body: {
            decision: "request_information",
            expectedRevision: submitted.revision,
            note: "Need more experience detail.",
          },
        }),
      RrpApplicationAccessDeniedError,
    );
  });

  it("requires nonempty explanation for request-information", async () => {
    const submitted = await createSubmittedApplication();
    await assert.rejects(
      () =>
        reviewRrpApplicationForAdminActor({
          actorUserId: "user-admin-1",
          applicationId: submitted.applicationId,
          body: {
            decision: "request_information",
            expectedRevision: submitted.revision,
            note: "   ",
          },
        }),
      /note is required/i,
    );
  });

  it("records durable request-information intent and keeps application decision on DM failure", async () => {
    const submitted = await createSubmittedApplication();
    const result = await reviewRrpApplicationForAdminActor({
      actorUserId: "user-admin-1",
      applicationId: submitted.applicationId,
      body: {
        decision: "request_information",
        expectedRevision: submitted.revision,
        note: "Please clarify prior regional work.",
      },
    });

    assert.equal(result.application.status, "information_requested");
    assert.equal(result.messageIntentRecorded, true);
    assert.equal(result.messageWarning, RRP_DELIVERY_WARNING.pendingRetry);

    const clientMessageId = buildRrpRequestInformationClientMessageId({
      applicationId: submitted.applicationId,
      applicationRevision: result.application.revision,
    });
    const intent = await findRrpMessageIntentByClientMessageId(clientMessageId);
    assert.ok(intent);
    assert.equal(intent!.kind, "request_information");
    assert.equal(intent!.status, "pending");
    assert.ok(intent!.deliveryAttempts >= 1);
    assert.equal(intent!.requestExplanation, "Please clarify prior regional work.");
    assert.doesNotMatch(intent!.clientMessageId, /dateOfBirth|Lovelace|12000/i);
  });

  it("keeps approval message safe and records pending intent on DM failure", async () => {
    const submitted = await createSubmittedApplication();
    const result = await confirmRrpAppointmentForAdminActor({
      actorUserId: "user-admin-1",
      applicationId: submitted.applicationId,
      body: { expectedRevision: submitted.revision },
    });
    assert.equal(result.application.status, "approved");
    assert.equal(result.messageWarning, RRP_DELIVERY_WARNING.pendingRetry);
    assert.equal(result.appointment.status, "active");

    const text = buildSafeApprovalMessageText("CA");
    assert.match(text, /Canada/);
    assert.match(text, /does not independently grant administrative or legal authority/i);
    assert.match(text, /create a commitment to provide funding/i);
    assert.match(text, /confidential/i);
    assert.doesNotMatch(text, /dateOfBirth|Lovelace|legalFirstName/i);
  });

  it("request-information message body excludes DOB and funding amounts", () => {
    const text = buildSafeRequestInformationMessageText({
      representCountryCode: "CA",
      requestExplanation: "Please clarify experience.",
    });
    assert.match(text, /More Information Is Needed/);
    assert.match(text, /for Canada/);
    assert.match(text, /Please clarify experience/);
    assert.doesNotMatch(text, /dateOfBirth|CAD|funding amount|app-1/i);
  });

  it("retries pending intents with stable clientMessageId and marks failed after max attempts", async () => {
    const submitted = await createSubmittedApplication();
    const result = await reviewRrpApplicationForAdminActor({
      actorUserId: "user-admin-1",
      applicationId: submitted.applicationId,
      body: {
        decision: "request_information",
        expectedRevision: submitted.revision,
        note: "Need clarification.",
      },
    });
    const clientMessageId = buildRrpRequestInformationClientMessageId({
      applicationId: submitted.applicationId,
      applicationRevision: result.application.revision,
    });
    let intent = await findRrpMessageIntentByClientMessageId(clientMessageId);
    assert.ok(intent);

    // Force retryable now.
    while (
      intent &&
      intent.status === "pending" &&
      intent.deliveryAttempts < RRP_MESSAGE_INTENT_MAX_DELIVERY_ATTEMPTS
    ) {
      await recordRrpMessageIntentDeliveryAttempt(intent.intentId, "temporary failure");
      intent = await findRrpMessageIntentByClientMessageId(clientMessageId);
    }
    assert.ok(intent);
    assert.equal(intent!.status, "failed");
    assert.equal(intent!.deliveryAttempts, RRP_MESSAGE_INTENT_MAX_DELIVERY_ATTEMPTS);

    const retry = await retryRrpMessageIntentDeliveryById(intent!.intentId);
    assert.equal(retry.delivered, false);
    assert.equal(retry.warning, RRP_DELIVERY_WARNING.previouslyFailed);
    assert.equal(retry.status, "failed");
    assert.doesNotMatch(retry.warning ?? "", /intentId|[0-9a-f]{8}-[0-9a-f]{4}-/i);
  });

  it("reports a terminal delivery warning only when this attempt ends automatic retry", async () => {
    const submitted = await createSubmittedApplication();
    const result = await reviewRrpApplicationForAdminActor({
      actorUserId: "user-admin-1",
      applicationId: submitted.applicationId,
      body: {
        decision: "request_information",
        expectedRevision: submitted.revision,
        note: "Need clarification.",
      },
    });
    const clientMessageId = buildRrpRequestInformationClientMessageId({
      applicationId: submitted.applicationId,
      applicationRevision: result.application.revision,
    });
    let intent = await findRrpMessageIntentByClientMessageId(clientMessageId);
    assert.equal(result.messageWarning, RRP_DELIVERY_WARNING.pendingRetry);
    const stillRetrying = await retryRrpMessageIntentDeliveryById(intent!.intentId);
    assert.equal(stillRetrying.warning, RRP_DELIVERY_WARNING.pendingRetry);
    assert.equal(stillRetrying.status, "pending");
    intent = await findRrpMessageIntentByClientMessageId(clientMessageId);
    while (intent && intent.status === "pending" && intent.deliveryAttempts < RRP_MESSAGE_INTENT_MAX_DELIVERY_ATTEMPTS - 1) {
      await recordRrpMessageIntentDeliveryAttempt(intent.intentId, "temporary failure");
      intent = await findRrpMessageIntentByClientMessageId(clientMessageId);
    }
    assert.equal(intent?.status, "pending");
    assert.equal(intent?.deliveryAttempts, RRP_MESSAGE_INTENT_MAX_DELIVERY_ATTEMPTS - 1);
    const retry = await retryRrpMessageIntentDeliveryById(intent!.intentId);
    assert.equal(retry.delivered, false);
    assert.equal(retry.warning, RRP_DELIVERY_WARNING.failedTerminal);
    assert.equal(retry.status, "failed");
    const finished = await findRrpMessageIntentByClientMessageId(clientMessageId);
    assert.equal(finished?.status, "failed");
    assert.equal(finished?.nextRetryAt, null);
  });

  it("reconcile scans only retryable pending intents", async () => {
    const submitted = await createSubmittedApplication();
    await reviewRrpApplicationForAdminActor({
      actorUserId: "user-admin-1",
      applicationId: submitted.applicationId,
      body: {
        decision: "request_information",
        expectedRevision: submitted.revision,
        note: "Need clarification.",
      },
    });

    const listed = await listRetryableRrpMessageIntents({
      limit: 10,
      now: new Date(Date.now() + 3_600_000),
    });
    assert.ok(listed.length >= 1);

    const summary = await reconcilePendingRrpMessageIntents({
      limit: 10,
      now: new Date(Date.now() + 3_600_000),
    });
    assert.ok(summary.scanned >= 1);
    // Without DM fixtures, delivery remains pending or fails toward terminal.
    assert.ok(summary.delivered + summary.stillPending + summary.failed === summary.scanned);
  });

  it("allows only one worker to claim the same intent (atomic lease)", async () => {
    const submitted = await createSubmittedApplication();
    const result = await reviewRrpApplicationForAdminActor({
      actorUserId: "user-admin-1",
      applicationId: submitted.applicationId,
      body: {
        decision: "request_information",
        expectedRevision: submitted.revision,
        note: "Need clarification.",
      },
    });
    const clientMessageId = buildRrpRequestInformationClientMessageId({
      applicationId: submitted.applicationId,
      applicationRevision: result.application.revision,
    });
    const intent = await findRrpMessageIntentByClientMessageId(clientMessageId);
    assert.ok(intent);

    // Make due and unclaimed for both workers.
    await recordRrpMessageIntentDeliveryAttempt(intent!.intentId, "temporary");
    const afterFail = await findRrpMessageIntentById(intent!.intentId);
    assert.equal(afterFail?.status, "pending");

    const future = new Date(Date.now() + 3_600_000);
    const first = await claimNextRrpMessageIntent({
      now: future,
      claimOwnerId: "worker-a",
    });
    const second = await claimNextRrpMessageIntent({
      now: future,
      claimOwnerId: "worker-b",
    });

    assert.ok(first);
    assert.equal(first!.intentId, intent!.intentId);
    assert.equal(first!.claimOwnerId, "worker-a");
    assert.equal(second, null);
  });

  it("recovers claim after lease expiry (worker restart safe)", async () => {
    const submitted = await createSubmittedApplication();
    const result = await reviewRrpApplicationForAdminActor({
      actorUserId: "user-admin-1",
      applicationId: submitted.applicationId,
      body: {
        decision: "request_information",
        expectedRevision: submitted.revision,
        note: "Need clarification.",
      },
    });
    const clientMessageId = buildRrpRequestInformationClientMessageId({
      applicationId: submitted.applicationId,
      applicationRevision: result.application.revision,
    });
    const intent = await findRrpMessageIntentByClientMessageId(clientMessageId);
    assert.ok(intent);

    const t0 = new Date("2030-01-01T00:00:00.000Z");
    const claimed = await claimNextRrpMessageIntent({
      now: t0,
      claimOwnerId: "worker-a",
      leaseMs: 1_000,
    });
    assert.ok(claimed);

    const duringLease = await claimNextRrpMessageIntent({
      now: new Date(t0.getTime() + 500),
      claimOwnerId: "worker-b",
    });
    assert.equal(duringLease, null);

    const afterLease = await claimNextRrpMessageIntent({
      now: new Date(t0.getTime() + 2_000),
      claimOwnerId: "worker-b",
    });
    assert.ok(afterLease);
    assert.equal(afterLease!.intentId, claimed!.intentId);
    assert.equal(afterLease!.claimOwnerId, "worker-b");
  });
});
