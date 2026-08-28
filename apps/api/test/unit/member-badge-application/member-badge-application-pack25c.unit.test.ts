/**
 * Pack 25C — Member Badge Application Stripe Checkout contracts.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  MEMBER_BADGE_APPLICATION_AMOUNT_CENTS,
  MEMBER_BADGE_APPLICATION_CURRENCY,
  MEMBER_BADGE_APPLICATION_PRICE_LABEL,
} from "@hu/types";

import {
  isMemberBadgeApplicationPaymentConfigured,
  isMemberBadgeApplicationStripeCheckoutConfigured,
  resolveMemberBadgeApplicationPaymentConfig,
} from "../../../src/modules/member-badge-application/member-badge-application-payment.config.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "../../../../..");

function readRepo(relative: string): string {
  return readFileSync(path.join(repoRoot, relative), "utf8");
}

describe("Pack 25C — Member Badge Application Stripe Checkout", () => {
  it("5-6 — server owns CA$28 / CAD and uses STRIPE_MEMBER_BADGE_PRICE_ID", () => {
    assert.equal(MEMBER_BADGE_APPLICATION_AMOUNT_CENTS, 2800);
    assert.equal(MEMBER_BADGE_APPLICATION_CURRENCY, "cad");
    assert.equal(MEMBER_BADGE_APPLICATION_PRICE_LABEL, "CA$28");
    const configSource = readRepo(
      "apps/api/src/modules/member-badge-application/member-badge-application-payment.config.ts",
    );
    assert.match(configSource, /STRIPE_MEMBER_BADGE_PRICE_ID/);
    assert.doesNotMatch(configSource, /STRIPE_MEMBERSHIP_PRICE_ID/);
    assert.doesNotMatch(configSource, /shippingRates|SHIPPING_RATE/);
  });

  it("7 — paymentPurpose remains member_badge_contribution with applicationId", () => {
    const checkout = readRepo(
      "apps/api/src/modules/member-badge-application/member-badge-application-checkout.service.ts",
    );
    assert.match(checkout, /paymentPurpose:\s*MEMBER_BADGE_PAYMENT_PURPOSE/);
    assert.match(checkout, /applicationId:\s*application\.applicationId/);
    assert.match(checkout, /internalUserId:\s*input\.userId/);
    assert.doesNotMatch(checkout, /shipping_address_collection|shipping_options/);
    assert.doesNotMatch(checkout, /addressLine1|recipientName/);
  });

  it("8 — dispatcher routes applicationId to application webhook", () => {
    const dispatcher = readRepo(
      "apps/api/src/modules/membership-payment/stripe-webhook-dispatcher.ts",
    );
    assert.match(dispatcher, /metadata\.applicationId/);
    assert.match(dispatcher, /processMemberBadgeApplicationStripeEvent/);
    assert.match(dispatcher, /processMemberBadgeStripeEvent/);
  });

  it("10-13 — webhook marks same application paid / awaiting_fulfillment", () => {
    const webhook = readRepo(
      "apps/api/src/modules/member-badge-application/member-badge-application-webhook.service.ts",
    );
    const repository = readRepo(
      "apps/api/src/modules/member-badge-application/member-badge-application.repository.ts",
    );
    assert.match(webhook, /markMemberBadgeApplicationPaid/);
    assert.match(webhook, /MEMBER_BADGE_APPLICATION_AMOUNT_CENTS/);
    assert.match(repository, /paymentStatus:\s*"paid"/);
    assert.match(repository, /fulfillmentStatus:\s*"awaiting_fulfillment"/);
    assert.match(repository, /paidAt:\s*input\.paidAt/);
    assert.doesNotMatch(webhook, /activateMembershipMemberNumber|active_member/);
  });

  it("16-18 — Admin Notification and Audit omit shipping address", () => {
    const webhook = readRepo(
      "apps/api/src/modules/member-badge-application/member-badge-application-webhook.service.ts",
    );
    assert.match(webhook, /member_badge_order_paid/);
    assert.match(webhook, /member_badge\.payment\.completed/);
    assert.match(webhook, /dedupeKey:\s*`member_badge_order_paid:\$\{input\.applicationId\}`/);
    assert.doesNotMatch(webhook, /addressLine1|postalCode|shippingAddress/);
  });

  it("24 — incomplete Stripe config fails closed", () => {
    const previous = {
      provider: process.env.MEMBER_BADGE_PAYMENT_PROVIDER,
      secret: process.env.STRIPE_SECRET_KEY,
      webhook: process.env.STRIPE_WEBHOOK_SECRET,
      price: process.env.STRIPE_MEMBER_BADGE_PRICE_ID,
    };

    try {
      process.env.MEMBER_BADGE_PAYMENT_PROVIDER = "stripe";
      process.env.STRIPE_SECRET_KEY = "sk_test_x";
      process.env.STRIPE_WEBHOOK_SECRET = "";
      process.env.STRIPE_MEMBER_BADGE_PRICE_ID = "price_x";
      const config = resolveMemberBadgeApplicationPaymentConfig();
      assert.equal(isMemberBadgeApplicationStripeCheckoutConfigured(config), false);
      assert.equal(isMemberBadgeApplicationPaymentConfigured(config), false);
    } finally {
      if (previous.provider === undefined) {
        delete process.env.MEMBER_BADGE_PAYMENT_PROVIDER;
      } else {
        process.env.MEMBER_BADGE_PAYMENT_PROVIDER = previous.provider;
      }
      if (previous.secret === undefined) {
        delete process.env.STRIPE_SECRET_KEY;
      } else {
        process.env.STRIPE_SECRET_KEY = previous.secret;
      }
      if (previous.webhook === undefined) {
        delete process.env.STRIPE_WEBHOOK_SECRET;
      } else {
        process.env.STRIPE_WEBHOOK_SECRET = previous.webhook;
      }
      if (previous.price === undefined) {
        delete process.env.STRIPE_MEMBER_BADGE_PRICE_ID;
      } else {
        process.env.STRIPE_MEMBER_BADGE_PRICE_ID = previous.price;
      }
    }
  });

  it("20-21 — Membership CA$1 amount remains isolated", () => {
    const membership = readRepo(
      "apps/api/src/modules/membership-payment/membership-payment.constants.ts",
    );
    assert.match(membership, /MEMBERSHIP_CONTRIBUTION_AMOUNT_CENTS\s*=\s*100/);
    assert.notEqual(MEMBER_BADGE_APPLICATION_AMOUNT_CENTS, 100);
  });
});
