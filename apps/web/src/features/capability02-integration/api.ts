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

const ENTITY_TYPE_TO_URL: Record<
  Exclude<CivicEntityType, "direct_conversation" | "blog_post" | "blog_author_application">,
  IntegrationUrlEntityType
> = {
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

/**
 * Profile UX Pack 03 — `direct_conversation` is a private Direct
 * Collaboration entity (Part 24) and never has a public Civic Integration
 * view, mirroring `publicUrlForEntity`'s explicit rejection in
 * `capability02-integration.service.ts` on the API side.
 *
 * Blog Implementation Pack 02 — `blog_post` uses Global Search / `/blog`
 * routes; it is not a Capability 02 lifecycle integration entity.
 */
export function toIntegrationUrlEntityType(entityType: CivicEntityType): IntegrationUrlEntityType {
  if (entityType === "direct_conversation") {
    throw new Error("Direct Collaboration conversations do not have a public Civic Integration view.");
  }

  if (entityType === "blog_post") {
    throw new Error("Blog posts do not have a Civic Integration lifecycle view.");
  }

  if (entityType === "blog_author_application") {
    throw new Error("Blog Author applications do not have a Civic Integration lifecycle view.");
  }

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
