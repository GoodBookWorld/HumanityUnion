import { enrichLatestInitiativesProjection } from "./enrichment/enrich-latest-initiatives-projection";
import type { PublicProjectionProvider } from "./provider";
import { bootstrapPublicProjectionProvider } from "./providers/bootstrap-public-projection-provider";
import type {
  CommunityExperiencePageData,
  CountryExperiencePageData,
  GlobalExperiencePublicProjections,
  PublicProjectionScopeRef,
  RegionExperiencePageData,
} from "./types";

const WORLD_SCOPE: PublicProjectionScopeRef = { scope: "world" };

function requireProjection<T>(projection: T | null, label: string): T {
  if (!projection) {
    throw new Error(`${label} is unavailable for the requested public scope.`);
  }

  return projection;
}

export class PublicProjectionEngine {
  constructor(private readonly provider: PublicProjectionProvider) {}

  get providerMode() {
    return this.provider.mode;
  }

  async getParticipationStatistics(scopeRef: PublicProjectionScopeRef) {
    return this.provider.getParticipationStatistics(scopeRef);
  }

  async getParticipationPipeline(scopeRef: PublicProjectionScopeRef) {
    return this.provider.getParticipationPipeline(scopeRef);
  }

  async getLatestInitiatives(scopeRef: PublicProjectionScopeRef) {
    return this.provider.getLatestInitiatives(scopeRef);
  }

  async loadGlobalExperienceProjections(): Promise<GlobalExperiencePublicProjections> {
    const [statistics, pipeline, latestInitiatives] = await Promise.all([
      this.provider.getParticipationStatistics(WORLD_SCOPE),
      this.provider.getParticipationPipeline(WORLD_SCOPE),
      this.provider.getLatestInitiatives(WORLD_SCOPE),
    ]);

    return {
      statistics: requireProjection(statistics, "Participation statistics projection"),
      pipeline: requireProjection(pipeline, "Participation pipeline projection"),
      latestInitiatives: await enrichLatestInitiativesProjection(
        requireProjection(latestInitiatives, "Latest initiatives projection"),
      ),
    };
  }

  async loadCommunityExperiencePageData(slug: string): Promise<CommunityExperiencePageData | null> {
    const [projections, catalog] = await Promise.all([
      this.provider.getCommunityExperienceProjections(slug),
      this.provider.getCommunityCatalog(),
    ]);

    if (!projections) {
      return null;
    }

    return { projections, catalog };
  }

  async getCommunityCatalog() {
    return this.provider.getCommunityCatalog();
  }

  async getCommunityExperienceProjections(slug: string) {
    return this.provider.getCommunityExperienceProjections(slug);
  }

  async loadCountryExperiencePageData(
    countrySlug: string,
  ): Promise<CountryExperiencePageData | null> {
    const projections = await this.provider.getCountryExperienceProjections(countrySlug);

    if (!projections) {
      return null;
    }

    return {
      projections: {
        ...projections,
        latestInitiatives: await enrichLatestInitiativesProjection(projections.latestInitiatives),
      },
    };
  }

  async getCountryExperienceProjections(countrySlug: string) {
    return this.provider.getCountryExperienceProjections(countrySlug);
  }

  async loadRegionExperiencePageData(regionSlug: string): Promise<RegionExperiencePageData | null> {
    const projections = await this.provider.getRegionExperienceProjections(regionSlug);

    if (!projections) {
      return null;
    }

    return {
      projections: {
        ...projections,
        latestInitiatives: await enrichLatestInitiativesProjection(projections.latestInitiatives),
      },
    };
  }

  async getRegionExperienceProjections(regionSlug: string) {
    return this.provider.getRegionExperienceProjections(regionSlug);
  }
}

export const publicProjectionEngine = new PublicProjectionEngine(bootstrapPublicProjectionProvider);

export async function loadGlobalExperienceProjections(): Promise<GlobalExperiencePublicProjections> {
  return publicProjectionEngine.loadGlobalExperienceProjections();
}

export async function loadCommunityExperiencePageData(
  slug: string,
): Promise<CommunityExperiencePageData | null> {
  return publicProjectionEngine.loadCommunityExperiencePageData(slug);
}

export async function loadCountryExperiencePageData(
  countrySlug: string,
): Promise<CountryExperiencePageData | null> {
  return publicProjectionEngine.loadCountryExperiencePageData(countrySlug);
}

export async function loadRegionExperiencePageData(
  regionSlug: string,
): Promise<RegionExperiencePageData | null> {
  return publicProjectionEngine.loadRegionExperiencePageData(regionSlug);
}
