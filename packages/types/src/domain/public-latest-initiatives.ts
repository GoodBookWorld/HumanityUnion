import type { PublicGeographicScope } from "./public-participation-statistics.js";

export interface LatestInitiativeRelatedPublicLink {
  label: string;
  href: string;
}

export interface LatestInitiativeCardProjection {
  initiativeId: string;
  title: string;
  summary: string;
  geographicScope: string;
  participationStage: string;
  publicStatus: string;
  publicInitiativeHref: string;
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
