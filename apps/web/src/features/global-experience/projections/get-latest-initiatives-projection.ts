import type {
  InitiativeStatus,
  LatestInitiativeCardProjection,
  LatestInitiativesPublicProjection,
} from "@hu/types";

import { getPublicInitiative } from "../../initiatives/api";
import { WORLD_LATEST_INITIATIVES_PUBLIC_PROJECTION } from "./bootstrap-latest-initiatives";

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

export async function getWorldLatestInitiativesPublicProjection(): Promise<LatestInitiativesPublicProjection> {
  const initiatives = await Promise.all(
    WORLD_LATEST_INITIATIVES_PUBLIC_PROJECTION.initiatives.map(enrichLatestInitiativeCard),
  );

  return {
    ...WORLD_LATEST_INITIATIVES_PUBLIC_PROJECTION,
    initiatives: initiatives.sort((left, right) => left.recencyOrder - right.recencyOrder),
  };
}
