import type { Document } from "mongodb";

import {
  APPROVED_PRODUCTION_PARTICIPANTS,
  STRIPE_OPERATIONAL_FIELDS,
} from "./constants.js";
import type {
  MembershipParticipantPlan,
  MembershipPlanRow,
  StripeSanitizationFieldPlan,
} from "./types.js";

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function hasShippingData(doc: Document | null | undefined): boolean {
  if (!doc) return false;
  const shipping = doc.shippingAddress;
  if (!shipping || typeof shipping !== "object") return false;
  const record = shipping as Record<string, unknown>;
  return Boolean(
    record.recipientName ||
      record.addressLine1 ||
      record.city ||
      record.postalCode ||
      record.phone,
  );
}

function listPresentStripeFields(doc: Document | null | undefined): string[] {
  if (!doc) return [];
  return STRIPE_OPERATIONAL_FIELDS.filter((field) => {
    const value = doc[field];
    return typeof value === "string" && value.trim().length > 0;
  });
}

export function buildStaticMembershipCollectionPlan(): MembershipPlanRow[] {
  return [
    {
      collection: "memberships",
      classification: "MUST_MIGRATE",
      rowCount: 0,
      action: "migrate_active_business_state_only",
      notes: "Omit not_started rows; never create membership merely for migration",
    },
    {
      collection: "member_profiles.membershipPubliclyVisible",
      classification: "MUST_PRESERVE",
      rowCount: 0,
      action: "preserve_boolean_as_stored",
      notes: "Do not invent true; preserve staging value",
    },
    {
      collection: "membership_contributions",
      classification: "CONDITIONAL_SANITIZED",
      rowCount: 0,
      action: "migrate_hu_status_strip_stripe_ops",
      notes: "Preserve paid/refunded HU state; omit Stripe Test operational IDs",
    },
    {
      collection: "membership_webhook_events",
      classification: "DO_NOT_MIGRATE",
      rowCount: 0,
      action: "skip",
      notes: "Staging operational webhook audit",
    },
    {
      collection: "member_badge_applications",
      classification: "MUST_MIGRATE_IF_PRESENT",
      rowCount: 0,
      action: "migrate_if_present_sanitize_stripe",
      notes: "shippingDataPresent boolean only — never log address/phone",
    },
    {
      collection: "member_badge_contributions",
      classification: "CONDITIONAL_SANITIZED",
      rowCount: 0,
      action: "migrate_if_authoritative_sanitize_stripe",
      notes: "Legacy parallel; strip Stripe Test IDs",
    },
  ];
}

export function buildStripeSanitizationPlan(): StripeSanitizationFieldPlan[] {
  const collections = [
    "membership_contributions",
    "member_badge_applications",
    "member_badge_contributions",
  ];
  const plans: StripeSanitizationFieldPlan[] = [];
  for (const collection of collections) {
    for (const field of STRIPE_OPERATIONAL_FIELDS) {
      plans.push({
        collection,
        field,
        action: "OMIT_OR_NULL",
        reason:
          "Staging Stripe Test operational IDs must not become Live dependencies; never invent Live IDs",
      });
    }
  }
  plans.push({
    collection: "memberships",
    field: "status/memberNumber/memberGrantedAt/applicationStatus",
    action: "PRESERVE_HU_BUSINESS_STATE",
    reason:
      "Active Member must not be forced to re-pay CA$1 merely because Test Stripe records were sanitized",
  });
  plans.push({
    collection: "member_badge_applications",
    field: "paymentStatus/fulfillmentStatus/shipped/delivered/paidAt/refund",
    action: "PRESERVE_HU_BUSINESS_STATE",
    reason: "Paid/shipped badge order preserves HU fulfillment without Test Stripe objects",
  });
  plans.push({
    collection: "membership_webhook_events",
    field: "*",
    action: "DO_NOT_MIGRATE_RECORD",
    reason: "Webhook audit is environment-local",
  });
  return plans;
}

export function planMembershipForParticipant(input: {
  label: string;
  memberId: string;
  userId: string;
  membership: Document | null;
  profile: Document | null;
  badgeApplication: Document | null;
}): MembershipParticipantPlan {
  const status = asString(input.membership?.status);
  const applicationStatus = asString(input.membership?.applicationStatus);
  const memberNumberPresent = Boolean(asString(input.membership?.memberNumber));
  const memberGrantedAtPresent = Boolean(asString(input.membership?.memberGrantedAt));
  const visibility =
    typeof input.profile?.membershipPubliclyVisible === "boolean"
      ? input.profile.membershipPubliclyVisible
      : null;

  const migrateMembershipRow = status !== null && status !== "not_started";

  const stripeOperationalFieldsPresent = [
    ...listPresentStripeFields(input.membership),
    ...listPresentStripeFields(input.badgeApplication),
  ];

  return {
    label: input.label,
    memberId: input.memberId,
    userId: input.userId,
    membershipStatus: status,
    applicationStatus,
    memberNumberPresent,
    memberGrantedAtPresent,
    membershipPubliclyVisible: visibility,
    migrateMembershipRow,
    badgeApplicationPresent: Boolean(input.badgeApplication),
    badgePaymentStatus: asString(input.badgeApplication?.paymentStatus),
    badgeFulfillmentStatus: asString(input.badgeApplication?.fulfillmentStatus),
    shippingDataPresent: hasShippingData(input.badgeApplication),
    stripeOperationalFieldsPresent: [...new Set(stripeOperationalFieldsPresent)],
  };
}

export function validateVladActiveMemberExpectations(
  plan: MembershipParticipantPlan,
): string[] {
  const blockers: string[] = [];
  if (plan.label !== "Vlad Shapran") return blockers;
  if (plan.membershipStatus !== "active_member") {
    blockers.push("Vlad membership.status expected active_member");
  }
  if (!plan.memberNumberPresent) {
    blockers.push("Vlad Member Number missing");
  }
  if (!plan.memberGrantedAtPresent) {
    blockers.push("Vlad memberGrantedAt missing");
  }
  if (!plan.migrateMembershipRow) {
    blockers.push("Vlad membership row must migrate");
  }
  return blockers;
}

export function validateNonVladNotStartedOmitted(plan: MembershipParticipantPlan): string[] {
  const blockers: string[] = [];
  if (plan.label === "Vlad Shapran") return blockers;
  if (plan.membershipStatus === "not_started" && plan.migrateMembershipRow) {
    blockers.push(`${plan.label}: not_started must not create membership migration row`);
  }
  if (plan.membershipStatus === null || plan.membershipStatus === "not_started") {
    if (plan.migrateMembershipRow) {
      blockers.push(`${plan.label}: omit not_started membership migration`);
    }
  }
  return blockers;
}

export function buildDefaultParticipantMembershipPlans(): MembershipParticipantPlan[] {
  return APPROVED_PRODUCTION_PARTICIPANTS.map((p) =>
    planMembershipForParticipant({
      label: p.label,
      memberId: p.memberId,
      userId: p.userId,
      membership: null,
      profile: null,
      badgeApplication: null,
    }),
  );
}

/** Ensure sanitized plan objects never include shipping payload keys. */
export function assertMembershipPlanSafeForLogging(plan: MembershipParticipantPlan): void {
  const json = JSON.stringify(plan);
  if (/addressLine1|recipientName|"phone"|shippingAddress/i.test(json)) {
    throw new Error("Membership plan leaked shipping/private fields");
  }
}
