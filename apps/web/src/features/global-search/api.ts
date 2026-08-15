import type { CivicSearchQuery, CivicSearchResponse, CivicSearchView } from "@hu/types";

import { apiRequest } from "../../lib/api-client";

export type { CivicSearchQuery, CivicSearchResponse, CivicSearchView };

export interface FetchPublicSearchInput {
  q?: string;
  entityType?: string;
  country?: string;
  region?: string;
  community?: string;
  activityArea?: string;
  status?: string;
  fromDate?: string;
  toDate?: string;
  limit?: number;
  offset?: number;
  view?: CivicSearchView;
  /** Launch Readiness Pack 06 — abort stale search navigations. */
  signal?: AbortSignal;
}

export async function fetchPublicSearch(
  input: FetchPublicSearchInput = {},
): Promise<CivicSearchResponse> {
  const params = new URLSearchParams();

  if (input.q) {
    params.set("q", input.q);
  }

  if (input.entityType) {
    params.set("entityType", input.entityType);
  }

  if (input.country) {
    params.set("country", input.country);
  }

  if (input.region) {
    params.set("region", input.region);
  }

  if (input.community) {
    params.set("community", input.community);
  }

  if (input.activityArea) {
    params.set("activityArea", input.activityArea);
  }

  if (input.status) {
    params.set("status", input.status);
  }

  if (input.fromDate) {
    params.set("fromDate", input.fromDate);
  }

  if (input.toDate) {
    params.set("toDate", input.toDate);
  }

  if (input.limit !== undefined) {
    params.set("limit", String(input.limit));
  }

  if (input.offset !== undefined) {
    params.set("offset", String(input.offset));
  }

  if (input.view) {
    params.set("view", input.view);
  }

  const query = params.toString();
  const path = query ? `/api/v1/public/search?${query}` : "/api/v1/public/search";

  return apiRequest<CivicSearchResponse>(path, input.signal ? { signal: input.signal } : undefined);
}

export const ENTITY_TYPE_OPTIONS = [
  { value: "", label: "All record types" },
  { value: "initiative", label: "Initiative" },
  { value: "analysis", label: "Collaborative Analysis" },
  { value: "improvement_proposal", label: "Improvement Proposals" },
  { value: "initiative_revision", label: "Revision" },
  { value: "petition", label: "Petition" },
  { value: "decision_session", label: "Decision Session" },
  { value: "collective_decision", label: "Collective Decision" },
  { value: "civic_action_package", label: "Civic Action Package" },
  { value: "official_response", label: "Official Responses" },
  { value: "civic_accountability", label: "Civic Accountability" },
  { value: "implementation_commitment", label: "Implementation Commitments" },
  { value: "implementation_tracking", label: "Implementation Tracking" },
  { value: "public_impact", label: "Public Impact" },
  { value: "civic_archive", label: "Civic Archive" },
  { value: "knowledge_article", label: "Knowledge Article" },
  { value: "knowledge_media", label: "Knowledge Media" },
  { value: "civic_nomination", label: "Civic Nomination" },
] as const;

export function entityTypeLabel(entityType: string): string {
  return ENTITY_TYPE_OPTIONS.find((option) => option.value === entityType)?.label ?? entityType;
}
