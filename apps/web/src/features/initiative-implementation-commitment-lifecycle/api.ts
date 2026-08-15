import type {
  InitiativeImplementationCommitment,
  InitiativeImplementationCommitmentCandidate,
  InitiativeImplementationCommitmentLifecycleDraft,
  InitiativeImplementationCommitmentLifecycleDraftContext,
  InitiativeImplementationCommitmentPackage,
} from "@hu/types";

import { apiRequest } from "../../lib/api-client";

export async function getInitiativeImplementationCommitmentWorkspace(
  initiativeId: string,
): Promise<InitiativeImplementationCommitmentLifecycleDraftContext> {
  return apiRequest<InitiativeImplementationCommitmentLifecycleDraftContext>(
    `/api/v1/initiative-implementation-commitment-lifecycle/initiative/${encodeURIComponent(initiativeId)}/workspace`,
  );
}

export async function generateInitiativeImplementationCommitmentDraft(
  initiativeId: string,
): Promise<InitiativeImplementationCommitmentLifecycleDraft> {
  return apiRequest<InitiativeImplementationCommitmentLifecycleDraft>(
    `/api/v1/initiative-implementation-commitment-lifecycle/initiative/${encodeURIComponent(initiativeId)}/draft/generate`,
    { method: "POST" },
  );
}

export async function saveInitiativeImplementationCommitmentDraft(
  initiativeId: string,
  input: Partial<
    Pick<InitiativeImplementationCommitmentLifecycleDraft, "title" | "summary"> & {
      candidates: InitiativeImplementationCommitmentCandidate[];
    }
  >,
): Promise<InitiativeImplementationCommitmentLifecycleDraft> {
  return apiRequest<InitiativeImplementationCommitmentLifecycleDraft>(
    `/api/v1/initiative-implementation-commitment-lifecycle/initiative/${encodeURIComponent(initiativeId)}/draft`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    },
  );
}

export async function publishInitiativeImplementationCommitmentStage(
  initiativeId: string,
): Promise<InitiativeImplementationCommitmentPackage> {
  return apiRequest<InitiativeImplementationCommitmentPackage>(
    `/api/v1/initiative-implementation-commitment-lifecycle/initiative/${encodeURIComponent(initiativeId)}/publish`,
    { method: "POST" },
  );
}

export async function acceptInitiativeImplementationCommitment(
  commitmentId: string,
): Promise<InitiativeImplementationCommitment> {
  return apiRequest<InitiativeImplementationCommitment>(
    `/api/v1/initiative-implementation-commitment-lifecycle/commitments/${encodeURIComponent(commitmentId)}/accept`,
    { method: "POST" },
  );
}

export async function declineInitiativeImplementationCommitment(
  commitmentId: string,
): Promise<InitiativeImplementationCommitment> {
  return apiRequest<InitiativeImplementationCommitment>(
    `/api/v1/initiative-implementation-commitment-lifecycle/commitments/${encodeURIComponent(commitmentId)}/decline`,
    { method: "POST" },
  );
}

export async function listMyProposedInitiativeImplementationCommitments(): Promise<
  InitiativeImplementationCommitment[]
> {
  return apiRequest<InitiativeImplementationCommitment[]>(
    "/api/v1/initiative-implementation-commitment-lifecycle/mine/proposed",
  );
}
