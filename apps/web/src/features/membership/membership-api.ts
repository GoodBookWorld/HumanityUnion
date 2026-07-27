import type {
  MembershipApplicationInput,
  MembershipCheckoutSessionPayload,
  MembershipMePayload,
  MembershipStatusPayload,
} from "@hu/types";

import { apiRequest } from "../../lib/api-client";

export async function getMembershipMe(): Promise<MembershipMePayload> {
  return apiRequest<MembershipMePayload>("/api/v1/membership/me");
}

export async function getMembershipStatus(): Promise<MembershipStatusPayload> {
  return apiRequest<MembershipStatusPayload>("/api/v1/membership/status");
}

export async function submitMembershipApplication(
  application: MembershipApplicationInput,
): Promise<MembershipMePayload> {
  return apiRequest<MembershipMePayload>("/api/v1/membership/application", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(application),
  });
}

export async function updateMembershipApplication(
  application: MembershipApplicationInput,
): Promise<MembershipMePayload> {
  return apiRequest<MembershipMePayload>("/api/v1/membership/application", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(application),
  });
}

export async function startMembershipContribution(): Promise<MembershipCheckoutSessionPayload> {
  return apiRequest<MembershipCheckoutSessionPayload>("/api/v1/membership/checkout", {
    method: "POST",
  });
}
