/**
 * HU-RRP-03K.2 — owner-safe resolution of existing RRP admin DM conversations.
 */
process.env.NODE_TEST_ENV = "true";

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { RRP_APPLICATION_CONSENT_VERSION } from "@hu/types";

import { setFindAuthUserByIdForTests } from "../../../src/modules/auth/auth-user.repository.js";
import type { AuthUserRecord } from "../../../src/modules/auth/auth-user.types.js";
import { buildDirectConversationId } from "../../../src/modules/direct-messaging/persistence/direct-messaging.mongo-document.js";
import {
  selectRrpAdminConversationIntent,
  setRrpAdminConversationLookupForTests,
} from "../../../src/modules/rrp-application/rrp-admin-conversation.resolution.js";
import {
  RrpApplicationAccessDeniedError,
  RrpApplicationNotFoundError,
} from "../../../src/modules/rrp-application/rrp-application.errors.js";
import {
  resetRrpApplicationIndexReadinessForTests,
  setRrpApplicationActiveUniqueIndexReadyForTests,
} from "../../../src/modules/rrp-application/rrp-application.index-readiness.js";
import {
  resetRrpApplicationMemoryForTests,
  setRrpApplicationForceMemoryForTests,
} from "../../../src/modules/rrp-application/rrp-application.repository.js";
import {
  createRrpApplicationDraftForUser,
  resolveOwnRrpAdminConversationForUser,
  reviewRrpApplicationForAdminActor,
  submitOwnRrpApplicationForUser,
} from "../../../src/modules/rrp-application/rrp-application.service.js";
import {
  buildRrpRequestInformationMessageIntent,
  insertRrpAppointmentMessageIntentIdempotent,
  markRrpMessageIntentDelivered,
  resetRrpAppointmentMessageIntentMemoryForTests,
  setRrpAppointmentMessageIntentForceMemoryForTests,
  type RrpAppointmentMessageIntentRecord,
} from "../../../src/modules/rrp-application/rrp-appointment-message-intent.repository.js";
import {
  resetRrpAppointmentMemoryForTests,
  setRrpAppointmentForceMemoryForTests,
} from "../../../src/modules/rrp-application/rrp-appointment.repository.js";

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

async function createSubmittedApplication(input?: {
  userId?: string;
  representCountryCode?: string;
}): Promise<{ applicationId: string; revision: number }> {
  const userId = input?.userId ?? "user-applicant-1";
  const draft = await createRrpApplicationDraftForUser(userId, {
    representCountryCode: input?.representCountryCode ?? "CA",
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
    userId,
    applicationId: draft.applicationId,
    body: {
      expectedRevision: draft.revision,
      consentAccepted: true,
      consentVersion: RRP_APPLICATION_CONSENT_VERSION,
    },
  });
  return { applicationId: submitted.applicationId, revision: submitted.revision };
}

function withTimestamps(
  intent: RrpAppointmentMessageIntentRecord,
  updatedAt: string,
  createdAt = updatedAt,
): RrpAppointmentMessageIntentRecord {
  return { ...intent, createdAt, updatedAt };
}

const apiSrc = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../src");

function readApi(relative: string): string {
  return readFileSync(path.join(apiSrc, relative), "utf8");
}

describe("HU-RRP-03K.2 owner-safe admin conversation resolution", () => {
  beforeEach(() => {
    setRrpApplicationForceMemoryForTests(true);
    setRrpAppointmentForceMemoryForTests(true);
    setRrpAppointmentMessageIntentForceMemoryForTests(true);
    setRrpApplicationActiveUniqueIndexReadyForTests(true);
    resetRrpApplicationMemoryForTests();
    resetRrpAppointmentMemoryForTests();
    resetRrpAppointmentMessageIntentMemoryForTests();
    resetRrpApplicationIndexReadinessForTests();
    setRrpApplicationActiveUniqueIndexReadyForTests(true);
    setRrpAdminConversationLookupForTests(null);

    const applicant = makeUser();
    const applicant2 = makeUser({
      userId: "user-applicant-2",
      memberId: "participant-2",
      email: "applicant2@example.com",
      displayName: "Applicant Two",
    });
    const admin = makeUser({
      userId: "user-admin-1",
      memberId: "participant-admin-1",
      email: "admin@example.com",
      role: "admin",
      displayName: "Admin One",
    });
    const admin2 = makeUser({
      userId: "user-admin-2",
      memberId: "participant-admin-2",
      email: "admin2@example.com",
      role: "admin",
      displayName: "Admin Two",
    });
    setFindAuthUserByIdForTests(async (userId) => {
      if (userId === applicant.userId) return applicant;
      if (userId === applicant2.userId) return applicant2;
      if (userId === admin.userId) return admin;
      if (userId === admin2.userId) return admin2;
      return null;
    });
  });

  afterEach(() => {
    setFindAuthUserByIdForTests(null);
    setRrpAdminConversationLookupForTests(null);
    resetRrpApplicationMemoryForTests();
    resetRrpAppointmentMemoryForTests();
    resetRrpAppointmentMessageIntentMemoryForTests();
    resetRrpApplicationIndexReadinessForTests();
  });

  it("owner can resolve delivered request_information DM", async () => {
    const submitted = await createSubmittedApplication();
    const review = await reviewRrpApplicationForAdminActor({
      actorUserId: "user-admin-1",
      applicationId: submitted.applicationId,
      body: {
        decision: "request_information",
        expectedRevision: submitted.revision,
        note: "Please clarify prior regional work.",
      },
    });
    assert.equal(review.application.status, "information_requested");

    // Review delivery fails without Mongo; mark delivered + inject conversation.
    const intentsSource = readApi(
      "modules/rrp-application/rrp-appointment-message-intent.repository.ts",
    );
    assert.match(intentsSource, /listRrpMessageIntentsByApplicationId/);

    const { findRrpMessageIntentByClientMessageId } = await import(
      "../../../src/modules/rrp-application/rrp-appointment-message-intent.repository.js"
    );
    const { buildRrpRequestInformationClientMessageId } = await import(
      "../../../src/modules/rrp-application/rrp-message-intent.constants.js"
    );
    const clientMessageId = buildRrpRequestInformationClientMessageId({
      applicationId: submitted.applicationId,
      applicationRevision: review.application.revision,
    });
    const intent = await findRrpMessageIntentByClientMessageId(clientMessageId);
    assert.ok(intent);
    await markRrpMessageIntentDelivered(intent!.intentId);

    const expectedConversationId = buildDirectConversationId(
      "participant-admin-1",
      "participant-1",
    );
    setRrpAdminConversationLookupForTests(async (conversationId) => {
      if (conversationId !== expectedConversationId) {
        return null;
      }
      return {
        conversationId,
        participantIds: ["participant-1", "participant-admin-1"].sort(),
      };
    });

    const resolved = await resolveOwnRrpAdminConversationForUser({
      userId: "user-applicant-1",
      applicationId: submitted.applicationId,
    });
    assert.equal(resolved.availability, "available");
    assert.equal(resolved.conversationId, expectedConversationId);
    assert.equal(resolved.applicationId, submitted.applicationId);
  });

  it("non-owner is denied without leaking conversation ids", async () => {
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

    await assert.rejects(
      () =>
        resolveOwnRrpAdminConversationForUser({
          userId: "user-applicant-2",
          applicationId: submitted.applicationId,
        }),
      RrpApplicationNotFoundError,
    );
  });

  it("does not accept client-forged conversation ids (server-derived only)", async () => {
    const routes = readApi("modules/rrp-application/rrp-application.routes.ts");
    assert.match(routes, /admin-conversation/);
    assert.doesNotMatch(routes, /req\.(body|query).*conversationId/);

    const resolution = readApi(
      "modules/rrp-application/rrp-admin-conversation.resolution.ts",
    );
    assert.match(resolution, /buildDirectConversationId/);
    assert.doesNotMatch(resolution, /openOrCreateDirectConversation/);
    assert.doesNotMatch(resolution, /req\.body/);
  });

  it("selects the latest delivered request_information intent", () => {
    const older = withTimestamps(
      buildRrpRequestInformationMessageIntent({
        applicationId: "app-1",
        applicationRevision: 2,
        recipientParticipantId: "participant-1",
        adminParticipantId: "participant-admin-1",
        representCountryCode: "CA",
        requestExplanation: "Older request",
      }),
      "2026-01-01T00:00:00.000Z",
    );
    const newer = withTimestamps(
      {
        ...buildRrpRequestInformationMessageIntent({
          applicationId: "app-1",
          applicationRevision: 3,
          recipientParticipantId: "participant-1",
          adminParticipantId: "participant-admin-2",
          representCountryCode: "CA",
          requestExplanation: "Newer request",
        }),
        status: "delivered",
      },
      "2026-02-01T00:00:00.000Z",
    );
    const deliveredOlder = { ...older, status: "delivered" as const };
    const selected = selectRrpAdminConversationIntent([deliveredOlder, newer]);
    assert.equal(selected.availability, "available");
    assert.equal(selected.intent?.adminParticipantId, "participant-admin-2");
    assert.equal(selected.intent?.requestExplanation, "Newer request");
  });

  it("same admin across applications resolves to the same conversation id", async () => {
    const appA = await createSubmittedApplication({ representCountryCode: "CA" });
    const appB = await createSubmittedApplication({ representCountryCode: "US" });

    for (const app of [appA, appB]) {
      const review = await reviewRrpApplicationForAdminActor({
        actorUserId: "user-admin-1",
        applicationId: app.applicationId,
        body: {
          decision: "request_information",
          expectedRevision: app.revision,
          note: "Please clarify experience.",
        },
      });
      const { findRrpMessageIntentByClientMessageId } = await import(
        "../../../src/modules/rrp-application/rrp-appointment-message-intent.repository.js"
      );
      const { buildRrpRequestInformationClientMessageId } = await import(
        "../../../src/modules/rrp-application/rrp-message-intent.constants.js"
      );
      const intent = await findRrpMessageIntentByClientMessageId(
        buildRrpRequestInformationClientMessageId({
          applicationId: app.applicationId,
          applicationRevision: review.application.revision,
        }),
      );
      assert.ok(intent);
      await markRrpMessageIntentDelivered(intent!.intentId);
    }

    const expectedConversationId = buildDirectConversationId(
      "participant-admin-1",
      "participant-1",
    );
    setRrpAdminConversationLookupForTests(async (conversationId) => {
      if (conversationId !== expectedConversationId) return null;
      return {
        conversationId,
        participantIds: ["participant-1", "participant-admin-1"].sort(),
      };
    });

    const resolvedA = await resolveOwnRrpAdminConversationForUser({
      userId: "user-applicant-1",
      applicationId: appA.applicationId,
    });
    const resolvedB = await resolveOwnRrpAdminConversationForUser({
      userId: "user-applicant-1",
      applicationId: appB.applicationId,
    });
    assert.equal(resolvedA.conversationId, expectedConversationId);
    assert.equal(resolvedB.conversationId, expectedConversationId);
  });

  it("different admins resolve to different conversation ids", async () => {
    const intentA = {
      ...buildRrpRequestInformationMessageIntent({
        applicationId: "app-diff-a",
        applicationRevision: 2,
        recipientParticipantId: "participant-1",
        adminParticipantId: "participant-admin-1",
        representCountryCode: "CA",
        requestExplanation: "From admin 1",
      }),
      status: "delivered" as const,
    };
    const intentB = {
      ...buildRrpRequestInformationMessageIntent({
        applicationId: "app-diff-b",
        applicationRevision: 2,
        recipientParticipantId: "participant-1",
        adminParticipantId: "participant-admin-2",
        representCountryCode: "US",
        requestExplanation: "From admin 2",
      }),
      status: "delivered" as const,
    };
    await insertRrpAppointmentMessageIntentIdempotent(intentA);
    await insertRrpAppointmentMessageIntentIdempotent(intentB);

    // Seed owned applications via draft/submit/review path is heavy; ownership
    // is tested elsewhere. Selection + derivation for different admins:
    const selectedA = selectRrpAdminConversationIntent([intentA]);
    const selectedB = selectRrpAdminConversationIntent([intentB]);
    assert.equal(
      buildDirectConversationId(
        selectedA.intent!.adminParticipantId,
        selectedA.intent!.recipientParticipantId,
      ),
      buildDirectConversationId("participant-admin-1", "participant-1"),
    );
    assert.equal(
      buildDirectConversationId(
        selectedB.intent!.adminParticipantId,
        selectedB.intent!.recipientParticipantId,
      ),
      buildDirectConversationId("participant-admin-2", "participant-1"),
    );
    assert.notEqual(
      buildDirectConversationId("participant-admin-1", "participant-1"),
      buildDirectConversationId("participant-admin-2", "participant-1"),
    );
  });

  it("pending / failed / absent intents return null with safe availability", () => {
    const pending = buildRrpRequestInformationMessageIntent({
      applicationId: "app-pending",
      applicationRevision: 2,
      recipientParticipantId: "participant-1",
      adminParticipantId: "participant-admin-1",
      representCountryCode: "CA",
      requestExplanation: "Pending delivery",
    });
    assert.equal(selectRrpAdminConversationIntent([pending]).availability, "pending");
    assert.equal(selectRrpAdminConversationIntent([pending]).intent, null);

    const failed = { ...pending, status: "failed" as const };
    assert.equal(selectRrpAdminConversationIntent([failed]).availability, "failed");
    assert.equal(selectRrpAdminConversationIntent([failed]).intent, null);

    assert.equal(selectRrpAdminConversationIntent([]).availability, "none");
  });

  it("missing conversation returns unavailable without creating one", async () => {
    const submitted = await createSubmittedApplication();
    const review = await reviewRrpApplicationForAdminActor({
      actorUserId: "user-admin-1",
      applicationId: submitted.applicationId,
      body: {
        decision: "request_information",
        expectedRevision: submitted.revision,
        note: "Please clarify prior regional work.",
      },
    });
    const { findRrpMessageIntentByClientMessageId } = await import(
      "../../../src/modules/rrp-application/rrp-appointment-message-intent.repository.js"
    );
    const { buildRrpRequestInformationClientMessageId } = await import(
      "../../../src/modules/rrp-application/rrp-message-intent.constants.js"
    );
    const intent = await findRrpMessageIntentByClientMessageId(
      buildRrpRequestInformationClientMessageId({
        applicationId: submitted.applicationId,
        applicationRevision: review.application.revision,
      }),
    );
    assert.ok(intent);
    await markRrpMessageIntentDelivered(intent!.intentId);

    let lookupCalls = 0;
    setRrpAdminConversationLookupForTests(async () => {
      lookupCalls += 1;
      return null;
    });

    const resolved = await resolveOwnRrpAdminConversationForUser({
      userId: "user-applicant-1",
      applicationId: submitted.applicationId,
    });
    assert.equal(resolved.conversationId, null);
    assert.equal(resolved.availability, "unavailable");
    assert.equal(lookupCalls, 1);

    const resolution = readApi(
      "modules/rrp-application/rrp-admin-conversation.resolution.ts",
    );
    assert.doesNotMatch(resolution, /openOrCreateDirectConversation/);
  });

  it("membership mismatch returns unavailable", async () => {
    const submitted = await createSubmittedApplication();
    const review = await reviewRrpApplicationForAdminActor({
      actorUserId: "user-admin-1",
      applicationId: submitted.applicationId,
      body: {
        decision: "request_information",
        expectedRevision: submitted.revision,
        note: "Please clarify prior regional work.",
      },
    });
    const { findRrpMessageIntentByClientMessageId } = await import(
      "../../../src/modules/rrp-application/rrp-appointment-message-intent.repository.js"
    );
    const { buildRrpRequestInformationClientMessageId } = await import(
      "../../../src/modules/rrp-application/rrp-message-intent.constants.js"
    );
    const intent = await findRrpMessageIntentByClientMessageId(
      buildRrpRequestInformationClientMessageId({
        applicationId: submitted.applicationId,
        applicationRevision: review.application.revision,
      }),
    );
    assert.ok(intent);
    await markRrpMessageIntentDelivered(intent!.intentId);

    setRrpAdminConversationLookupForTests(async (conversationId) => ({
      conversationId,
      participantIds: ["participant-admin-1", "participant-other"],
    }));

    const resolved = await resolveOwnRrpAdminConversationForUser({
      userId: "user-applicant-1",
      applicationId: submitted.applicationId,
    });
    assert.equal(resolved.conversationId, null);
    assert.equal(resolved.availability, "unavailable");
  });

  it("preserves Messages privacy policy and does not change auth.role", async () => {
    const eligibility = readApi(
      "modules/direct-messaging/direct-messaging-eligibility.ts",
    );
    assert.match(eligibility, /nobody/);
    assert.match(eligibility, /active_allies/);

    const resolution = readApi(
      "modules/rrp-application/rrp-admin-conversation.resolution.ts",
    );
    assert.doesNotMatch(resolution, /auth\.role|role:\s*"admin"/);
    assert.doesNotMatch(resolution, /isNewDirectConversationAllowed/);

    await assert.rejects(
      () =>
        resolveOwnRrpAdminConversationForUser({
          userId: "missing-user",
          applicationId: "any",
        }),
      RrpApplicationAccessDeniedError,
    );
  });
});
