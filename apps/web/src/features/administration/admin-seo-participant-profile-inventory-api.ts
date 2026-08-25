/**
 * SEO Pack 11 — Admin Pages inventory uses the same minimal public sitemap
 * enumeration API (no Admin directory / private fields).
 */
import { apiRequest } from "../../lib/api-client";

export interface PublicSitemapParticipantProfileInventoryEntry {
  publicName: string;
  updatedAt?: string;
}

interface PublicSitemapParticipantProfilesResponse {
  entries: PublicSitemapParticipantProfileInventoryEntry[];
}

export async function listPublicSitemapParticipantProfiles(): Promise<
  PublicSitemapParticipantProfileInventoryEntry[]
> {
  const data = await apiRequest<PublicSitemapParticipantProfilesResponse>(
    "/api/v1/public/sitemap/participant-profiles",
  );
  return data.entries ?? [];
}
