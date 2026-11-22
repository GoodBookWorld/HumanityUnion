/**
 * HU-RRP-POST-01B — repeated RRP notification opens, current detail, consent, rail.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  adminDirectoryParticipantDeepLinkKey,
  readAdminDirectoryDeepLinkQuery,
  resolveDirectoryParticipantDeepLink,
} from "./admin-participant-directory-deep-link";
import { resolveAdminNotificationHref } from "./admin-notification-labels";
import {
  createRrpNotificationOpenRequest,
  explicitRrpOpenChanges,
  readRrpApplicationNotificationTarget,
  releaseDirectoryDeepLinkForLocationChange,
  resetRrpNotificationOpenRequestsForTests,
  shouldAcceptRrpDetailResponse,
} from "./admin-rrp-notification-open";

const webSrc = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function read(relativeFromWebSrc: string): string {
  return readFileSync(path.join(webSrc, relativeFromWebSrc), "utf8");
}

const rows = [{ memberId: "participant-1", viewableApplicationIds: ["app-1", "app-2"] }];

function openFromUrl(href: string, appliedKey: string | null) {
  const query = readAdminDirectoryDeepLinkQuery(new URL(href, "https://hu.local").searchParams);
  return resolveDirectoryParticipantDeepLink({
    participantId: query.participantId,
    rrpApplicationId: query.rrpApplicationId,
    acceptedParticipantFilter: query.participantId,
    directoryReady: true,
    rows,
    appliedKey,
  });
}

describe("HU-RRP-POST-01B admin RRP notification refresh", () => {
  it("opens the first notification and refetches when the same URL is clicked again", () => {
    resetRrpNotificationOpenRequestsForTests();
    const href = "/admin/participants?participantId=participant-1&rrpApplicationId=app-1";
    const first = openFromUrl(href, null);
    assert.equal(first.action, "open-application");
    if (first.action !== "open-application") {
      return;
    }
    assert.equal(first.applicationId, "app-1");

    const repeatedUrl = openFromUrl(href, first.appliedKey);
    assert.equal(repeatedUrl.action, "ignore");

    const target = readRrpApplicationNotificationTarget({
      type: "rrp_application_submitted",
      targetHref: href,
    });
    assert.deepEqual(target, { participantId: "participant-1", applicationId: "app-1" });
    const reopened = explicitRrpOpenChanges(createRrpNotificationOpenRequest(target!));
    assert.equal(reopened.modalOpen, true);
    assert.equal(reopened.applicationId, "app-1");
    assert.equal(reopened.releaseAppliedKey, true);
    assert.ok(reopened.openRequestId > 0);

    const again = explicitRrpOpenChanges(createRrpNotificationOpenRequest(target!));
    assert.notEqual(again.openRequestId, reopened.openRequestId);
    assert.equal(again.applicationId, "app-1");
  });

  it("uses the current record for a resubmission and for an older notification", () => {
    resetRrpNotificationOpenRequestsForTests();
    const current = new Map([
      ["app-1", { applicationId: "app-1", motivation: "Updated after resubmission" }],
    ]);
    const initialHref = "/admin/participants?participantId=participant-1&rrpApplicationId=app-1";
    const older = readRrpApplicationNotificationTarget({
      type: "rrp_application_submitted",
      targetHref: initialHref,
    });
    const latest = readRrpApplicationNotificationTarget({
      type: "rrp_application_submitted",
      targetHref: initialHref,
    });
    assert.equal(older?.applicationId, latest?.applicationId);
    const opened = explicitRrpOpenChanges(createRrpNotificationOpenRequest(older!));
    const record = current.get(opened.applicationId);
    assert.equal(record?.motivation, "Updated after resubmission");
    assert.equal(JSON.stringify(older), JSON.stringify(latest));
  });

  it("switches to the application named by a different notification", () => {
    resetRrpNotificationOpenRequestsForTests();
    const first = explicitRrpOpenChanges(
      createRrpNotificationOpenRequest({ participantId: "participant-1", applicationId: "app-1" }),
    );
    const secondHref = "/admin/participants?participantId=participant-1&rrpApplicationId=app-2";
    const moved = openFromUrl(secondHref, adminDirectoryParticipantDeepLinkKey("participant-1", "app-1"));
    assert.equal(moved.action, "open-application");
    if (moved.action !== "open-application") {
      return;
    }
    assert.equal(moved.applicationId, "app-2");
    assert.notEqual(moved.applicationId, first.applicationId);
    const clicked = explicitRrpOpenChanges(
      createRrpNotificationOpenRequest({ participantId: "participant-1", applicationId: "app-2" }),
    );
    assert.equal(clicked.applicationId, "app-2");
  });

  it("drops an older detail response after a newer open or selection", () => {
    assert.equal(
      shouldAcceptRrpDetailResponse({
        responseRequestId: 1,
        latestRequestId: 1,
        responseApplicationId: "app-1",
        selectedApplicationId: "app-1",
        responseGeneration: 1,
        latestGeneration: 1,
      }),
      true,
    );
    assert.equal(
      shouldAcceptRrpDetailResponse({
        responseRequestId: 1,
        latestRequestId: 2,
        responseApplicationId: "app-1",
        selectedApplicationId: "app-1",
        responseGeneration: 1,
        latestGeneration: 2,
      }),
      false,
    );
    assert.equal(
      shouldAcceptRrpDetailResponse({
        responseRequestId: 2,
        latestRequestId: 2,
        responseApplicationId: "app-1",
        selectedApplicationId: "app-2",
        responseGeneration: 2,
        latestGeneration: 2,
      }),
      false,
    );
  });

  it("reopens a direct URL and browser navigation after that location changes", () => {
    const href = "/admin/participants?participantId=participant-1&rrpApplicationId=app-1";
    const direct = openFromUrl(href, null);
    assert.equal(direct.action, "open-application");
    if (direct.action !== "open-application") {
      return;
    }
    const sameLocation = releaseDirectoryDeepLinkForLocationChange({
      previousLocationKey: direct.appliedKey,
      locationKey: direct.appliedKey,
      appliedKey: direct.appliedKey,
    });
    assert.equal(sameLocation.appliedKey, direct.appliedKey);
    const away = releaseDirectoryDeepLinkForLocationChange({
      previousLocationKey: direct.appliedKey,
      locationKey: adminDirectoryParticipantDeepLinkKey(null, null),
      appliedKey: direct.appliedKey,
    });
    assert.equal(away.appliedKey, null);
    const forward = releaseDirectoryDeepLinkForLocationChange({
      previousLocationKey: away.locationKey,
      locationKey: direct.appliedKey,
      appliedKey: away.appliedKey,
    });
    assert.equal(forward.appliedKey, null);
    const reopened = openFromUrl(href, forward.appliedKey);
    assert.equal(reopened.action, "open-application");
  });

  it("leaves other notification categories on their existing hrefs", () => {
    assert.equal(
      readRrpApplicationNotificationTarget({
        type: "participant_registered",
        targetHref: "/admin/participants?participantId=member-1",
      }),
      null,
    );
    assert.equal(
      resolveAdminNotificationHref({
        type: "participant_registered",
        targetHref: "/admin/participants?participantId=member-1",
        sourceEventId: "member-registered:member-1",
      }),
      "/admin/participants?participantId=member-1",
    );
    assert.equal(
      resolveAdminNotificationHref({
        type: "integrity_media_author_message",
        targetHref: "/admin/integrity-media",
        sourceEventId: "message-1",
      }),
      "/admin/integrity-media",
    );
    const header = read("features/administration/components/AdminWorkspaceHeader.tsx");
    assert.match(header, /readRrpApplicationNotificationTarget/);
    assert.match(header, /publishRrpNotificationOpen/);
    assert.match(header, /if \(openRef\.current\)/);
    assert.doesNotMatch(header, /setInterval|rrpNotice=/);
    const section = read("features/administration/components/AdminParticipantsSection.tsx");
    assert.match(section, /explicitRrpOpenChanges/);
    assert.match(section, /releaseDirectoryDeepLinkForLocationChange/);
    assert.match(section, /openRequestId=\{rrpOpenRequestId\}/);
    const modal = read("features/administration/components/AdminRrpApplicationModal.tsx");
    assert.match(modal, /shouldAcceptRrpDetailResponse/);
    assert.match(modal, /openRequestId/);
    assert.match(modal, /getAdminRrpApplication\(applicationId\)/);
    assert.doesNotMatch(modal, /version: detail\.consentVersion/);
  });

  it("shows the acceptance time without the stored consent version token", () => {
    const modal = read("features/administration/components/AdminRrpApplicationModal.tsx");
    const english = JSON.parse(read("features/i18n/messages/en.json")) as {
      rrpApplication: { admin: { fields: { consentAccepted: string } } };
    };
    const packaged = JSON.parse(
      readFileSync(
        path.resolve(webSrc, "../../api/assets/packaged-web-ui-catalogs/en.json"),
        "utf8",
      ),
    ) as { rrpApplication: { admin: { fields: { consentAccepted: string } } } };
    assert.equal(english.rrpApplication.admin.fields.consentAccepted, "Accepted on {at}");
    assert.equal(
      packaged.rrpApplication.admin.fields.consentAccepted,
      english.rrpApplication.admin.fields.consentAccepted,
    );
    assert.match(modal, /formatDateTime\(detail\.consentAcceptedAt, locale\)/);
    assert.doesNotMatch(modal, /rrp-application-consent-v2/);
    assert.match(read("features/administration/admin-rrp-application-api.ts"), /\/review/);
    assert.match(
      readFileSync(
        path.resolve(webSrc, "../../api/src/modules/rrp-application/rrp-application.service.ts"),
        "utf8",
      ),
      /consentVersion: submit\.consentVersion/,
    );
  });
});

describe("HU-RRP-POST-01B workspace right rail", () => {
  it("scrolls independently on desktop and stays in normal flow below 1025px", () => {
    const css = read("features/workspace-home/components/workspace-home-assistant.css");
    const assistant = read("features/workspace-home/components/WorkspaceHomeAssistant.tsx");
    const assistantCss = read("features/humanity-union-assistant/humanity-union-assistant.css");
    const widgetCss = read(
      "features/regional-program/components/rrp-application-workspace-widget.css",
    );
    const tokens = read("design-system/tokens.css");
    assert.match(assistant, /tabIndex=\{0\}/);
    assert.match(css, /@media \(min-width: 1025px\)/);
    assert.match(css, /position:\s*sticky/);
    assert.match(css, /top:\s*var\(--hu-sticky-top\)/);
    assert.match(css, /max-height:\s*calc\(100dvh - var\(--hu-sticky-top\) - var\(--hu-space-4\)\)/);
    assert.match(css, /overflow-y:\s*auto/);
    assert.match(css, /min-height:\s*0/);
    assert.match(css, /overscroll-behavior:\s*contain/);
    assert.match(css, /:focus-visible/);
    assert.doesNotMatch(css, /margin-left|margin-right|left:|right:/);
    assert.match(tokens, /--hu-sticky-top:\s*var\(--humanity-header-offset\)/);
    assert.match(tokens, /--hu-header-height:\s*4\.5rem/);
    assert.doesNotMatch(assistantCss, /top:\s*5\.5rem/);
    const desktop = css.slice(css.indexOf("@media (min-width: 1025px)"));
    assert.match(desktop, /overflow-y:\s*auto/);
    assert.doesNotMatch(css.slice(0, css.indexOf("@media (min-width: 1025px)")), /max-height/);
    assert.match(widgetCss, /data-history-scroll="true"/);
    assert.match(widgetCss, /overflow-y:\s*auto/);
    assert.match(widgetCss, /\[dir="rtl"\]/);
  });
});
