import {
  MEMBER_BADGE_APPLICATION_AMOUNT_CENTS,
  MEMBER_BADGE_APPLICATION_CURRENCY,
  MEMBER_BADGE_PAYMENT_PURPOSE,
} from "./member-badge-application.constants.js";
import { recordAdministrationAuditBestEffort } from "../administration/audit.service.js";
import { projectAdminNotificationForAdmins } from "../admin-notifications/admin-notification.service.js";
import { findAuthUserById } from "../auth/auth-user.repository.js";
import {
  buildMembershipWebhookEventRecord,
  findMembershipWebhookEventByStripeEventId,
  insertMembershipWebhookEvent,
  markMembershipWebhookEventProcessed,
} from "../membership-payment/membership-webhook-event.repository.js";
import { MemberBadgeApplicationValidationError } from "./member-badge-application.errors.js";
import {
  findMemberBadgeApplicationByCheckoutSessionId,
  findMemberBadgeApplicationById,
  markMemberBadgeApplicationPaid,
  markMemberBadgeApplicationRefunded,
} from "./member-badge-application.repository.js";

function extractMetadata(object: Record<string, unknown>): Record<string, string> {
  return (object.metadata as Record<string, string> | undefined) ?? {};
}

function resolveAmountTotalCents(object: Record<string, unknown>): number | null {
  if (typeof object.amount_total === "number") {
    return object.amount_total;
  }
  if (typeof object.amount_received === "number") {
    return object.amount_received;
  }
  return null;
}

function resolveCurrency(object: Record<string, unknown>): string | null {
  if (typeof object.currency === "string") {
    return object.currency.toLowerCase();
  }
  return null;
}

async function emitPaidAdminNotification(input: {
  applicationId: string;
  participantId: string;
  stripeEventId: string;
  displayName: string;
}): Promise<void> {
  await projectAdminNotificationForAdmins({
    type: "member_badge_order_paid",
    title: "Member badge order paid",
    actorLabel: input.displayName,
    targetLabel: `Application ${input.applicationId.slice(0, 8)}`,
    targetHref: `/admin/participants?view=member_badge_orders&badgeApplicationId=${input.applicationId}`,
    sourceEventId: `member_badge_order_paid:${input.applicationId}:${input.stripeEventId}`,
    dedupeKey: `member_badge_order_paid:${input.applicationId}`,
  });
}

async function confirmMemberBadgeApplicationPaid(input: {
  sessionObject: Record<string, unknown>;
  stripeEventId: string;
}): Promise<{ applicationId: string; userId: string; alreadyPaid: boolean }> {
  const metadata = extractMetadata(input.sessionObject);
  const paymentPurpose = metadata.paymentPurpose;

  if (paymentPurpose !== MEMBER_BADGE_PAYMENT_PURPOSE) {
    throw new MemberBadgeApplicationValidationError("Unexpected payment purpose.");
  }

  const applicationId = metadata.applicationId;
  const internalUserId = metadata.internalUserId;

  if (!applicationId) {
    throw new MemberBadgeApplicationValidationError("applicationId metadata is required.");
  }

  const application =
    (await findMemberBadgeApplicationById(applicationId)) ??
    (typeof input.sessionObject.id === "string"
      ? await findMemberBadgeApplicationByCheckoutSessionId(String(input.sessionObject.id))
      : null);

  if (!application) {
    throw new MemberBadgeApplicationValidationError("Member Badge Application not found.");
  }

  if (internalUserId && application.userId !== internalUserId) {
    throw new MemberBadgeApplicationValidationError(
      "Member Badge Application participant mismatch.",
    );
  }

  if (application.paymentStatus === "paid") {
    return {
      applicationId: application.applicationId,
      userId: application.userId,
      alreadyPaid: true,
    };
  }

  if (application.applicationStatus === "cancelled") {
    throw new MemberBadgeApplicationValidationError(
      "Cancelled Member Badge Application cannot be paid.",
    );
  }

  const amountTotal = resolveAmountTotalCents(input.sessionObject);
  const currency = resolveCurrency(input.sessionObject);

  if (amountTotal !== null && amountTotal !== MEMBER_BADGE_APPLICATION_AMOUNT_CENTS) {
    throw new MemberBadgeApplicationValidationError(
      "Member Badge payment amount does not match CA$28.",
    );
  }

  if (currency !== null && currency !== MEMBER_BADGE_APPLICATION_CURRENCY) {
    throw new MemberBadgeApplicationValidationError(
      "Member Badge payment currency must be CAD.",
    );
  }

  const paymentStatus = input.sessionObject.payment_status;
  if (paymentStatus !== undefined && paymentStatus !== "paid") {
    throw new MemberBadgeApplicationValidationError("Checkout Session is not paid.");
  }

  const paidAt = new Date(
    typeof input.sessionObject.created === "number"
      ? input.sessionObject.created * 1000
      : Date.now(),
  ).toISOString();

  const paymentIntentId =
    typeof input.sessionObject.payment_intent === "string"
      ? input.sessionObject.payment_intent
      : typeof input.sessionObject.id === "string" &&
          String(input.sessionObject.object ?? "") === "payment_intent"
        ? String(input.sessionObject.id)
        : null;

  const updated = await markMemberBadgeApplicationPaid({
    applicationId: application.applicationId,
    paidAt,
    stripeCheckoutSessionId:
      typeof input.sessionObject.id === "string" &&
      String(input.sessionObject.object ?? "checkout.session") !== "payment_intent"
        ? String(input.sessionObject.id)
        : application.stripeCheckoutSessionId,
    stripePaymentIntentId: paymentIntentId,
    lastStripeEventId: input.stripeEventId,
  });

  if (!updated) {
    const refreshed = await findMemberBadgeApplicationById(application.applicationId);
    if (refreshed?.paymentStatus === "paid") {
      return {
        applicationId: application.applicationId,
        userId: application.userId,
        alreadyPaid: true,
      };
    }
    throw new MemberBadgeApplicationValidationError(
      "Unable to mark Member Badge Application as paid.",
    );
  }

  const user = await findAuthUserById(updated.userId);
  const displayName = user?.displayName?.trim() || "Member";

  recordAdministrationAuditBestEffort({
    actorParticipantId: updated.participantId,
    action: "member_badge.payment.completed",
    targetType: "member_badge_application",
    targetId: updated.applicationId,
    afterSummary: `payment=paid;fulfillment=awaiting_fulfillment;amountCents=${MEMBER_BADGE_APPLICATION_AMOUNT_CENTS};currency=${MEMBER_BADGE_APPLICATION_CURRENCY}`,
  });

  await emitPaidAdminNotification({
    applicationId: updated.applicationId,
    participantId: updated.participantId,
    stripeEventId: input.stripeEventId,
    displayName,
  });

  return {
    applicationId: updated.applicationId,
    userId: updated.userId,
    alreadyPaid: false,
  };
}

export async function processMemberBadgeApplicationStripeEvent(event: {
  id: string;
  type: string;
  api_version: string | null;
  livemode: boolean;
  data: {
    object: Record<string, unknown>;
  };
}): Promise<{ processed: boolean; ignored: boolean }> {
  const existing = await findMembershipWebhookEventByStripeEventId(event.id);

  if (existing?.processingStatus === "processed") {
    return { processed: true, ignored: true };
  }

  if (!existing) {
    await insertMembershipWebhookEvent(
      buildMembershipWebhookEventRecord({
        stripeEventId: event.id,
        stripeEventType: event.type,
        stripeApiVersion: event.api_version,
        livemode: event.livemode,
        processingStatus: "received",
      }),
    );
  }

  const supported = new Set([
    "checkout.session.completed",
    "payment_intent.succeeded",
    "charge.refunded",
  ]);

  if (!supported.has(event.type)) {
    await markMembershipWebhookEventProcessed(event.id, {
      processingStatus: "ignored",
    });
    return { processed: false, ignored: true };
  }

  try {
    if (event.type === "checkout.session.completed" || event.type === "payment_intent.succeeded") {
      const metadata = extractMetadata(event.data.object);
      if (!metadata.applicationId) {
        await markMembershipWebhookEventProcessed(event.id, {
          processingStatus: "ignored",
        });
        return { processed: false, ignored: true };
      }

      const result = await confirmMemberBadgeApplicationPaid({
        sessionObject: event.data.object,
        stripeEventId: event.id,
      });

      await markMembershipWebhookEventProcessed(event.id, {
        processingStatus: "processed",
        membershipId: undefined,
        contributionId: result.applicationId,
        userId: result.userId,
      });

      return { processed: true, ignored: result.alreadyPaid };
    }

    if (event.type === "charge.refunded") {
      const metadata = extractMetadata(event.data.object);
      const applicationId = metadata.applicationId;
      if (!applicationId) {
        await markMembershipWebhookEventProcessed(event.id, {
          processingStatus: "ignored",
        });
        return { processed: false, ignored: true };
      }

      await markMemberBadgeApplicationRefunded({
        applicationId,
        lastStripeEventId: event.id,
      });

      await markMembershipWebhookEventProcessed(event.id, {
        processingStatus: "processed",
        contributionId: applicationId,
      });

      return { processed: true, ignored: false };
    }

    await markMembershipWebhookEventProcessed(event.id, {
      processingStatus: "ignored",
    });
    return { processed: false, ignored: true };
  } catch (error) {
    await markMembershipWebhookEventProcessed(event.id, {
      processingStatus: "failed",
    });
    throw error;
  }
}

/** Test helper — simulate Pack 25C Checkout completion for mock provider. */
export async function simulateMockMemberBadgeApplicationCheckoutCompleted(input: {
  applicationId: string;
  userId: string;
  sessionId: string;
}): Promise<void> {
  await processMemberBadgeApplicationStripeEvent({
    id: `mock_evt_badge_app_${input.applicationId}_${Date.now()}`,
    type: "checkout.session.completed",
    api_version: "mock",
    livemode: false,
    data: {
      object: {
        id: input.sessionId,
        object: "checkout.session",
        payment_status: "paid",
        amount_total: MEMBER_BADGE_APPLICATION_AMOUNT_CENTS,
        currency: MEMBER_BADGE_APPLICATION_CURRENCY,
        payment_intent: `mock_pi_${input.applicationId}`,
        created: Math.floor(Date.now() / 1000),
        metadata: {
          paymentPurpose: MEMBER_BADGE_PAYMENT_PURPOSE,
          applicationId: input.applicationId,
          internalUserId: input.userId,
        },
      },
    },
  });
}
