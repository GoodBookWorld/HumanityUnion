import type { PublicGeographicScope } from "./public-participation-statistics.js";

export type PublicExperienceRouteStatus = "active" | "unavailable";

export interface LatestInitiativeRelatedPublicLink {
  label: string;
  href: string;
  routeStatus: PublicExperienceRouteStatus;
}

export interface LatestInitiativeCardProjection {
  initiativeId: string;
  title: string;
  summary: string;
  geographicScope: string;
  participationStage: string;
  publicStatus: string;
  publicRouteStatus: PublicExperienceRouteStatus;
  publicInitiativeHref?: string;
  publicUnavailableNotice?: string;
  relatedPublicLinks: LatestInitiativeRelatedPublicLink[];
  recencyOrder: number;
}

export interface LatestInitiativesPublicProjection {
  scope: PublicGeographicScope;
  scopeLabel: string;
  source: "bootstrap" | "projection";
  generatedAt: string;
  initiatives: LatestInitiativeCardProjection[];
}
