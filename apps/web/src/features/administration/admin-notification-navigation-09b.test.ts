/**
 * HU-RRP-09B — admin notification navigation and the RRP workspace icon.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  readAdminDirectoryDeepLinkQuery,
  resolveDirectoryParticipantDeepLink,
} from "./admin-participant-directory-deep-link";
import {
  resolveAdminNotificationHref,
} from "./admin-notification-labels";

const webSrc = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function read(relativeFromWebSrc: string): string {
  return readFileSync(path.join(webSrc, relativeFromWebSrc), "utf8");
}

describe("HU-RRP-09B admin notification navigation", () => {
  it("renders the Regional Applications icon at 32 by 32", () => {
    const widget = read(
      "features/regional-program/components/RrpApplicationWorkspaceWidget.tsx",
    );
    const css = read(
      "features/regional-program/components/rrp-application-workspace-widget.css",
    );
    assert.match(widget, /src="\/icons\/workspace\/regions\.svg"/);
    assert.match(widget, /alt=""/);
    assert.match(widget, /width=\{32\}/);
    assert.match(widget, /height=\{32\}/);
    assert.match(widget, /marginInlineEnd:\s*8/);
    assert.match(css, /@media \(max-width: 1024px\)/);
    assert.match(css, /\[dir="rtl"\]/);
    assert.doesNotMatch(widget, /width=\{24\}/);
  });

  it("opens an RRP notification and a second application without repeating the first", () => {
    const first = readAdminDirectoryDeepLinkQuery(
      new URLSearchParams("participantId=participant-1&rrpApplicationId=app-1"),
    );
    const opened = resolveDirectoryParticipantDeepLink({
      participantId: first.participantId,
      rrpApplicationId: first.rrpApplicationId,
      acceptedParticipantFilter: "participant-1",
      directoryReady: true,
      rows: [{ memberId: "participant-1", viewableApplicationIds: ["app-1", "app-2"] }],
      appliedKey: null,
    });
    assert.equal(opened.action, "open-application");
    if (opened.action !== "open-application") {
      return;
    }
    assert.equal(opened.applicationId, "app-1");

    const repeated = resolveDirectoryParticipantDeepLink({
      participantId: first.participantId,
      rrpApplicationId: first.rrpApplicationId,
      acceptedParticipantFilter: "participant-1",
      directoryReady: true,
      rows: [{ memberId: "participant-1", viewableApplicationIds: ["app-1", "app-2"] }],
      appliedKey: opened.appliedKey,
    });
    assert.equal(repeated.action, "ignore");

    const second = resolveDirectoryParticipantDeepLink({
      participantId: "participant-1",
      rrpApplicationId: "app-2",
      acceptedParticipantFilter: "participant-1",
      directoryReady: true,
      rows: [{ memberId: "participant-1", viewableApplicationIds: ["app-1", "app-2"] }],
      appliedKey: opened.appliedKey,
    });
    assert.equal(second.action, "open-application");
    if (second.action !== "open-application") {
      return;
    }
    assert.equal(second.applicationId, "app-2");
  });

  it("waits for the directory response on a direct URL and does not use a stale page", () => {
    const query = readAdminDirectoryDeepLinkQuery(
      new URLSearchParams("participantId=participant-9&rrpApplicationId=app-9"),
    );
    const waiting = resolveDirectoryParticipantDeepLink({
      participantId: query.participantId,
      rrpApplicationId: query.rrpApplicationId,
      acceptedParticipantFilter: null,
      directoryReady: true,
      rows: [{ memberId: "someone-else", viewableApplicationIds: ["app-9"] }],
      appliedKey: null,
    });
    assert.equal(waiting.action, "wait");

    const ready = resolveDirectoryParticipantDeepLink({
      participantId: query.participantId,
      rrpApplicationId: query.rrpApplicationId,
      acceptedParticipantFilter: "participant-9",
      directoryReady: true,
      rows: [{ memberId: "participant-9", viewableApplicationIds: ["app-9"] }],
      appliedKey: null,
    });
    assert.equal(ready.action, "open-application");
  });

  it("selects a New Participant from a legacy event id and from a future href", () => {
    assert.equal(
      resolveAdminNotificationHref({
        type: "participant_registered",
        targetHref: "/admin/participants",
        sourceEventId: "member-registered:member-1",
      }),
      "/admin/participants?participantId=member-1",
    );
    assert.equal(
      resolveAdminNotificationHref({
        type: "participant_registered",
        targetHref: "/admin/participants?participantId=member-future",
        sourceEventId: "member-registered:member-legacy",
      }),
      "/admin/participants?participantId=member-future",
    );
    assert.equal(
      resolveAdminNotificationHref({
        type: "participant_registered",
        targetHref: "/admin/participants",
        sourceEventId: "member-registered:../secret",
      }),
      "/admin/participants",
    );
    assert.equal(
      resolveAdminNotificationHref({
        type: "participant_registered",
        targetHref: "/admin/participants",
        sourceEventId: "11111111-1111-4111-8111-111111111111",
      }),
      "/admin/participants",
    );

    const selected = resolveDirectoryParticipantDeepLink({
      participantId: "member-1",
      rrpApplicationId: null,
      acceptedParticipantFilter: "member-1",
      directoryReady: true,
      rows: [{ memberId: "member-1", viewableApplicationIds: [] }],
      appliedKey: null,
    });
    assert.equal(selected.action, "select-participant");
  });

  it("keeps suspension, badge-order, and path destinations on their existing targets", () => {
    assert.equal(
      resolveAdminNotificationHref({
        type: "participant_suspension_review_requested",
        targetHref: "/admin/participants?participantId=member-7",
      }),
      "/admin/participants?participantId=member-7",
    );
    assert.equal(
      resolveAdminNotificationHref({
        type: "member_badge_order_paid",
        targetHref: "/admin/participants?view=member_badge_orders&badgeApplicationId=badge-1",
      }),
      "/admin/participants?view=member_badge_orders&badgeApplicationId=badge-1",
    );
    assert.equal(
      resolveAdminNotificationHref({
        type: "initiative_published",
        targetHref: "/admin/initiatives/initiative-1",
      }),
      "/admin/initiatives/initiative-1",
    );
    assert.equal(
      resolveAdminNotificationHref({
        type: "public_choice_published",
        targetHref: "/admin/public-choice/choice-1",
      }),
      "/admin/public-choice/choice-1",
    );
    assert.equal(
      resolveAdminNotificationHref({
        type: "blog_post_published",
        targetHref: "/blog/post-slug",
      }),
      "/blog/post-slug",
    );
    assert.equal(
      resolveAdminNotificationHref({
        type: "integrity_media_author_message",
        targetHref: "/admin/integrity-media",
        sourceEventId: "11111111-1111-4111-8111-111111111111",
      }),
      "/admin/integrity-media?messageId=11111111-1111-4111-8111-111111111111",
    );
    assert.equal(
      resolveAdminNotificationHref({
        type: "blog_subscriber_confirmed",
        targetHref: "/admin/views/subscribers",
      }),
      "/admin/views/subscribers",
    );
    assert.equal(
      resolveAdminNotificationHref({
        type: "operational_alert",
        targetHref: "/admin/diagnostics",
      }),
      "/admin/diagnostics",
    );

    const query = readAdminDirectoryDeepLinkQuery(
      new URLSearchParams(
        "view=member_badge_orders&badgeApplicationId=badge-1&participantId=member-7",
      ),
    );
    assert.equal(query.view, "member_badge_orders");
    assert.equal(query.badgeApplicationId, "badge-1");
    assert.equal(query.participantId, "member-7");
  });

  it("does not open an application the administrator cannot view", () => {
    const hidden = resolveDirectoryParticipantDeepLink({
      participantId: "participant-1",
      rrpApplicationId: "private-app",
      acceptedParticipantFilter: "participant-1",
      directoryReady: true,
      rows: [{ memberId: "participant-1", viewableApplicationIds: ["visible-app"] }],
      appliedKey: null,
    });
    assert.equal(hidden.action, "application-unavailable");

    const missing = resolveDirectoryParticipantDeepLink({
      participantId: "participant-1",
      rrpApplicationId: "app-1",
      acceptedParticipantFilter: "participant-1",
      directoryReady: true,
      rows: [],
      appliedKey: null,
    });
    assert.equal(missing.action, "participant-unavailable");
  });

  it("follows the current search params instead of a one-time page load", () => {
    const section = read("features/administration/components/AdminParticipantsSection.tsx");
    const deepLink = read("features/administration/admin-participant-directory-deep-link.ts");
    assert.match(section, /useSearchParams\(/);
    assert.match(section, /readAdminDirectoryDeepLinkQuery/);
    assert.match(section, /resolveDirectoryParticipantDeepLink/);
    assert.match(deepLink, /params\.get\("participantId"\)/);
    assert.match(section, /initialApplicationId=\{rrpDeepLinkApplicationId\}/);
    assert.doesNotMatch(section, /new URLSearchParams\(window\.location\.search\)/);
    assert.doesNotMatch(section, /deepLinkHandledRef/);
  });
});
