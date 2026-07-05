import type { LatestInitiativesPublicProjection } from "./public-latest-initiatives.js";
import type { ParticipationPipelinePublicProjection } from "./public-participation-pipeline.js";
import type { ParticipationPublicStatisticsProjection } from "./public-participation-statistics.js";
import type { PublicExperienceRouteStatus } from "./public-latest-initiatives.js";

export interface CommunityRepresentativeVisual {
  kind: "placeholder" | "image";
  caption: string;
  initials: string;
  imageHref?: string;
}

export interface CommunityPublicRecord {
  slug: string;
  name: string;
  description: string;
  activityArea: string;
  regionLabel: string;
  countryLabel: string;
  initiativeCount: number;
  communityHref: string;
  communityRouteStatus: PublicExperienceRouteStatus;
}

export interface CommunityIdentityPublicProjection {
  slug: string;
  name: string;
  description: string;
  activityArea: string;
  regionLabel: string;
  countryLabel: string;
  representativeVisual: CommunityRepresentativeVisual;
  source: "bootstrap" | "projection";
}

export interface CommunityImpactOverviewSignal {
  id: string;
  label: string;
  value: string;
  derived: boolean;
  verificationHref?: string;
  verificationRouteStatus?: PublicExperienceRouteStatus;
}

export interface CommunityImpactOverviewPublicProjection {
  scopeLabel: string;
  communityName: string;
  signals: CommunityImpactOverviewSignal[];
  generatedAt: string;
  source: "bootstrap" | "projection";
}

export interface CommunityCatalogPublicProjection {
  communities: CommunityPublicRecord[];
  generatedAt: string;
  source: "bootstrap" | "projection";
}

export interface CommunityExperiencePublicProjections {
  identity: CommunityIdentityPublicProjection;
  statistics: ParticipationPublicStatisticsProjection;
  pipeline: ParticipationPipelinePublicProjection;
  latestInitiatives: LatestInitiativesPublicProjection;
  impactOverview: CommunityImpactOverviewPublicProjection;
}
