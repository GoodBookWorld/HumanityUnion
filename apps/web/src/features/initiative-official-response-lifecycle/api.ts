import type {
  InitiativeOfficialResponseCandidate,
  InitiativeOfficialResponseLifecycleDraft,
  InitiativeOfficialResponseLifecycleDraftContext,
  InitiativeOfficialResponsePackage,
  InitiativeOfficialResponseRecord,
} from "@hu/types";

import { apiRequest } from "../../lib/api-client";

export async function getInitiativeOfficialResponseWorkspace(
  initiativeId: string,
): Promise<InitiativeOfficialResponseLifecycleDraftContext> {
  return apiRequest<InitiativeOfficialResponseLifecycleDraftContext>(
    `/api/v1/initiative-official-response-lifecycle/initiative/${encodeURIComponent(initiativeId)}/workspace`,
  );
}

export async function generateInitiativeOfficialResponseDraft(
  initiativeId: string,
): Promise<InitiativeOfficialResponseLifecycleDraft> {
  return apiRequest<InitiativeOfficialResponseLifecycleDraft>(
    `/api/v1/initiative-official-response-lifecycle/initiative/${encodeURIComponent(initiativeId)}/draft/generate`,
    { method: "POST" },
  );
}

export async function saveInitiativeOfficialResponseDraft(
  initiativeId: string,
  input: Partial<
    Pick<InitiativeOfficialResponseLifecycleDraft, "title" | "summary"> & {
      candidates: InitiativeOfficialResponseCandidate[];
    }
  >,
): Promise<InitiativeOfficialResponseLifecycleDraft> {
  return apiRequest<InitiativeOfficialResponseLifecycleDraft>(
    `/api/v1/initiative-official-response-lifecycle/initiative/${encodeURIComponent(initiativeId)}/draft`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    },
  );
}

export async function publishInitiativeOfficialResponseStage(
  initiativeId: string,
): Promise<InitiativeOfficialResponsePackage> {
  return apiRequest<InitiativeOfficialResponsePackage>(
    `/api/v1/initiative-official-response-lifecycle/initiative/${encodeURIComponent(initiativeId)}/publish`,
    { method: "POST" },
  );
}

export async function listPublishedInitiativeOfficialResponses(
  initiativeId: string,
): Promise<InitiativeOfficialResponseRecord[]> {
  return apiRequest<InitiativeOfficialResponseRecord[]>(
    `/api/v1/initiative-official-response-lifecycle/initiative/${encodeURIComponent(initiativeId)}/published`,
  );
}

export async function getInitiativeOfficialResponsePackage(packageId: string): Promise<{
  package: InitiativeOfficialResponsePackage;
  responses: InitiativeOfficialResponseRecord[];
}> {
  return apiRequest<{
    package: InitiativeOfficialResponsePackage;
    responses: InitiativeOfficialResponseRecord[];
  }>(`/api/v1/initiative-official-response-lifecycle/packages/${encodeURIComponent(packageId)}`);
}
