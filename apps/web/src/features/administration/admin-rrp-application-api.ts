import type {
  AdminRrpApplicationDetail,
  AdminRrpApplicationListItem,
  AdminRrpApplicationReviewDecision,
  RrpConfirmAppointmentResult,
} from "@hu/types";

import { apiRequest } from "../../lib/api-client";

export interface ListAdminRrpApplicationsQuery {
  participantId?: string;
  representCountryCode?: string;
  fundingModel?: "SELF" | "PARTIAL" | "FULL";
  status?: string;
  limit?: number;
  offset?: number;
}

export interface AdminRrpApplicationsListResponse {
  readonly items: readonly AdminRrpApplicationListItem[];
  readonly total: number;
  readonly limit: number;
  readonly offset: number;
}

export async function listAdminRrpApplications(
  query: ListAdminRrpApplicationsQuery = {},
): Promise<AdminRrpApplicationsListResponse> {
  const params = new URLSearchParams();
  if (query.participantId?.trim()) {
    params.set("participantId", query.participantId.trim());
  }
  if (query.representCountryCode?.trim()) {
    params.set("representCountryCode", query.representCountryCode.trim());
  }
  if (query.fundingModel) {
    params.set("fundingModel", query.fundingModel);
  }
  if (query.status) {
    params.set("status", query.status);
  }
  if (query.limit !== undefined) {
    params.set("limit", String(query.limit));
  }
  if (query.offset !== undefined) {
    params.set("offset", String(query.offset));
  }
  const suffix = params.toString();
  return apiRequest<AdminRrpApplicationsListResponse>(
    `/api/v1/admin/rrp-applications${suffix ? `?${suffix}` : ""}`,
  );
}

export async function getAdminRrpApplication(
  applicationId: string,
): Promise<AdminRrpApplicationDetail> {
  return apiRequest<AdminRrpApplicationDetail>(
    `/api/v1/admin/rrp-applications/${encodeURIComponent(applicationId)}`,
  );
}

export async function reviewAdminRrpApplication(input: {
  applicationId: string;
  decision: Exclude<AdminRrpApplicationReviewDecision, "approve">;
  expectedRevision: number;
  note?: string;
}): Promise<AdminRrpApplicationDetail> {
  return apiRequest<AdminRrpApplicationDetail>(
    `/api/v1/admin/rrp-applications/${encodeURIComponent(input.applicationId)}/review`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        decision: input.decision,
        expectedRevision: input.expectedRevision,
        ...(input.note !== undefined ? { note: input.note } : {}),
      }),
    },
  );
}

/** Approve + platform designation — never use status-only review approve. */
export async function confirmAdminRrpAppointment(input: {
  applicationId: string;
  expectedRevision: number;
}): Promise<RrpConfirmAppointmentResult> {
  return apiRequest<RrpConfirmAppointmentResult>(
    `/api/v1/admin/rrp-applications/${encodeURIComponent(input.applicationId)}/confirm-appointment`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ expectedRevision: input.expectedRevision }),
    },
  );
}
