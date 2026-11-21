/**
 * HU-RRP-07E.2 — Admin shortcut from Messages to an existing RRP directory deep link.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { isSafeAdminRrpNotificationHref } from "../administration/admin-notification-labels.js";
import {
  buildAdminRrpMessagesHref,
  isSafeAdminRrpMessagesHref,
  rrpHrefFromAdminDirectoryLookup,
} from "./admin-rrp-messages-link.js";

const webSrc = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function read(relativeFromWebSrc: string): string {
  return readFileSync(path.join(webSrc, relativeFromWebSrc), "utf8");
}

describe("HU-RRP-07E.2 admin RRP shortcut in Messages", () => {
  it("links one viewable application with a safe participant and application id", () => {
    const href = buildAdminRrpMessagesHref("participant-1", ["app-1"]);
    assert.equal(
      href,
      "/admin/participants?participantId=participant-1&rrpApplicationId=app-1",
    );
    assert.equal(isSafeAdminRrpMessagesHref(href), true);
    assert.equal(isSafeAdminRrpNotificationHref(href), true);
  });

  it("links several viewable applications to the directory selector without an application id", () => {
    const href = buildAdminRrpMessagesHref("participant-1", ["app-1", "app-2", "app-1"]);
    assert.equal(href, "/admin/participants?participantId=participant-1");
    assert.equal(isSafeAdminRrpMessagesHref(href), true);
    assert.equal(isSafeAdminRrpNotificationHref(href), false);
    const section = read("features/administration/components/AdminParticipantsSection.tsx");
    const modal = read("features/administration/components/AdminRrpApplicationModal.tsx");
    assert.match(section, /if \(canViewRrpApplication\(match\)\)/);
    assert.match(section, /setRrpApplicationModalOpen\(true\)/);
    assert.match(section, /applicationIds=\{viewableRrpApplicationIds\}/);
    assert.match(modal, /selectorItems\.length > 1/);
  });

  it("returns no link for a missing summary or an empty viewable list", () => {
    assert.equal(buildAdminRrpMessagesHref("participant-1", []), null);
    assert.equal(buildAdminRrpMessagesHref("participant-1", null), null);
    assert.equal(buildAdminRrpMessagesHref("  ", ["app-1"]), null);
    assert.equal(
      rrpHrefFromAdminDirectoryLookup({
        requestedParticipantId: "participant-1",
        activeParticipantId: "participant-1",
        forbidden: false,
        participants: [{ memberId: "participant-1" }],
      }),
      null,
    );
    assert.equal(
      rrpHrefFromAdminDirectoryLookup({
        requestedParticipantId: "participant-1",
        activeParticipantId: "participant-1",
        forbidden: false,
        participants: [{ memberId: "participant-1", rrpSummary: { viewableApplicationIds: [] } }],
      }),
      null,
    );
  });

  it("drops a stale lookup when the open participant has changed", () => {
    assert.equal(
      rrpHrefFromAdminDirectoryLookup({
        requestedParticipantId: "participant-1",
        activeParticipantId: "participant-2",
        forbidden: false,
        participants: [
          {
            memberId: "participant-1",
            rrpSummary: { viewableApplicationIds: ["app-1"] },
          },
        ],
      }),
      null,
    );
  });

  it("returns no link on 403 and does not surface application ids", () => {
    const href = rrpHrefFromAdminDirectoryLookup({
      requestedParticipantId: "participant-1",
      activeParticipantId: "participant-1",
      forbidden: true,
      participants: [
        {
          memberId: "participant-1",
          rrpSummary: { viewableApplicationIds: ["app-secret"] },
        },
      ],
    });
    assert.equal(href, null);
  });

  it("accepts only the two Messages destinations and rejects every other shape", () => {
    assert.equal(
      isSafeAdminRrpMessagesHref("/admin/participants?participantId=participant-1"),
      true,
    );
    assert.equal(
      isSafeAdminRrpMessagesHref(
        "/admin/participants?participantId=participant-1&rrpApplicationId=app-1",
      ),
      true,
    );
    assert.equal(
      isSafeAdminRrpNotificationHref(
        "/admin/participants?participantId=participant-1&rrpApplicationId=app-1&motivation=secret",
      ),
      false,
    );

    const rejected = [
      "https://evil.example/admin/participants?participantId=participant-1",
      "//evil.example/admin/participants?participantId=participant-1",
      "/admin/other?participantId=participant-1",
      "/admin/participants/extra?participantId=participant-1",
      "/admin/participants?participantId=participant-1&extra=1",
      "/admin/participants?participantId=participant-1&participantId=participant-2",
      "/admin/participants?participantId=participant-1&rrpApplicationId=app-1&rrpApplicationId=app-2",
      "/admin/participants?rrpApplicationId=app-1&participantId=participant-1",
      "/admin/participants?participantId=",
      "/admin/participants?participantId=%20",
      "/admin/participants?participantId=../secret",
      "/admin/participants?participantId=participant-1&rrpApplicationId=",
      "/admin/participants?participantId=participant-1&motivation=secret",
      "/admin/participants?participantId=participant-1&dateOfBirth=1990-01-01",
      "/admin/participants?participantId=participant-motivation",
      "/admin/participants?participantId=participant-1#application",
      "",
    ];
    for (const href of rejected) {
      assert.equal(isSafeAdminRrpMessagesHref(href), false, href);
    }
    assert.equal(buildAdminRrpMessagesHref("participant-motivation", ["app-1"]), null);
    assert.equal(buildAdminRrpMessagesHref("participant-1", ["app-1", "bad id"]), null);
  });

  it("keeps the lookup admin-only and the conversation header free of application bodies", () => {
    const workspace = read("features/direct-messaging/components/DirectMessagesWorkspace.tsx");
    const view = read("features/direct-messaging/components/DirectConversationView.tsx");
    const link = read("features/direct-messaging/admin-rrp-messages-link.ts");
    const guard = workspace.indexOf("!isAdminViewer");
    const lookup = workspace.indexOf("listAdminParticipants(");
    assert.ok(guard >= 0 && lookup > guard);
    assert.match(workspace, /cancelled/);
    assert.match(workspace, /activeParticipantIdRef\.current/);
    assert.match(workspace, /isForbiddenError\(error\)/);
    assert.match(workspace, /rrpApplicationHref=\{rrpApplicationHref\}/);
    assert.match(view, /rrpApplicationHref \?/);
    assert.match(view, /t\("viewRrpApplication"\)/);
    assert.match(link, /isSafeAdminRrpMessagesHref\(href\)/);
    assert.doesNotMatch(link, /isSafeAdminRrpNotificationHref/);
    assert.doesNotMatch(view, /listAdminParticipants/);
    const privateFields = /dateOfBirth|legalFirstName|legalLastName|relevantExperience|annualRequestedAmountCad/;
    assert.doesNotMatch(workspace, privateFields);
    assert.doesNotMatch(view, privateFields);
    assert.doesNotMatch(link, privateFields);
    assert.doesNotMatch(view, /View Regional Application/);
  });

  it("localizes the shortcut and keeps the new link RTL-safe", () => {
    const css = read("features/direct-messaging/components/direct-messaging.css");
    const ruleStart = css.indexOf(".direct-messaging__rrp-link");
    const rule = css.slice(ruleStart, css.indexOf(".direct-messaging__conversation-status", ruleStart));
    assert.match(rule, /text-align:\s*start/);
    assert.match(rule, /overflow-wrap:\s*anywhere/);
    assert.match(css, /\[dir="rtl"\] \.direct-messaging__rrp-link/);
    assert.doesNotMatch(rule, /margin-left|margin-right/);

    const english = JSON.parse(read("features/i18n/messages/en.json"));
    assert.equal(
      english.workspace.messagesPage.conversation.viewRrpApplication,
      "View Regional Application",
    );
    for (const locale of ["uk", "zh-Hant", "ar"] as const) {
      const catalog = JSON.parse(read(`features/i18n/messages/${locale}.json`));
      const message = catalog.workspace.messagesPage.conversation.viewRrpApplication;
      assert.equal(typeof message, "string");
      assert.ok(message.length > 0);
    }
  });
});
