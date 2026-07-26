import {
  MEMBER_BADGE_PAYMENT_PURPOSE,
  MEMBERSHIP_PAYMENT_PURPOSE,
} from "../member-badge-contribution/member-badge-contribution.constants.js";
import { processMemberBadgeStripeEvent } from "../member-badge-contribution/member-badge-webhook.service.js";
import { processMembershipStripeEvent } from "./membership-payment.service.js";

function extractPaymentPurpose(object: Record<string, unknown>): string | null {
  const metadata = (object.metadata as Record<string, string> | undefined) ?? {};
  return metadata.paymentPurpose ?? null;
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
  const purpose = extractPaymentPurpose(event.data.object);

  if (purpose === MEMBER_BADGE_PAYMENT_PURPOSE) {
    return processMemberBadgeStripeEvent(event);
  }

  if (purpose === MEMBERSHIP_PAYMENT_PURPOSE || purpose === null) {
    return processMembershipStripeEvent(event);
  }

  return { processed: false, ignored: true };
}
