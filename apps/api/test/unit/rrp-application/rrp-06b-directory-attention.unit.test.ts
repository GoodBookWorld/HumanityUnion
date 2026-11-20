/**
 * HU-RRP-06B — RRP directory attention derivation and status projection.
 */
process.env.NODE_TEST_ENV = "true";

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { RrpApplicationRecord, RrpAppointmentRecord } from "@hu/types";
import { RRP_APPLICATION_CONSENT_VERSION } from "@hu/types";

import {
  buildRrpSummaryForParticipant,
  deriveRrpApplicationNeedsAdminAttention,
  RRP_DIRECTORY_PIPELINE_STATUSES,
} from "../../../src/modules/administration/admin-rrp-directory-summary.js";

function application(
  overrides: Partial<RrpApplicationRecord> &
    Pick<RrpApplicationRecord, "applicationId" | "status">,
): RrpApplicationRecord {
  const now = "2026-11-01T12:00:00.000Z";
  return {
    participantId: "participant-1",
    userId: "user-1",
    legalFirstName: null,
    legalLastName: null,
    profession: null,
    residenceCountryCode: null,
    representCountryCode: "CA",
    dateOfBirth: null,
    fundingModel: "SELF",
    annualRequestedAmountCad: null,
    teamMemberCount: null,
    relevantExperience: null,
    motivation: "Motivation",
    consentAcceptedAt: now,
    consentVersion: RRP_APPLICATION_CONSENT_VERSION,
    createdAt: now,
    updatedAt: now,
    submittedAt: now,
    reviewedAt: null,
    reviewerAdminUserId: null,
    revision: 1,
    decisionHistory: [],
    ...overrides,
  };
}

describe("HU-RRP-06B RRP directory attention", () => {
  it("keeps pipeline statuses aligned with the applicant directory contract", () => {
    assert.deepEqual([...RRP_DIRECTORY_PIPELINE_STATUSES], [
      "submitted",
      "under_review",
      "information_requested",
    ]);
  });

  it("marks newly submitted applications as needing attention", () => {
    const app = application({
      applicationId: "app-new",
      status: "submitted",
      submittedAt: "2026-11-10T10:00:00.000Z",
      reviewedAt: null,
    });
    assert.equal(deriveRrpApplicationNeedsAdminAttention(app), true);
    const summary = buildRrpSummaryForParticipant({ applications: [app], appointments: [] });
    assert.equal(summary?.needsAdminAttention, true);
    assert.equal(summary?.applications[0]?.needsAdminAttention, true);
    assert.equal(summary?.applications[0]?.status, "submitted");
  });

  it("clears attention after the first successful admin action", () => {
    const underReview = application({
      applicationId: "app-reviewed",
      status: "under_review",
      submittedAt: "2026-11-10T10:00:00.000Z",
      reviewedAt: "2026-11-10T11:00:00.000Z",
    });
    assert.equal(deriveRrpApplicationNeedsAdminAttention(underReview), false);

    const infoRequested = application({
      applicationId: "app-info",
      status: "information_requested",
      submittedAt: "2026-11-10T10:00:00.000Z",
      reviewedAt: "2026-11-10T12:00:00.000Z",
    });
    assert.equal(deriveRrpApplicationNeedsAdminAttention(infoRequested), false);

    const rejected = application({
      applicationId: "app-rejected",
      status: "rejected",
      submittedAt: "2026-11-10T10:00:00.000Z",
      reviewedAt: "2026-11-10T12:00:00.000Z",
    });
    assert.equal(deriveRrpApplicationNeedsAdminAttention(rejected), false);
  });

  it("restores attention when the applicant resubmits after information requested", () => {
    const resubmitted = application({
      applicationId: "app-resubmit",
      status: "submitted",
      submittedAt: "2026-11-11T09:00:00.000Z",
      reviewedAt: "2026-11-10T12:00:00.000Z",
    });
    assert.equal(deriveRrpApplicationNeedsAdminAttention(resubmitted), true);
    const summary = buildRrpSummaryForParticipant({
      applications: [resubmitted],
      appointments: [],
    });
    assert.equal(summary?.needsAdminAttention, true);
  });

  it("does not treat viewing as an admin action (timestamps unchanged keep attention)", () => {
    const untouched = application({
      applicationId: "app-view-only",
      status: "submitted",
      submittedAt: "2026-11-10T10:00:00.000Z",
      reviewedAt: null,
    });
    assert.equal(deriveRrpApplicationNeedsAdminAttention(untouched), true);
    // Opening a modal does not mutate submittedAt/reviewedAt; recompute stays true.
    assert.equal(deriveRrpApplicationNeedsAdminAttention({ ...untouched }), true);
  });

  it("keeps attention independent across multiple applications for one participant", () => {
    const needsAttention = application({
      applicationId: "app-a",
      status: "submitted",
      representCountryCode: "CA",
      submittedAt: "2026-11-12T08:00:00.000Z",
      reviewedAt: null,
    });
    const handled = application({
      applicationId: "app-b",
      status: "information_requested",
      representCountryCode: "US",
      submittedAt: "2026-11-01T08:00:00.000Z",
      reviewedAt: "2026-11-02T08:00:00.000Z",
    });
    const summary = buildRrpSummaryForParticipant({
      applications: [needsAttention, handled],
      appointments: [],
    });
    assert.ok(summary);
    assert.equal(summary!.applications.length, 2);
    const byId = new Map(summary!.applications.map((item) => [item.applicationId, item]));
    assert.equal(byId.get("app-a")?.needsAdminAttention, true);
    assert.equal(byId.get("app-a")?.status, "submitted");
    assert.equal(byId.get("app-b")?.needsAdminAttention, false);
    assert.equal(byId.get("app-b")?.status, "information_requested");
    assert.equal(summary!.needsAdminAttention, true);
  });

  it("projects canonical statuses for viewable applications without collapsing them", () => {
    const submitted = application({
      applicationId: "app-sub",
      status: "submitted",
      representCountryCode: "CA",
      reviewedAt: null,
    });
    const approved = application({
      applicationId: "app-appr",
      status: "approved",
      representCountryCode: "MX",
      submittedAt: "2026-10-01T00:00:00.000Z",
      reviewedAt: "2026-10-02T00:00:00.000Z",
    });
    const appointment: RrpAppointmentRecord = {
      appointmentId: "appt-1",
      participantId: "participant-1",
      userId: "user-1",
      representCountryCode: "MX",
      sourceApplicationId: "app-appr",
      status: "active",
      appointedAt: "2026-10-02T00:00:00.000Z",
      appointedByAdminUserId: "admin-1",
      revokedAt: null,
      revokedByAdminUserId: null,
      revision: 1,
      auditHistory: [],
    };
    const summary = buildRrpSummaryForParticipant({
      applications: [submitted, approved],
      appointments: [appointment],
    });
    assert.ok(summary);
    const statuses = summary!.applications.map((item) => item.status).sort();
    assert.deepEqual(statuses, ["approved", "submitted"]);
    assert.equal(summary!.applications.some((item) => item.status === "submitted"), true);
    assert.equal(summary!.applications.some((item) => item.status === "approved"), true);
  });
});
