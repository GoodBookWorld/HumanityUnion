import type { Initiative, MemberProfile } from "@hu/types";

import { listInitiatives } from "../initiatives/initiative.store.js";
import { canExposePublicInitiativeProjection } from "../initiatives/public-initiative.projection.js";
import { listPublicSitemapMemberProfileDocuments } from "../member-profile/member-profile.repository.js";

export interface PublicSitemapInitiativeEntry {
  initiativeId: string;
  updatedAt: string;
}

export interface PublicSitemapParticipantProfileEntry {
  publicName: string;
  updatedAt?: string;
}

/**
 * SEO Pack 02 — public Initiative refs for sitemap generation.
 * Reuses the same eligibility gate as GET /api/v1/public/initiatives/:id.
 */
export function listPublicSitemapInitiatives(
  initiatives: Initiative[] = listInitiatives(),
): PublicSitemapInitiativeEntry[] {
  return initiatives
    .filter(canExposePublicInitiativeProjection)
    .map((initiative) => ({
      initiativeId: initiative.initiativeId,
      updatedAt: initiative.updatedAt,
    }))
    .sort((left, right) => left.initiativeId.localeCompare(right.initiativeId));
}

function isTrustworthyIsoTimestamp(value: string | undefined): value is string {
  if (!value?.trim()) {
    return false;
  }
  const time = Date.parse(value);
  return !Number.isNaN(time);
}

/**
 * Pure sitemap eligibility mapper for Participant Profiles.
 * Only `profileVisibility === "public"` + `status === "active"` with a non-empty publicName.
 */
export function toPublicSitemapParticipantProfileEntry(
  profile: Pick<MemberProfile, "publicName" | "updatedAt" | "profileVisibility" | "status">,
): PublicSitemapParticipantProfileEntry | null {
  if (profile.status !== "active") {
    return null;
  }
  if (profile.profileVisibility !== "public") {
    return null;
  }

  const publicName = profile.publicName?.trim();
  if (!publicName) {
    return null;
  }

  return {
    publicName,
    ...(isTrustworthyIsoTimestamp(profile.updatedAt)
      ? { updatedAt: profile.updatedAt.trim() }
      : {}),
  };
}

/**
 * SEO Pack 11 — public Participant Profile refs for sitemap generation.
 * Privacy is enforced in Mongo (active + public only) before mapping.
 *
 * When `documents` is provided (unit tests), Mongo is not contacted.
 */
export async function listPublicSitemapParticipantProfiles(
  documents?: Array<{ publicName: string; updatedAt: string }>,
): Promise<PublicSitemapParticipantProfileEntry[]> {
  const source = documents ?? (await listPublicSitemapMemberProfileDocuments());
  const byPublicName = new Map<string, PublicSitemapParticipantProfileEntry>();

  for (const document of source) {
    const mapped = toPublicSitemapParticipantProfileEntry({
      publicName: document.publicName,
      updatedAt: document.updatedAt,
      profileVisibility: "public",
      status: "active",
    });
    if (!mapped) {
      continue;
    }
    if (!byPublicName.has(mapped.publicName)) {
      byPublicName.set(mapped.publicName, mapped);
    }
  }

  return [...byPublicName.values()].sort((left, right) =>
    left.publicName.localeCompare(right.publicName),
  );
}
