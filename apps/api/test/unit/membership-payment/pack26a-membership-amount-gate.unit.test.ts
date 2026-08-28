/**
 * Pack 26A — Membership amount mismatch must not activate Membership / allocate Member Number.
 *
 * Uses source-contract assertions plus verification helper behavior (full DB activation
 * path is covered by e2e scripts; this pack keeps focused unit guards).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { assertMembershipCheckoutAmountAndCurrency } from "../../../src/modules/membership-payment/membership-payment.verification.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "../../../../..");

function readRepo(relative: string): string {
  return readFileSync(path.join(repoRoot, relative), "utf8");
}

describe("Pack 26A — Membership activation gated on amount integrity", () => {
  it("webhook service asserts amount/currency before activateMembershipFromContribution", () => {
    const service = readRepo(
      "apps/api/src/modules/membership-payment/membership-payment.service.ts",
    );
    const assertIdx = service.indexOf("assertMembershipCheckoutAmountAndCurrency");
    const activateIdx = service.indexOf("activateMembershipFromContribution");
    assert.ok(assertIdx > 0, "amount assertion must exist");
    assert.ok(activateIdx > assertIdx, "amount assertion must run before activation");
    assert.match(service, /Checkout Session is not paid/);
    assert.doesNotMatch(
      service.slice(service.indexOf("processMembershipStripeEvent")),
      /purpose === null/,
    );
  });

  it("wrong amount helper throws before any activation side effects can run", () => {
    assert.throws(() =>
      assertMembershipCheckoutAmountAndCurrency({
        amount_total: 999,
        currency: "cad",
      }),
    );
  });

  it("dispatcher no longer falls through null purpose to Membership", () => {
    const dispatcher = readRepo(
      "apps/api/src/modules/membership-payment/stripe-webhook-dispatcher.ts",
    );
    assert.match(dispatcher, /assertSupportedStripePaymentPurpose/);
    assert.doesNotMatch(dispatcher, /purpose === MEMBERSHIP_PAYMENT_PURPOSE \|\| purpose === null/);
    assert.match(dispatcher, /MEMBER_BADGE_CONTRIBUTIONS_ENABLED/);
  });
});
