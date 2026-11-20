/**
 * HU-RRP-06B — Admin Participant Directory RRP status, deep-link, stability.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import type { AdminParticipantDirectoryItem } from "@hu/types";

import {
  clampDirectoryOffset,
  parseAdminParticipantsDirectoryState,
  serializeAdminParticipantsDirectoryState,
} from "./admin-participants-directory-state.js";
import {
  participantNeedsRrpAdminAttention,
  resolveRrpDirectoryApplicationStatuses,
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

describe("HU-RRP-06B Admin Participant Directory RRP", () => {
  it("renders distinct statuses for multiple applications and attention flag", () => {
    const participant = row({
      rrpSummary: {
        classifications: ["applicant_self_funded", "applicant_partial_funding"],
        activeApplicationIds: ["app-a", "app-b"],
        activeAppointmentIds: [],
        viewableApplicationIds: ["app-a", "app-b"],
        representCountryCodes: ["CA", "US"],
        applications: [
          {
            applicationId: "app-a",
            status: "submitted",
            representCountryCode: "CA",
            needsAdminAttention: true,
          },
          {
            applicationId: "app-b",
            status: "information_requested",
            representCountryCode: "US",
            needsAdminAttention: false,
          },
        ],
        needsAdminAttention: true,
      },
    });

    assert.equal(participantNeedsRrpAdminAttention(participant), true);
    const statuses = resolveRrpDirectoryApplicationStatuses(participant);
    assert.equal(statuses.length, 2);
    assert.deepEqual(
      statuses.map((item) => item.status).sort(),
      ["information_requested", "submitted"],
    );
    assert.equal(statuses.find((item) => item.applicationId === "app-a")?.needsAdminAttention, true);
    assert.equal(
      statuses.find((item) => item.applicationId === "app-b")?.needsAdminAttention,
      false,
    );
  });

  it("wires status column, attention row class, and deep-link params", () => {
    const section = read("features/administration/components/AdminParticipantsSection.tsx");
    const css = read("features/administration/components/admin-participants-table.css");
    const modal = read("features/administration/components/AdminRrpApplicationModal.tsx");
    const api = read("features/administration/admin-participant-directory-api.ts");

    assert.match(section, /rrpStatusColumn/);
    assert.match(section, /participantNeedsRrpAdminAttention/);
    assert.match(section, /resolveRrpDirectoryApplicationStatuses/);
    assert.match(section, /admin-participants-table__row--rrp-attention/);
    assert.match(section, /participantId/);
    assert.match(section, /rrpApplicationId/);
    assert.match(section, /initialApplicationId/);
    assert.match(section, /directoryRequestIdRef/);
    assert.match(section, /Refreshing directory/);
    assert.match(section, /persistDirectoryState/);
    assert.match(section, /clampDirectoryOffset/);
    assert.match(section, /deepLinkUnavailable/);
    assert.match(css, /admin-participants-table__row--rrp-attention/);
    assert.match(modal, /initialApplicationId/);
    assert.match(api, /participantId/);
  });

  it("keeps previous rows during refresh and rejects stale overwrite patterns", () => {
    const section = read("features/administration/components/AdminParticipantsSection.tsx");
    assert.match(section, /hasLoadedDirectoryRef/);
    assert.match(section, /requestId !== directoryRequestIdRef\.current/);
    assert.match(section, /Keep previous rows visible/);
    assert.match(section, /if \(!hasLoadedDirectoryRef\.current\)/);
    assert.match(section, /Refreshing directory/);
  });

  it("preserves filters/pagination across Messages navigation via session snapshot", () => {
    const serialized = serializeAdminParticipantsDirectoryState({
      searchInput: "ada",
      search: "ada",
      status: "active",
      roleFilter: "applicant_full_funding",
      membershipStatus: "",
      sort: "createdAt",
      order: "desc",
      emailVerification: "verified",
      offset: 50,
    });
    const parsed = parseAdminParticipantsDirectoryState(serialized);
    assert.ok(parsed);
    assert.equal(parsed!.search, "ada");
    assert.equal(parsed!.roleFilter, "applicant_full_funding");
    assert.equal(parsed!.offset, 50);
    assert.equal(clampDirectoryOffset(75, 40, 25), 25);
    assert.equal(clampDirectoryOffset(-10, 40, 25), 0);
    assert.equal(clampDirectoryOffset(0, 0, 25), 0);

    const section = read("features/administration/components/AdminParticipantsSection.tsx");
    assert.match(section, /writeAdminParticipantsDirectoryState|persistDirectoryState/);
    assert.match(section, /readAdminParticipantsDirectoryState/);
    assert.match(section, /openConversation/);
  });

  it("respects viewableApplicationIds for deep-link authorization helpers", () => {
    const unauthorized = row({
      rrpSummary: {
        classifications: ["applicant_self_funded"],
        activeApplicationIds: ["app-visible"],
        activeAppointmentIds: [],
        viewableApplicationIds: ["app-visible"],
        representCountryCodes: ["CA"],
        applications: [
          {
            applicationId: "app-visible",
            status: "submitted",
            representCountryCode: "CA",
            needsAdminAttention: true,
          },
        ],
        needsAdminAttention: true,
      },
    });
    assert.deepEqual(resolveViewableRrpApplicationIds(unauthorized), ["app-visible"]);
    assert.equal(resolveViewableRrpApplicationIds(unauthorized).includes("app-secret"), false);
  });

  it("adds directory localization keys for all installed catalogs", () => {
    const locales = [
      "en",
      "uk",
      "zh-Hant",
      "ar",
      "de",
      "es",
      "fr",
      "he",
      "ka",
      "pt",
    ];
    for (const locale of locales) {
      const catalog = JSON.parse(read(`features/i18n/messages/${locale}.json`)) as {
        rrpApplication: { admin: { directory: Record<string, string> } };
      };
      assert.equal(typeof catalog.rrpApplication.admin.directory.rrpStatusColumn, "string");
      assert.equal(typeof catalog.rrpApplication.admin.directory.needsAttentionAria, "string");
      assert.equal(typeof catalog.rrpApplication.admin.directory.deepLinkUnavailable, "string");
      assert.equal(
        typeof catalog.rrpApplication.admin.directory.deepLinkParticipantUnavailable,
        "string",
      );
    }
  });
});
