import {
  MEMBER_BADGE_PAYMENT_PURPOSE,
  MEMBERSHIP_PAYMENT_PURPOSE,
} from "../member-badge-contribution/member-badge-contribution.constants.js";
import { resolveMemberBadgeContributionConfig } from "../member-badge-contribution/member-badge-contribution.config.js";
import { processMemberBadgeStripeEvent } from "../member-badge-contribution/member-badge-webhook.service.js";
import { processMemberBadgeApplicationStripeEvent } from "../member-badge-application/member-badge-application-webhook.service.js";
import { MembershipPaymentValidationError } from "./membership-payment.errors.js";
import { processMembershipStripeEvent } from "./membership-payment.service.js";
import { assertStripeLivemodeMatchesEnvironment } from "./stripe-livemode.guard.js";

const SUPPORTED_PAYMENT_PURPOSES = new Set<string>([
  MEMBERSHIP_PAYMENT_PURPOSE,
  MEMBER_BADGE_PAYMENT_PURPOSE,
]);

type SupportedStripePaymentPurpose =
  | typeof MEMBERSHIP_PAYMENT_PURPOSE
  | typeof MEMBER_BADGE_PAYMENT_PURPOSE;

function extractPaymentPurpose(object: Record<string, unknown>): string | null {
  const metadata = (object.metadata as Record<string, string> | undefined) ?? {};
  const purpose = metadata.paymentPurpose;
  return typeof purpose === "string" && purpose.trim() ? purpose.trim() : null;
}

function extractMetadata(object: Record<string, unknown>): Record<string, string> {
  return (object.metadata as Record<string, string> | undefined) ?? {};
}

/**
 * Pack 26A — require an explicit supported paymentPurpose.
 * Missing/unknown purpose must not fall through to Membership activation.
 */
export function assertSupportedStripePaymentPurpose(
  purpose: string | null,
): asserts purpose is SupportedStripePaymentPurpose {
  if (purpose === null) {
    throw new MembershipPaymentValidationError(
      "Stripe webhook paymentPurpose metadata is required.",
    );
  }

  if (!SUPPORTED_PAYMENT_PURPOSES.has(purpose)) {
    throw new MembershipPaymentValidationError(
      "Stripe webhook paymentPurpose is not a supported payment purpose.",
    );
  }
}

export async function dispatchStripeMembershipWebhookEvent(event: {
  id: string;
  type: string;
  api_version: string | null;
  livemode: boolean;
  data: {
    object: Record<string, unknown>;
  };
}): Promise<{ processed: boolean; ignored: boolean }> {
  assertStripeLivemodeMatchesEnvironment(event.livemode);

  const purpose = extractPaymentPurpose(event.data.object);
  assertSupportedStripePaymentPurpose(purpose);

  if (purpose === MEMBER_BADGE_PAYMENT_PURPOSE) {
    const metadata = extractMetadata(event.data.object);

    // Pack 25C — canonical application Checkout carries applicationId.
    if (metadata.applicationId) {
      return processMemberBadgeApplicationStripeEvent(event);
    }

    // Legacy TASK-094 contribution Checkout — fail closed unless explicitly enabled.
    const legacyConfig = resolveMemberBadgeContributionConfig();
    if (!legacyConfig.enabled) {
      throw new MembershipPaymentValidationError(
        "Legacy Member Badge contribution webhooks are disabled (MEMBER_BADGE_CONTRIBUTIONS_ENABLED=false).",
      );
    }

    return processMemberBadgeStripeEvent(event);
  }

  if (purpose === MEMBERSHIP_PAYMENT_PURPOSE) {
    return processMembershipStripeEvent(event);
  }

  // Unreachable when assertSupportedStripePaymentPurpose is correct; keep fail-closed.
  throw new MembershipPaymentValidationError(
    "Stripe webhook paymentPurpose is not a supported payment purpose.",
  );
}
