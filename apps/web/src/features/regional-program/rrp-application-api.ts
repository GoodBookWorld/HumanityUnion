import type { RrpApplicationDetail } from "@hu/types";
import {
  RRP_APPLICATION_CONSENT_VERSION,
  type RrpFundingModel,
} from "@hu/types";

import { apiRequest } from "../../lib/api-client";

export interface RrpApplicationDraftCreateInput {
  representCountryCode: string;
  legalFirstName?: string | null;
  legalLastName?: string | null;
  profession?: string | null;
  residenceCountryCode?: string | null;
  dateOfBirth?: string | null;
  fundingModel?: RrpFundingModel | null;
  annualRequestedAmountCad?: number | null;
  teamMemberCount?: number | null;
  relevantExperience?: string | null;
  motivation?: string | null;
}

export interface RrpApplicationDraftUpdateInput {
  expectedRevision: number;
  representCountryCode?: string;
  legalFirstName?: string | null;
  legalLastName?: string | null;
  profession?: string | null;
  residenceCountryCode?: string | null;
  dateOfBirth?: string | null;
  fundingModel?: RrpFundingModel | null;
  annualRequestedAmountCad?: number | null;
  teamMemberCount?: number | null;
  relevantExperience?: string | null;
  motivation?: string | null;
}

export async function listMyRrpApplications(): Promise<RrpApplicationDetail[]> {
  return apiRequest<RrpApplicationDetail[]>("/api/v1/rrp-applications/me");
}

export async function getMyRrpApplication(
  applicationId: string,
): Promise<RrpApplicationDetail> {
  return apiRequest<RrpApplicationDetail>(
    `/api/v1/rrp-applications/${encodeURIComponent(applicationId)}`,
  );
}

export async function createRrpApplicationDraft(
  input: RrpApplicationDraftCreateInput,
): Promise<RrpApplicationDetail> {
  return apiRequest<RrpApplicationDetail>("/api/v1/rrp-applications", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export async function updateRrpApplicationDraft(
  applicationId: string,
  input: RrpApplicationDraftUpdateInput,
): Promise<RrpApplicationDetail> {
  return apiRequest<RrpApplicationDetail>(
    `/api/v1/rrp-applications/${encodeURIComponent(applicationId)}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    },
  );
}

export async function submitRrpApplication(input: {
  applicationId: string;
  expectedRevision: number;
}): Promise<RrpApplicationDetail> {
  return apiRequest<RrpApplicationDetail>(
    `/api/v1/rrp-applications/${encodeURIComponent(input.applicationId)}/submit`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        expectedRevision: input.expectedRevision,
        consentAccepted: true,
        consentVersion: RRP_APPLICATION_CONSENT_VERSION,
      }),
    },
  );
}

export async function withdrawRrpApplication(input: {
  applicationId: string;
  expectedRevision: number;
}): Promise<RrpApplicationDetail> {
  return apiRequest<RrpApplicationDetail>(
    `/api/v1/rrp-applications/${encodeURIComponent(input.applicationId)}/withdraw`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ expectedRevision: input.expectedRevision }),
    },
  );
}
