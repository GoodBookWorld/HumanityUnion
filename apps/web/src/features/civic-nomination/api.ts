import type {
  CivicNomination,
  CivicNominationInstitutionRole,
  PublicCivicNominationListItem,
  PublicCivicNominationProjection,
} from "@hu/types";

import { apiRequest } from "../../lib/api-client";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

export interface CivicNominationDraftPayload {
  institutionRole: CivicNominationInstitutionRole;
  nominationType: "self" | "other_person";
  nomineeName: string;
  nomineeProfileId?: string;
  countrySlug?: string;
  regionSlug?: string;
  communitySlug?: string;
  expertiseAreas: CivicNomination["expertiseAreas"];
  experienceSummary: string;
  confirmedAchievements: string;
  evidenceLinks: CivicNomination["evidenceLinks"];
  visionStatement: string;
  conflictOfInterest: CivicNomination["conflictOfInterest"];
  declarations: CivicNomination["declarations"];
}

export async function createCivicNominationDraft(
  payload: CivicNominationDraftPayload,
): Promise<CivicNomination> {
  return apiRequest<CivicNomination>("/api/v1/civic-nominations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function updateCivicNominationDraft(
  nominationId: string,
  payload: Partial<CivicNominationDraftPayload>,
): Promise<CivicNomination> {
  return apiRequest<CivicNomination>(
    `/api/v1/civic-nominations/${encodeURIComponent(nominationId)}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
  );
}

export async function submitCivicNomination(nominationId: string): Promise<CivicNomination> {
  return apiRequest<CivicNomination>(
    `/api/v1/civic-nominations/${encodeURIComponent(nominationId)}/submit`,
    { method: "POST" },
  );
}

export async function listPublicCivicNominations(filters?: {
  institutionRole?: CivicNominationInstitutionRole;
  countrySlug?: string;
}): Promise<PublicCivicNominationListItem[]> {
  const params = new URLSearchParams();

  if (filters?.institutionRole) {
    params.set("institutionRole", filters.institutionRole);
  }

  if (filters?.countrySlug) {
    params.set("countrySlug", filters.countrySlug.trim());
  }

  const query = params.toString();
  const url = `${API_BASE_URL}/api/v1/public/civic-nominations${query ? `?${query}` : ""}`;
  const response = await fetch(url, { cache: "no-store" });

  if (!response.ok) {
    return [];
  }

  const payload = (await response.json()) as {
    success: boolean;
    data: PublicCivicNominationListItem[];
  };

  return payload.success ? payload.data : [];
}

export async function getPublicCivicNomination(
  nominationId: string,
): Promise<PublicCivicNominationProjection | null> {
  const url = `${API_BASE_URL}/api/v1/public/civic-nominations/${encodeURIComponent(nominationId)}`;
  const response = await fetch(url, { cache: "no-store" });

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as {
    success: boolean;
    data: PublicCivicNominationProjection;
  };

  return payload.success ? payload.data : null;
}
