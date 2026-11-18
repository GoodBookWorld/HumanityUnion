/**
 * HU-RRP-03I — review decision "approve" rejected; confirm-appointment remains canonical.
 */
process.env.NODE_TEST_ENV = "true";

import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";

import { RRP_APPLICATION_CONSENT_VERSION } from "@hu/types";

import { setFindAuthUserByIdForTests } from "../../../src/modules/auth/auth-user.repository.js";
import type { AuthUserRecord } from "../../../src/modules/auth/auth-user.types.js";
import { RrpApplicationValidationError } from "../../../src/modules/rrp-application/rrp-application.errors.js";
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
import {
  RRP_REVIEW_APPROVE_REJECTED_MESSAGE,
  validateAdminReviewBody,
} from "../../../src/modules/rrp-application/rrp-application.validation.js";
import { confirmRrpAppointmentForAdminActor } from "../../../src/modules/rrp-application/rrp-appointment.service.js";
import {
  findActiveRrpAppointmentBySourceApplicationId,
  resetRrpAppointmentMemoryForTests,
  setRrpAppointmentForceMemoryForTests,
} from "../../../src/modules/rrp-application/rrp-appointment.repository.js";
import {
  resetRrpAppointmentMessageIntentMemoryForTests,
  setRrpAppointmentMessageIntentForceMemoryForTests,
} from "../../../src/modules/rrp-application/rrp-appointment-message-intent.repository.js";

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

describe("HU-RRP-03I remove status-only approve", () => {
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
    setFindAuthUserByIdForTests(async (userId) => {
      if (userId === applicant.userId) return applicant;
      if (userId === admin.userId) return admin;
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

  it("validateAdminReviewBody rejects approve with statusCode 422", () => {
    try {
      validateAdminReviewBody({
        decision: "approve",
        expectedRevision: 1,
      });
      assert.fail("expected validation error");
    } catch (error) {
      assert.ok(error instanceof RrpApplicationValidationError);
      assert.equal(error.statusCode, 422);
      assert.equal(error.message, RRP_REVIEW_APPROVE_REJECTED_MESSAGE);
    }
  });

  it("keeps mark_under_review, request_information, and reject", async () => {
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
      relevantExperience: "Experience.",
      motivation: "Motivation.",
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
    const underReview = await reviewRrpApplicationForAdminActor({
      actorUserId: "user-admin-1",
      applicationId: submitted.applicationId,
      body: {
        decision: "mark_under_review",
        expectedRevision: submitted.revision,
      },
    });
    assert.equal(underReview.application.status, "under_review");

    const info = await reviewRrpApplicationForAdminActor({
      actorUserId: "user-admin-1",
      applicationId: submitted.applicationId,
      body: {
        decision: "request_information",
        expectedRevision: underReview.application.revision,
        note: "Please clarify team size.",
      },
    });
    assert.equal(info.application.status, "information_requested");

    // Separate application for reject path
    const draft2 = await createRrpApplicationDraftForUser("user-applicant-1", {
      representCountryCode: "UA",
      legalFirstName: "Ada",
      legalLastName: "Lovelace",
      profession: "Engineer",
      residenceCountryCode: "CA",
      dateOfBirth: adultDob(),
      fundingModel: "SELF",
      annualRequestedAmountCad: null,
      teamMemberCount: 0,
      relevantExperience: "Experience.",
      motivation: "Motivation.",
    });
    const submitted2 = await submitOwnRrpApplicationForUser({
      userId: "user-applicant-1",
      applicationId: draft2.applicationId,
      body: {
        expectedRevision: draft2.revision,
        consentAccepted: true,
        consentVersion: RRP_APPLICATION_CONSENT_VERSION,
      },
    });
    const rejected = await reviewRrpApplicationForAdminActor({
      actorUserId: "user-admin-1",
      applicationId: submitted2.applicationId,
      body: {
        decision: "reject",
        expectedRevision: submitted2.revision,
        note: "Not a fit at this time.",
      },
    });
    assert.equal(rejected.application.status, "rejected");
  });

  it("confirm-appointment still creates approved application + appointment atomically", async () => {
    const draft = await createRrpApplicationDraftForUser("user-applicant-1", {
      representCountryCode: "NO",
      legalFirstName: "Ada",
      legalLastName: "Lovelace",
      profession: "Engineer",
      residenceCountryCode: "CA",
      dateOfBirth: adultDob(),
      fundingModel: "SELF",
      annualRequestedAmountCad: null,
      teamMemberCount: 1,
      relevantExperience: "Experience.",
      motivation: "Motivation.",
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
    const result = await confirmRrpAppointmentForAdminActor({
      actorUserId: "user-admin-1",
      applicationId: submitted.applicationId,
      body: { expectedRevision: submitted.revision },
    });
    assert.equal(result.application.status, "approved");
    assert.equal(result.appointment.status, "active");
    const appointment = await findActiveRrpAppointmentBySourceApplicationId(
      submitted.applicationId,
    );
    assert.ok(appointment);
    assert.equal(appointment!.appointmentId, result.appointment.appointmentId);
  });
});
