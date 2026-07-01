import type { Initiative, PublicInitiativeProjection } from "@hu/types";

import { getMemberById } from "../member/member.store.js";

export function toPublicInitiativeProjection(initiative: Initiative): PublicInitiativeProjection {
  const steward = getMemberById(initiative.stewardId);

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
    },
    stewardDisplayName: steward?.profile.displayName ?? "Unknown Steward",
    createdAt: initiative.createdAt,
  };
}
