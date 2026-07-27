import type { ParticipationArea, ParticipationAreaTransition } from "@hu/types";

import { apiRequest } from "../../lib/api-client";

export interface ParticipationAreaEligibilityPreview {
  world: boolean;
  country?: string;
  region?: string;
  community?: string;
}

export interface ParticipationAreaWorkspaceResponse {
  activeArea: ParticipationArea | null;
  pendingTransition: ParticipationAreaTransition | null;
  labels: {
    country?: string;
    region?: string;
    community?: string;
  };
  pendingLabels?: {
    country?: string;
    region?: string;
    community?: string;
  };
  eligibilityPreview: ParticipationAreaEligibilityPreview;
  transitionPolicy: {
    delayDays: number;
    explanation: string;
  };
  geographyOptions: {
    countries: Array<{ slug: string; label: string }>;
    regions: Array<{ slug: string; label: string; countrySlug: string }>;
    communities?: Array<{
      slug: string;
      label: string;
      countrySlug: string;
      regionSlug: string;
    }>;
  };
}

export interface ParticipationAreaInput {
  countrySlug: string;
  regionSlug?: string;
  communitySlug?: string;
  regionLabel?: string;
}

export async function getMyParticipationAreaWorkspace(): Promise<ParticipationAreaWorkspaceResponse> {
  return apiRequest<ParticipationAreaWorkspaceResponse>("/api/v1/participation-area/me");
}

export async function createMyParticipationArea(
  input: ParticipationAreaInput,
): Promise<ParticipationAreaWorkspaceResponse> {
  return apiRequest<ParticipationAreaWorkspaceResponse>("/api/v1/participation-area/me", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });
}

export async function requestMyParticipationAreaTransition(
  input: ParticipationAreaInput,
): Promise<ParticipationAreaWorkspaceResponse> {
  return apiRequest<ParticipationAreaWorkspaceResponse>(
    "/api/v1/participation-area/me/transition",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    },
  );
}

export async function cancelMyParticipationAreaTransition(): Promise<ParticipationAreaWorkspaceResponse> {
  return apiRequest<ParticipationAreaWorkspaceResponse>(
    "/api/v1/participation-area/me/transition/cancel",
    {
      method: "POST",
    },
  );
}
