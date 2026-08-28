/**
 * Pack 26A — pre-production Stripe / webhook / livemode / purpose safety.
 */
import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import {
  MEMBERSHIP_CONTRIBUTION_AMOUNT_CENTS,
  MEMBERSHIP_CONTRIBUTION_CURRENCY,
} from "../../../src/modules/membership-payment/membership-payment.constants.js";
import { MembershipPaymentValidationError } from "../../../src/modules/membership-payment/membership-payment.errors.js";
import { assertMembershipCheckoutAmountAndCurrency } from "../../../src/modules/membership-payment/membership-payment.verification.js";
import {
  assertSupportedStripePaymentPurpose,
  dispatchStripeMembershipWebhookEvent,
} from "../../../src/modules/membership-payment/stripe-webhook-dispatcher.js";
import {
  assertStripeLivemodeMatchesEnvironment,
  expectStripeLivemode,
  StripeLivemodeMismatchError,
} from "../../../src/modules/membership-payment/stripe-livemode.guard.js";
import { resolveMemberBadgeContributionConfig } from "../../../src/modules/member-badge-contribution/member-badge-contribution.config.js";

const savedEnv = { ...process.env };

afterEach(() => {
  for (const key of Object.keys(process.env)) {
    if (!(key in savedEnv)) {
      delete process.env[key];
    }
  }
  for (const [key, value] of Object.entries(savedEnv)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
});

describe("Pack 26A — Membership amount / currency verification", () => {
  it("accepts CA$1 CAD", () => {
    assert.doesNotThrow(() =>
      assertMembershipCheckoutAmountAndCurrency({
        amount_total: MEMBERSHIP_CONTRIBUTION_AMOUNT_CENTS,
        currency: MEMBERSHIP_CONTRIBUTION_CURRENCY,
        payment_status: "paid",
      }),
    );
  });

  it("rejects wrong amount", () => {
    assert.throws(
      () =>
        assertMembershipCheckoutAmountAndCurrency({
          amount_total: 2800,
          currency: "cad",
        }),
      /does not match CA\$1/,
    );
  });

  it("rejects wrong currency", () => {
    assert.throws(
      () =>
        assertMembershipCheckoutAmountAndCurrency({
          amount_total: 100,
          currency: "usd",
        }),
      /must be CAD/,
    );
  });

  it("rejects missing amount", () => {
    assert.throws(
      () =>
        assertMembershipCheckoutAmountAndCurrency({
          currency: "cad",
        }),
      /amount is missing/,
    );
  });
});

describe("Pack 26A — Stripe livemode guard", () => {
  it("production expects Live Mode and rejects Test events", () => {
    process.env.PLATFORM_MODE = "production";
    assert.equal(expectStripeLivemode(), true);
    assert.throws(
      () => assertStripeLivemodeMatchesEnvironment(false),
      StripeLivemodeMismatchError,
    );
    assert.doesNotThrow(() => assertStripeLivemodeMatchesEnvironment(true));
  });

  it("staging/beta expects Test Mode and rejects Live events", () => {
    process.env.PLATFORM_MODE = "staging";
    assert.equal(expectStripeLivemode(), false);
    assert.throws(
      () => assertStripeLivemodeMatchesEnvironment(true),
      StripeLivemodeMismatchError,
    );
    assert.doesNotThrow(() => assertStripeLivemodeMatchesEnvironment(false));
  });

  it("development expects Test Mode", () => {
    process.env.PLATFORM_MODE = "development";
    process.env.NODE_ENV = "development";
    assert.equal(expectStripeLivemode(), false);
    assert.throws(
      () => assertStripeLivemodeMatchesEnvironment(true),
      /Live Mode event rejected/,
    );
  });
});

describe("Pack 26A — webhook paymentPurpose routing", () => {
  it("rejects missing paymentPurpose", () => {
    assert.throws(
      () => assertSupportedStripePaymentPurpose(null),
      MembershipPaymentValidationError,
    );
  });

  it("rejects unknown paymentPurpose", () => {
    assert.throws(
      () => assertSupportedStripePaymentPurpose("donation"),
      /not a supported payment purpose/,
    );
  });

  it("accepts membership and member_badge_contribution", () => {
    assert.doesNotThrow(() => assertSupportedStripePaymentPurpose("membership"));
    assert.doesNotThrow(() => assertSupportedStripePaymentPurpose("member_badge_contribution"));
  });

  it("dispatch rejects missing purpose without Membership activation path", async () => {
    process.env.PLATFORM_MODE = "development";
    await assert.rejects(
      () =>
        dispatchStripeMembershipWebhookEvent({
          id: "evt_pack26a_missing_purpose",
          type: "checkout.session.completed",
          api_version: null,
          livemode: false,
          data: {
            object: {
              id: "cs_test_missing",
              amount_total: 100,
              currency: "cad",
              payment_status: "paid",
              metadata: {},
            },
          },
        }),
      /paymentPurpose metadata is required/,
    );
  });

  it("dispatch rejects Live Mode on staging before fulfillment", async () => {
    process.env.PLATFORM_MODE = "staging";
    await assert.rejects(
      () =>
        dispatchStripeMembershipWebhookEvent({
          id: "evt_pack26a_live_on_staging",
          type: "checkout.session.completed",
          api_version: null,
          livemode: true,
          data: {
            object: {
              id: "cs_live_bad",
              amount_total: 100,
              currency: "cad",
              payment_status: "paid",
              metadata: { paymentPurpose: "membership" },
            },
          },
        }),
      StripeLivemodeMismatchError,
    );
  });

  it("dispatch rejects Test Mode on production before fulfillment", async () => {
    process.env.PLATFORM_MODE = "production";
    await assert.rejects(
      () =>
        dispatchStripeMembershipWebhookEvent({
          id: "evt_pack26a_test_on_prod",
          type: "checkout.session.completed",
          api_version: null,
          livemode: false,
          data: {
            object: {
              id: "cs_test_bad",
              amount_total: 100,
              currency: "cad",
              payment_status: "paid",
              metadata: { paymentPurpose: "membership" },
            },
          },
        }),
      StripeLivemodeMismatchError,
    );
  });

  it("legacy Badge contribution webhook fails closed when disabled", async () => {
    process.env.PLATFORM_MODE = "development";
    process.env.MEMBER_BADGE_CONTRIBUTIONS_ENABLED = "false";
    assert.equal(resolveMemberBadgeContributionConfig().enabled, false);

    await assert.rejects(
      () =>
        dispatchStripeMembershipWebhookEvent({
          id: "evt_pack26a_legacy_badge",
          type: "checkout.session.completed",
          api_version: null,
          livemode: false,
          data: {
            object: {
              id: "cs_legacy",
              amount_total: 2000,
              currency: "cad",
              payment_status: "paid",
              metadata: {
                paymentPurpose: "member_badge_contribution",
                // no applicationId → legacy path
              },
            },
          },
        }),
      /Legacy Member Badge contribution webhooks are disabled/,
    );
  });
});
