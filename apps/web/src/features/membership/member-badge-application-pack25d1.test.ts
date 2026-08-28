/**
 * Pack 25D.1 — Admin Badge fulfillment UI polish + legacy notification fallback.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { ApiRequestError } from "../../lib/api-client";
import { formatMemberBadgeLabelEmailError } from "../administration/admin-member-badge-order-api";
import { resolveAdminNotificationHref } from "../administration/admin-notification-labels";

const webSrc = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function read(relativeFromWebSrc: string): string {
  return readFileSync(path.join(webSrc, relativeFromWebSrc), "utf8");
}

describe("Pack 25D.1 — Admin fulfillment UI polish", () => {
  it("6-8 — Email Label missing-config is specific; network stays generic", () => {
    const configError = formatMemberBadgeLabelEmailError(
      new ApiRequestError("MEMBER_BADGE_FULFILLMENT_EMAIL is not configured.", 400),
    );
    assert.equal(configError.title, "Email label unavailable");
    assert.equal(configError.message, "MEMBER_BADGE_FULFILLMENT_EMAIL is not configured.");
    assert.doesNotMatch(configError.message, /temporarily unavailable/i);

    const networkError = formatMemberBadgeLabelEmailError(new ApiRequestError("boom", 0));
    assert.equal(networkError.title, "Email label unavailable");
    assert.match(networkError.message, /temporarily unavailable/i);

    const modal = read("features/administration/components/AdminMemberBadgeOrderModal.tsx");
    assert.match(modal, /formatMemberBadgeLabelEmailError/);
    assert.match(modal, /setErrorTitle\(formatted\.title\)/);
  });

  it("9-11 — new and legacy badge notification deep-links", () => {
    const withId = resolveAdminNotificationHref({
      type: "member_badge_order_paid",
      targetHref:
        "/admin/participants?view=member_badge_orders&badgeApplicationId=app-123",
    });
    assert.equal(
      withId,
      "/admin/participants?view=member_badge_orders&badgeApplicationId=app-123",
    );

    const legacy = resolveAdminNotificationHref({
      type: "member_badge_order_paid",
      targetHref: "/admin/participants",
    });
    assert.equal(legacy, "/admin/participants?view=member_badge_orders");
    assert.doesNotMatch(legacy ?? "", /badgeApplicationId=/);

    const missingHref = resolveAdminNotificationHref({
      type: "member_badge_order_paid",
      targetHref: undefined,
    });
    assert.equal(missingHref, "/admin/participants?view=member_badge_orders");

    const other = resolveAdminNotificationHref({
      type: "participant_registered",
      targetHref: "/admin/participants",
    });
    assert.equal(other, "/admin/participants");

    const header = read("features/administration/components/AdminWorkspaceHeader.tsx");
    assert.match(header, /resolveAdminNotificationHref/);
    assert.doesNotMatch(header, /notification\.targetHref\?\.trim\(\) \|\| null/);
  });

  it("12-15 — five Participant aggregate cards in one desktop row", () => {
    const section = read("features/administration/components/AdminParticipantsSection.tsx");
    const grid = read("features/administration/components/AdminMetricDetailsGrid.tsx");
    const css = read("features/administration/components/admin-panel.css");

    assert.match(section, /label:\s*"Application started"/);
    assert.match(section, /membership\.applicationStarted/);
    assert.match(grid, /admin-metric-details-grid--cols-5/);
    assert.match(grid, /cells\.length === 5/);
    assert.match(css, /\.admin-metric-details-grid--cols-5\s*\{[\s\S]*repeat\(5/);
    assert.match(
      css,
      /@media \(max-width:\s*900px\)[\s\S]*\.admin-metric-details-grid--cols-5[\s\S]*repeat\(5/,
    );
    assert.match(
      css,
      /@media \(max-width:\s*700px\)[\s\S]*\.admin-metric-details-grid--cols-5[\s\S]*repeat\(2/,
    );
  });
});
