import type {
  MemberBadgeCheckoutSessionPayload,
  MemberBadgeContributionAvailability,
  MemberBadgeContributionDetail,
  MemberBadgeContributionSummary,
} from "@hu/types";

import { apiRequest } from "../../lib/api-client";

export async function getMemberBadgeAvailability(): Promise<MemberBadgeContributionAvailability> {
  return apiRequest<MemberBadgeContributionAvailability>(
    "/api/v1/member-badge-contributions/availability",
  );
}

export async function startMemberBadgeContribution(): Promise<MemberBadgeCheckoutSessionPayload> {
  return apiRequest<MemberBadgeCheckoutSessionPayload>(
    "/api/v1/member-badge-contributions/checkout",
    { method: "POST" },
  );
}

export async function listMemberBadgeRequests(): Promise<MemberBadgeContributionSummary[]> {
  return apiRequest<MemberBadgeContributionSummary[]>("/api/v1/member-badge-contributions/me");
}

export async function getMemberBadgeRequestDetail(
  badgeContributionId: string,
): Promise<MemberBadgeContributionDetail> {
  return apiRequest<MemberBadgeContributionDetail>(
    `/api/v1/member-badge-contributions/me/${encodeURIComponent(badgeContributionId)}`,
  );
}

export async function getMemberBadgeRequestBySession(
  sessionId: string,
): Promise<MemberBadgeContributionDetail> {
  return apiRequest<MemberBadgeContributionDetail>(
    `/api/v1/member-badge-contributions/me/session/${encodeURIComponent(sessionId)}`,
  );
}
