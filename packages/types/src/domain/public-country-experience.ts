import type { CommunityRepresentativeVisual } from "./public-community-experience.js";
import type { LatestInitiativesPublicProjection } from "./public-latest-initiatives.js";
import type { PublicExperienceRouteStatus } from "./public-latest-initiatives.js";
import type { ParticipationPipelinePublicProjection } from "./public-participation-pipeline.js";
import type { ParticipationPublicStatisticsProjection } from "./public-participation-statistics.js";

export type CountryRepresentativeVisual = CommunityRepresentativeVisual;

export interface CountryIdentityPublicProjection {
  slug: string;
  name: string;
  description: string;
  representativeVisual: CountryRepresentativeVisual;
  source: "bootstrap" | "projection";
}

export interface TrustedNationalMediaRecord {
  id: string;
  title: string;
  publisher: string;
  summary: string;
  mediaHref?: string;
  mediaRouteStatus: PublicExperienceRouteStatus;
  unavailableNotice?: string;
}

export interface TrustedNationalMediaPublicProjection {
  scopeLabel: string;
  countryName: string;
  media: TrustedNationalMediaRecord[];
  generatedAt: string;
  source: "bootstrap" | "projection";
}

export interface RegionPublicRecord {
  slug: string;
  name: string;
  description: string;
  countryLabel: string;
  initiativeCount: number;
  regionHref: string;
  regionRouteStatus: PublicExperienceRouteStatus;
}

export interface CountryRegionalCatalogPublicProjection {
  regions: RegionPublicRecord[];
  generatedAt: string;
  source: "bootstrap" | "projection";
}

export interface CountryExperiencePublicProjections {
  identity: CountryIdentityPublicProjection;
  statistics: ParticipationPublicStatisticsProjection;
  pipeline: ParticipationPipelinePublicProjection;
  latestInitiatives: LatestInitiativesPublicProjection;
  trustedNationalMedia: TrustedNationalMediaPublicProjection | null;
  regionalCatalog: CountryRegionalCatalogPublicProjection;
}
