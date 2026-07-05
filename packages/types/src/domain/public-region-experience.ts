import type {
  CommunityCatalogPublicProjection,
  CommunityRepresentativeVisual,
} from "./public-community-experience.js";
import type { LatestInitiativesPublicProjection } from "./public-latest-initiatives.js";
import type { ParticipationPipelinePublicProjection } from "./public-participation-pipeline.js";
import type { ParticipationPublicStatisticsProjection } from "./public-participation-statistics.js";

export type RegionRepresentativeVisual = CommunityRepresentativeVisual;

export interface RegionIdentityPublicProjection {
  slug: string;
  name: string;
  description: string;
  countrySlug: string;
  countryLabel: string;
  representativeVisual: RegionRepresentativeVisual;
  source: "bootstrap" | "projection";
}

export interface RegionExperiencePublicProjections {
  identity: RegionIdentityPublicProjection;
  statistics: ParticipationPublicStatisticsProjection;
  pipeline: ParticipationPipelinePublicProjection;
  latestInitiatives: LatestInitiativesPublicProjection;
  communityCatalog: CommunityCatalogPublicProjection;
}
