/**
 * HU-RRP-03L.2 — server write gate default OFF; explicit "true" restores writes.
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
import { isNewDirectConversationAllowed } from "../../../src/modules/direct-messaging/direct-messaging-eligibility.js";
import {
  resetRrpApplicationIndexReadinessForTests,
  setRrpApplicationActiveUniqueIndexReadyForTests,
} from "../../../src/modules/rrp-application/rrp-application.index-readiness.js";
import {
  resetRrpApplicationMemoryForTests,
  setRrpApplicationForceMemoryForTests,
} from "../../../src/modules/rrp-application/rrp-application.repository.js";
import { RrpApplicationUnavailableError } from "../../../src/modules/rrp-application/rrp-application.errors.js";
import {
  createRrpApplicationDraftForUser,
  getOwnRrpApplicationForUser,
  listOwnRrpApplicationsForUser,
  listRrpApplicationsForAdminActor,
  reviewRrpApplicationForAdminActor,
  submitOwnRrpApplicationForUser,
  updateOwnRrpApplicationDraftForUser,
  withdrawOwnRrpApplicationForUser,
} from "../../../src/modules/rrp-application/rrp-application.service.js";
import {
  RRP_APPLICATIONS_WRITES_ENABLED_ENV,
  isRrpApplicationWritesEnabled,
  setRrpApplicationWritesEnabledForTests,
} from "../../../src/modules/rrp-application/rrp-application-writes.activation.js";
import { confirmRrpAppointmentForAdminActor } from "../../../src/modules/rrp-application/rrp-appointment.service.js";
import {
  resetRrpAppointmentMemoryForTests,
  setRrpAppointmentForceMemoryForTests,
} from "../../../src/modules/rrp-application/rrp-appointment.repository.js";
import {
  buildRrpRequestInformationMessageIntent,
  insertRrpAppointmentMessageIntentIdempotent,
  resetRrpAppointmentMessageIntentMemoryForTests,
  setRrpAppointmentMessageIntentForceMemoryForTests,
} from "../../../src/modules/rrp-application/rrp-appointment-message-intent.repository.js";
import {
  deliverRrpMessageIntentBestEffort,
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

const apiSrc = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../src");

function readApi(relative: string): string {
  return readFileSync(path.join(apiSrc, relative), "utf8");
}

describe("HU-RRP-03L.2 RRP writes activation gate", () => {
  beforeEach(() => {
    setRrpApplicationWritesEnabledForTests(null);
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

  it("defaults writes OFF unless env is exactly true", () => {
    assert.equal(isRrpApplicationWritesEnabled({}), false);
    assert.equal(
      isRrpApplicationWritesEnabled({ [RRP_APPLICATIONS_WRITES_ENABLED_ENV]: "false" }),
      false,
    );
    assert.equal(
      isRrpApplicationWritesEnabled({ [RRP_APPLICATIONS_WRITES_ENABLED_ENV]: "1" }),
      false,
    );
    assert.equal(
      isRrpApplicationWritesEnabled({ [RRP_APPLICATIONS_WRITES_ENABLED_ENV]: "true" }),
      true,
    );
  });

  it("blocks create / update / submit / withdraw / review / confirm when OFF", async () => {
    await assert.rejects(
      () =>
        createRrpApplicationDraftForUser("user-applicant-1", {
          representCountryCode: "CA",
        }),
      RrpApplicationUnavailableError,
    );

    setRrpApplicationWritesEnabledForTests(true);
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
    setRrpApplicationWritesEnabledForTests(false);

    await assert.rejects(
      () =>
        updateOwnRrpApplicationDraftForUser({
          userId: "user-applicant-1",
          applicationId: draft.applicationId,
          body: { expectedRevision: draft.revision, profession: "Updated" },
        }),
      RrpApplicationUnavailableError,
    );
    await assert.rejects(
      () =>
        submitOwnRrpApplicationForUser({
          userId: "user-applicant-1",
          applicationId: draft.applicationId,
          body: {
            expectedRevision: draft.revision,
            consentAccepted: true,
            consentVersion: RRP_APPLICATION_CONSENT_VERSION,
          },
        }),
      RrpApplicationUnavailableError,
    );
    await assert.rejects(
      () =>
        withdrawOwnRrpApplicationForUser({
          userId: "user-applicant-1",
          applicationId: draft.applicationId,
          body: { expectedRevision: draft.revision },
        }),
      RrpApplicationUnavailableError,
    );
    await assert.rejects(
      () =>
        reviewRrpApplicationForAdminActor({
          actorUserId: "user-admin-1",
          applicationId: draft.applicationId,
          body: {
            decision: "mark_under_review",
            expectedRevision: draft.revision,
          },
        }),
      RrpApplicationUnavailableError,
    );
    await assert.rejects(
      () =>
        confirmRrpAppointmentForAdminActor({
          actorUserId: "user-admin-1",
          applicationId: draft.applicationId,
          body: { expectedRevision: draft.revision },
        }),
      RrpApplicationUnavailableError,
    );
  });

  it("allows authorized reads while writes are OFF", async () => {
    setRrpApplicationWritesEnabledForTests(true);
    const draft = await createRrpApplicationDraftForUser("user-applicant-1", {
      representCountryCode: "CA",
    });
    setRrpApplicationWritesEnabledForTests(false);

    const listed = await listOwnRrpApplicationsForUser("user-applicant-1");
    assert.equal(listed.length, 1);
    const own = await getOwnRrpApplicationForUser({
      userId: "user-applicant-1",
      applicationId: draft.applicationId,
    });
    assert.equal(own.applicationId, draft.applicationId);

    const adminList = await listRrpApplicationsForAdminActor({
      actorUserId: "user-admin-1",
      query: {},
    });
    assert.ok(adminList.items.some((item) => item.applicationId === draft.applicationId));
  });

  it("restores write path when explicitly enabled", async () => {
    setRrpApplicationWritesEnabledForTests(true);
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
    assert.equal(submitted.status, "submitted");
  });

  it("pauses intent delivery and reconcile when writes are OFF", async () => {
    const intent = buildRrpRequestInformationMessageIntent({
      applicationId: "app-paused",
      applicationRevision: 2,
      recipientParticipantId: "participant-1",
      adminParticipantId: "participant-admin-1",
      representCountryCode: "CA",
      requestExplanation: "Need clarification",
    });
    await insertRrpAppointmentMessageIntentIdempotent(intent);

    setRrpApplicationWritesEnabledForTests(false);
    const warning = await deliverRrpMessageIntentBestEffort(intent);
    assert.match(String(warning), /writes are not enabled/i);

    const summary = await reconcilePendingRrpMessageIntents({ limit: 5 });
    assert.deepEqual(summary, {
      scanned: 0,
      delivered: 0,
      stillPending: 0,
      failed: 0,
    });

    const service = readApi("modules/rrp-application/rrp-application.service.ts");
    const appointment = readApi("modules/rrp-application/rrp-appointment.service.ts");
    const delivery = readApi("modules/rrp-application/rrp-message-intent.delivery.js".replace(/\.js$/, ".ts"));
    assert.match(service, /assertRrpApplicationWritesEnabled/);
    assert.match(appointment, /assertRrpApplicationWritesEnabled/);
    assert.match(delivery, /isRrpApplicationWritesEnabled/);
  });

  it("does not alter Messages privacy eligibility helpers", async () => {
    assert.equal(
      await isNewDirectConversationAllowed(
        "viewer",
        "owner",
        "nobody",
        {
          listWorkspaceAlliesForParticipant: async () => [
            { participantId: "viewer" } as never,
          ],
        },
        { viewerIsAdmin: true },
      ),
      false,
    );
  });
});
