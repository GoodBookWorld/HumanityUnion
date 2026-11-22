/**
 * HU-RRP-09B — admin notification navigation and the RRP workspace icon.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  directoryListFiltersForNotificationTarget,
  directoryNotificationScrollBehavior,
  directoryTargetLookupQuery,
  readAdminDirectoryDeepLinkQuery,
  resolveDirectoryNotificationScroll,
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
  it("renders the Regional Applications header at the Assistant scale", () => {
    const widget = read(
      "features/regional-program/components/RrpApplicationWorkspaceWidget.tsx",
    );
    const css = read(
      "features/regional-program/components/rrp-application-workspace-widget.css",
    );
    assert.match(widget, /src="\/icons\/workspace\/regions\.svg"/);
    assert.match(widget, /alt=""/);
    assert.match(widget, /width=\{40\}/);
    assert.match(widget, /height=\{40\}/);
    assert.match(widget, /rrp-application-workspace-widget__header/);
    assert.match(widget, /rrp-application-workspace-widget__icon/);
    assert.match(widget, /t\("workspaceWidget\.title"\)/);
    assert.doesNotMatch(widget, /<br\s*\/?>/);
    assert.doesNotMatch(widget, /width=\{32\}|width=\{24\}/);
    assert.match(css, /display:\s*flex/);
    assert.match(css, /align-items:\s*center/);
    assert.match(css, /flex-shrink:\s*0/);
    assert.match(css, /width:\s*2\.5rem/);
    assert.match(css, /height:\s*2\.5rem/);
    assert.match(css, /overflow-wrap:\s*anywhere/);
    assert.match(css, /text-align:\s*start/);
    assert.match(css, /@media \(max-width: 1024px\)/);
    assert.match(css, /\[dir="rtl"\]/);

    const en = JSON.parse(read("features/i18n/messages/en.json")) as {
      rrpApplication: { workspaceWidget: { title: string } };
    };
    assert.equal(en.rrpApplication.workspaceWidget.title, "My Regional Applications");
    for (const locale of ["ar", "he", "de"] as const) {
      const catalog = JSON.parse(read(`features/i18n/messages/${locale}.json`)) as {
        rrpApplication: { workspaceWidget: { title: string } };
      };
      const title = catalog.rrpApplication.workspaceWidget.title;
      assert.ok(title.trim().length > 12);
      assert.notEqual(title, en.rrpApplication.workspaceWidget.title);
    }
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
      rows: [{ memberId: "member-1", viewableApplicationIds: ["app-1", "app-2"] }],
      appliedKey: null,
    });
    assert.equal(selected.action, "select-participant");
  });

  it("selects a participant row without opening an associated application", () => {
    for (const applicationIds of [[], ["app-1"], ["app-1", "app-2"]]) {
      const result = resolveDirectoryParticipantDeepLink({
        participantId: "member-1",
        rrpApplicationId: null,
        acceptedParticipantFilter: "member-1",
        directoryReady: true,
        rows: [{ memberId: "member-1", viewableApplicationIds: applicationIds }],
        appliedKey: null,
      });
      assert.equal(result.action, "select-participant");
    }
  });

  it("keeps a suspension review on the participant row", () => {
    assert.equal(
      resolveAdminNotificationHref({
        type: "participant_suspension_review_requested",
        targetHref: "/admin/participants?participantId=member-7",
      }),
      "/admin/participants?participantId=member-7",
    );
    const result = resolveDirectoryParticipantDeepLink({
      participantId: "member-7",
      rrpApplicationId: null,
      acceptedParticipantFilter: "member-7",
      directoryReady: true,
      rows: [{ memberId: "member-7", viewableApplicationIds: ["app-7"] }],
      appliedKey: null,
    });
    assert.equal(result.action, "select-participant");
  });

  it("closes the application when navigation moves from an RRP link to a participant link", () => {
    const opened = resolveDirectoryParticipantDeepLink({
      participantId: "participant-1",
      rrpApplicationId: "app-1",
      acceptedParticipantFilter: "participant-1",
      directoryReady: true,
      rows: [{ memberId: "participant-1", viewableApplicationIds: ["app-1"] }],
      appliedKey: null,
    });
    assert.equal(opened.action, "open-application");
    const participantOnly = resolveDirectoryParticipantDeepLink({
      participantId: "participant-1",
      rrpApplicationId: null,
      acceptedParticipantFilter: "participant-1",
      directoryReady: true,
      rows: [{ memberId: "participant-1", viewableApplicationIds: ["app-1"] }],
      appliedKey: opened.action === "open-application" ? opened.appliedKey : null,
    });
    assert.equal(participantOnly.action, "select-participant");
  });

  it("keeps the directory table paginated while a notification target is separate", () => {
    const filtered = directoryListFiltersForNotificationTarget({
      participantId: "member-1",
      badgeViewRequested: false,
      search: "saved search",
      status: "disabled",
      role: "admin",
      membershipStatus: "member_badge_orders",
      emailVerificationStatus: "verified",
    });
    assert.deepEqual(filtered, {
      search: "saved search",
      status: "disabled",
      role: "admin",
      membershipStatus: "member_badge_orders",
      emailVerificationStatus: "verified",
    });
    assert.equal("participantId" in filtered, false);

    const reset = directoryListFiltersForNotificationTarget({
      participantId: "member-1",
      search: "",
      status: "",
      membershipStatus: "",
      emailVerificationStatus: "",
    });
    assert.deepEqual(reset, {});

    const lookup = directoryTargetLookupQuery("member-1");
    assert.deepEqual(lookup, { participantId: "member-1", limit: 1, offset: 0 });

    const section = read("features/administration/components/AdminParticipantsSection.tsx");
    const listStart = section.indexOf(
      "const listFilters = directoryListFiltersForNotificationTarget",
    );
    const listEnd = section.indexOf("const response = await listAdminParticipants", listStart);
    const tableCall = section.slice(listStart, listEnd);
    assert.doesNotMatch(tableCall, /participantId/);
    assert.match(section, /directoryTargetLookupQuery\(deepLinkParticipantId\)/);
    assert.match(section, /setNotificationTarget\(match\)/);
    assert.match(section, /requestId !== targetRequestIdRef\.current/);
    assert.match(section, /requestId !== directoryRequestIdRef\.current/);
    assert.match(section, /offset: requestOffset/);
  });

  it("scrolls to the row, the selection toolbar, or the unavailable notice", () => {
    assert.deepEqual(
      resolveDirectoryNotificationScroll({
        action: "select-participant",
        participantId: "member-1",
        participantOnCurrentPage: true,
      }),
      { kind: "row", participantId: "member-1" },
    );
    assert.deepEqual(
      resolveDirectoryNotificationScroll({
        action: "select-participant",
        participantId: "member-1",
        participantOnCurrentPage: false,
      }),
      { kind: "selection" },
    );
    assert.equal(
      resolveDirectoryNotificationScroll({
        action: "open-application",
        participantId: "member-1",
        participantOnCurrentPage: true,
      }).kind,
      "modal",
    );
    assert.equal(
      resolveDirectoryNotificationScroll({
        action: "participant-unavailable",
        participantId: "member-1",
        participantOnCurrentPage: false,
      }).kind,
      "unavailable",
    );
    assert.equal(
      resolveDirectoryNotificationScroll({
        action: "wait",
        participantId: "member-1",
        participantOnCurrentPage: true,
      }).kind,
      "none",
    );
    assert.equal(directoryNotificationScrollBehavior(true), "auto");
    assert.equal(directoryNotificationScrollBehavior(false), "smooth");

    const section = read("features/administration/components/AdminParticipantsSection.tsx");
    const css = read("features/administration/components/admin-participants-table.css");
    assert.match(section, /data-directory-participant-id=\{row\.memberId\}/);
    assert.match(section, /prefers-reduced-motion: reduce/);
    assert.match(section, /scrollIntoView/);
    assert.match(css, /scroll-margin-block-start:\s*var\(--humanity-header-offset\)/);
    assert.doesNotMatch(css, /scroll-margin-left|margin-left:\s*var\(--humanity-header-offset\)/);
  });

  it("closes an unrelated modal when the destination changes", () => {
    const section = read("features/administration/components/AdminParticipantsSection.tsx");
    assert.match(section, /if \(!directoryQuery\.rrpApplicationId\)/);
    assert.match(section, /setRrpApplicationModalOpen\(false\)/);
    assert.match(section, /directoryQuery\.badgeApplicationId/);
    assert.match(section, /directoryListFiltersForNotificationTarget/);
    assert.match(section, /isDirectoryBadgeDeepLink/);
    const badge = readAdminDirectoryDeepLinkQuery(
      new URLSearchParams("view=member_badge_orders&badgeApplicationId=badge-1"),
    );
    assert.equal(badge.participantId, null);
    assert.equal(badge.rrpApplicationId, null);
    assert.equal(badge.badgeApplicationId, "badge-1");
    const ignored = resolveDirectoryParticipantDeepLink({
      participantId: badge.participantId,
      rrpApplicationId: badge.rrpApplicationId,
      acceptedParticipantFilter: null,
      directoryReady: true,
      rows: [{ memberId: "member-1", viewableApplicationIds: ["app-1"] }],
      appliedKey: null,
    });
    assert.equal(ignored.action, "ignore");
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
