/**
 * Pack 25B — Member Badge Application validation + privacy + price contracts.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  MEMBER_BADGE_APPLICATION_AMOUNT_CENTS,
  MEMBER_BADGE_APPLICATION_CURRENCY,
  MEMBER_BADGE_APPLICATION_DELIVERY_LABEL,
  MEMBER_BADGE_APPLICATION_PRICE_LABEL,
} from "@hu/types";

import { MemberBadgeApplicationValidationError } from "../../../src/modules/member-badge-application/member-badge-application.errors.js";
import { validateMemberBadgeApplicationSaveBody } from "../../../src/modules/member-badge-application/member-badge-application.validation.js";
import { resolvePublicMembershipFields } from "../../../src/modules/member-profile/member-profile.projection.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "../../../../..");

function readRepo(relative: string): string {
  return readFileSync(path.join(repoRoot, relative), "utf8");
}

const validAddress = {
  recipientName: "Alex Member",
  addressLine1: "123 Civic Way",
  addressLine2: "Suite 2",
  city: "Nelson",
  provinceStateRegion: "BC",
  postalCode: "V1L 5R4",
  country: "Canada",
  phone: "+1-250-555-0100",
};

describe("Pack 25B — Member Badge Application foundation", () => {
  it("1 — price contract is CA$28 / CAD / delivery included (centralized)", () => {
    assert.equal(MEMBER_BADGE_APPLICATION_AMOUNT_CENTS, 2800);
    assert.equal(MEMBER_BADGE_APPLICATION_CURRENCY, "cad");
    assert.equal(MEMBER_BADGE_APPLICATION_PRICE_LABEL, "CA$28");
    assert.equal(MEMBER_BADGE_APPLICATION_DELIVERY_LABEL, "Delivery included");
  });

  it("5 — required address validation rejects incomplete payloads", () => {
    assert.throws(
      () => validateMemberBadgeApplicationSaveBody({ shippingAddress: { city: "Nelson" } }),
      MemberBadgeApplicationValidationError,
    );
    assert.throws(
      () =>
        validateMemberBadgeApplicationSaveBody({
          shippingAddress: { ...validAddress, recipientName: "   " },
        }),
      /Recipient name/i,
    );
  });

  it("5b — required address validation accepts complete shipping address", () => {
    const parsed = validateMemberBadgeApplicationSaveBody({ shippingAddress: validAddress });
    assert.equal(parsed.shippingAddress.recipientName, "Alex Member");
    assert.equal(parsed.shippingAddress.addressLine2, "Suite 2");
    assert.equal(parsed.shippingAddress.phone, "+1-250-555-0100");
  });

  it("6 — shipping address fields remain outside PublicMemberProfile projection", () => {
    const projectionSource = readRepo(
      "apps/api/src/modules/member-profile/member-profile.projection.ts",
    );
    assert.doesNotMatch(projectionSource, /addressLine1|provinceStateRegion|postalCode/);
    const publicTypes = readRepo("packages/types/src/domain/member-profile.ts");
    assert.doesNotMatch(publicTypes, /MemberBadgeApplicationShippingAddress/);
    assert.doesNotMatch(publicTypes, /addressLine1/);

    const fields = resolvePublicMembershipFields(
      {
        profileId: "p1",
        userId: "u1",
        memberNumber: "HU-1",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
        displayName: "Alex",
        publicName: "alex",
        biography: "",
        organization: undefined,
        skills: [],
        language: "en",
        profileVisibility: "public",
        showOrganization: true,
        showLocation: true,
        showParticipationArea: true,
        membershipPubliclyVisible: false,
        skillsVisibility: "public",
        professionalLinksVisibility: "public",
        showInitiativesStatistics: true,
        showCollectiveDecisionsStatistics: true,
        showAlliesStatistics: true,
        showProposalsStatistics: true,
        showPetitionsStatistics: true,
        showCommitmentsStatistics: true,
        messagingPolicy: "active_allies",
        status: "active",
      } as never,
      {
        membershipId: "m1",
        userId: "u1",
        status: "active_member",
        memberNumber: "HU-1",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      } as never,
    );
    assert.equal(fields.membershipStatus, "member");
    assert.equal(fields.memberBadgeVisible, true);
    assert.equal("addressLine1" in fields, false);
  });

  it("11-12 — Continue-to-Payment never marks paid without webhook", () => {
    const service = readRepo(
      "apps/api/src/modules/member-badge-application/member-badge-application.service.ts",
    );
    const checkout = readRepo(
      "apps/api/src/modules/member-badge-application/member-badge-application-checkout.service.ts",
    );
    assert.match(checkout, /checkoutReady:\s*true/);
    assert.doesNotMatch(service, /paymentStatus:\s*"paid"/);
    assert.doesNotMatch(checkout, /paymentStatus:\s*"paid"/);
  });

  it("17 — Membership CA$1 workflow remains separate from badge application price", () => {
    const membershipPayment = readRepo(
      "apps/api/src/modules/membership-payment/membership-payment.constants.ts",
    );
    assert.match(membershipPayment, /MEMBERSHIP_CONTRIBUTION_AMOUNT_CENTS\s*=\s*100/);
    assert.notEqual(MEMBER_BADGE_APPLICATION_AMOUNT_CENTS, 100);
  });

  it("eligibility uses active_member + memberNumber (not public badge visibility)", () => {
    const service = readRepo(
      "apps/api/src/modules/member-badge-application/member-badge-application.service.ts",
    );
    assert.match(service, /status !== "active_member"/);
    assert.match(service, /!membership\.memberNumber/);
    assert.doesNotMatch(service, /membershipPubliclyVisible|memberBadgeVisible/);
  });

  it("audit uses member_badge.application.save without address payloads", () => {
    const service = readRepo(
      "apps/api/src/modules/member-badge-application/member-badge-application.service.ts",
    );
    assert.match(service, /member_badge\.application\.save/);
    assert.doesNotMatch(service, /afterSummary:[\s\S]{0,120}addressLine1/);
  });
});
