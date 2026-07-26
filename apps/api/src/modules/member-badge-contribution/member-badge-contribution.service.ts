import type {
  MemberBadgeContributionAvailability,
  MemberBadgeContributionDetail,
  MemberBadgeContributionSummary,
} from "@hu/types";

import { findAuthUserById } from "../auth/auth-user.repository.js";
import { findMemberProfileByUserId } from "../member-profile/member-profile.repository.js";
import { findMembershipByUserId } from "../membership/membership.repository.js";
import {
  isMemberBadgeMockCheckoutConfigured,
  isMemberBadgeStripeCheckoutConfigured,
  resolveMemberBadgeContributionConfig,
} from "./member-badge-contribution.config.js";
import {
  MemberBadgeContributionAccessDeniedError,
  MemberBadgeContributionConflictError,
  MemberBadgeContributionNotFoundError,
  MemberBadgeContributionUnavailableError,
  MemberBadgeContributionValidationError,
} from "./member-badge-contribution.errors.js";
import {
  findMemberBadgeContributionByCheckoutSessionId,
  findMemberBadgeContributionById,
  findMemberBadgeContributionsByUserId,
  findActiveMemberBadgeCheckoutByUserId,
} from "./member-badge-contribution.repository.js";
import {
  toMemberBadgeContributionDetail,
  toMemberBadgeContributionSummary,
} from "./member-badge-contribution.projection.js";

function formatCadAmount(cents: number): string {
  return `${(cents / 100).toFixed(0)} CAD`;
}

export function isMemberBadgeCheckoutConfigured(): boolean {
  const config = resolveMemberBadgeContributionConfig();
  if (!config.enabled) {
    return false;
  }

  if (config.provider === "mock") {
    return isMemberBadgeMockCheckoutConfigured(config);
  }

  return isMemberBadgeStripeCheckoutConfigured(config);
}

export async function getMemberBadgeContributionAvailability(input: {
  userId: string | null;
}): Promise<MemberBadgeContributionAvailability> {
  const config = resolveMemberBadgeContributionConfig();
  const contributionAmountCad = formatCadAmount(config.amountCents);

  if (!config.enabled || !isMemberBadgeCheckoutConfigured()) {
    return {
      enabled: false,
      eligible: false,
      reason: "Member Badge Contributions are not currently open.",
      contributionAmountCad,
      shippingCountries: config.shippingCountries,
    };
  }

  if (!input.userId) {
    return {
      enabled: true,
      eligible: false,
      reason: "Sign in to request the official Member Badge.",
      contributionAmountCad,
      shippingCountries: config.shippingCountries,
    };
  }

  const user = await findAuthUserById(input.userId);
  if (!user || user.emailVerificationStatus !== "verified") {
    return {
      enabled: true,
      eligible: false,
      reason: "The official Member Badge is available to active Humanity Union Members.",
      contributionAmountCad,
      shippingCountries: config.shippingCountries,
    };
  }

  const membership = await findMembershipByUserId(input.userId);
  if (!membership || membership.status !== "active_member") {
    return {
      enabled: true,
      eligible: false,
      reason: "The official Member Badge is available to active Humanity Union Members.",
      contributionAmountCad,
      shippingCountries: config.shippingCountries,
    };
  }

  return {
    enabled: true,
    eligible: true,
    reason: null,
    contributionAmountCad,
    shippingCountries: config.shippingCountries,
  };
}

export async function assertMemberBadgeCheckoutEligible(userId: string): Promise<{
  userId: string;
  profileId: string;
  membershipId: string;
  memberNumberSnapshot: string | null;
}> {
  const user = await findAuthUserById(userId);

  if (!user) {
    throw new MemberBadgeContributionAccessDeniedError("Authentication session is invalid.");
  }

  if (user.emailVerificationStatus !== "verified") {
    throw new MemberBadgeContributionAccessDeniedError(
      "Email must be confirmed before contribution.",
    );
  }

  const membership = await findMembershipByUserId(userId);

  if (!membership) {
    throw new MemberBadgeContributionNotFoundError("Membership record not found.");
  }

  if (membership.status !== "active_member") {
    throw new MemberBadgeContributionValidationError(
      "The official Member Badge is available to active Humanity Union Members.",
    );
  }

  const config = resolveMemberBadgeContributionConfig();

  if (!config.enabled) {
    throw new MemberBadgeContributionUnavailableError(
      "Member Badge Contributions are not currently open.",
    );
  }

  if (config.provider === "mock") {
    if (!isMemberBadgeMockCheckoutConfigured(config)) {
      throw new MemberBadgeContributionUnavailableError(
        "Member Badge Contribution checkout is not configured.",
      );
    }
  } else if (!isMemberBadgeStripeCheckoutConfigured(config)) {
    throw new MemberBadgeContributionUnavailableError(
      "Member Badge Contribution checkout is not configured.",
    );
  }

  const activeCheckout = await findActiveMemberBadgeCheckoutByUserId(userId);
  if (activeCheckout) {
    throw new MemberBadgeContributionConflictError(
      "An active Member Badge Contribution checkout is already in progress.",
    );
  }

  const profile = await findMemberProfileByUserId(userId);
  if (!profile) {
    throw new MemberBadgeContributionNotFoundError("Member profile not found.");
  }

  return {
    userId,
    profileId: profile.profileId,
    membershipId: membership.membershipId,
    memberNumberSnapshot: membership.memberNumber,
  };
}

export async function listMemberBadgeContributionsForUser(
  userId: string,
): Promise<MemberBadgeContributionSummary[]> {
  const records = await findMemberBadgeContributionsByUserId(userId);
  return records.map(toMemberBadgeContributionSummary);
}

export async function getMemberBadgeContributionDetailForUser(input: {
  userId: string;
  badgeContributionId: string;
}): Promise<MemberBadgeContributionDetail> {
  const record = await findMemberBadgeContributionById(input.badgeContributionId);

  if (!record || record.userId !== input.userId) {
    throw new MemberBadgeContributionNotFoundError("Badge request not found.");
  }

  return toMemberBadgeContributionDetail(record);
}

export async function getMemberBadgeContributionBySessionForUser(input: {
  userId: string;
  sessionId: string;
}): Promise<MemberBadgeContributionDetail | null> {
  const record = await findMemberBadgeContributionByCheckoutSessionId(input.sessionId);

  if (!record || record.userId !== input.userId) {
    return null;
  }

  return toMemberBadgeContributionDetail(record);
}
