/**
 * Pack 25D — Admin Member Badge fulfillment UI + Membership refinements.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const webSrc = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function read(relativeFromWebSrc: string): string {
  return readFileSync(path.join(webSrc, relativeFromWebSrc), "utf8");
}

describe("Pack 25D — Admin UI + Membership refinements", () => {
  const section = read("features/administration/components/AdminParticipantsSection.tsx");
  const modal = read("features/administration/components/AdminMemberBadgeOrderModal.tsx");
  const progress = read(
    "features/administration/components/AdminMemberBadgeFulfillmentProgress.tsx",
  );
  const progressCss = read("features/administration/components/admin-member-badge-order.css");
  const api = read("features/administration/admin-member-badge-order-api.ts");
  const widget = read("features/membership/components/MemberBadgeApplicationWidget.tsx");
  const widgetCss = read("features/membership/components/member-badge-application.css");
  const statusCard = read("features/membership/components/MembershipStatusCard.tsx");
  const factsTiles = read("features/membership/components/MembershipFactsTiles.tsx");
  const membershipCss = read("features/membership/components/membership-page.css");

  it("directory Membership filter labels (Pack 25D primary views)", () => {
    assert.match(section, /option value="">All<\/option>/);
    assert.match(
      section,
      /option value="application_submitted">Application submitted<\/option>/,
    );
    assert.match(section, /option value="active_member">Active Members<\/option>/);
    assert.match(
      section,
      /option value="member_badge_orders">Member Badge Orders<\/option>/,
    );
    assert.doesNotMatch(section, /option value="not_started">/);
    assert.doesNotMatch(section, /option value="application_started">/);
    assert.doesNotMatch(section, /option value="pending_payment">/);
    assert.doesNotMatch(section, /option value="application_completed">/);
    assert.doesNotMatch(section, />Active Member</);
  });

  it("aggregates include Application started from membership.applicationStarted", () => {
    assert.match(section, /label:\s*"Application started"/);
    assert.match(section, /membership\.applicationStarted/);
  });

  it("badge orders view columns + View Order CTA", () => {
    assert.match(section, /Member Number/);
    assert.match(section, /Payment/);
    assert.match(section, /Fulfillment/);
    assert.match(section, /Updated/);
    assert.match(section, /View Order/);
    assert.match(section, /admin-participants-table__view-order/);
    assert.match(progressCss, /admin-participants-table__view-order/);
  });

  it("deep-link reads view + badgeApplicationId", () => {
    assert.match(section, /view === "member_badge_orders"/);
    assert.match(section, /badgeApplicationId/);
    assert.match(section, /setBadgeOrderApplicationId/);
    assert.match(section, /AdminMemberBadgeOrderModal/);
  });

  it("admin API client covers detail, fulfillment, email-label, label.pdf", () => {
    assert.match(api, /\/api\/v1\/admin\/member-badge-applications\//);
    assert.match(api, /\/fulfillment/);
    assert.match(api, /\/email-label/);
    assert.match(api, /\/label\.pdf/);
    assert.match(api, /printAdminMemberBadgeLabel/);
    assert.doesNotMatch(api, /stripeSecret|webhookSecret|cardNumber/);
  });

  it("modal sections + reversible shipped/delivered controls", () => {
    assert.match(modal, /Member Badge Order/);
    assert.match(modal, />\s*Order\s*</);
    assert.match(modal, />\s*Payment\s*</);
    assert.match(modal, />\s*Delivery\s*</);
    assert.match(modal, />\s*Fulfillment\s*</);
    assert.match(modal, /Mark as Shipped/);
    assert.match(modal, /Mark as Delivered/);
    assert.match(modal, /Print Label/);
    assert.match(modal, /Email Label/);
    assert.doesNotMatch(modal, /stripeSecret|paymentIntent|webhook/);
  });

  it("fulfillment progress reduced-motion + milestones", () => {
    assert.match(progress, /Awaiting fulfillment/);
    assert.match(progress, /Preparing/);
    assert.match(progress, /Shipped/);
    assert.match(progress, /Delivered/);
    assert.match(progressCss, /prefers-reduced-motion:\s*reduce/);
    assert.match(progressCss, /animation:\s*none/);
    assert.match(progressCss, /admin-member-badge-fulfillment-progress--active/);
    assert.match(progressCss, /admin-member-badge-fulfillment-progress--complete/);
  });

  it("widget horizontal CSS classes + Delivered label for completed", () => {
    assert.match(widget, /member-badge-application-widget__fields--horizontal/);
    assert.match(widgetCss, /member-badge-application-widget__fields--horizontal/);
    assert.match(widget, /status === "completed"/);
    assert.match(widget, /return "Delivered"/);
    assert.doesNotMatch(widget, /applicationId/);
  });

  it("status card tiles for active Member facts", () => {
    assert.match(statusCard, /MembershipFactsTiles/);
    assert.match(statusCard, /Current Status/);
    assert.match(statusCard, /Application Status/);
    assert.match(statusCard, /Member Number/);
    assert.match(statusCard, /Member Since/);
    assert.match(statusCard, /Contribution/);
    assert.match(factsTiles, /membership-facts-tiles/);
    assert.match(membershipCss, /#edf4fb/);
    assert.match(membershipCss, /#fbf4e8/);
    assert.match(membershipCss, /#edf6ef/);
    assert.match(membershipCss, /#f1edf8/);
    assert.match(membershipCss, /#ebf7f7/);
  });

  it("notification deep-link pattern documented in source", () => {
    const surface = read(
      "features/member-profile/components/ParticipantProfileSurface.tsx",
    );
    assert.match(section, /view=member_badge_orders|view === "member_badge_orders"/);
    assert.match(api, /badgeApplicationId|applicationId/);
    assert.match(surface, /MembershipFactsTiles/);
  });
});
