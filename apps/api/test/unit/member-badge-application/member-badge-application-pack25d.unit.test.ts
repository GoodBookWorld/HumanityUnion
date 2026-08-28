/**
 * Pack 25D — Admin Member Badge fulfillment + directory + label contracts.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  MEMBER_BADGE_APPLICATION_AMOUNT_CENTS,
  MEMBER_BADGE_APPLICATION_CURRENCY,
} from "@hu/types";

import {
  MEMBER_BADGE_APPLICATION_SENDER,
  MEMBER_BADGE_APPLICATION_LABEL_PAGE_SIZE_PT,
} from "../../../src/modules/member-badge-application/member-badge-application.constants.js";
import { deriveMemberBadgeFulfillmentStatus } from "../../../src/modules/member-badge-application/member-badge-application-fulfillment.service.js";
import {
  MEMBER_BADGE_LABEL_LAYOUT,
  resolveMemberBadgeApplicationLookupUrl,
} from "../../../src/modules/member-badge-application/member-badge-application-label.service.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "../../../../..");

function readRepo(relative: string): string {
  return readFileSync(path.join(repoRoot, relative), "utf8");
}

describe("Pack 25D — Member Badge Admin fulfillment API", () => {
  it("15-20 — fulfillment markers sync status and Delivered implies Shipped", () => {
    assert.equal(
      deriveMemberBadgeFulfillmentStatus({
        paymentStatus: "paid",
        shipped: false,
        delivered: false,
      }),
      "awaiting_fulfillment",
    );
    assert.equal(
      deriveMemberBadgeFulfillmentStatus({
        paymentStatus: "paid",
        shipped: true,
        delivered: false,
      }),
      "shipped",
    );
    assert.equal(
      deriveMemberBadgeFulfillmentStatus({
        paymentStatus: "paid",
        shipped: true,
        delivered: true,
      }),
      "completed",
    );
  });

  it("30-34 — A5 label constants and safe QR lookup URL", () => {
    assert.deepEqual([...MEMBER_BADGE_APPLICATION_LABEL_PAGE_SIZE_PT], [419.53, 595.28]);
    assert.equal(MEMBER_BADGE_APPLICATION_SENDER.name, "Humanity Union Society");
    assert.match(MEMBER_BADGE_APPLICATION_SENDER.addressLine1, /514 Vernon/);
    const url = resolveMemberBadgeApplicationLookupUrl("app-abc-123");
    assert.match(url, /badgeApplicationId=app-abc-123/);
    assert.match(url, /member_badge_orders/);
    assert.doesNotMatch(url, /address|phone|stripe|secret/i);
  });

  it("Pack 25D.1 — A5 layout places QR upper-right and recipient on right", () => {
    const label = readRepo(
      "apps/api/src/modules/member-badge-application/member-badge-application-label.service.ts",
    );
    assert.match(label, /MEMBER_BADGE_LABEL_LAYOUT/);
    assert.match(label, /qrX = pageWidth - margin - qrSize/);
    assert.match(label, /qrY = margin/);
    assert.match(label, /rightX = pageWidth \* MEMBER_BADGE_LABEL_LAYOUT\.rightColumnXRatio/);
    assert.match(label, /text\("FROM"/);
    assert.match(label, /text\("TO"/);
    assert.match(label, /Member #:/);
    assert.match(label, /fontSize\(8\)/);
    assert.equal(MEMBER_BADGE_LABEL_LAYOUT.margin, 36);
    assert.ok(MEMBER_BADGE_LABEL_LAYOUT.rightColumnXRatio >= 0.48);
    assert.deepEqual([...MEMBER_BADGE_APPLICATION_LABEL_PAGE_SIZE_PT], [419.53, 595.28]);
  });

  it("Pack 25D.1 — missing fulfillment email is a validation error, not unavailable", () => {
    const label = readRepo(
      "apps/api/src/modules/member-badge-application/member-badge-application-label.service.ts",
    );
    const adminRoutes = readRepo(
      "apps/api/src/modules/member-badge-application/member-badge-application-admin.routes.ts",
    );
    assert.match(label, /MEMBER_BADGE_FULFILLMENT_EMAIL is not configured/);
    assert.match(label, /MemberBadgeApplicationValidationError/);
    assert.match(adminRoutes, /MemberBadgeApplicationValidationError[\s\S]*return 400/);
  });

  it("45-46 — Badge CA$28 and currency remain canonical", () => {
    assert.equal(MEMBER_BADGE_APPLICATION_AMOUNT_CENTS, 2800);
    assert.equal(MEMBER_BADGE_APPLICATION_CURRENCY, "cad");
  });

  it("notification deep-link includes application id", () => {
    const webhook = readRepo(
      "apps/api/src/modules/member-badge-application/member-badge-application-webhook.service.ts",
    );
    assert.match(
      webhook,
      /targetHref:[\s\S]*badgeApplicationId=\$\{input\.applicationId\}/,
    );
    assert.doesNotMatch(webhook, /shippingAddress/);
  });

  it("admin routes exist for detail, fulfillment, label pdf, email", () => {
    const routes = readRepo(
      "apps/api/src/modules/member-badge-application/member-badge-application-admin.routes.ts",
    );
    assert.match(routes, /\/:applicationId\/fulfillment/);
    assert.match(routes, /\/:applicationId\/email-label/);
    assert.match(routes, /\/:applicationId\/label\.pdf/);
    assert.match(routes, /requireAuthenticationMiddleware/);
    assert.match(routes, /authenticationMiddleware/);
  });

  it("directory operational filters include application_submitted and member_badge_orders", () => {
    const service = readRepo(
      "apps/api/src/modules/administration/admin-participant-directory.service.ts",
    );
    assert.match(service, /application_submitted/);
    assert.match(service, /member_badge_orders/);
    assert.match(service, /findUserIdsWithMemberBadgeApplications|memberBadgeOrder/);
  });

  it("applicationStarted aggregate is cumulative in membership statistics", () => {
    const stats = readRepo(
      "apps/api/src/modules/membership-statistics/membership-statistics.service.ts",
    );
    assert.match(stats, /applicationStarted/);
    assert.match(stats, /countApplicationStartedMemberships/);
  });

  it("fulfillment audit actions omit address payloads", () => {
    const fulfillment = readRepo(
      "apps/api/src/modules/member-badge-application/member-badge-application-fulfillment.service.ts",
    );
    assert.match(fulfillment, /member_badge\.fulfillment\.shipped_marked/);
    assert.match(fulfillment, /member_badge\.fulfillment\.delivered_unmarked/);
    assert.doesNotMatch(fulfillment, /afterSummary:[\s\S]{0,80}addressLine1/);
    assert.doesNotMatch(fulfillment, /shippingAddress/);
  });
});
