import type { CivicEntityType, CivicIntegrationView } from "@hu/types";

import { apiRequest } from "../../lib/api-client";

export type IntegrationUrlEntityType =
  | "initiative"
  | "analysis"
  | "improvement-proposal"
  | "decision-session"
  | "collective-decision"
  | "civic-action-package"
  | "official-response"
  | "implementation-commitment"
  | "implementation-tracking"
  | "public-impact"
  | "civic-archive";

const ENTITY_TYPE_TO_URL: Record<CivicEntityType, IntegrationUrlEntityType> = {
  initiative: "initiative",
  analysis: "analysis",
  improvement_proposal: "improvement-proposal",
  initiative_revision: "initiative",
  decision_session: "decision-session",
  collective_decision: "collective-decision",
  civic_action_package: "civic-action-package",
  official_response: "official-response",
  implementation_commitment: "implementation-commitment",
  implementation_tracking: "implementation-tracking",
  public_impact: "public-impact",
  civic_archive: "civic-archive",
};

export function toIntegrationUrlEntityType(entityType: CivicEntityType): IntegrationUrlEntityType {
  return ENTITY_TYPE_TO_URL[entityType];
}

export async function getCivicIntegrationView(
  entityType: IntegrationUrlEntityType,
  entityId: string,
): Promise<CivicIntegrationView | null> {
  try {
    return await apiRequest<CivicIntegrationView>(
      `/api/v1/public/integration/${encodeURIComponent(entityType)}/${encodeURIComponent(entityId)}`,
    );
  } catch {
    return null;
  }
}
