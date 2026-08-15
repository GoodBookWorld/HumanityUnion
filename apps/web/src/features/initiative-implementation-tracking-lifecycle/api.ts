import type {
  InitiativeImplementationTracking,
  InitiativeImplementationTrackingCandidate,
  InitiativeImplementationTrackingLifecycleDraft,
  InitiativeImplementationTrackingLifecycleDraftContext,
  InitiativeImplementationTrackingPackage,
} from "@hu/types";

import { apiRequest } from "../../lib/api-client";

export async function getInitiativeImplementationTrackingWorkspace(
  initiativeId: string,
): Promise<InitiativeImplementationTrackingLifecycleDraftContext> {
  return apiRequest<InitiativeImplementationTrackingLifecycleDraftContext>(
    `/api/v1/initiative-implementation-tracking-lifecycle/initiative/${encodeURIComponent(initiativeId)}/workspace`,
  );
}

export async function generateInitiativeImplementationTrackingDraft(
  initiativeId: string,
): Promise<InitiativeImplementationTrackingLifecycleDraft> {
  return apiRequest<InitiativeImplementationTrackingLifecycleDraft>(
    `/api/v1/initiative-implementation-tracking-lifecycle/initiative/${encodeURIComponent(initiativeId)}/draft/generate`,
    { method: "POST" },
  );
}

export async function saveInitiativeImplementationTrackingDraft(
  initiativeId: string,
  input: Partial<
    Pick<InitiativeImplementationTrackingLifecycleDraft, "title" | "summary"> & {
      candidates: InitiativeImplementationTrackingCandidate[];
    }
  >,
): Promise<InitiativeImplementationTrackingLifecycleDraft> {
  return apiRequest<InitiativeImplementationTrackingLifecycleDraft>(
    `/api/v1/initiative-implementation-tracking-lifecycle/initiative/${encodeURIComponent(initiativeId)}/draft`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    },
  );
}

export async function publishInitiativeImplementationTrackingStage(
  initiativeId: string,
): Promise<InitiativeImplementationTrackingPackage> {
  return apiRequest<InitiativeImplementationTrackingPackage>(
    `/api/v1/initiative-implementation-tracking-lifecycle/initiative/${encodeURIComponent(initiativeId)}/publish`,
    { method: "POST" },
  );
}

export interface UpdateInitiativeImplementationTrackingProgressInput {
  progress?: number;
  currentStatus?: string;
  notes?: string;
  evidenceReferences?: string[];
  obstacles?: string[];
  dependencies?: string[];
  startedDate?: string | null;
  actualCompletedDate?: string | null;
  summary?: string;
}

export async function updateInitiativeImplementationTrackingProgress(
  trackingId: string,
  input: UpdateInitiativeImplementationTrackingProgressInput,
): Promise<InitiativeImplementationTracking> {
  return apiRequest<InitiativeImplementationTracking>(
    `/api/v1/initiative-implementation-tracking-lifecycle/trackings/${encodeURIComponent(trackingId)}/progress`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    },
  );
}

export async function listMyActiveInitiativeImplementationTrackings(): Promise<
  InitiativeImplementationTracking[]
> {
  return apiRequest<InitiativeImplementationTracking[]>(
    "/api/v1/initiative-implementation-tracking-lifecycle/mine",
  );
}
