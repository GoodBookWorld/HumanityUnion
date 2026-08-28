import type {
  MemberBadgeApplicationAvailability,
  MemberBadgeApplicationDetail,
  MemberBadgeApplicationPaymentBoundary,
  MemberBadgeApplicationShippingAddress,
} from "@hu/types";

import { apiRequest } from "../../lib/api-client";

export async function getMemberBadgeApplicationAvailability(): Promise<MemberBadgeApplicationAvailability> {
  return apiRequest<MemberBadgeApplicationAvailability>(
    "/api/v1/member-badge-applications/availability",
  );
}

export async function getMyMemberBadgeApplication(): Promise<MemberBadgeApplicationDetail | null> {
  return apiRequest<MemberBadgeApplicationDetail | null>("/api/v1/member-badge-applications/me");
}

export async function saveMyMemberBadgeApplication(
  shippingAddress: MemberBadgeApplicationShippingAddress,
): Promise<MemberBadgeApplicationDetail> {
  return apiRequest<MemberBadgeApplicationDetail>(
    "/api/v1/member-badge-applications/me",
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ shippingAddress }),
    },
  );
}

export async function continueMyMemberBadgeApplicationPayment(
  shippingAddress: MemberBadgeApplicationShippingAddress,
): Promise<MemberBadgeApplicationPaymentBoundary> {
  return apiRequest<MemberBadgeApplicationPaymentBoundary>(
    "/api/v1/member-badge-applications/me/continue-to-payment",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ shippingAddress }),
    },
  );
}
