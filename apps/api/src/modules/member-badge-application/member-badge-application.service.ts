import type {
  MemberBadgeApplicationAvailability,
  MemberBadgeApplicationDetail,
  MemberBadgeApplicationPaymentBoundary,
  MemberBadgeApplicationShippingAddress,
} from "@hu/types";

import { recordAdministrationAuditBestEffort } from "../administration/audit.service.js";
import { findAuthUserById } from "../auth/auth-user.repository.js";
import { findMembershipByUserId } from "../membership/membership.repository.js";
import { createMemberBadgeApplicationCheckoutSession } from "./member-badge-application-checkout.service.js";
import {
  isMemberBadgeApplicationPaymentConfigured,
  resolveMemberBadgeApplicationPaymentConfig,
} from "./member-badge-application-payment.config.js";
import {
  MEMBER_BADGE_APPLICATION_AMOUNT_CENTS,
  MEMBER_BADGE_APPLICATION_CURRENCY,
  MEMBER_BADGE_APPLICATION_DELIVERY_LABEL,
  MEMBER_BADGE_APPLICATION_PAYMENT_UNAVAILABLE_MESSAGE,
  MEMBER_BADGE_APPLICATION_PRICE_LABEL,
} from "./member-badge-application.constants.js";
import {
  MemberBadgeApplicationAccessDeniedError,
  MemberBadgeApplicationConflictError,
  MemberBadgeApplicationNotFoundError,
  MemberBadgeApplicationUnavailableError,
} from "./member-badge-application.errors.js";
import { toMemberBadgeApplicationDetail } from "./member-badge-application.projection.js";
import {
  buildMemberBadgeApplicationRecord,
  findActiveUnpaidMemberBadgeApplicationByUserId,
  findCurrentMemberBadgeApplicationByUserId,
  findMemberBadgeApplicationById,
  insertMemberBadgeApplication,
  updateMemberBadgeApplicationShipping,
} from "./member-badge-application.repository.js";
import { validateMemberBadgeApplicationSaveBody } from "./member-badge-application.validation.js";

export async function assertMemberBadgeApplicationEligible(userId: string): Promise<{
  userId: string;
  participantId: string;
  membershipId: string;
  memberNumberSnapshot: string;
}> {
  const user = await findAuthUserById(userId);

  if (!user) {
    throw new MemberBadgeApplicationAccessDeniedError("Authentication session is invalid.");
  }

  if (user.status !== "active") {
    throw new MemberBadgeApplicationAccessDeniedError("Your account access is suspended.");
  }

  if (user.emailVerificationStatus !== "verified") {
    throw new MemberBadgeApplicationAccessDeniedError(
      "Confirm your email before applying for the Member Badge.",
    );
  }

  const membership = await findMembershipByUserId(userId);

  if (!membership || membership.status !== "active_member" || !membership.memberNumber) {
    throw new MemberBadgeApplicationAccessDeniedError(
      "The official Member Badge is available only to active Humanity Union Members with a Member Number.",
    );
  }

  return {
    userId,
    participantId: user.memberId,
    membershipId: membership.membershipId,
    memberNumberSnapshot: membership.memberNumber,
  };
}

export async function getMemberBadgeApplicationAvailability(input: {
  userId: string | null;
}): Promise<MemberBadgeApplicationAvailability> {
  const paymentConfigured = isMemberBadgeApplicationPaymentConfigured(
    resolveMemberBadgeApplicationPaymentConfig(),
  );
  const base = {
    priceLabel: MEMBER_BADGE_APPLICATION_PRICE_LABEL,
    deliveryLabel: MEMBER_BADGE_APPLICATION_DELIVERY_LABEL,
    amountCents: MEMBER_BADGE_APPLICATION_AMOUNT_CENTS,
    currency: MEMBER_BADGE_APPLICATION_CURRENCY,
    paymentConfigured,
  };

  if (!input.userId) {
    return {
      ...base,
      eligible: false,
      reason: "Sign in as an active Member to apply for the Member Badge.",
    };
  }

  try {
    await assertMemberBadgeApplicationEligible(input.userId);
    return { ...base, eligible: true, reason: null };
  } catch (error) {
    if (error instanceof MemberBadgeApplicationAccessDeniedError) {
      return { ...base, eligible: false, reason: error.message };
    }
    throw error;
  }
}

export async function getCurrentMemberBadgeApplicationForUser(
  userId: string,
): Promise<MemberBadgeApplicationDetail | null> {
  await assertMemberBadgeApplicationEligible(userId);
  const existing = await findCurrentMemberBadgeApplicationByUserId(userId);
  return existing ? toMemberBadgeApplicationDetail(existing) : null;
}

async function upsertUnpaidApplication(input: {
  userId: string;
  shippingAddress: MemberBadgeApplicationShippingAddress;
  applicationStatus: "draft" | "submitted";
}): Promise<MemberBadgeApplicationDetail> {
  const eligibility = await assertMemberBadgeApplicationEligible(input.userId);
  const existing = await findActiveUnpaidMemberBadgeApplicationByUserId(input.userId);

  if (existing) {
    if (existing.paymentStatus !== "unpaid") {
      throw new MemberBadgeApplicationConflictError(
        "This Member Badge Application can no longer be edited.",
      );
    }

    const updated = await updateMemberBadgeApplicationShipping({
      applicationId: existing.applicationId,
      userId: input.userId,
      shippingAddress: input.shippingAddress,
      applicationStatus: input.applicationStatus,
    });

    if (!updated) {
      throw new MemberBadgeApplicationNotFoundError(
        "Unable to update Member Badge Application.",
      );
    }

    recordAdministrationAuditBestEffort({
      actorParticipantId: eligibility.participantId,
      action: "member_badge.application.save",
      targetType: "member_badge_application",
      targetId: updated.applicationId,
      afterSummary: `status=${updated.applicationStatus};payment=${updated.paymentStatus};updated=1`,
    });

    return toMemberBadgeApplicationDetail(updated);
  }

  const created = buildMemberBadgeApplicationRecord({
    userId: eligibility.userId,
    participantId: eligibility.participantId,
    membershipId: eligibility.membershipId,
    memberNumberSnapshot: eligibility.memberNumberSnapshot,
    shippingAddress: input.shippingAddress,
    applicationStatus: input.applicationStatus,
  });

  await insertMemberBadgeApplication(created);

  recordAdministrationAuditBestEffort({
    actorParticipantId: eligibility.participantId,
    action: "member_badge.application.save",
    targetType: "member_badge_application",
    targetId: created.applicationId,
    afterSummary: `status=${created.applicationStatus};payment=${created.paymentStatus};created=1`,
  });

  return toMemberBadgeApplicationDetail(created);
}

export async function saveMemberBadgeApplicationForUser(
  userId: string,
  body: unknown,
): Promise<MemberBadgeApplicationDetail> {
  const { shippingAddress } = validateMemberBadgeApplicationSaveBody(body);
  return upsertUnpaidApplication({
    userId,
    shippingAddress,
    applicationStatus: "draft",
  });
}

/**
 * Pack 25C — persist application and create Stripe/mock Checkout Session.
 * Returns checkoutReady + checkoutUrl when payment is configured.
 */
export async function continueMemberBadgeApplicationPaymentForUser(
  userId: string,
  body: unknown,
): Promise<MemberBadgeApplicationPaymentBoundary> {
  const { shippingAddress } = validateMemberBadgeApplicationSaveBody(body);
  const application = await upsertUnpaidApplication({
    userId,
    shippingAddress,
    applicationStatus: "submitted",
  });

  if (!isMemberBadgeApplicationPaymentConfigured()) {
    return {
      application: {
        ...application,
        paymentSetupMessage: MEMBER_BADGE_APPLICATION_PAYMENT_UNAVAILABLE_MESSAGE,
      },
      checkoutReady: false,
      checkoutUrl: null,
      sessionId: null,
      message: MEMBER_BADGE_APPLICATION_PAYMENT_UNAVAILABLE_MESSAGE,
    };
  }

  try {
    return await createMemberBadgeApplicationCheckoutSession({
      userId,
      applicationId: application.applicationId,
    });
  } catch (error) {
    if (error instanceof MemberBadgeApplicationUnavailableError) {
      return {
        application: {
          ...application,
          paymentSetupMessage: error.message,
        },
        checkoutReady: false,
        checkoutUrl: null,
        sessionId: null,
        message: error.message,
      };
    }
    throw error;
  }
}

export async function getMemberBadgeApplicationByIdForUser(input: {
  userId: string;
  applicationId: string;
}): Promise<MemberBadgeApplicationDetail> {
  await assertMemberBadgeApplicationEligible(input.userId);
  const record = await findMemberBadgeApplicationById(input.applicationId);

  if (!record || record.userId !== input.userId) {
    throw new MemberBadgeApplicationNotFoundError();
  }

  return toMemberBadgeApplicationDetail(record);
}
