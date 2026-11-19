/**
 * HU-RRP-FINAL-03B — admin appointment revocation.
 */
process.env.NODE_TEST_ENV = "true";

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { RRP_APPLICATION_CONSENT_VERSION } from "@hu/types";

import { buildRrpSummaryForParticipant } from "../../../src/modules/administration/admin-participant-directory.service.js";
import { listAdministrationAuditsForTarget } from "../../../src/modules/administration/audit.service.js";
import { setAdministrationAuditForceMemoryForTests } from "../../../src/modules/administration/persistence/administration-audit.repository.js";
import { setFindAuthUserByIdForTests } from "../../../src/modules/auth/auth-user.repository.js";
import type { AuthUserRecord } from "../../../src/modules/auth/auth-user.types.js";
import { findRrpApplicationById } from "../../../src/modules/rrp-application/rrp-application.repository.js";
import { findRrpAppointmentById } from "../../../src/modules/rrp-application/rrp-appointment.repository.js";
import {
  RrpApplicationAccessDeniedError,
  RrpApplicationNotFoundError,
  RrpApplicationUnavailableError,
} from "../../../src/modules/rrp-application/rrp-application.errors.js";
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
  clearRrpApplicationRateLimitBucketsForTests,
  rrpAdminWriteRateLimiter,
  RRP_ADMIN_WRITE_RATE_LIMIT_FOR_TESTS,
} from "../../../src/modules/rrp-application/rrp-application-rate-limit.js";
import {
  createRrpApplicationDraftForUser,
  getRrpApplicationDetailForAdminActor,
  listOwnRrpApplicationsForUser,
  submitOwnRrpApplicationForUser,
} from "../../../src/modules/rrp-application/rrp-application.service.js";
import {
  confirmRrpAppointmentForAdminActor,
  revokeRrpAppointmentForAdminActor,
} from "../../../src/modules/rrp-application/rrp-appointment.service.js";
import {
  findActiveRrpAppointmentBySourceApplicationId,
  findActiveRrpAppointmentForParticipantCountry,
  resetRrpAppointmentMemoryForTests,
  setRrpAppointmentForceMemoryForTests,
} from "../../../src/modules/rrp-application/rrp-appointment.repository.js";
import {
  resetRrpAppointmentMessageIntentMemoryForTests,
  setRrpAppointmentMessageIntentForceMemoryForTests,
} from "../../../src/modules/rrp-application/rrp-appointment-message-intent.repository.js";
import {
  resetRrpAppointmentIndexReadinessForTests,
  setRrpAppointmentActiveUniqueIndexReadyForTests,
} from "../../../src/modules/rrp-application/rrp-appointment.index-readiness.js";

const apiRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

function readApi(relative: string): string {
  return readFileSync(path.join(apiRoot, relative), "utf8");
}

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

function installAuthFixture(): void {
  setFindAuthUserByIdForTests(async (userId) => {
    if (userId === "user-applicant-1") return makeUser();
    if (userId === "user-applicant-2") {
      return makeUser({
        userId: "user-applicant-2",
        memberId: "participant-2",
        email: "two@example.com",
      });
    }
    if (userId === "user-admin-1") {
      return makeUser({
        userId: "user-admin-1",
        memberId: "participant-admin-1",
        role: "admin",
        email: "admin@example.com",
      });
    }
    if (userId === "user-member-2") {
      return makeUser({
        userId: "user-member-2",
        memberId: "participant-member-2",
        email: "member2@example.com",
      });
    }
    return null;
  });
}

async function createSubmittedApplication(input?: {
  userId?: string;
  country?: string;
  fundingModel?: "SELF" | "PARTIAL" | "FULL";
}): Promise<{ applicationId: string; revision: number; status: string }> {
  const userId = input?.userId ?? "user-applicant-1";
  const draft = await createRrpApplicationDraftForUser(userId, {
    representCountryCode: input?.country ?? "CA",
    legalFirstName: "Ada",
    legalLastName: "Lovelace",
    profession: "Engineer",
    residenceCountryCode: "CA",
    dateOfBirth: adultDob(),
    fundingModel: input?.fundingModel ?? "SELF",
    annualRequestedAmountCad:
      input?.fundingModel === "SELF" || !input?.fundingModel ? null : 12000,
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
  return {
    applicationId: submitted.applicationId,
    revision: submitted.revision,
    status: submitted.status,
  };
}

async function approve(applicationId: string, revision: number) {
  return confirmRrpAppointmentForAdminActor({
    actorUserId: "user-admin-1",
    applicationId,
    body: { expectedRevision: revision },
  });
}

describe("HU-RRP-FINAL-03B admin appointment revocation", () => {
  beforeEach(() => {
    setRrpApplicationWritesEnabledForTests(true);
    setRrpApplicationForceMemoryForTests(true);
    setRrpAppointmentForceMemoryForTests(true);
    setRrpAppointmentMessageIntentForceMemoryForTests(true);
    setAdministrationAuditForceMemoryForTests(true);
    setRrpApplicationActiveUniqueIndexReadyForTests(true);
    setRrpAppointmentActiveUniqueIndexReadyForTests(true);
    resetRrpApplicationMemoryForTests();
    resetRrpAppointmentMemoryForTests();
    resetRrpAppointmentMessageIntentMemoryForTests();
    resetRrpApplicationIndexReadinessForTests();
    resetRrpAppointmentIndexReadinessForTests();
    setRrpApplicationActiveUniqueIndexReadyForTests(true);
    setRrpAppointmentActiveUniqueIndexReadyForTests(true);
    clearRrpApplicationRateLimitBucketsForTests();
    installAuthFixture();
  });

  afterEach(() => {
    setRrpApplicationWritesEnabledForTests(null);
    setFindAuthUserByIdForTests(null);
    clearRrpApplicationRateLimitBucketsForTests();
  });

  it("wires revoke-appointment route with admin write rate limiter", () => {
    const routes = readApi("src/modules/rrp-application/rrp-application-admin.routes.ts");
    assert.match(routes, /revoke-appointment/);
    assert.match(routes, /revokeRrpAppointmentForAdminActor/);
    assert.match(
      routes,
      /\/:applicationId\/revoke-appointment[\s\S]*rrpAdminWriteRateLimiter/,
    );
  });

  it("revokes an active appointment for admin and clears designation on refetch", async () => {
    const submitted = await createSubmittedApplication();
    const confirmed = await approve(submitted.applicationId, submitted.revision);
    assert.equal(confirmed.appointment.status, "active");
    assert.equal(confirmed.application.activeAppointment?.status, "active");

    const revoked = await revokeRrpAppointmentForAdminActor({
      actorUserId: "user-admin-1",
      applicationId: submitted.applicationId,
      body: { note: "Policy review" },
    });

    assert.equal(revoked.transitioned, true);
    assert.equal(revoked.appointment.status, "revoked");
    assert.equal(revoked.application.activeAppointment, null);
    assert.equal(revoked.application.status, "approved");

    const active = await findActiveRrpAppointmentBySourceApplicationId(submitted.applicationId);
    assert.equal(active, null);

    const detail = await getRrpApplicationDetailForAdminActor({
      actorUserId: "user-admin-1",
      applicationId: submitted.applicationId,
    });
    assert.equal(detail.activeAppointment, null);
    assert.equal(detail.status, "approved");
    assert.equal(detail.decisionHistory.length, confirmed.application.decisionHistory.length);

    const own = await listOwnRrpApplicationsForUser("user-applicant-1");
    const row = own.find((item) => item.applicationId === submitted.applicationId);
    assert.ok(row);
    assert.equal(row!.platformDesignationActive, false);

    const { findAuthUserById } = await import(
      "../../../src/modules/auth/auth-user.repository.js"
    );
    const user = await findAuthUserById("user-applicant-1");
    assert.equal(user?.role, "member");
  });

  it("rejects unauthenticated-style missing admin and non-admin actors", async () => {
    const submitted = await createSubmittedApplication();
    await approve(submitted.applicationId, submitted.revision);

    await assert.rejects(
      () =>
        revokeRrpAppointmentForAdminActor({
          actorUserId: "user-member-2",
          applicationId: submitted.applicationId,
          body: {},
        }),
      RrpApplicationAccessDeniedError,
    );
  });

  it("returns 404 semantics for unknown application and missing appointment", async () => {
    await assert.rejects(
      () =>
        revokeRrpAppointmentForAdminActor({
          actorUserId: "user-admin-1",
          applicationId: "missing-application",
          body: {},
        }),
      RrpApplicationNotFoundError,
    );

    const submitted = await createSubmittedApplication();
    await assert.rejects(
      () =>
        revokeRrpAppointmentForAdminActor({
          actorUserId: "user-admin-1",
          applicationId: submitted.applicationId,
          body: {},
        }),
      RrpApplicationNotFoundError,
    );
  });

  it("is idempotent when already revoked and audits only a real transition", async () => {
    const submitted = await createSubmittedApplication();
    const confirmed = await approve(submitted.applicationId, submitted.revision);
    const appointmentId = confirmed.appointment.appointmentId;

    const first = await revokeRrpAppointmentForAdminActor({
      actorUserId: "user-admin-1",
      applicationId: submitted.applicationId,
      body: {},
    });
    assert.equal(first.transitioned, true);

    // Allow best-effort audit microtask to settle.
    await new Promise((resolve) => setTimeout(resolve, 20));
    const afterFirst = await listAdministrationAuditsForTarget({
      targetType: "rrp_appointment",
      targetId: appointmentId,
    });
    const revokeAudits = afterFirst.filter((entry) => entry.action === "rrp.appointment.revoke");
    assert.equal(revokeAudits.length, 1);
    assert.match(revokeAudits[0]!.beforeSummary ?? "", /applicationId=/);
    assert.match(revokeAudits[0]!.afterSummary ?? "", /status=revoked/);
    assert.doesNotMatch(revokeAudits[0]!.beforeSummary ?? "", /Lovelace|dateOfBirth|motivation/i);

    const second = await revokeRrpAppointmentForAdminActor({
      actorUserId: "user-admin-1",
      applicationId: submitted.applicationId,
      body: { note: "replay" },
    });
    assert.equal(second.transitioned, false);
    assert.equal(second.appointment.status, "revoked");

    await new Promise((resolve) => setTimeout(resolve, 20));
    const afterSecond = await listAdministrationAuditsForTarget({
      targetType: "rrp_appointment",
      targetId: appointmentId,
    });
    assert.equal(
      afterSecond.filter((entry) => entry.action === "rrp.appointment.revoke").length,
      1,
    );
  });

  it("handles concurrent revoke requests without duplicate transition", async () => {
    const submitted = await createSubmittedApplication();
    await approve(submitted.applicationId, submitted.revision);

    const [a, b] = await Promise.all([
      revokeRrpAppointmentForAdminActor({
        actorUserId: "user-admin-1",
        applicationId: submitted.applicationId,
        body: {},
      }),
      revokeRrpAppointmentForAdminActor({
        actorUserId: "user-admin-1",
        applicationId: submitted.applicationId,
        body: {},
      }),
    ]);

    assert.equal(a.appointment.status, "revoked");
    assert.equal(b.appointment.status, "revoked");
    assert.equal(
      Number(a.transitioned) + Number(b.transitioned),
      1,
      "exactly one concurrent revoke should transition",
    );
  });

  it("fails closed when RRP writes are disabled", async () => {
    const submitted = await createSubmittedApplication();
    await approve(submitted.applicationId, submitted.revision);
    setRrpApplicationWritesEnabledForTests(false);

    await assert.rejects(
      () =>
        revokeRrpAppointmentForAdminActor({
          actorUserId: "user-admin-1",
          applicationId: submitted.applicationId,
          body: {},
        }),
      RrpApplicationUnavailableError,
    );
  });

  it("enforces admin write rate limit with 429", () => {
    const { maxPerWindow } = RRP_ADMIN_WRITE_RATE_LIMIT_FOR_TESTS;
    let limitedStatus = 0;
    const mockReq = { auth: { id: "admin-rate" }, headers: {}, socket: {} } as never;
    const next = () => undefined;
    for (let i = 0; i < maxPerWindow; i += 1) {
      rrpAdminWriteRateLimiter(mockReq, { statusCode: 0, status() { return this; }, json() {} } as never, next);
    }
    rrpAdminWriteRateLimiter(
      mockReq,
      {
        statusCode: 0,
        status(code: number) {
          limitedStatus = code;
          return this;
        },
        json() {},
      } as never,
      next,
    );
    assert.equal(limitedStatus, 429);
  });

  it("revoking one representative leaves another active in the same country", async () => {
    const first = await createSubmittedApplication({
      userId: "user-applicant-1",
      country: "CA",
    });
    await approve(first.applicationId, first.revision);

    const second = await createSubmittedApplication({
      userId: "user-applicant-2",
      country: "CA",
    });
    await approve(second.applicationId, second.revision);

    await revokeRrpAppointmentForAdminActor({
      actorUserId: "user-admin-1",
      applicationId: first.applicationId,
      body: {},
    });

    const a1 = await findActiveRrpAppointmentForParticipantCountry({
      participantId: "participant-1",
      representCountryCode: "CA",
    });
    const a2 = await findActiveRrpAppointmentForParticipantCountry({
      participantId: "participant-2",
      representCountryCode: "CA",
    });
    assert.equal(a1, null);
    assert.ok(a2);
    assert.equal(a2!.sourceApplicationId, second.applicationId);
  });

  it("allows reappointment after revoke and still blocks duplicate active appointment", async () => {
    const first = await createSubmittedApplication({ country: "CA" });
    await approve(first.applicationId, first.revision);
    await revokeRrpAppointmentForAdminActor({
      actorUserId: "user-admin-1",
      applicationId: first.applicationId,
      body: {},
    });

    const second = await createSubmittedApplication({ country: "CA", fundingModel: "FULL" });
    const reappointed = await approve(second.applicationId, second.revision);
    assert.equal(reappointed.appointment.status, "active");
    assert.equal(reappointed.appointment.participantId, "participant-1");

    const third = await createSubmittedApplication({ country: "CA", fundingModel: "PARTIAL" });
    await assert.rejects(
      () => approve(third.applicationId, third.revision),
      /active Representative appointment already exists/i,
    );
  });

  it("keeps approved application viewable after revoke without active representative classification", async () => {
    const first = await createSubmittedApplication({
      userId: "user-applicant-1",
      country: "CA",
    });
    const confirmed = await approve(first.applicationId, first.revision);
    const activeAppointment = await findRrpAppointmentById(confirmed.appointment.appointmentId);
    assert.ok(activeAppointment);
    const approvedApp = await findRrpApplicationById(first.applicationId);
    assert.ok(approvedApp);
    assert.equal(approvedApp!.status, "approved");

    const whileActive = buildRrpSummaryForParticipant({
      applications: [approvedApp!],
      appointments: [activeAppointment!],
    });
    assert.ok(whileActive);
    assert.ok(whileActive!.classifications.includes("representative"));
    assert.ok(whileActive!.activeAppointmentIds.includes(activeAppointment!.appointmentId));
    assert.ok(whileActive!.viewableApplicationIds.includes(first.applicationId));

    await revokeRrpAppointmentForAdminActor({
      actorUserId: "user-admin-1",
      applicationId: first.applicationId,
      body: {},
    });
    const revokedAppointment = await findRrpAppointmentById(confirmed.appointment.appointmentId);
    assert.equal(revokedAppointment?.status, "revoked");

    const afterRevoke = buildRrpSummaryForParticipant({
      applications: [approvedApp!],
      appointments: [revokedAppointment!],
    });
    assert.ok(afterRevoke, "approved history must keep an RRP summary for View Application");
    assert.equal(afterRevoke!.classifications.includes("representative"), false);
    assert.deepEqual(afterRevoke!.activeAppointmentIds, []);
    assert.ok(afterRevoke!.viewableApplicationIds.includes(first.applicationId));
    assert.equal(afterRevoke!.activeApplicationIds.includes(first.applicationId), false);

    const detail = await getRrpApplicationDetailForAdminActor({
      actorUserId: "user-admin-1",
      applicationId: first.applicationId,
    });
    assert.equal(detail.status, "approved");
    assert.equal(detail.activeAppointment, null);
    assert.ok(detail.decisionHistory.length > 0);

    // Second representative in same country remains classified/viewable independently.
    const second = await createSubmittedApplication({
      userId: "user-applicant-2",
      country: "CA",
    });
    const secondConfirmed = await approve(second.applicationId, second.revision);
    const secondApp = await findRrpApplicationById(second.applicationId);
    const secondAppointment = await findRrpAppointmentById(secondConfirmed.appointment.appointmentId);
    const secondSummary = buildRrpSummaryForParticipant({
      applications: [secondApp!],
      appointments: [secondAppointment!],
    });
    assert.ok(secondSummary?.classifications.includes("representative"));
    assert.ok(secondSummary?.viewableApplicationIds.includes(second.applicationId));

    const firstStillHistory = buildRrpSummaryForParticipant({
      applications: [approvedApp!],
      appointments: [revokedAppointment!],
    });
    assert.ok(firstStillHistory?.viewableApplicationIds.includes(first.applicationId));
    assert.equal(firstStillHistory!.classifications.includes("representative"), false);
  });
});
