/**
 * HU-RRP-02B — Regional Representative application API foundation.
 */
process.env.NODE_TEST_ENV = "true";

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  RRP_APPLICATION_CONSENT_VERSION,
  RRP_APPLICATION_ACTIVE_STATUSES,
} from "@hu/types";

import { setFindAuthUserByIdForTests } from "../../../src/modules/auth/auth-user.repository.js";
import type { AuthUserRecord } from "../../../src/modules/auth/auth-user.types.js";
import {
  assertAdminMayTransition,
  assertParticipantMaySubmit,
  assertParticipantMayUpdate,
  assertParticipantMayWithdraw,
} from "../../../src/modules/rrp-application/rrp-application.lifecycle.js";
import {
  RrpApplicationAccessDeniedError,
  RrpApplicationConflictError,
  RrpApplicationUnavailableError,
  RrpApplicationValidationError,
} from "../../../src/modules/rrp-application/rrp-application.errors.js";
import {
  resetRrpApplicationIndexReadinessForTests,
  setRrpApplicationActiveUniqueIndexReadyForTests,
} from "../../../src/modules/rrp-application/rrp-application.index-readiness.js";
import { RRP_ACTIVE_UNIQUE_INDEX_NAME } from "../../../src/modules/rrp-application/rrp-application.constants.js";
import {
  toAdminRrpApplicationDetail,
  toAdminRrpApplicationListItem,
  buildRrpApplicationAuditSummary,
  toRrpApplicationDetail,
} from "../../../src/modules/rrp-application/rrp-application.projection.js";
import {
  resetRrpApplicationMemoryForTests,
  setRrpApplicationForceMemoryForTests,
} from "../../../src/modules/rrp-application/rrp-application.repository.js";
import {
  createRrpApplicationDraftForUser,
  getOwnRrpApplicationForUser,
  getRrpApplicationDetailForAdminActor,
  listOwnRrpApplicationsForUser,
  listRrpApplicationsForAdminActor,
  reviewRrpApplicationForAdminActor,
  submitOwnRrpApplicationForUser,
  updateOwnRrpApplicationDraftForUser,
  withdrawOwnRrpApplicationForUser,
} from "../../../src/modules/rrp-application/rrp-application.service.js";
import {
  computeExactAgeYears,
  validateCreateDraftBody,
  validateDateOfBirth,
  validateFundingFields,
  validateSubmitBody,
} from "../../../src/modules/rrp-application/rrp-application.validation.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "../../../../..");

function readRepo(relative: string): string {
  return readFileSync(path.join(repoRoot, relative), "utf8");
}

function makeUser(overrides: Partial<AuthUserRecord> = {}): AuthUserRecord {
  return {
    userId: "user-applicant-1",
    email: "applicant@example.com",
    passwordHash: "hash",
    displayName: "Applicant One",
    role: "member",
    status: "active",
    memberId: "participant-1",
    emailVerificationStatus: "verified",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

const adminUser = makeUser({
  userId: "user-admin-1",
  email: "admin@example.com",
  displayName: "Admin One",
  role: "admin",
  memberId: "participant-admin-1",
});

const otherUser = makeUser({
  userId: "user-other-1",
  email: "other@example.com",
  memberId: "participant-2",
});

const users = new Map<string, AuthUserRecord>();

function installUsers(...records: AuthUserRecord[]): void {
  users.clear();
  for (const record of records) {
    users.set(record.userId, record);
  }
  setFindAuthUserByIdForTests(async (userId) => users.get(userId) ?? null);
}

/** Fixed "today" for deterministic age tests: 2026-11-17 UTC. */
const AS_OF = new Date("2026-11-17T15:00:00.000Z");

function completeDraftFields() {
  return {
    legalFirstName: "Alex",
    legalLastName: "Applicant",
    profession: "Community organizer",
    residenceCountryCode: "CA",
    representCountryCode: "CA",
    dateOfBirth: "2000-01-15",
    fundingModel: "SELF" as const,
    annualRequestedAmountCad: null,
    teamMemberCount: 2,
    relevantExperience: "Led regional civic programs for five years.",
    motivation: "I want to strengthen regional representation.",
  };
}

beforeEach(() => {
  setRrpApplicationForceMemoryForTests(true);
  resetRrpApplicationMemoryForTests();
  resetRrpApplicationIndexReadinessForTests();
  installUsers(makeUser(), adminUser, otherUser);
});

afterEach(() => {
  setFindAuthUserByIdForTests(null);
  resetRrpApplicationMemoryForTests();
  resetRrpApplicationIndexReadinessForTests();
  setRrpApplicationForceMemoryForTests(false);
});

describe("HU-RRP-02B — age and date validation", () => {
  it("accepts an applicant who turns 18 today", () => {
    assert.equal(computeExactAgeYears("2008-11-17", AS_OF), 18);
    assert.equal(validateDateOfBirth("2008-11-17", AS_OF), "2008-11-17");
  });

  it("rejects an underage applicant one day before the 18th birthday", () => {
    assert.equal(computeExactAgeYears("2008-11-18", AS_OF), 17);
    assert.throws(() => validateDateOfBirth("2008-11-18", AS_OF), /at least 18/);
  });

  it("rejects future and impossible dates", () => {
    assert.throws(() => validateDateOfBirth("2099-01-01", AS_OF), /future/);
    assert.throws(() => validateDateOfBirth("2000-02-30", AS_OF), /real calendar/);
    assert.throws(() => validateDateOfBirth("2000-13-01", AS_OF), /real calendar|valid calendar/);
    assert.throws(() => validateDateOfBirth("not-a-date", AS_OF), /valid calendar/);
  });
});

describe("HU-RRP-02B — funding validation", () => {
  it("requires null amount for SELF and amount for PARTIAL/FULL", () => {
    assert.deepEqual(
      validateFundingFields({
        fundingModel: "SELF",
        annualRequestedAmountCad: null,
        requireComplete: true,
      }),
      { fundingModel: "SELF", annualRequestedAmountCad: null },
    );
    assert.throws(
      () =>
        validateFundingFields({
          fundingModel: "SELF",
          annualRequestedAmountCad: 100,
          requireComplete: true,
        }),
      /null for SELF/,
    );
    assert.throws(
      () =>
        validateFundingFields({
          fundingModel: "PARTIAL",
          annualRequestedAmountCad: null,
          requireComplete: true,
        }),
      /required for PARTIAL/,
    );
    assert.equal(
      validateFundingFields({
        fundingModel: "FULL",
        annualRequestedAmountCad: 25000.5,
        requireComplete: true,
      }).annualRequestedAmountCad,
      25000.5,
    );
  });
});

describe("HU-RRP-02B — draft create / submit / withdraw", () => {
  it("creates a valid draft", async () => {
    const draft = await createRrpApplicationDraftForUser("user-applicant-1", {
      representCountryCode: "ca",
      profession: "Engineer",
    });
    assert.equal(draft.status, "draft");
    assert.equal(draft.representCountryCode, "CA");
    assert.equal(draft.profession, "Engineer");
    assert.equal(draft.revision, 1);
    assert.equal(draft.participantId, "participant-1");
  });

  it("submits a complete application", async () => {
    const draft = await createRrpApplicationDraftForUser(
      "user-applicant-1",
      completeDraftFields(),
    );
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
    assert.equal(submitted.consentVersion, RRP_APPLICATION_CONSENT_VERSION);
    assert.ok(submitted.submittedAt);
    assert.equal(submitted.decisionHistory.length, 1);
  });

  it("rejects submission with missing mandatory fields", async () => {
    const draft = await createRrpApplicationDraftForUser("user-applicant-1", {
      representCountryCode: "CA",
    });
    await assert.rejects(
      () =>
        submitOwnRrpApplicationForUser({
          userId: "user-applicant-1",
          applicationId: draft.applicationId,
          body: {
            expectedRevision: 1,
            consentAccepted: true,
            consentVersion: RRP_APPLICATION_CONSENT_VERSION,
          },
        }),
      RrpApplicationValidationError,
    );
  });

  it("rejects underage date of birth on draft create", async () => {
    await assert.rejects(
      () =>
        createRrpApplicationDraftForUser("user-applicant-1", {
          representCountryCode: "CA",
          dateOfBirth: "2015-01-01",
        }),
      /at least 18/,
    );
  });

  it("is idempotent on submit retry without duplicating history", async () => {
    const draft = await createRrpApplicationDraftForUser(
      "user-applicant-1",
      completeDraftFields(),
    );
    const first = await submitOwnRrpApplicationForUser({
      userId: "user-applicant-1",
      applicationId: draft.applicationId,
      body: {
        expectedRevision: 1,
        consentAccepted: true,
        consentVersion: RRP_APPLICATION_CONSENT_VERSION,
      },
    });
    const second = await submitOwnRrpApplicationForUser({
      userId: "user-applicant-1",
      applicationId: draft.applicationId,
      body: {
        expectedRevision: first.revision,
        consentAccepted: true,
        consentVersion: RRP_APPLICATION_CONSENT_VERSION,
      },
    });
    assert.equal(second.status, "submitted");
    assert.equal(second.revision, first.revision);
    assert.equal(second.decisionHistory.length, 1);
  });

  it("allows withdraw from submitted", async () => {
    const draft = await createRrpApplicationDraftForUser(
      "user-applicant-1",
      completeDraftFields(),
    );
    const submitted = await submitOwnRrpApplicationForUser({
      userId: "user-applicant-1",
      applicationId: draft.applicationId,
      body: {
        expectedRevision: 1,
        consentAccepted: true,
        consentVersion: RRP_APPLICATION_CONSENT_VERSION,
      },
    });
    const withdrawn = await withdrawOwnRrpApplicationForUser({
      userId: "user-applicant-1",
      applicationId: draft.applicationId,
      body: { expectedRevision: submitted.revision },
    });
    assert.equal(withdrawn.status, "withdrawn");
  });
});

describe("HU-RRP-02B — uniqueness and concurrency", () => {
  it("blocks a second active application for the same representation country", async () => {
    await createRrpApplicationDraftForUser("user-applicant-1", {
      representCountryCode: "CA",
    });
    await assert.rejects(
      () =>
        createRrpApplicationDraftForUser("user-applicant-1", {
          representCountryCode: "CA",
        }),
      RrpApplicationConflictError,
    );
  });

  it("allows active applications for different representation countries", async () => {
    const first = await createRrpApplicationDraftForUser("user-applicant-1", {
      representCountryCode: "CA",
    });
    const second = await createRrpApplicationDraftForUser("user-applicant-1", {
      representCountryCode: "UA",
    });
    assert.notEqual(first.applicationId, second.applicationId);
    assert.equal(second.representCountryCode, "UA");
  });

  it("allows a new application after a terminal application for the same country", async () => {
    const first = await createRrpApplicationDraftForUser(
      "user-applicant-1",
      completeDraftFields(),
    );
    const submitted = await submitOwnRrpApplicationForUser({
      userId: "user-applicant-1",
      applicationId: first.applicationId,
      body: {
        expectedRevision: 1,
        consentAccepted: true,
        consentVersion: RRP_APPLICATION_CONSENT_VERSION,
      },
    });
    const rejected = await reviewRrpApplicationForAdminActor({
      actorUserId: "user-admin-1",
      applicationId: first.applicationId,
      body: {
        decision: "reject",
        expectedRevision: submitted.revision,
        note: "Not a fit at this time.",
      },
    });
    assert.equal(rejected.status, "rejected");

    const second = await createRrpApplicationDraftForUser("user-applicant-1", {
      representCountryCode: "CA",
      profession: "Coordinator",
    });
    assert.notEqual(second.applicationId, first.applicationId);
    assert.equal(second.status, "draft");

    const history = await listOwnRrpApplicationsForUser("user-applicant-1");
    assert.equal(history.length, 2);
    assert.ok(history.some((item) => item.status === "rejected"));
    assert.ok(history.some((item) => item.status === "draft"));
  });

  it("prevents parallel duplicate creation for the same country", async () => {
    const results = await Promise.allSettled([
      createRrpApplicationDraftForUser("user-applicant-1", { representCountryCode: "CA" }),
      createRrpApplicationDraftForUser("user-applicant-1", { representCountryCode: "CA" }),
    ]);
    const fulfilled = results.filter((result) => result.status === "fulfilled");
    const rejected = results.filter((result) => result.status === "rejected");
    assert.equal(fulfilled.length, 1);
    assert.equal(rejected.length, 1);
  });

  it("fails closed when the active unique index is not ready", async () => {
    setRrpApplicationActiveUniqueIndexReadyForTests(false);
    await assert.rejects(
      () =>
        createRrpApplicationDraftForUser("user-applicant-1", {
          representCountryCode: "CA",
        }),
      RrpApplicationUnavailableError,
    );
  });

  it("rejects concurrent update with stale revision", async () => {
    const draft = await createRrpApplicationDraftForUser("user-applicant-1", {
      representCountryCode: "CA",
      profession: "A",
    });
    await updateOwnRrpApplicationDraftForUser({
      userId: "user-applicant-1",
      applicationId: draft.applicationId,
      body: { expectedRevision: 1, profession: "B" },
    });
    await assert.rejects(
      () =>
        updateOwnRrpApplicationDraftForUser({
          userId: "user-applicant-1",
          applicationId: draft.applicationId,
          body: { expectedRevision: 1, profession: "C" },
        }),
      RrpApplicationConflictError,
    );
  });
});

describe("HU-RRP-02B — ownership and authorization", () => {
  it("denies ownership access to another participant", async () => {
    const draft = await createRrpApplicationDraftForUser("user-applicant-1", {
      representCountryCode: "CA",
    });
    await assert.rejects(
      () =>
        getOwnRrpApplicationForUser({
          userId: "user-other-1",
          applicationId: draft.applicationId,
        }),
      /not found/i,
    );
  });

  it("denies unverified participants", async () => {
    installUsers(
      makeUser({ emailVerificationStatus: "pending" }),
      adminUser,
      otherUser,
    );
    await assert.rejects(
      () =>
        createRrpApplicationDraftForUser("user-applicant-1", {
          representCountryCode: "CA",
        }),
      RrpApplicationAccessDeniedError,
    );
  });

  it("denies unauthorized admin access", async () => {
    const draft = await createRrpApplicationDraftForUser(
      "user-applicant-1",
      completeDraftFields(),
    );
    await submitOwnRrpApplicationForUser({
      userId: "user-applicant-1",
      applicationId: draft.applicationId,
      body: {
        expectedRevision: 1,
        consentAccepted: true,
        consentVersion: RRP_APPLICATION_CONSENT_VERSION,
      },
    });
    await assert.rejects(
      () =>
        listRrpApplicationsForAdminActor({
          actorUserId: "user-applicant-1",
          query: {},
        }),
      RrpApplicationAccessDeniedError,
    );
  });
});

describe("HU-RRP-02B — status transitions and approval policy", () => {
  it("enforces participant and admin transition rules", () => {
    assert.doesNotThrow(() => assertParticipantMayUpdate("draft"));
    assert.doesNotThrow(() => assertParticipantMaySubmit("information_requested"));
    assert.throws(() => assertParticipantMayUpdate("submitted"), RrpApplicationConflictError);
    assert.throws(() => assertParticipantMayWithdraw("approved"), RrpApplicationConflictError);
    assert.equal(
      assertAdminMayTransition({ fromStatus: "submitted", decision: "mark_under_review" }),
      "under_review",
    );
    assert.equal(
      assertAdminMayTransition({ fromStatus: "under_review", decision: "approve" }),
      "approved",
    );
    assert.throws(
      () => assertAdminMayTransition({ fromStatus: "draft", decision: "approve" }),
      RrpApplicationConflictError,
    );
  });

  it("supports information_requested resubmission", async () => {
    const draft = await createRrpApplicationDraftForUser(
      "user-applicant-1",
      completeDraftFields(),
    );
    const submitted = await submitOwnRrpApplicationForUser({
      userId: "user-applicant-1",
      applicationId: draft.applicationId,
      body: {
        expectedRevision: 1,
        consentAccepted: true,
        consentVersion: RRP_APPLICATION_CONSENT_VERSION,
      },
    });
    const requested = await reviewRrpApplicationForAdminActor({
      actorUserId: "user-admin-1",
      applicationId: draft.applicationId,
      body: {
        decision: "request_information",
        expectedRevision: submitted.revision,
        note: "Please clarify prior regional work.",
      },
    });
    assert.equal(requested.status, "information_requested");

    const updated = await updateOwnRrpApplicationDraftForUser({
      userId: "user-applicant-1",
      applicationId: draft.applicationId,
      body: {
        expectedRevision: requested.revision,
        relevantExperience: "Expanded regional experience details.",
      },
    });
    const resubmitted = await submitOwnRrpApplicationForUser({
      userId: "user-applicant-1",
      applicationId: draft.applicationId,
      body: {
        expectedRevision: updated.revision,
        consentAccepted: true,
        consentVersion: RRP_APPLICATION_CONSENT_VERSION,
      },
    });
    assert.equal(resubmitted.status, "submitted");
  });

  it("approves without granting Representative role or privileges", async () => {
    const draft = await createRrpApplicationDraftForUser(
      "user-applicant-1",
      completeDraftFields(),
    );
    const submitted = await submitOwnRrpApplicationForUser({
      userId: "user-applicant-1",
      applicationId: draft.applicationId,
      body: {
        expectedRevision: 1,
        consentAccepted: true,
        consentVersion: RRP_APPLICATION_CONSENT_VERSION,
      },
    });
    const approved = await reviewRrpApplicationForAdminActor({
      actorUserId: "user-admin-1",
      applicationId: draft.applicationId,
      body: {
        decision: "approve",
        expectedRevision: submitted.revision,
      },
    });
    assert.equal(approved.status, "approved");

    const serviceSource = readRepo(
      "apps/api/src/modules/rrp-application/rrp-application.service.ts",
    );
    assert.match(serviceSource, /Approval must never grant Representative status or privileges/);
    assert.doesNotMatch(serviceSource, /grantRole|role:\s*"representative"|ensureRepresentative/i);
    assert.doesNotMatch(
      readRepo("apps/api/src/modules/rrp-application/rrp-application.repository.ts"),
      /representativeRole|platformCapability|capability\.grant/i,
    );

    const applicant = users.get("user-applicant-1");
    assert.equal(applicant?.role, "member");
  });

  it("repeated approval is idempotent and does not append duplicate history", async () => {
    const draft = await createRrpApplicationDraftForUser(
      "user-applicant-1",
      completeDraftFields(),
    );
    const submitted = await submitOwnRrpApplicationForUser({
      userId: "user-applicant-1",
      applicationId: draft.applicationId,
      body: {
        expectedRevision: 1,
        consentAccepted: true,
        consentVersion: RRP_APPLICATION_CONSENT_VERSION,
      },
    });
    const approved = await reviewRrpApplicationForAdminActor({
      actorUserId: "user-admin-1",
      applicationId: draft.applicationId,
      body: {
        decision: "approve",
        expectedRevision: submitted.revision,
      },
    });
    const historyLength = approved.decisionHistory.length;
    const again = await reviewRrpApplicationForAdminActor({
      actorUserId: "user-admin-1",
      applicationId: draft.applicationId,
      body: {
        decision: "approve",
        expectedRevision: approved.revision,
      },
    });
    assert.equal(again.status, "approved");
    assert.equal(again.revision, approved.revision);
    assert.equal(again.decisionHistory.length, historyLength);
  });
});

describe("HU-RRP-02B — privacy and membership isolation", () => {
  it("keeps DOB out of admin list rows and audit summaries", async () => {
    const draft = await createRrpApplicationDraftForUser(
      "user-applicant-1",
      completeDraftFields(),
    );
    const list = toAdminRrpApplicationListItem({
      applicationId: draft.applicationId,
      participantId: "participant-1",
      userId: "user-applicant-1",
      legalFirstName: "Alex",
      legalLastName: "Applicant",
      profession: "Organizer",
      residenceCountryCode: "CA",
      representCountryCode: "CA",
      dateOfBirth: "2000-01-15",
      fundingModel: "SELF",
      annualRequestedAmountCad: null,
      teamMemberCount: 1,
      relevantExperience: "x",
      motivation: "y",
      consentAcceptedAt: null,
      consentVersion: null,
      status: "draft",
      createdAt: draft.createdAt,
      updatedAt: draft.updatedAt,
      submittedAt: null,
      reviewedAt: null,
      reviewerAdminUserId: null,
      revision: 1,
      decisionHistory: [],
    });
    assert.equal("dateOfBirth" in list, false);

    const listed = await listRrpApplicationsForAdminActor({
      actorUserId: "user-admin-1",
      query: {},
    });
    assert.equal(listed.items.length, 1);
    assert.equal("dateOfBirth" in listed.items[0]!, false);

    const summary = buildRrpApplicationAuditSummary({
      applicationId: draft.applicationId,
      participantId: "participant-1",
      userId: "user-applicant-1",
      legalFirstName: "Alex",
      legalLastName: "Applicant",
      profession: "Organizer",
      residenceCountryCode: "CA",
      representCountryCode: "CA",
      dateOfBirth: "2000-01-15",
      fundingModel: "SELF",
      annualRequestedAmountCad: null,
      teamMemberCount: 1,
      relevantExperience: "secret experience",
      motivation: "secret motivation",
      consentAcceptedAt: null,
      consentVersion: null,
      status: "draft",
      createdAt: draft.createdAt,
      updatedAt: draft.updatedAt,
      submittedAt: null,
      reviewedAt: null,
      reviewerAdminUserId: null,
      revision: 1,
      decisionHistory: [],
    });
    assert.doesNotMatch(summary, /2000-01-15|secret experience|secret motivation/);
  });

  it("exposes DOB only on owner and admin detail projections", async () => {
    const draft = await createRrpApplicationDraftForUser(
      "user-applicant-1",
      completeDraftFields(),
    );
    const owner = await getOwnRrpApplicationForUser({
      userId: "user-applicant-1",
      applicationId: draft.applicationId,
    });
    const admin = await getRrpApplicationDetailForAdminActor({
      actorUserId: "user-admin-1",
      applicationId: draft.applicationId,
    });
    assert.equal(owner.dateOfBirth, "2000-01-15");
    assert.equal(admin.dateOfBirth, "2000-01-15");

    const listed = await listRrpApplicationsForAdminActor({
      actorUserId: "user-admin-1",
      query: {},
    });
    assert.equal("dateOfBirth" in listed.items[0]!, false);
    assert.ok(toAdminRrpApplicationDetail);
    assert.ok(toRrpApplicationDetail);
  });

  it("does not add RRP fields to public MemberProfile projections", () => {
    const projection = readRepo(
      "apps/api/src/modules/member-profile/member-profile.projection.ts",
    );
    const publicTypes = readRepo("packages/types/src/domain/member-profile.ts");
    assert.doesNotMatch(projection, /dateOfBirth|rrpApplication|representCountryCode/);
    assert.doesNotMatch(publicTypes, /dateOfBirth|RrpApplication/);
  });

  it("does not wire DOB into notifications, analytics, or route logging", () => {
    const service = readRepo("apps/api/src/modules/rrp-application/rrp-application.service.ts");
    const routes = readRepo("apps/api/src/modules/rrp-application/rrp-application.routes.ts");
    const adminRoutes = readRepo(
      "apps/api/src/modules/rrp-application/rrp-application-admin.routes.ts",
    );
    assert.doesNotMatch(service, /emit.*Notification|analytics|console\.(log|info|warn)/);
    assert.doesNotMatch(routes, /dateOfBirth|console\.(log|info)/);
    assert.doesNotMatch(adminRoutes, /dateOfBirth|console\.(log|info)/);
    assert.doesNotMatch(
      readRepo("apps/api/src/modules/rrp-application/rrp-application.projection.ts"),
      /notification|analytics/,
    );
  });

  it("does not modify Membership domain modules", () => {
    const membershipService = readRepo(
      "apps/api/src/modules/membership/membership.service.ts",
    );
    assert.doesNotMatch(membershipService, /rrp|RrpApplication|regional representative/i);
  });

  it("registers the active partial unique index and write fail-closed gate", () => {
    assert.equal(
      RRP_ACTIVE_UNIQUE_INDEX_NAME,
      "rrp_application_one_active_per_participant_country",
    );
    const indexes = readRepo("apps/api/src/infrastructure/mongodb/mongo-indexes.ts");
    assert.match(indexes, /RRP_ACTIVE_UNIQUE_INDEX_DESCRIPTION/);
    assert.match(indexes, /RRP_ACTIVE_UNIQUE_INDEX_NAME/);
    const readiness = readRepo(
      "apps/api/src/modules/rrp-application/rrp-application.index-readiness.ts",
    );
    assert.match(readiness, /RRP_APPLICATION_ACTIVE_STATUSES/);
    assert.match(readiness, /createIndex/);
    assert.match(readiness, /unavailable\(/);
    for (const status of RRP_APPLICATION_ACTIVE_STATUSES) {
      assert.ok(RRP_APPLICATION_ACTIVE_STATUSES.includes(status));
    }
    const repository = readRepo(
      "apps/api/src/modules/rrp-application/rrp-application.repository.ts",
    );
    assert.match(repository, /ensureWriteReady/);
    assert.match(repository, /assertRrpApplicationActiveUniqueIndexReady/);
  });

  it("rejects unsafe consent / create payloads", () => {
    assert.throws(() => validateCreateDraftBody({}), /Representation country/);
    assert.throws(
      () =>
        validateSubmitBody({
          expectedRevision: 1,
          consentAccepted: false,
          consentVersion: RRP_APPLICATION_CONSENT_VERSION,
        }),
      /consent/i,
    );
  });
});

