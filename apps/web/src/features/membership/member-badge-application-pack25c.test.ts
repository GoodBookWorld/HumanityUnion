/**
 * Pack 25C — Member Badge Application Checkout web contracts.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const webSrc = path.resolve(here, "../..");

function read(relativeFromWebSrc: string): string {
  return readFileSync(path.join(webSrc, relativeFromWebSrc), "utf8");
}

describe("Pack 25C — Member Badge Application Checkout web", () => {
  it("13 — Continue to Payment redirects when checkoutReady", () => {
    const modal = read("features/membership/components/MemberBadgeApplicationModal.tsx");
    assert.match(modal, /checkoutReady/);
    assert.match(modal, /window\.location\.assign\(result\.checkoutUrl\)/);
    assert.doesNotMatch(modal, /Payment setup is being completed/);
  });

  it("14 — widget can show Paid / Awaiting fulfillment", () => {
    const widget = read("features/membership/components/MemberBadgeApplicationWidget.tsx");
    assert.match(widget, /Paid/);
    assert.match(widget, /Awaiting fulfillment/);
    assert.match(widget, /paymentStatus === "unpaid"/);
  });

  it("9 — success redirect does not mark paid in client", () => {
    const page = read("features/membership/components/MembershipPageContent.tsx");
    assert.match(page, /badgePayment/);
    assert.doesNotMatch(page, /paymentStatus:\s*"paid"/);
    assert.doesNotMatch(page, /markMemberBadgeApplicationPaid/);
  });

  it("Admin notification label for member_badge_order_paid", () => {
    const labels = read("features/administration/admin-notification-labels.ts");
    assert.match(labels, /member_badge_order_paid:\s*"Member badge order paid"/);
  });
});
