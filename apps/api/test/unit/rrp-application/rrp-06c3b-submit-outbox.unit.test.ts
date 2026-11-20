/**
 * HU-RRP-06C.3B — Atomic RRP submit + Outbox event wiring.
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
import { CATALOGUE_EVENTS } from "../../../src/infrastructure/events/catalogue-events.js";
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
import {
  buildRrpApplicationSubmittedEventId,
  createRrpApplicationSubmittedEvent,
  RRP_APPLICATION_AGGREGATE_TYPE,
} from "../../../src/modules/rrp-application/rrp-application-submitted.event.js";
import { RrpApplicationConflictError } from "../../../src/modules/rrp-application/rrp-application.errors.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const apiSrc = path.resolve(here, "../../../src");

function readSrc(relativeFromSrc: string): string {
  return readFileSync(path.join(apiSrc, relativeFromSrc), "utf8");
}

function makeUser(overrides: Partial<AuthUserRecord> = {}): AuthUserRecord {
  return {
    userId: "user-applicant-1",
    email: "applicant@example.com",
    passwordHash: "hash",
    displayName: "Applicant One",
    role: "member",
    status: "active",
    emailVerificationStatus: "verified",
    memberId: "participant-1",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function completeDraftFields(): Record<string, unknown> {
  return {
    representCountryCode: "CA",
    legalFirstName: "Ada",
    legalLastName: "Lovelace",
    profession: "Engineer",
    residenceCountryCode: "CA",
    dateOfBirth: "1990-01-15",
    fundingModel: "SELF",
    annualRequestedAmountCad: null,
    teamMemberCount: 1,
    relevantExperience: "Experience text that is long enough for validation.",
    motivation: "Motivation text that is long enough for validation rules.",
  };
}

const submitBody = (expectedRevision: number) => ({
  expectedRevision,
  consentAccepted: true,
  consentVersion: RRP_APPLICATION_CONSENT_VERSION,
});

describe("HU-RRP-06C.3B RRP submit Outbox event builder", () => {
  it("builds stable distinct event ids per submission epoch", () => {
    const first = buildRrpApplicationSubmittedEventId(
      "app-1",
      "2026-11-20T10:00:00.000Z",
    );
    const second = buildRrpApplicationSubmittedEventId(
      "app-1",
      "2026-11-21T10:00:00.000Z",
    );
    assert.equal(first, "rrp-application-submitted:app-1:2026-11-20T10:00:00.000Z");
    assert.notEqual(first, second);

    const event = createRrpApplicationSubmittedEvent({
      applicationId: "app-1",
      participantId: "participant-1",
      submittedAt: "2026-11-20T10:00:00.000Z",
      actorId: "user-1",
    });
    assert.equal(event.eventId, first);
    assert.equal(event.eventName, CATALOGUE_EVENTS.rrpApplicationSubmitted);
    assert.equal(event.aggregateType, RRP_APPLICATION_AGGREGATE_TYPE);
    assert.deepEqual(event.payload, {
      applicationId: "app-1",
      participantId: "participant-1",
      submittedAt: "2026-11-20T10:00:00.000Z",
    });
    assert.equal("dateOfBirth" in event.payload, false);
    assert.equal("motivation" in event.payload, false);
    assert.equal("fundingModel" in event.payload, false);
  });
});

describe("HU-RRP-06C.3B submit service wiring (source)", () => {
  it("wires Mongo transaction + enqueue for real submits only", () => {
    const service = readSrc("modules/rrp-application/rrp-application.service.ts");
    assert.match(service, /async function commitSubmittedRevisionWithOutbox/);
    assert.match(service, /runMongoTransaction/);
    assert.match(service, /enqueueDomainEvent\(event, \{ session \}\)/);
    assert.match(service, /createRrpApplicationSubmittedEvent/);
    assert.match(service, /isRrpApplicationForceMemoryForTests\(\)/);

    const submitStart = service.indexOf("export async function submitOwnRrpApplicationForUser");
    const submitEnd = service.indexOf("export async function withdrawOwnRrpApplicationForUser");
    assert.ok(submitStart > 0 && submitEnd > submitStart);
    const submitBody = service.slice(submitStart, submitEnd);
    assert.match(submitBody, /isIdempotentSubmit\(current\.status\)/);
    assert.match(submitBody, /commitSubmittedRevisionWithOutbox/);
    // Idempotent path returns before the outbox helper call.
    const idempotentIdx = submitBody.indexOf("if (isIdempotentSubmit(current.status))");
    const commitCallIdx = submitBody.indexOf("commitSubmittedRevisionWithOutbox");
    assert.ok(idempotentIdx >= 0 && commitCallIdx > idempotentIdx);
  });
});

describe("HU-RRP-06C.3B submit behavior (memory mode)", () => {
  beforeEach(() => {
    setRrpApplicationForceMemoryForTests(true);
    setRrpApplicationWritesEnabledForTests(true);
    setRrpApplicationActiveUniqueIndexReadyForTests(true);
    resetRrpApplicationMemoryForTests();
    setFindAuthUserByIdForTests(async (userId) => {
      if (userId === "user-applicant-1") {
        return makeUser();
      }
      if (userId === "user-admin-1") {
        return makeUser({
          userId: "user-admin-1",
          email: "admin@example.com",
          displayName: "Admin",
          role: "admin",
          memberId: "admin-participant-1",
        });
      }
      return null;
    });
  });

  afterEach(() => {
    setFindAuthUserByIdForTests(null);
    resetRrpApplicationMemoryForTests();
    resetRrpApplicationIndexReadinessForTests();
    setRrpApplicationForceMemoryForTests(false);
    setRrpApplicationWritesEnabledForTests(null);
  });

  it("creates a submitted application on initial submit", async () => {
    const draft = await createRrpApplicationDraftForUser(
      "user-applicant-1",
      completeDraftFields(),
    );
    const submitted = await submitOwnRrpApplicationForUser({
      userId: "user-applicant-1",
      applicationId: draft.applicationId,
      body: submitBody(1),
    });
    assert.equal(submitted.status, "submitted");
    assert.ok(submitted.submittedAt);
    assert.equal(submitted.revision, 2);
  });

  it("creates a distinct submission epoch on resubmit after information_requested", async () => {
    const draft = await createRrpApplicationDraftForUser(
      "user-applicant-1",
      completeDraftFields(),
    );
    const submitted = await submitOwnRrpApplicationForUser({
      userId: "user-applicant-1",
      applicationId: draft.applicationId,
      body: submitBody(1),
    });
    const firstSubmittedAt = submitted.submittedAt;

    const requested = await reviewRrpApplicationForAdminActor({
      actorUserId: "user-admin-1",
      applicationId: draft.applicationId,
      body: {
        expectedRevision: submitted.revision,
        decision: "request_information",
        note: "Please clarify team size.",
      },
    });
    assert.equal(requested.application.status, "information_requested");

    await new Promise((resolve) => setTimeout(resolve, 5));

    const resubmitted = await submitOwnRrpApplicationForUser({
      userId: "user-applicant-1",
      applicationId: draft.applicationId,
      body: submitBody(requested.application.revision),
    });
    assert.equal(resubmitted.status, "submitted");
    assert.ok(resubmitted.submittedAt);
    assert.notEqual(resubmitted.submittedAt, firstSubmittedAt);
    assert.notEqual(
      buildRrpApplicationSubmittedEventId(draft.applicationId, firstSubmittedAt!),
      buildRrpApplicationSubmittedEventId(draft.applicationId, resubmitted.submittedAt!),
    );
  });

  it("does not advance revision on idempotent submit", async () => {
    const draft = await createRrpApplicationDraftForUser(
      "user-applicant-1",
      completeDraftFields(),
    );
    const first = await submitOwnRrpApplicationForUser({
      userId: "user-applicant-1",
      applicationId: draft.applicationId,
      body: submitBody(1),
    });
    const second = await submitOwnRrpApplicationForUser({
      userId: "user-applicant-1",
      applicationId: draft.applicationId,
      body: submitBody(first.revision),
    });
    assert.equal(second.revision, first.revision);
    assert.equal(second.submittedAt, first.submittedAt);
    assert.equal(second.decisionHistory.length, first.decisionHistory.length);
  });

  it("rejects revision conflicts without changing status", async () => {
    const draft = await createRrpApplicationDraftForUser(
      "user-applicant-1",
      completeDraftFields(),
    );
    await assert.rejects(
      () =>
        submitOwnRrpApplicationForUser({
          userId: "user-applicant-1",
          applicationId: draft.applicationId,
          body: submitBody(99),
        }),
      RrpApplicationConflictError,
    );
    const stillDraft = await submitOwnRrpApplicationForUser({
      userId: "user-applicant-1",
      applicationId: draft.applicationId,
      body: submitBody(1),
    });
    assert.equal(stillDraft.status, "submitted");
    assert.equal(stillDraft.revision, 2);
  });
});
