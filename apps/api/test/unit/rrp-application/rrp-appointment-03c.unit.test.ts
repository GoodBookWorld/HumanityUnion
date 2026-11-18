/**
 * HU-RRP-03C — confirm-appointment, appointments, directory classification, message intents.
 */
process.env.NODE_TEST_ENV = "true";

import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";

import { RRP_APPLICATION_CONSENT_VERSION } from "@hu/types";

import { setFindAuthUserByIdForTests } from "../../../src/modules/auth/auth-user.repository.js";
import type { AuthUserRecord } from "../../../src/modules/auth/auth-user.types.js";
import {
  RrpApplicationAccessDeniedError,
  RrpApplicationConflictError,
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
  reviewRrpApplicationForAdminActor,
  submitOwnRrpApplicationForUser,
} from "../../../src/modules/rrp-application/rrp-application.service.js";
import { confirmRrpAppointmentForAdminActor } from "../../../src/modules/rrp-application/rrp-appointment.service.js";
import {
  findActiveRrpAppointmentBySourceApplicationId,
  findActiveRrpAppointmentForParticipantCountry,
  resetRrpAppointmentMemoryForTests,
  setRrpAppointmentForceMemoryForTests,
} from "../../../src/modules/rrp-application/rrp-appointment.repository.js";
import {
  findRrpAppointmentMessageIntentByAppointmentId,
  resetRrpAppointmentMessageIntentMemoryForTests,
  setRrpAppointmentMessageIntentForceMemoryForTests,
} from "../../../src/modules/rrp-application/rrp-appointment-message-intent.repository.js";
import {
  findUserIdsForApplicantFundingClassification,
} from "../../../src/modules/rrp-application/rrp-application.repository.js";
import { findUserIdsWithActiveRrpAppointments } from "../../../src/modules/rrp-application/rrp-appointment.repository.js";

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
  participantId?: string;
  country?: string;
  fundingModel?: "SELF" | "PARTIAL" | "FULL";
}): Promise<{ applicationId: string; revision: number }> {
  const userId = input?.userId ?? "user-applicant-1";
  const draft = await createRrpApplicationDraftForUser(userId, {
    representCountryCode: input?.country ?? "CA",
    legalFirstName: "Ada",
    legalLastName: "Lovelace",
    profession: "Engineer",
    residenceCountryCode: "CA",
    dateOfBirth: adultDob(),
    fundingModel: input?.fundingModel ?? "SELF",
    annualRequestedAmountCad: input?.fundingModel === "SELF" || !input?.fundingModel ? null : 12000,
    teamMemberCount: 2,
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

describe("HU-RRP-03C confirm-appointment foundation", () => {
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

    const applicant = makeUser();
    const admin = makeUser({
      userId: "user-admin-1",
      memberId: "participant-admin-1",
      email: "admin@example.com",
      role: "admin",
      displayName: "Admin One",
    });
    const representative = makeUser({
      userId: "user-rep-1",
      memberId: "participant-rep-1",
      email: "rep@example.com",
      role: "member",
      displayName: "Rep One",
    });

    setFindAuthUserByIdForTests(async (userId) => {
      if (userId === applicant.userId) return applicant;
      if (userId === admin.userId) return admin;
      if (userId === representative.userId) return representative;
      return null;
    });
  });

  afterEach(() => {
    setFindAuthUserByIdForTests(null);
    resetRrpApplicationMemoryForTests();
    resetRrpAppointmentMemoryForTests();
    resetRrpAppointmentMessageIntentMemoryForTests();
    resetRrpApplicationIndexReadinessForTests();
  });

  it("denies anonymous, participant, applicant, and representative actors", async () => {
    const submitted = await createSubmittedApplication();

    await assert.rejects(
      () =>
        confirmRrpAppointmentForAdminActor({
          actorUserId: "",
          applicationId: submitted.applicationId,
          body: { expectedRevision: submitted.revision },
        }),
      RrpApplicationAccessDeniedError,
    );

    await assert.rejects(
      () =>
        confirmRrpAppointmentForAdminActor({
          actorUserId: "user-applicant-1",
          applicationId: submitted.applicationId,
          body: { expectedRevision: submitted.revision },
        }),
      /Administrator access is required/i,
    );

    // Applicant who already has a submitted app cannot self-appoint.
    await assert.rejects(
      () =>
        confirmRrpAppointmentForAdminActor({
          actorUserId: "user-applicant-1",
          applicationId: submitted.applicationId,
          body: { expectedRevision: submitted.revision },
        }),
      RrpApplicationAccessDeniedError,
    );

    await assert.rejects(
      () =>
        confirmRrpAppointmentForAdminActor({
          actorUserId: "user-rep-1",
          applicationId: submitted.applicationId,
          body: { expectedRevision: submitted.revision },
        }),
      RrpApplicationAccessDeniedError,
    );
  });

  it("allows administrator confirm-appointment and records appointment + message intent", async () => {
    const submitted = await createSubmittedApplication({ fundingModel: "PARTIAL" });
    const result = await confirmRrpAppointmentForAdminActor({
      actorUserId: "user-admin-1",
      applicationId: submitted.applicationId,
      body: { expectedRevision: submitted.revision },
    });

    assert.equal(result.application.status, "approved");
    assert.equal(result.appointment.status, "active");
    assert.equal(result.appointment.sourceApplicationId, submitted.applicationId);
    assert.equal(result.appointment.representCountryCode, "CA");
    assert.equal(result.messageIntentRecorded, true);
    // Best-effort DM is expected to warn in unit harness without messaging fixtures.
    assert.ok(result.messageWarning);

    const appointment = await findActiveRrpAppointmentBySourceApplicationId(submitted.applicationId);
    assert.ok(appointment);
    assert.equal(appointment!.appointedByAdminUserId, "user-admin-1");

    const intent = await findRrpAppointmentMessageIntentByAppointmentId(appointment!.appointmentId);
    assert.ok(intent);
    assert.match(intent!.clientMessageId, /^rrp-appointment:/);
    assert.doesNotMatch(intent!.clientMessageId, /dateOfBirth|motivation|funding/i);
    // Temporary DM failure keeps intent pending (retryable); appointment remains valid.
    assert.equal(intent!.status, "pending");
    assert.ok(intent!.deliveryAttempts >= 1);
    assert.ok(intent!.lastError);
  });

  it("is idempotent on duplicate confirm-appointment", async () => {
    const submitted = await createSubmittedApplication();
    const first = await confirmRrpAppointmentForAdminActor({
      actorUserId: "user-admin-1",
      applicationId: submitted.applicationId,
      body: { expectedRevision: submitted.revision },
    });
    const second = await confirmRrpAppointmentForAdminActor({
      actorUserId: "user-admin-1",
      applicationId: submitted.applicationId,
      body: { expectedRevision: first.application.revision },
    });

    assert.equal(first.appointment.appointmentId, second.appointment.appointmentId);
    assert.equal(second.application.decisionHistory.length, first.application.decisionHistory.length);
  });

  it("rejects concurrent conflicting confirm when appointment already exists for participant/country", async () => {
    const first = await createSubmittedApplication({ country: "CA", fundingModel: "SELF" });
    await confirmRrpAppointmentForAdminActor({
      actorUserId: "user-admin-1",
      applicationId: first.applicationId,
      body: { expectedRevision: first.revision },
    });

    // Second application same participant/country after terminal first — allowed by app uniqueness,
    // but appointment uniqueness blocks a second active appointment.
    const second = await createSubmittedApplication({ country: "CA", fundingModel: "FULL" });
    await assert.rejects(
      () =>
        confirmRrpAppointmentForAdminActor({
          actorUserId: "user-admin-1",
          applicationId: second.applicationId,
          body: { expectedRevision: second.revision },
        }),
      RrpApplicationConflictError,
    );
  });

  it("allows multiple Representatives for the same country (different participants)", async () => {
    const first = await createSubmittedApplication({
      userId: "user-applicant-1",
      country: "CA",
    });
    await confirmRrpAppointmentForAdminActor({
      actorUserId: "user-admin-1",
      applicationId: first.applicationId,
      body: { expectedRevision: first.revision },
    });

    setFindAuthUserByIdForTests(async (userId) => {
      if (userId === "user-applicant-1") return makeUser();
      if (userId === "user-admin-1") {
        return makeUser({
          userId: "user-admin-1",
          memberId: "participant-admin-1",
          role: "admin",
          email: "admin@example.com",
        });
      }
      if (userId === "user-applicant-2") {
        return makeUser({
          userId: "user-applicant-2",
          memberId: "participant-2",
          email: "two@example.com",
        });
      }
      return null;
    });

    const second = await createSubmittedApplication({
      userId: "user-applicant-2",
      country: "CA",
    });
    const result = await confirmRrpAppointmentForAdminActor({
      actorUserId: "user-admin-1",
      applicationId: second.applicationId,
      body: { expectedRevision: second.revision },
    });
    assert.equal(result.appointment.representCountryCode, "CA");
    assert.equal(result.appointment.participantId, "participant-2");

    const a1 = await findActiveRrpAppointmentForParticipantCountry({
      participantId: "participant-1",
      representCountryCode: "CA",
    });
    const a2 = await findActiveRrpAppointmentForParticipantCountry({
      participantId: "participant-2",
      representCountryCode: "CA",
    });
    assert.ok(a1);
    assert.ok(a2);
    assert.notEqual(a1!.appointmentId, a2!.appointmentId);
  });

  it("keeps review approve status-only without creating an appointment", async () => {
    const submitted = await createSubmittedApplication();
    const reviewed = await reviewRrpApplicationForAdminActor({
      actorUserId: "user-admin-1",
      applicationId: submitted.applicationId,
      body: { decision: "approve", expectedRevision: submitted.revision },
    });
    assert.equal(reviewed.status, "approved");
    const appointment = await findActiveRrpAppointmentBySourceApplicationId(submitted.applicationId);
    assert.equal(appointment, null);
  });

  it("derives directory applicant and representative classification user ids", async () => {
    const submitted = await createSubmittedApplication({ fundingModel: "FULL" });
    const applicantIds = await findUserIdsForApplicantFundingClassification("FULL");
    assert.ok(applicantIds.includes("user-applicant-1"));

    await confirmRrpAppointmentForAdminActor({
      actorUserId: "user-admin-1",
      applicationId: submitted.applicationId,
      body: { expectedRevision: submitted.revision },
    });

    const afterApplicant = await findUserIdsForApplicantFundingClassification("FULL");
    assert.equal(afterApplicant.includes("user-applicant-1"), false);

    const reps = await findUserIdsWithActiveRrpAppointments();
    assert.ok(reps.includes("user-applicant-1"));
  });

  it("does not escalate auth.role on appointment", async () => {
    const submitted = await createSubmittedApplication();
    await confirmRrpAppointmentForAdminActor({
      actorUserId: "user-admin-1",
      applicationId: submitted.applicationId,
      body: { expectedRevision: submitted.revision },
    });
    // Auth fixture remains member — appointment module never mutates auth users.
    const { findAuthUserById } = await import("../../../src/modules/auth/auth-user.repository.js");
    const user = await findAuthUserById("user-applicant-1");
    assert.equal(user?.role, "member");
  });
});
