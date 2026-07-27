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
  | "civic-accountability"
  | "implementation-commitment"
  | "implementation-tracking"
  | "public-impact"
  | "civic-archive"
  | "knowledge";

const ENTITY_TYPE_TO_URL: Record<CivicEntityType, IntegrationUrlEntityType> = {
  initiative: "initiative",
  analysis: "analysis",
  improvement_proposal: "improvement-proposal",
  initiative_revision: "initiative",
  petition: "initiative",
  decision_session: "decision-session",
  collective_decision: "collective-decision",
  civic_action_package: "civic-action-package",
  official_response: "official-response",
  civic_accountability: "civic-accountability",
  implementation_commitment: "implementation-commitment",
  implementation_tracking: "implementation-tracking",
  public_impact: "public-impact",
  civic_archive: "civic-archive",
  knowledge_article: "knowledge",
  knowledge_media: "knowledge",
  civic_nomination: "knowledge",
  member_badge_contribution: "knowledge",
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
