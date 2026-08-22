import type {
  CountryAffiliationEntry,
  CountryAffiliationEntryType,
} from "@hu/types";

import { apiRequest } from "../../lib/api-client";

export interface ListAdminCountryPeopleQuery {
  countryCode?: string;
  entryType?: CountryAffiliationEntryType | "";
  active?: "true" | "false" | "";
}

export interface AdminCountryPeopleWriteInput {
  countryCode: string;
  entryType: CountryAffiliationEntryType;
  name: string;
  roleOrPosition?: string | null;
  imageUrl?: string | null;
  email?: string | null;
  websiteUrl?: string | null;
  sortOrder?: number;
  active?: boolean;
}

export async function listAdminCountryPeople(
  query: ListAdminCountryPeopleQuery = {},
): Promise<CountryAffiliationEntry[]> {
  const params = new URLSearchParams();
  if (query.countryCode?.trim()) {
    params.set("countryCode", query.countryCode.trim());
  }
  if (query.entryType) {
    params.set("entryType", query.entryType);
  }
  if (query.active === "true" || query.active === "false") {
    params.set("active", query.active);
  }
  const suffix = params.toString();
  return apiRequest<CountryAffiliationEntry[]>(
    `/api/v1/admin/country-people${suffix ? `?${suffix}` : ""}`,
  );
}

export async function createAdminCountryPerson(
  input: AdminCountryPeopleWriteInput,
): Promise<CountryAffiliationEntry> {
  return apiRequest<CountryAffiliationEntry>("/api/v1/admin/country-people", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export async function updateAdminCountryPerson(
  entryId: string,
  input: Partial<AdminCountryPeopleWriteInput>,
): Promise<CountryAffiliationEntry> {
  return apiRequest<CountryAffiliationEntry>(
    `/api/v1/admin/country-people/${encodeURIComponent(entryId)}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    },
  );
}

export async function activateAdminCountryPerson(
  entryId: string,
): Promise<CountryAffiliationEntry> {
  return apiRequest<CountryAffiliationEntry>(
    `/api/v1/admin/country-people/${encodeURIComponent(entryId)}/activate`,
    { method: "POST" },
  );
}

export async function deactivateAdminCountryPerson(
  entryId: string,
): Promise<CountryAffiliationEntry> {
  return apiRequest<CountryAffiliationEntry>(
    `/api/v1/admin/country-people/${encodeURIComponent(entryId)}/deactivate`,
    { method: "POST" },
  );
}

export async function deleteAdminCountryPerson(
  entryId: string,
  options: { hard?: boolean } = {},
): Promise<CountryAffiliationEntry | { entryId: string; deleted: true }> {
  const suffix = options.hard ? "?hard=true" : "";
  return apiRequest(
    `/api/v1/admin/country-people/${encodeURIComponent(entryId)}${suffix}`,
    { method: "DELETE" },
  );
}
