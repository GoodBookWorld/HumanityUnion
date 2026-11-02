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
  /** ISO 3166-2 code from the geography registry (projection source only). */
  regionCode?: string;
  /** ISO 3166-1 alpha-2 code (projection source only). */
  countryCode?: string;
  /** Registry administrative type, e.g. "province" (projection source only). */
  administrativeType?: string | null;
}

export interface RegionExperiencePublicProjections {
  identity: RegionIdentityPublicProjection;
  statistics: ParticipationPublicStatisticsProjection;
  pipeline: ParticipationPipelinePublicProjection;
  latestInitiatives: LatestInitiativesPublicProjection;
  communityCatalog: CommunityCatalogPublicProjection;
}
