import type { BetaOnboardingItem, PlatformConfigPublic, WorkspaceReadiness } from "@hu/types";

import { apiRequest } from "../../lib/api-client";

export async function getPlatformConfig(): Promise<PlatformConfigPublic> {
  return apiRequest<PlatformConfigPublic>("/api/v1/platform/config");
}

export async function getBetaOnboarding(): Promise<BetaOnboardingItem[]> {
  const result = await apiRequest<{ items: BetaOnboardingItem[] }>("/api/v1/platform/onboarding");
  return result.items;
}

export async function getWorkspaceReadiness(): Promise<WorkspaceReadiness> {
  return apiRequest<WorkspaceReadiness>("/api/v1/platform/readiness/workspace");
}
