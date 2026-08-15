import type {
  InitiativePublicImpactLifecycleDraft,
  InitiativePublicImpactLifecycleDraftContext,
  InitiativePublicImpactParticipationStatistics,
  InitiativePublicImpactReport,
  InitiativePublicImpactReportSection,
} from "@hu/types";

import { apiRequest } from "../../lib/api-client";

export async function getInitiativePublicImpactWorkspace(
  initiativeId: string,
): Promise<InitiativePublicImpactLifecycleDraftContext> {
  return apiRequest<InitiativePublicImpactLifecycleDraftContext>(
    `/api/v1/initiative-public-impact-lifecycle/initiative/${encodeURIComponent(initiativeId)}/workspace`,
  );
}

export async function generateInitiativePublicImpactDraft(
  initiativeId: string,
): Promise<InitiativePublicImpactLifecycleDraft> {
  return apiRequest<InitiativePublicImpactLifecycleDraft>(
    `/api/v1/initiative-public-impact-lifecycle/initiative/${encodeURIComponent(initiativeId)}/draft/generate`,
    { method: "POST" },
  );
}

export async function saveInitiativePublicImpactDraft(
  initiativeId: string,
  input: Partial<
    Pick<
      InitiativePublicImpactLifecycleDraft,
      | "title"
      | "officialResponsePackageId"
      | "trackingPackageId"
      | "commitmentPackageId"
      | "decisionId"
    > & {
      sections: InitiativePublicImpactReportSection[];
      participationStatistics: InitiativePublicImpactParticipationStatistics;
    }
  >,
): Promise<InitiativePublicImpactLifecycleDraft> {
  return apiRequest<InitiativePublicImpactLifecycleDraft>(
    `/api/v1/initiative-public-impact-lifecycle/initiative/${encodeURIComponent(initiativeId)}/draft`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    },
  );
}

export async function publishInitiativePublicImpactStage(
  initiativeId: string,
): Promise<InitiativePublicImpactReport> {
  return apiRequest<InitiativePublicImpactReport>(
    `/api/v1/initiative-public-impact-lifecycle/initiative/${encodeURIComponent(initiativeId)}/publish`,
    { method: "POST" },
  );
}

export async function getPublishedInitiativePublicImpactReport(
  initiativeId: string,
): Promise<InitiativePublicImpactReport | null> {
  return apiRequest<InitiativePublicImpactReport | null>(
    `/api/v1/initiative-public-impact-lifecycle/initiative/${encodeURIComponent(initiativeId)}/published`,
  );
}

export async function getInitiativePublicImpactReport(
  reportId: string,
): Promise<InitiativePublicImpactReport> {
  return apiRequest<InitiativePublicImpactReport>(
    `/api/v1/initiative-public-impact-lifecycle/reports/${encodeURIComponent(reportId)}`,
  );
}
