import type {
  CivicActionPackageMetrics,
  PublicCivicActionPackageListItem,
  PublicCivicActionPackageProjection,
} from "@hu/types";

import { apiRequest } from "../../lib/api-client";

export interface PublicCivicActionPackagesResponse {
  packages: PublicCivicActionPackageListItem[];
  metrics: CivicActionPackageMetrics;
}

export async function getPublicCivicActionPackage(
  capId: string,
): Promise<PublicCivicActionPackageProjection | null> {
  try {
    return await apiRequest<PublicCivicActionPackageProjection>(
      `/api/v1/public/civic-action-packages/${encodeURIComponent(capId)}`,
    );
  } catch {
    return null;
  }
}

export async function getPublicCivicActionPackageForDecision(
  decisionId: string,
): Promise<PublicCivicActionPackageProjection | null> {
  try {
    return await apiRequest<PublicCivicActionPackageProjection>(
      `/api/v1/public/initiative-collective-decisions/${encodeURIComponent(decisionId)}/civic-action-package`,
    );
  } catch {
    return null;
  }
}

export async function listPublicCivicActionPackagesForInitiative(
  initiativeId: string,
): Promise<PublicCivicActionPackagesResponse> {
  const payload = await apiRequest<PublicCivicActionPackageListItem[]>(
    `/api/v1/public/initiatives/${encodeURIComponent(initiativeId)}/civic-action-packages`,
  );

  return {
    packages: payload,
    metrics: {
      capCount: payload.length,
      issuedCapCount: payload.filter((capPackage) => capPackage.status === "issued").length,
      archivedCapCount: payload.filter((capPackage) => capPackage.status === "archived").length,
    },
  };
}
