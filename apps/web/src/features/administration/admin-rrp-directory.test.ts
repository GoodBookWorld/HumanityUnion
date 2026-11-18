/**
 * HU-RRP-03D — Admin Participant directory RRP helpers and UI wiring.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import type { AdminParticipantDirectoryItem } from "@hu/types";

import {
  canViewRrpApplication,
  isRrpApproveEligibleStatus,
  parseAdminParticipantRoleFilter,
  resolveViewableRrpApplicationIds,
} from "./admin-rrp-directory.js";

const webSrc = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function read(relativeFromWebSrc: string): string {
  return readFileSync(path.join(webSrc, relativeFromWebSrc), "utf8");
}

function row(
  overrides: Partial<AdminParticipantDirectoryItem> = {},
): AdminParticipantDirectoryItem {
  return {
    userId: "u1",
    memberId: "p1",
    email: "a@example.com",
    displayName: "Ada",
    role: "member",
    status: "active",
    emailVerificationStatus: "verified",
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("HU-RRP-03D Admin Participant directory RRP", () => {
  it("parses Role filter into auth.role or rrpClassification without mutating auth.role", () => {
    assert.deepEqual(parseAdminParticipantRoleFilter(""), {});
    assert.deepEqual(parseAdminParticipantRoleFilter("member"), { role: "member" });
    assert.deepEqual(parseAdminParticipantRoleFilter("admin"), { role: "admin" });
    assert.deepEqual(parseAdminParticipantRoleFilter("applicant_self_funded"), {
      rrpClassification: "applicant_self_funded",
    });
    assert.deepEqual(parseAdminParticipantRoleFilter("applicant_partial_funding"), {
      rrpClassification: "applicant_partial_funding",
    });
    assert.deepEqual(parseAdminParticipantRoleFilter("applicant_full_funding"), {
      rrpClassification: "applicant_full_funding",
    });
    assert.deepEqual(parseAdminParticipantRoleFilter("applicant_funding_unspecified"), {
      rrpClassification: "applicant_funding_unspecified",
    });
    assert.deepEqual(parseAdminParticipantRoleFilter("representative"), {
      rrpClassification: "representative",
    });
  });

  it("enables View Application only when viewable application ids exist", () => {
    assert.equal(canViewRrpApplication(null), false);
    assert.equal(canViewRrpApplication(row()), false);
    assert.equal(
      canViewRrpApplication(
        row({
          rrpSummary: {
            classifications: ["applicant_self_funded"],
            activeApplicationIds: ["app-1"],
            activeAppointmentIds: [],
            viewableApplicationIds: ["app-1"],
            representCountryCodes: ["CA"],
          },
        }),
      ),
      true,
    );
    assert.deepEqual(
      resolveViewableRrpApplicationIds(
        row({
          rrpSummary: {
            classifications: ["representative"],
            activeApplicationIds: [],
            activeAppointmentIds: ["appt-1"],
            viewableApplicationIds: ["app-source"],
            representCountryCodes: ["CA"],
          },
        }),
      ),
      ["app-source"],
    );
  });

  it("limits Approve eligibility to submitted and under_review", () => {
    assert.equal(isRrpApproveEligibleStatus("submitted"), true);
    assert.equal(isRrpApproveEligibleStatus("under_review"), true);
    assert.equal(isRrpApproveEligibleStatus("information_requested"), false);
    assert.equal(isRrpApproveEligibleStatus("approved"), false);
    assert.equal(isRrpApproveEligibleStatus("draft"), false);
  });

  it("wires Role filter options and View Application toolbar into Admin Participants", () => {
    const section = read(
      "features/administration/components/AdminParticipantsSection.tsx",
    );
    assert.match(section, /applicant_self_funded/);
    assert.match(section, /applicant_partial_funding/);
    assert.match(section, /applicant_full_funding/);
    assert.match(section, /applicant_funding_unspecified/);
    assert.match(section, /representative/);
    assert.match(section, /Participant account/);
    assert.match(section, /Administrator/);
    assert.match(section, /View Application/);
    assert.match(section, /AdminRrpApplicationModal/);
    assert.match(section, /rrpClassification/);
    assert.match(section, /adminParticipantPublicProfilePath/);
    assert.doesNotMatch(section, /auth\.role\s*=/);
  });

  it("shows participant display name and unspecified funding safely", () => {
    const modal = read(
      "features/administration/components/AdminRrpApplicationModal.tsx",
    );
    assert.match(modal, /applicantDisplayName/);
    assert.match(modal, /tFunding\("UNSPECIFIED"\)/);
    assert.match(modal, /fields\.legalNamesOptional/);
    const section = read(
      "features/administration/components/AdminParticipantsSection.tsx",
    );
    assert.match(section, /participantPrimaryName\(singleSelection\)/);
  });

  it("uses confirm-appointment for Approve and never status-only review approve", () => {
    const modal = read(
      "features/administration/components/AdminRrpApplicationModal.tsx",
    );
    const api = read("features/administration/admin-rrp-application-api.ts");
    assert.match(api, /confirm-appointment/);
    assert.match(api, /confirmAdminRrpAppointment/);
    assert.match(modal, /confirmAdminRrpAppointment/);
    assert.match(modal, /ConfirmDialog/);
    assert.match(modal, /confirmApprove/);
    assert.match(modal, /confirmRequestInfo/);
    assert.match(modal, /approvingRef/);
    assert.match(modal, /requestingRef/);
    assert.match(modal, /messageWarning/);
    assert.doesNotMatch(api, /decision:\s*"approve"/);
    assert.match(api, /decision: AdminRrpApplicationReviewDecision/);
    assert.doesNotMatch(api, /Exclude<AdminRrpApplicationReviewDecision,\s*"approve">/);
  });

  it("nests Admin RRP dialog inside backdrop so pointer events reach controls", () => {
    const modal = read(
      "features/administration/components/AdminRrpApplicationModal.tsx",
    );
    const css = read(
      "features/administration/components/admin-rrp-application-modal.css",
    );
    assert.match(modal, /admin-rrp-application-modal__backdrop/);
    assert.match(modal, /onClick=\{\(event\) => event\.stopPropagation\(\)\}/);
    // Sibling-backdrop anti-pattern must not return.
    assert.doesNotMatch(
      modal,
      /hu-confirm-dialog__backdrop"[^>]*>\s*\/>\s*<div[^>]*role="dialog"/,
    );
    assert.match(css, /\.admin-rrp-application-modal__backdrop/);
    assert.match(css, /\.admin-rrp-application-modal\s*\{[^}]*position:\s*relative/s);
  });

  it("keeps Admin modal out of participant Workspace widget", () => {
    const widget = read(
      "features/regional-program/components/RrpApplicationWorkspaceWidget.tsx",
    );
    assert.doesNotMatch(widget, /AdminRrpApplicationModal/);
    assert.doesNotMatch(widget, /confirmAdminRrpAppointment/);
    assert.match(widget, /platformDesignationActive/);
    assert.match(widget, /representativeDesignation/);
    assert.match(widget, /HumanityUnionAssistantWidget|RrpApplicationModal/);
  });

  it("avoids logging application PII and URL query embedding of DOB", () => {
    const modal = read(
      "features/administration/components/AdminRrpApplicationModal.tsx",
    );
    assert.doesNotMatch(modal, /console\.(log|debug|info|warn|error)/);
    assert.doesNotMatch(modal, /dateOfBirth/);
    assert.doesNotMatch(modal, /searchParams|URLSearchParams/);
    const section = read(
      "features/administration/components/AdminParticipantsSection.tsx",
    );
    assert.doesNotMatch(section, /rrpApplicationId=/);
  });

  it("localizes admin RRP strings through rrpApplication.admin catalog", () => {
    const en = JSON.parse(read("features/i18n/messages/en.json")) as {
      rrpApplication: { admin: Record<string, unknown>; workspaceWidget: Record<string, string> };
    };
    assert.ok(en.rrpApplication.admin.title);
    assert.ok(en.rrpApplication.admin.confirmApprove);
    assert.ok(en.rrpApplication.workspaceWidget.representativeDesignation);
    const modal = read(
      "features/administration/components/AdminRrpApplicationModal.tsx",
    );
    assert.match(modal, /useTranslations\("rrpApplication\.admin"\)/);
    const css = read(
      "features/administration/components/admin-rrp-application-modal.css",
    );
    assert.match(css, /\[dir="rtl"\]/);
  });
});
