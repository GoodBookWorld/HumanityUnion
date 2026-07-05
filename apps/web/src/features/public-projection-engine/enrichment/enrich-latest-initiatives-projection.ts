import type {
  InitiativeStatus,
  LatestInitiativeCardProjection,
  LatestInitiativesPublicProjection,
} from "@hu/types";

import { getPublicInitiative } from "../../initiatives/api";

/**
 * Engine-level enrichment applied after provider retrieval (all provider modes).
 * Merges live initiative metadata when available. Capability 02 providers may
 * return complete cards and make this a pass-through.
 */

function formatPublicStatus(status: InitiativeStatus): string {
  return status
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function summarizeDescription(description: string, maxLength = 160): string {
  if (description.length <= maxLength) {
    return description;
  }

  return `${description.slice(0, maxLength - 1).trimEnd()}…`;
}

async function enrichLatestInitiativeCard(
  card: LatestInitiativeCardProjection,
): Promise<LatestInitiativeCardProjection> {
  if (card.publicRouteStatus === "unavailable") {
    return card;
  }

  try {
    const projection = await getPublicInitiative(card.initiativeId);

    return {
      ...card,
      title: projection.title,
      summary: summarizeDescription(projection.description),
      geographicScope: projection.metadata.region
        ? `${projection.metadata.region}, World`
        : card.geographicScope,
      publicStatus: formatPublicStatus(projection.status),
    };
  } catch {
    return card;
  }
}

export async function enrichLatestInitiativesProjection(
  projection: LatestInitiativesPublicProjection,
): Promise<LatestInitiativesPublicProjection> {
  const initiatives = await Promise.all(projection.initiatives.map(enrichLatestInitiativeCard));

  return {
    ...projection,
    initiatives: initiatives.sort((left, right) => left.recencyOrder - right.recencyOrder),
  };
}
