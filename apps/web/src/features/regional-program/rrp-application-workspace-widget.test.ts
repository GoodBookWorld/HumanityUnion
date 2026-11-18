/**
 * HU-RRP-02D.1 — Persistent My Regional Applications Workspace widget.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import type { RrpApplicationDetail } from "@hu/types";

import { isRrpApplicationEntryEnabled, RRP_APPLICATION_ENTRY_FLAG_ENV } from "./rrp-application-entry.js";
import {
  isRrpApplicationEditableStatus,
  partitionRrpApplicationsForDisplay,
} from "./rrp-application-form.js";

const webSrc = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function read(relativeFromWebSrc: string): string {
  return readFileSync(path.join(webSrc, relativeFromWebSrc), "utf8");
}

function sampleApplication(
  overrides: Partial<RrpApplicationDetail> &
    Pick<RrpApplicationDetail, "applicationId" | "status" | "updatedAt" | "representCountryCode">,
): RrpApplicationDetail {
  return {
    participantId: "p1",
    legalFirstName: null,
    legalLastName: null,
    profession: null,
    residenceCountryCode: null,
    dateOfBirth: null,
    fundingModel: null,
    annualRequestedAmountCad: null,
    teamMemberCount: null,
    relevantExperience: null,
    motivation: null,
    consentAcceptedAt: null,
    consentVersion: null,
    createdAt: overrides.updatedAt,
    submittedAt: null,
    reviewedAt: null,
    revision: 1,
    decisionHistory: [],
    ...overrides,
  };
}

describe("HU-RRP-02D.1 Regional Applications Workspace widget", () => {
  it("keeps the entry flag OFF by default and hides the widget when disabled", () => {
    assert.equal(isRrpApplicationEntryEnabled({}), false);
    const assistant = read("features/workspace-home/components/WorkspaceHomeAssistant.tsx");
    const widget = read(
      "features/regional-program/components/RrpApplicationWorkspaceWidget.tsx",
    );
    assert.match(assistant, /isRrpApplicationEntryEnabled\(\)/);
    assert.match(assistant, /RrpApplicationWorkspaceWidget/);
    assert.match(widget, /isRrpApplicationEntryEnabled\(\)/);
    assert.match(widget, /return null/);
    assert.equal(
      isRrpApplicationEntryEnabled({ [RRP_APPLICATION_ENTRY_FLAG_ENV]: "true" }),
      true,
    );
  });

  it("places the widget as the next sibling after the workspace Assistant", () => {
    const assistant = read("features/workspace-home/components/WorkspaceHomeAssistant.tsx");
    const assistantIdx = assistant.indexOf(
      '<HumanityUnionAssistantWidget surfaceId="workspace" />',
    );
    const widgetIdx = assistant.indexOf("<RrpApplicationWorkspaceWidget");
    assert.ok(assistantIdx >= 0);
    assert.ok(widgetIdx > assistantIdx);
    assert.doesNotMatch(assistant, /member-workspace__nav/);
  });

  it("shows Representative platform designation from appointment data and hides Admin Approve", () => {
    const widget = read(
      "features/regional-program/components/RrpApplicationWorkspaceWidget.tsx",
    );
    assert.match(widget, /platformDesignationActive/);
    assert.match(widget, /workspaceWidget\.representativeDesignation/);
    assert.doesNotMatch(widget, /confirmAdminRrpAppointment|AdminRrpApplicationModal|Approve/);
  });

  it("deep-links information_requested rows to the server-provided conversation id", () => {
    const widget = read(
      "features/regional-program/components/RrpApplicationWorkspaceWidget.tsx",
    );
    assert.match(widget, /information_requested/);
    assert.match(widget, /adminConversationId/);
    assert.match(widget, /adminConversationAvailability/);
    assert.match(
      widget,
      /\/workspace\/messages\/\$\{encodeURIComponent\(conversationId\)\}/,
    );
    assert.match(widget, /workspaceWidget\.openMessages/);
    assert.match(widget, /workspaceWidget\.messagesUnavailable/);
    assert.match(widget, /data-rrp-open-messages="unavailable"/);
    assert.doesNotMatch(widget, /href="\/workspace\/messages"/);
    assert.doesNotMatch(widget, /buildDirectConversationId|openOrCreate/);
    assert.doesNotMatch(widget, /DirectMessagingPanel|RrpChat/);
  });

  it("maps conversation availability per application without Ally selector redirect", () => {
    const widget = read(
      "features/regional-program/components/RrpApplicationWorkspaceWidget.tsx",
    );
    const en = JSON.parse(read("features/i18n/messages/en.json")) as {
      rrpApplication: {
        workspaceWidget: {
          messagesUnavailable: Record<string, string>;
        };
      };
    };
    assert.ok(en.rrpApplication.workspaceWidget.messagesUnavailable.pending);
    assert.ok(en.rrpApplication.workspaceWidget.messagesUnavailable.failed);
    assert.ok(en.rrpApplication.workspaceWidget.messagesUnavailable.none);
    assert.ok(en.rrpApplication.workspaceWidget.messagesUnavailable.unavailable);
    assert.match(widget, /resolveMessagesUnavailableKey/);
    assert.doesNotMatch(widget, /active.?all(?:y|ies)|AllySelector|openOrCreate/i);
  });

  it("partitions active applications before history and sorts by updatedAt", () => {
    const listed = [
      sampleApplication({
        applicationId: "hist-old",
        status: "withdrawn",
        representCountryCode: "US",
        updatedAt: "2026-01-01T00:00:00.000Z",
      }),
      sampleApplication({
        applicationId: "active-new",
        status: "draft",
        representCountryCode: "CA",
        updatedAt: "2026-03-01T00:00:00.000Z",
      }),
      sampleApplication({
        applicationId: "hist-new",
        status: "rejected",
        representCountryCode: "GB",
        updatedAt: "2026-02-15T00:00:00.000Z",
      }),
      sampleApplication({
        applicationId: "active-old",
        status: "submitted",
        representCountryCode: "FR",
        updatedAt: "2026-02-01T00:00:00.000Z",
      }),
    ];
    const { active, history } = partitionRrpApplicationsForDisplay(listed);
    assert.deepEqual(
      active.map((item) => item.applicationId),
      ["active-new", "active-old"],
    );
    assert.deepEqual(
      history.map((item) => item.applicationId),
      ["hist-new", "hist-old"],
    );
  });

  it("allows edit only for draft and information_requested; terminal statuses are read-only", () => {
    assert.equal(isRrpApplicationEditableStatus("draft"), true);
    assert.equal(isRrpApplicationEditableStatus("information_requested"), true);
    assert.equal(isRrpApplicationEditableStatus("submitted"), false);
    assert.equal(isRrpApplicationEditableStatus("under_review"), false);
    assert.equal(isRrpApplicationEditableStatus("approved"), false);
    assert.equal(isRrpApplicationEditableStatus("rejected"), false);
    assert.equal(isRrpApplicationEditableStatus("withdrawn"), false);

    const widget = read(
      "features/regional-program/components/RrpApplicationWorkspaceWidget.tsx",
    );
    assert.match(widget, /isRrpApplicationEditableStatus/);
    assert.match(widget, /workspaceWidget\.edit/);
    assert.match(widget, /workspaceWidget\.view/);
  });

  it("opens the shared modal for selected applicationId, create intent, and refresh", () => {
    const widget = read(
      "features/regional-program/components/RrpApplicationWorkspaceWidget.tsx",
    );
    const modal = read("features/regional-program/components/RrpApplicationModal.tsx");
    assert.match(widget, /RrpApplicationModal/);
    assert.match(widget, /initialApplicationId=\{modalApplicationId\}/);
    assert.match(widget, /initialIntent=\{modalIntent\}/);
    assert.match(widget, /onApplicationsChanged=\{refresh\}/);
    assert.match(widget, /intent:\s*"create"/);
    assert.match(modal, /initialApplicationId/);
    assert.match(modal, /onApplicationsChanged/);
    assert.match(modal, /listed\.find\(\(item\) => item\.applicationId === initialApplicationId\)/);
    assert.match(modal, /onApplicationsChangedRef\.current\?\.\(\)/);
  });

  it("covers empty, loading, and error states without private applicant fields", () => {
    const widget = read(
      "features/regional-program/components/RrpApplicationWorkspaceWidget.tsx",
    );
    assert.match(widget, /workspaceWidget\.invitation/);
    assert.match(widget, /workspaceWidget\.loading/);
    assert.match(widget, /workspaceWidget\.error/);
    assert.match(widget, /workspaceWidget\.retry/);
    assert.match(widget, /workspaceWidget\.create/);
    assert.match(widget, /workspaceWidget\.newApplication/);
    assert.doesNotMatch(widget, /dateOfBirth|legalFirstName|legalLastName|annualRequestedAmountCad|relevantExperience|motivation/);
  });

  it("preserves the widget after modal close and does not auto-save", () => {
    const widget = read(
      "features/regional-program/components/RrpApplicationWorkspaceWidget.tsx",
    );
    const modal = read("features/regional-program/components/RrpApplicationModal.tsx");
    assert.match(widget, /handleCloseModal/);
    assert.match(widget, /setModalOpen\(false\)/);
    assert.doesNotMatch(widget, /autoSave|autosave/);
    assert.doesNotMatch(modal, /autoSave|autosave/);
    assert.match(modal, /isRrpApplicationFormDirty/);
  });

  it("keeps Join entry flows on existing auth intent helpers", () => {
    const entry = read("features/regional-program/rrp-application-entry.ts");
    const home = read("app/workspace/WorkspaceHomePage.tsx");
    const regional = read(
      "features/regional-program/components/RegionalProgramPageContent.tsx",
    );
    assert.match(entry, /buildRrpApplicationLoginHref/);
    assert.match(entry, /buildRrpApplicationConfirmEmailHref/);
    assert.match(entry, /withSafeReturnTo/);
    assert.match(home, /hasRrpApplicationEntryIntent/);
    assert.match(home, /emailVerificationStatus !== "verified"/);
    assert.match(home, /RrpApplicationModal/);
    assert.match(regional, /JoinProgramApplicationEntryLink/);
    assert.match(regional, /buildRrpApplicationLoginHref/);
    assert.match(regional, /buildRrpApplicationConfirmEmailHref/);
  });

  it("uses WEB_UI workspaceWidget keys with locale catalogs and RTL-safe CSS", () => {
    const widget = read(
      "features/regional-program/components/RrpApplicationWorkspaceWidget.tsx",
    );
    const css = read(
      "features/regional-program/components/rrp-application-workspace-widget.css",
    );
    const en = JSON.parse(read("features/i18n/messages/en.json"));
    assert.match(widget, /useTranslations\("rrpApplication"\)/);
    assert.match(widget, /useCountryDisplayName/);
    assert.match(widget, /useLocale/);
    assert.equal(en.rrpApplication.workspaceWidget.title, "My Regional Applications");
    assert.equal(typeof en.rrpApplication.errors.notFound, "string");
    for (const locale of ["ar", "uk", "zh-Hant"] as const) {
      const catalog = JSON.parse(read(`features/i18n/messages/${locale}.json`));
      assert.equal(
        catalog.rrpApplication.workspaceWidget.title,
        "My Regional Applications",
      );
      assert.equal(typeof catalog.rrpApplication.errors.notFound, "string");
    }
    assert.match(css, /\[dir="rtl"\]/);
    assert.match(css, /overflow-x:\s*hidden/);
    assert.match(css, /@media \(max-width: 1024px\)/);
    assert.match(css, /margin-inline|padding-block|border-block|text-align:\s*start/);
  });

  it("does not enable the RRP entry flag in source and avoids a second form", () => {
    assert.equal(isRrpApplicationEntryEnabled({}), false);
    const widget = read(
      "features/regional-program/components/RrpApplicationWorkspaceWidget.tsx",
    );
    assert.doesNotMatch(widget, /legalFirstName|dateOfBirth|fundingModel/);
    assert.match(widget, /listMyRrpApplications/);
    assert.match(widget, /RrpApplicationModal/);
  });
});
