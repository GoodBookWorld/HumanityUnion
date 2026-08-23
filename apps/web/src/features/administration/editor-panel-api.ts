/**
 * Pack 12B2 — Editor Panel client: mutation APIs for operational Editor tools.
 */
import type {
  CountryAffiliationEntry,
  CountryAffiliationEntryType,
  EditorCapabilityId,
  EditorGeographicScopePresentation,
  Initiative,
  MediaResource,
  MediaResourceScopeType,
  MediaResourceType,
} from "@hu/types";

import { apiRequest } from "../../lib/api-client";

export type EditorPanelToolId =
  | "initiatives"
  | "public-choice"
  | "publishing"
  | "media-resources"
  | "country-people"
  | "beta-access";

export interface EditorPanelStatistic {
  readonly toolId: EditorPanelToolId;
  readonly label: string;
  readonly value: number | null;
  readonly unavailableReason?: string;
}

export interface EditorPanelToolDescriptor {
  readonly toolId: EditorPanelToolId;
  readonly capability: EditorCapabilityId;
  readonly label: string;
  readonly mutationSupported: boolean;
  readonly moderationSupported?: boolean;
  readonly unavailableReason?: string;
}

export interface EditorPanelPayload {
  readonly editor: {
    readonly isEditor: true;
    readonly status: "ACTIVE" | "INACTIVE";
    readonly capabilities: readonly EditorCapabilityId[];
    readonly geographicScope: EditorGeographicScopePresentation;
  };
  readonly displayName: string;
  readonly tools: readonly EditorPanelToolDescriptor[];
  readonly statistics: readonly EditorPanelStatistic[];
}

export interface EditorInitiativeRow {
  readonly initiativeId: string;
  readonly title: string;
  readonly status: string;
  readonly geographyLabel: string;
  readonly administrativelyBlocked: boolean;
  readonly blockAuthority?: "ADMIN" | "EDITOR" | null;
  readonly blockLabel?: string | null;
  readonly publicHref: string;
  readonly updatedAt: string;
}

export interface EditorPublicChoiceRow {
  readonly initiativeId: string;
  readonly electionTitle: string;
  readonly votingStatus: string;
  readonly geographyLabel: string;
  readonly candidateCount: number;
  readonly administrativelyBlocked: boolean;
  readonly blockAuthority?: "ADMIN" | "EDITOR" | null;
  readonly blockLabel?: string | null;
  readonly publicHref: string;
  readonly updatedAt: string;
}

export interface EditorPublicChoiceCandidateRow {
  readonly candidateId: string;
  readonly name: string;
  readonly photoUrl?: string;
  readonly campaignPageUrl?: string;
  readonly isBlocked: boolean;
  readonly blockAuthority?: "ADMIN" | "EDITOR" | null;
  readonly blockLabel?: string | null;
}

export interface EditorMediaResourceWriteInput {
  resourceType: MediaResourceType;
  scopeType: MediaResourceScopeType;
  countryCode?: string | null;
  name: string;
  logoLabel: string;
  logoUrl?: string | null;
  websiteUrl: string;
  rssUrl?: string | null;
  categoryId?: string | null;
  description?: string | null;
  secondaryText?: string | null;
  language?: string | null;
  providerId?: string | null;
  active?: boolean;
  sortOrder?: number;
}

export interface EditorCountryPeopleWriteInput {
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

export async function fetchEditorPanel(): Promise<EditorPanelPayload> {
  return apiRequest<EditorPanelPayload>("/api/v1/workspace/editor/panel");
}

export async function fetchEditorInitiatives(): Promise<{
  items: EditorInitiativeRow[];
  total: number;
}> {
  return apiRequest("/api/v1/workspace/editor/initiatives");
}

export async function fetchEditorInitiative(initiativeId: string): Promise<Initiative> {
  return apiRequest(`/api/v1/workspace/editor/initiatives/${encodeURIComponent(initiativeId)}`);
}

export async function updateEditorInitiative(
  initiativeId: string,
  body: Record<string, unknown>,
): Promise<Initiative> {
  return apiRequest(`/api/v1/workspace/editor/initiatives/${encodeURIComponent(initiativeId)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function republishEditorInitiative(
  initiativeId: string,
  body: Record<string, unknown> = {},
): Promise<Initiative> {
  return apiRequest(
    `/api/v1/workspace/editor/initiatives/${encodeURIComponent(initiativeId)}/republish`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
}

export async function fetchEditorPublicChoice(): Promise<{
  items: EditorPublicChoiceRow[];
  total: number;
}> {
  return apiRequest("/api/v1/workspace/editor/public-choice");
}

export async function fetchEditorPublicChoiceCandidates(initiativeId: string): Promise<{
  initiativeId: string;
  electionTitle: string;
  administrativelyBlocked: boolean;
  candidates: EditorPublicChoiceCandidateRow[];
}> {
  return apiRequest(
    `/api/v1/workspace/editor/public-choice/${encodeURIComponent(initiativeId)}/candidates`,
  );
}

export async function updateEditorPublicChoiceCandidate(
  initiativeId: string,
  candidateId: string,
  input: {
    name?: string;
    photoUrl?: string | null;
    campaignPageUrl?: string | null;
  },
): Promise<unknown> {
  return apiRequest(
    `/api/v1/workspace/editor/public-choice/${encodeURIComponent(initiativeId)}/candidates/${encodeURIComponent(candidateId)}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    },
  );
}

export async function fetchEditorMediaResources(): Promise<{ items: MediaResource[] }> {
  return apiRequest("/api/v1/workspace/editor/media-resources");
}

export async function createEditorMediaResource(
  input: EditorMediaResourceWriteInput,
): Promise<MediaResource> {
  return apiRequest("/api/v1/workspace/editor/media-resources", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export async function updateEditorMediaResource(
  id: string,
  input: Partial<Omit<EditorMediaResourceWriteInput, "resourceType">>,
): Promise<MediaResource> {
  return apiRequest(`/api/v1/workspace/editor/media-resources/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export async function fetchEditorCountryPeople(): Promise<{ items: CountryAffiliationEntry[] }> {
  return apiRequest("/api/v1/workspace/editor/country-people");
}

export async function createEditorCountryPerson(
  input: EditorCountryPeopleWriteInput,
): Promise<CountryAffiliationEntry> {
  return apiRequest("/api/v1/workspace/editor/country-people", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export async function updateEditorCountryPerson(
  entryId: string,
  input: Partial<EditorCountryPeopleWriteInput>,
): Promise<CountryAffiliationEntry> {
  return apiRequest(`/api/v1/workspace/editor/country-people/${encodeURIComponent(entryId)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export async function fetchEditorBetaInvites(): Promise<{ invites: unknown[] }> {
  return apiRequest("/api/v1/workspace/editor/beta-invites");
}

export async function createEditorBetaInvite(email: string): Promise<unknown> {
  return apiRequest("/api/v1/workspace/editor/beta-invites", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export async function activateEditorMediaResource(id: string): Promise<unknown> {
  return apiRequest(`/api/v1/workspace/editor/media-resources/${id}/activate`, {
    method: "POST",
  });
}

export async function deactivateEditorMediaResource(id: string): Promise<unknown> {
  return apiRequest(`/api/v1/workspace/editor/media-resources/${id}/deactivate`, {
    method: "POST",
  });
}

export async function activateEditorCountryPerson(entryId: string): Promise<unknown> {
  return apiRequest(`/api/v1/workspace/editor/country-people/${entryId}/activate`, {
    method: "POST",
  });
}

export async function deactivateEditorCountryPerson(entryId: string): Promise<unknown> {
  return apiRequest(`/api/v1/workspace/editor/country-people/${entryId}/deactivate`, {
    method: "POST",
  });
}

export async function blockEditorInitiative(
  initiativeId: string,
  reason?: string,
): Promise<unknown> {
  return apiRequest(`/api/v1/workspace/editor/initiatives/${encodeURIComponent(initiativeId)}/block`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(reason ? { reason } : {}),
  });
}

export async function unblockEditorInitiative(
  initiativeId: string,
  reason?: string,
): Promise<unknown> {
  return apiRequest(
    `/api/v1/workspace/editor/initiatives/${encodeURIComponent(initiativeId)}/unblock`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(reason ? { reason } : {}),
    },
  );
}

export async function blockEditorPublicChoiceCandidate(
  initiativeId: string,
  candidateId: string,
  reason?: string,
): Promise<unknown> {
  return apiRequest(
    `/api/v1/workspace/editor/public-choice/${encodeURIComponent(initiativeId)}/candidates/${encodeURIComponent(candidateId)}/block`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(reason ? { reason } : {}),
    },
  );
}

export async function unblockEditorPublicChoiceCandidate(
  initiativeId: string,
  candidateId: string,
  reason?: string,
): Promise<unknown> {
  return apiRequest(
    `/api/v1/workspace/editor/public-choice/${encodeURIComponent(initiativeId)}/candidates/${encodeURIComponent(candidateId)}/unblock`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(reason ? { reason } : {}),
    },
  );
}
