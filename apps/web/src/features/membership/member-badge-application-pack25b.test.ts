/**
 * Pack 25B — Member Badge Application UI contracts.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import type { MemberBadgeApplicationShippingAddress } from "@hu/types";
import {
  MEMBER_BADGE_APPLICATION_DELIVERY_LABEL,
  MEMBER_BADGE_APPLICATION_PRICE_LABEL,
} from "@hu/types";

import { API_BASE_URL } from "../../lib/api-base-url";
import {
  continueMyMemberBadgeApplicationPayment,
  saveMyMemberBadgeApplication,
} from "./member-badge-application-api";

const here = path.dirname(fileURLToPath(import.meta.url));
const webSrc = path.resolve(here, "../..");

function read(relativeFromWebSrc: string): string {
  return readFileSync(path.join(webSrc, relativeFromWebSrc), "utf8");
}

const sampleShippingAddress: MemberBadgeApplicationShippingAddress = {
  recipientName: "Alex Member",
  addressLine1: "123 Civic Way",
  addressLine2: "Suite 2",
  city: "Nelson",
  provinceStateRegion: "BC",
  postalCode: "V1L 5R4",
  country: "Canada",
  phone: "+1-250-555-0100",
};

function headerValue(headers: HeadersInit | undefined, name: string): string | null {
  if (!headers) {
    return null;
  }
  return new Headers(headers).get(name);
}

describe("Pack 25B.1 — Member Badge Application JSON request contract", () => {
  it("1 — Save for Later helper sends PUT + application/json + shippingAddress body", async () => {
    const originalFetch = globalThis.fetch;
    let capturedUrl: string | null = null;
    let capturedInit: RequestInit | undefined;

    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      capturedUrl = String(input);
      capturedInit = init;
      return new Response(
        JSON.stringify({
          success: true,
          data: {
            applicationId: "app-1",
            paymentStatus: "unpaid",
            shippingAddress: sampleShippingAddress,
          },
          meta: {},
          links: {},
          message: "saved",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }) as typeof fetch;

    try {
      await saveMyMemberBadgeApplication(sampleShippingAddress);
      assert.equal(capturedUrl, `${API_BASE_URL}/api/v1/member-badge-applications/me`);
      assert.equal(capturedInit?.method, "PUT");
      assert.equal(headerValue(capturedInit?.headers, "Content-Type"), "application/json");
      assert.equal(
        capturedInit?.body,
        JSON.stringify({ shippingAddress: sampleShippingAddress }),
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("2 — Continue to Payment helper sends POST + application/json + shippingAddress body", async () => {
    const originalFetch = globalThis.fetch;
    let capturedUrl: string | null = null;
    let capturedInit: RequestInit | undefined;

    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      capturedUrl = String(input);
      capturedInit = init;
      return new Response(
        JSON.stringify({
          success: true,
          data: {
            application: {
              applicationId: "app-1",
              paymentStatus: "unpaid",
              shippingAddress: sampleShippingAddress,
            },
            checkoutReady: false,
            checkoutUrl: null,
            sessionId: null,
            message: "Payment temporarily unavailable.",
          },
          meta: {},
          links: {},
          message: "ok",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }) as typeof fetch;

    try {
      await continueMyMemberBadgeApplicationPayment(sampleShippingAddress);
      assert.equal(
        capturedUrl,
        `${API_BASE_URL}/api/v1/member-badge-applications/me/continue-to-payment`,
      );
      assert.equal(capturedInit?.method, "POST");
      assert.equal(headerValue(capturedInit?.headers, "Content-Type"), "application/json");
      assert.equal(
        capturedInit?.body,
        JSON.stringify({ shippingAddress: sampleShippingAddress }),
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

describe("Pack 25B — Member Badge Application web foundation", () => {
  it("9-10 — Wear Your Commitment uses Member Badge Application CTA and CA$28", () => {
    const offer = read("features/membership/components/MembershipMemberBadgeOffer.tsx");
    const constants = read("features/membership/membership.constants.ts");
    assert.match(offer, /MemberBadgeApplicationModal/);
    assert.match(offer, /MemberBadgeApplicationWidget/);
    assert.match(constants, /Member Badge Application/);
    assert.match(constants, /CA\$28/);
    assert.match(constants, /Delivery included/);
    assert.doesNotMatch(constants, /\+ Shipping/);
    assert.doesNotMatch(offer, /Coming Soon/);
    assert.equal(MEMBER_BADGE_APPLICATION_PRICE_LABEL, "CA$28");
    assert.equal(MEMBER_BADGE_APPLICATION_DELIVERY_LABEL, "Delivery included");
  });

  it("9 — widget appears below membership-success-section after application", () => {
    const offer = read("features/membership/components/MembershipMemberBadgeOffer.tsx");
    const widget = read("features/membership/components/MemberBadgeApplicationWidget.tsx");
    assert.match(offer, /application \? \([\s\S]*MemberBadgeApplicationWidget/);
    assert.match(widget, /My Member Badge Application/);
    assert.match(widget, /Not paid|Awaiting payment/);
    assert.doesNotMatch(widget, /applicationId/);
  });

  it("13-15 — modal uses accessible dialog architecture", () => {
    const modal = read("features/membership/components/MemberBadgeApplicationModal.tsx");
    assert.match(modal, /role="dialog"/);
    assert.match(modal, /aria-modal="true"/);
    assert.match(modal, /Escape/);
    assert.match(modal, /trapTabKey/);
    assert.match(modal, /onClick=\{onClose\}/);
    assert.match(modal, /stopPropagation/);
    assert.match(modal, /Save for Later/);
    assert.match(modal, /Continue to Payment/);
    assert.match(modal, /setError\(formatAuthFormError/);
    assert.doesNotMatch(modal, /catch[\s\S]{0,120}onClose\(\)/);
  });

  it("16 — modal/widget CSS supports mobile viewport scrolling", () => {
    const css = read("features/membership/components/member-badge-application.css");
    assert.match(css, /max-height:\s*min\(92vh/);
    assert.match(css, /overflow-y:\s*auto/);
    assert.match(css, /@media \(max-width:\s*480px\)/);
  });

  it("membership page hosts Wear Your Commitment for active Members", () => {
    const page = read("features/membership/components/MembershipPageContent.tsx");
    assert.match(page, /MembershipMemberBadgeOffer/);
    assert.match(page, /isActiveMembershipStatus/);
  });

  it("18 — Pack 25A.1 automatic Member indicator contracts remain", () => {
    const projection = readFileSync(
      path.resolve(webSrc, "../../api/src/modules/member-profile/member-profile.projection.ts"),
      "utf8",
    );
    assert.match(projection, /memberBadgeVisible:\s*true/);
    assert.match(projection, /membershipPubliclyVisible === true/);
    const surface = read("features/member-profile/components/ParticipantProfileSurface.tsx");
    assert.match(surface, /shouldShowMemberBadge\(profile\)/);
    assert.match(surface, /MemberStatusIndicator/);
  });
});
