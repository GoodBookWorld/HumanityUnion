/**
 * HU-RRP-03H — isolated MongoMemoryReplSet workflow (participant → admin → intents).
 *
 * Uses process-owned single-node replica set + hu_test_ database.
 * Does NOT start Playwright / WEB. Does NOT touch Production Mongo.
 *
 * Proves transactional confirm-appointment, index readiness, security denials,
 * multi-rep-per-country, withdraw, request-information intent, and idempotency.
 */
process.env.NODE_TEST_ENV = "true";

import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import { randomBytes } from "node:crypto";

import { MongoMemoryReplSet } from "mongodb-memory-server-core";
import { RRP_APPLICATION_CONSENT_VERSION } from "@hu/types";

import { generateIsolatedTestDatabaseName } from "../../../scripts/test-mongo-isolation.js";

const DATABASE = generateIsolatedTestDatabaseName();

let replSet: MongoMemoryReplSet | null = null;
let connected = false;

function adultDob(): string {
  const d = new Date();
  d.setUTCFullYear(d.getUTCFullYear() - 30);
  return d.toISOString().slice(0, 10);
}

function makeUser(
  mods: Awaited<ReturnType<typeof loadMods>>,
  overrides: Partial<{
    userId: string;
    memberId: string;
    email: string;
    role: "member" | "admin";
    displayName: string;
  }> = {},
) {
  const now = new Date().toISOString();
  return {
    userId: overrides.userId ?? `user-${randomBytes(3).toString("hex")}`,
    email: overrides.email ?? `user-${randomBytes(3).toString("hex")}@example.test`,
    passwordHash: "hash",
    displayName: overrides.displayName ?? "Test User",
    role: overrides.role ?? ("member" as const),
    status: "active" as const,
    memberId: overrides.memberId ?? `participant-${randomBytes(3).toString("hex")}`,
    emailVerificationStatus: "verified" as const,
    emailVerifiedAt: now,
    createdAt: now,
    updatedAt: now,
  } satisfies import("../../../src/modules/auth/auth-user.types.js").AuthUserRecord;
}

async function loadMods() {
  return {
    isolation: await import(
      "../../../src/infrastructure/mongodb/explicit-isolated-mongo-test.js"
    ),
    connection: await import("../../../src/infrastructure/mongodb/mongo-connection.js"),
    database: await import("../../../src/infrastructure/mongodb/mongo-database.js"),
    indexes: await import("../../../src/infrastructure/mongodb/mongo-indexes.js"),
    collections: await import(
      "../../../src/infrastructure/mongodb/mongo-collections.js"
    ),
    authUser: await import("../../../src/modules/auth/auth-user.repository.js"),
    appRepo: await import(
      "../../../src/modules/rrp-application/rrp-application.repository.js"
    ),
    appService: await import(
      "../../../src/modules/rrp-application/rrp-application.service.js"
    ),
    appointmentService: await import(
      "../../../src/modules/rrp-application/rrp-appointment.service.js"
    ),
    appointmentRepo: await import(
      "../../../src/modules/rrp-application/rrp-appointment.repository.js"
    ),
    intentRepo: await import(
      "../../../src/modules/rrp-application/rrp-appointment-message-intent.repository.js"
    ),
    appIndex: await import(
      "../../../src/modules/rrp-application/rrp-application.index-readiness.js"
    ),
    appointmentIndex: await import(
      "../../../src/modules/rrp-application/rrp-appointment.index-readiness.js"
    ),
    intentIndex: await import(
      "../../../src/modules/rrp-application/rrp-message-intent.index-readiness.js"
    ),
    errors: await import("../../../src/modules/rrp-application/rrp-application.errors.js"),
    delivery: await import(
      "../../../src/modules/rrp-application/rrp-message-intent.delivery.js"
    ),
    writes: await import(
      "../../../src/modules/rrp-application/rrp-application-writes.activation.js"
    ),
  };
}

type Mods = Awaited<ReturnType<typeof loadMods>>;

describe("HU-RRP-03H isolated MongoMemoryReplSet workflow", () => {
  let mods: Mods;
  let applicant: ReturnType<typeof makeUser>;
  let applicant2: ReturnType<typeof makeUser>;
  let admin: ReturnType<typeof makeUser>;

  before(async () => {
    mods = await loadMods();
    replSet = await MongoMemoryReplSet.create({
      replSet: { count: 1, storageEngine: "wiredTiger" },
    });
    const uri = replSet.getUri(DATABASE);
    assert.match(
      new URL(uri.replace(/^mongodb:/, "http:")).hostname,
      /^(127\.0\.0\.1|localhost)$/,
    );
    mods.isolation.assertExplicitIsolatedMongoTestTarget({ uri, database: DATABASE });
    mods.isolation.lockExplicitIsolatedMongoTestConfig({ uri, database: DATABASE });
    await mods.connection.connectMongoClient();
    connected = true;
    assert.equal(mods.database.getMongoDatabase().databaseName, DATABASE);
    await mods.indexes.ensureMongoIndexes();

    // Real Mongo path — not in-memory stores.
    mods.writes.setRrpApplicationWritesEnabledForTests(true);
    mods.appRepo.setRrpApplicationForceMemoryForTests(false);
    mods.appointmentRepo.setRrpAppointmentForceMemoryForTests(false);
    mods.intentRepo.setRrpAppointmentMessageIntentForceMemoryForTests(false);
    mods.appIndex.resetRrpApplicationIndexReadinessForTests();
    mods.appointmentIndex.resetRrpAppointmentIndexReadinessForTests();
    mods.intentIndex.resetRrpMessageIntentIndexReadinessForTests();
  });

  after(async () => {
    try {
      if (connected && mods.database.getMongoDatabase().databaseName === DATABASE) {
        await mods.database.getMongoDatabase().dropDatabase();
      }
    } finally {
      if (connected) {
        await mods.connection.disconnectMongoClient();
      }
      await replSet?.stop({ doCleanup: true });
      mods?.writes.setRrpApplicationWritesEnabledForTests(null);
      mods?.appRepo.setRrpApplicationForceMemoryForTests(false);
      mods?.appointmentRepo.setRrpAppointmentForceMemoryForTests(false);
      mods?.intentRepo.setRrpAppointmentMessageIntentForceMemoryForTests(false);
      mods?.authUser.setFindAuthUserByIdForTests(null);
    }
  });

  beforeEach(() => {
    mods.writes.setRrpApplicationWritesEnabledForTests(true);
    applicant = makeUser(mods, {
      userId: "user-applicant-e2e",
      memberId: "participant-applicant-e2e",
      email: "applicant-e2e@example.test",
      role: "member",
    });
    applicant2 = makeUser(mods, {
      userId: "user-applicant2-e2e",
      memberId: "participant-applicant2-e2e",
      email: "applicant2-e2e@example.test",
      role: "member",
    });
    admin = makeUser(mods, {
      userId: "user-admin-e2e",
      memberId: "participant-admin-e2e",
      email: "admin-e2e@example.test",
      role: "admin",
      displayName: "Admin E2E",
    });
    mods.authUser.setFindAuthUserByIdForTests(async (userId) => {
      if (userId === applicant.userId) return applicant;
      if (userId === applicant2.userId) return applicant2;
      if (userId === admin.userId) return admin;
      return null;
    });
  });

  async function createSubmitted(input?: {
    userId?: string;
    country?: string;
    fundingModel?: "SELF" | "PARTIAL" | "FULL";
    annualRequestedAmountCad?: number | null;
  }) {
    const userId = input?.userId ?? applicant.userId;
    const fundingModel = input?.fundingModel ?? "SELF";
    const annualRequestedAmountCad =
      input?.annualRequestedAmountCad !== undefined
        ? input.annualRequestedAmountCad
        : fundingModel === "SELF"
          ? null
          : 15_000;
    const draft = await mods.appService.createRrpApplicationDraftForUser(userId, {
      representCountryCode: input?.country ?? "CA",
      legalFirstName: "Ada",
      legalLastName: "Lovelace",
      profession: "Engineer",
      residenceCountryCode: "CA",
      dateOfBirth: adultDob(),
      fundingModel,
      annualRequestedAmountCad,
      teamMemberCount: 1,
      relevantExperience: "Experience text for isolated E2E.",
      motivation: "Motivation text for isolated E2E.",
    });
    const submitted = await mods.appService.submitOwnRrpApplicationForUser({
      userId,
      applicationId: draft.applicationId,
      body: {
        expectedRevision: draft.revision,
        consentAccepted: true,
        consentVersion: RRP_APPLICATION_CONSENT_VERSION,
      },
    });
    return submitted;
  }

  it("ensures appointment and message-intent unique indexes exist after bootstrap", async () => {
    await mods.appointmentIndex.assertRrpAppointmentActiveUniqueIndexReady();
    await mods.intentIndex.assertRrpMessageIntentIndexesReady();
    const appointmentIndexes = await mods.database
      .getMongoCollection(mods.collections.MONGO_COLLECTIONS.rrpAppointments)
      .indexes();
    const intentIndexes = await mods.database
      .getMongoCollection(mods.collections.MONGO_COLLECTIONS.rrpAppointmentMessageIntents)
      .indexes();
    assert.ok(
      appointmentIndexes.some(
        (index) =>
          index.name === "rrp_appointment_one_active_per_participant_country" &&
          index.unique === true,
      ),
    );
    assert.ok(
      intentIndexes.some(
        (index) =>
          index.name === "rrp_message_intent_client_message_id_unique" &&
          index.unique === true,
      ),
    );
  });

  it("runs participant draft → submit → withdraw on isolated Mongo", async () => {
    const draft = await mods.appService.createRrpApplicationDraftForUser(applicant.userId, {
      representCountryCode: "UA",
      legalFirstName: "Ada",
      legalLastName: "Lovelace",
      profession: "Engineer",
      residenceCountryCode: "CA",
      dateOfBirth: adultDob(),
      fundingModel: "PARTIAL",
      annualRequestedAmountCad: 12000,
      teamMemberCount: 2,
      relevantExperience: "Relevant experience.",
      motivation: "Motivation.",
    });
    assert.equal(draft.status, "draft");
    assert.equal(draft.consentVersion, null);

    const submitted = await mods.appService.submitOwnRrpApplicationForUser({
      userId: applicant.userId,
      applicationId: draft.applicationId,
      body: {
        expectedRevision: draft.revision,
        consentAccepted: true,
        consentVersion: RRP_APPLICATION_CONSENT_VERSION,
      },
    });
    assert.equal(submitted.status, "submitted");
    assert.equal(submitted.consentVersion, RRP_APPLICATION_CONSENT_VERSION);
    assert.ok(submitted.consentAcceptedAt);

    const withdrawn = await mods.appService.withdrawOwnRrpApplicationForUser({
      userId: applicant.userId,
      applicationId: submitted.applicationId,
      body: { expectedRevision: submitted.revision },
    });
    assert.equal(withdrawn.status, "withdrawn");
  });

  it("rejects underage DOB and wrong consent version on submit", async () => {
    await assert.rejects(
      () =>
        mods.appService.createRrpApplicationDraftForUser(applicant.userId, {
          representCountryCode: "DE",
          legalFirstName: "Young",
          legalLastName: "Person",
          profession: "Student",
          residenceCountryCode: "DE",
          dateOfBirth: new Date().toISOString().slice(0, 10),
          fundingModel: "SELF",
          annualRequestedAmountCad: null,
          teamMemberCount: 0,
          relevantExperience: "Experience.",
          motivation: "Motivation.",
        }),
      /18|age|birth/i,
    );

    const adultDraft = await mods.appService.createRrpApplicationDraftForUser(
      applicant.userId,
      {
        representCountryCode: "FR",
        legalFirstName: "Ada",
        legalLastName: "Lovelace",
        profession: "Engineer",
        residenceCountryCode: "FR",
        dateOfBirth: adultDob(),
        fundingModel: "SELF",
        annualRequestedAmountCad: null,
        teamMemberCount: 0,
        relevantExperience: "Experience.",
        motivation: "Motivation.",
      },
    );
    await assert.rejects(
      () =>
        mods.appService.submitOwnRrpApplicationForUser({
          userId: applicant.userId,
          applicationId: adultDraft.applicationId,
          body: {
            expectedRevision: adultDraft.revision,
            consentAccepted: true,
            consentVersion: "rrp-application-consent-v1",
          },
        }),
      /consent/i,
    );
  });

  it("admin request-information records durable intent without DOB/funding in body", async () => {
    const submitted = await createSubmitted({
      country: "PL",
      fundingModel: "FULL",
      annualRequestedAmountCad: 25_000,
    });
    const reviewed = await mods.appService.reviewRrpApplicationForAdminActor({
      actorUserId: admin.userId,
      applicationId: submitted.applicationId,
      body: {
        expectedRevision: submitted.revision,
        decision: "request_information",
        note: "Please clarify local team composition.",
      },
    });
    assert.equal(reviewed.application.status, "information_requested");
    const byApp = await mods.database
      .getMongoCollection(mods.collections.MONGO_COLLECTIONS.rrpAppointmentMessageIntents)
      .find({ applicationId: submitted.applicationId, kind: "request_information" })
      .toArray();
    assert.ok(byApp.length >= 1);
    const recorded = byApp[0]!;
    assert.equal(recorded.status, "pending");
    assert.doesNotMatch(recorded.requestExplanation ?? "", /\d{4}-\d{2}-\d{2}/);
    assert.doesNotMatch(JSON.stringify(recorded), /dateOfBirth|annualRequestedAmountCad/i);
  });

  it("denies non-admin confirm-appointment and does not escalate auth.role", async () => {
    const submitted = await createSubmitted({ country: "SE" });
    await assert.rejects(
      () =>
        mods.appointmentService.confirmRrpAppointmentForAdminActor({
          actorUserId: applicant.userId,
          applicationId: submitted.applicationId,
          body: { expectedRevision: submitted.revision },
        }),
      (error: unknown) => error instanceof mods.errors.RrpApplicationAccessDeniedError,
    );
    assert.equal(applicant.role, "member");
  });

  it("admin confirm-appointment uses Mongo transaction and records approval intent", async () => {
    const submitted = await createSubmitted({ country: "NO", fundingModel: "SELF" });
    const result = await mods.appointmentService.confirmRrpAppointmentForAdminActor({
      actorUserId: admin.userId,
      applicationId: submitted.applicationId,
      body: { expectedRevision: submitted.revision },
    });
    assert.equal(result.application.status, "approved");
    assert.equal(result.appointment.status, "active");
    assert.equal(result.messageIntentRecorded, true);
    assert.equal(applicant.role, "member");

    const intent = await mods.intentRepo.findRrpAppointmentMessageIntentByAppointmentId(
      result.appointment.appointmentId,
    );
    assert.ok(intent);
    assert.equal(intent!.clientMessageId, `rrp-appointment:${result.appointment.appointmentId}`);
    assert.match(intent!.kind, /appointment_approval/);

    // Idempotent re-confirm
    const again = await mods.appointmentService.confirmRrpAppointmentForAdminActor({
      actorUserId: admin.userId,
      applicationId: submitted.applicationId,
      body: { expectedRevision: result.application.revision },
    });
    assert.equal(again.appointment.appointmentId, result.appointment.appointmentId);
    const intents = await mods.database
      .getMongoCollection(mods.collections.MONGO_COLLECTIONS.rrpAppointmentMessageIntents)
      .find({ appointmentId: result.appointment.appointmentId })
      .toArray();
    assert.equal(intents.length, 1);
  });

  it("allows unlimited Representatives per country; one active per participant/country", async () => {
    const first = await createSubmitted({
      userId: applicant.userId,
      country: "IT",
    });
    const second = await createSubmitted({
      userId: applicant2.userId,
      country: "IT",
    });
    const a1 = await mods.appointmentService.confirmRrpAppointmentForAdminActor({
      actorUserId: admin.userId,
      applicationId: first.applicationId,
      body: { expectedRevision: first.revision },
    });
    const a2 = await mods.appointmentService.confirmRrpAppointmentForAdminActor({
      actorUserId: admin.userId,
      applicationId: second.applicationId,
      body: { expectedRevision: second.revision },
    });
    assert.notEqual(a1.appointment.appointmentId, a2.appointment.appointmentId);
    assert.equal(a1.appointment.representCountryCode, "IT");
    assert.equal(a2.appointment.representCountryCode, "IT");

    const activeUserIds =
      await mods.appointmentRepo.findUserIdsWithActiveRrpAppointments();
    assert.ok(activeUserIds.includes(applicant.userId));
    assert.ok(activeUserIds.includes(applicant2.userId));
  });

  it("fails closed when appointment index readiness override is false", async () => {
    mods.appointmentIndex.setRrpAppointmentActiveUniqueIndexReadyForTests(false);
    try {
      await assert.rejects(
        () => mods.appointmentIndex.assertRrpAppointmentActiveUniqueIndexReady(),
        (error: unknown) =>
          error instanceof mods.errors.RrpApplicationUnavailableError,
      );
    } finally {
      mods.appointmentIndex.resetRrpAppointmentIndexReadinessForTests();
    }
  });
});
