import type { Initiative, PublicInitiativeProjection } from "@hu/types";

import { getMemberById } from "../member/member-access.js";
import { getCurrentPublishedVersion } from "../initiative-version-revision/initiative-version-revision.store.js";
import { isInitiativeEligibleForPublicProjection } from "./initiative-public-projection.access.js";

export async function toPublicInitiativeProjection(
  initiative: Initiative,
): Promise<PublicInitiativeProjection> {
  const steward = await getMemberById(initiative.stewardId);

  return {
    initiativeId: initiative.initiativeId,
    title: initiative.title,
    description: initiative.description,
    status: initiative.status,
    metadata: {
      category: initiative.metadata.category,
      tags: [...initiative.metadata.tags],
      region: initiative.metadata.region,
      language: initiative.metadata.language,
      communitySlug: initiative.metadata.communitySlug,
      communityAssociation: initiative.metadata.communityAssociation,
      participationScope: initiative.metadata.participationScope,
      activityArea: initiative.metadata.activityArea,
      activityAreaOther: initiative.metadata.activityAreaOther,
      imageUrl: initiative.metadata.imageUrl,
      imageAltText: initiative.metadata.imageAltText,
      startDate: initiative.metadata.startDate,
      completionDate: initiative.metadata.completionDate,
    },
    stewardDisplayName: steward?.profile.displayName ?? "Unknown Steward",
    createdAt: initiative.createdAt,
    currentVersion: getCurrentPublishedVersion(initiative.initiativeId) || 1,
    sourceReferences: initiative.sourceReferences
      ? structuredClone(initiative.sourceReferences)
      : undefined,
  };
}

export function canExposePublicInitiativeProjection(initiative: Initiative): boolean {
  return isInitiativeEligibleForPublicProjection(initiative);
}
