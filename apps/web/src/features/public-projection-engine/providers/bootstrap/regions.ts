import type { RegionExperiencePublicProjections } from "@hu/types";

import { BOOTSTRAP_COMMUNITY_CATALOG } from "./communities";

function publicInitiativeHref(initiativeId: string): string {
  return `/initiatives/public/${encodeURIComponent(initiativeId)}`;
}

function countryHref(slug: string): string {
  return `/country/${encodeURIComponent(slug)}`;
}

const BRITISH_COLUMBIA_COMMUNITY_CATALOG = {
  source: "bootstrap" as const,
  generatedAt: "2026-01-01T00:00:00.000Z",
  communities: BOOTSTRAP_COMMUNITY_CATALOG.communities.filter(
    (community) =>
      community.countrySlug === "canada" && community.regionSlug === "british-columbia",
  ),
};

const BRITISH_COLUMBIA_PROJECTIONS: RegionExperiencePublicProjections = {
  identity: {
    slug: "british-columbia",
    name: "British Columbia",
    description:
      "Regional public civic activity on Humanity Union within British Columbia, Canada — observable participation across participant-created communities and structured civic records.",
    countrySlug: "canada",
    countryLabel: "Canada",
    representativeVisual: {
      kind: "placeholder",
      initials: "BC",
      caption:
        "Representative regional visual placeholder — region imagery policy not yet available.",
    },
    source: "bootstrap",
  },
  statistics: {
    scope: "region",
    scopeLabel: "British Columbia",
    source: "bootstrap",
    generatedAt: "2026-01-01T00:00:00.000Z",
    indicators: [
      {
        id: "regional-participant-indicators",
        label: "Public participant indicators",
        value: 20,
        derived: true,
      },
      {
        id: "regional-initiatives",
        label: "Public initiatives associated",
        value: 2,
        derived: false,
      },
      {
        id: "regional-evidence-records",
        label: "Public civic records",
        value: 7,
        derived: true,
      },
    ],
  },
  pipeline: {
    scope: "region",
    scopeLabel: "British Columbia",
    source: "bootstrap",
    generatedAt: "2026-01-01T00:00:00.000Z",
    stages: [
      { stageId: "initiative", label: "Initiative", count: 2 },
      { stageId: "collaborative-analysis", label: "Collaborative Analysis", count: 1 },
      { stageId: "collective-decision", label: "Collective Decision", count: 1 },
      { stageId: "petition", label: "Petition", count: 2 },
      { stageId: "implementation-commitment", label: "Implementation Commitment", count: 1 },
      { stageId: "implementation", label: "Implementation", count: 1 },
    ],
  },
  latestInitiatives: {
    scope: "region",
    scopeLabel: "British Columbia",
    source: "bootstrap",
    generatedAt: "2026-01-01T00:00:00.000Z",
    initiatives: [
      {
        initiativeId: "initiative-bootstrap-001",
        title: "Community Garden Initiative",
        summary:
          "Establish a shared community garden to improve local food access and neighborhood cooperation.",
        geographicScope: "Central Kootenay, British Columbia, Canada",
        participationStage: "Implementation",
        publicStatus: "Draft",
        publicRouteStatus: "active",
        publicInitiativeHref: publicInitiativeHref("initiative-bootstrap-001"),
        recencyOrder: 1,
        relatedPublicLinks: [
          {
            label: "Public Collaborative Analysis",
            href: "/collaborative-analysis/public/analysis-bootstrap-001",
            routeStatus: "active",
          },
          {
            label: "Public Petition",
            href: "/petitions/public/petition-bootstrap-001",
            routeStatus: "active",
          },
          {
            label: "Public Implementation",
            href: "/implementations/public/implementation-bootstrap-001",
            routeStatus: "active",
          },
        ],
      },
      {
        initiativeId: "initiative-bootstrap-demo-002",
        title: "Clean Water Access Proposal",
        summary:
          "Public proposal to improve shared water infrastructure and transparent community oversight.",
        geographicScope: "Central Kootenay, British Columbia, Canada",
        participationStage: "Petition",
        publicStatus: "Proposal",
        publicRouteStatus: "unavailable",
        publicUnavailableNotice:
          "Demonstration card only — no public initiative record exists yet for this example.",
        recencyOrder: 2,
        relatedPublicLinks: [],
      },
    ],
  },
  communityCatalog: BRITISH_COLUMBIA_COMMUNITY_CATALOG,
};

export const BOOTSTRAP_REGION_PROJECTIONS_BY_SLUG: Record<
  string,
  RegionExperiencePublicProjections
> = {
  "british-columbia": BRITISH_COLUMBIA_PROJECTIONS,
};

export const BOOTSTRAP_REGION_SLUGS = Object.keys(BOOTSTRAP_REGION_PROJECTIONS_BY_SLUG);

export function isBootstrapRegionSlug(
  slug: string,
): slug is keyof typeof BOOTSTRAP_REGION_PROJECTIONS_BY_SLUG {
  return slug in BOOTSTRAP_REGION_PROJECTIONS_BY_SLUG;
}

export function getBootstrapRegionProjections(
  slug: string,
): RegionExperiencePublicProjections | null {
  if (!isBootstrapRegionSlug(slug)) {
    return null;
  }

  return BOOTSTRAP_REGION_PROJECTIONS_BY_SLUG[slug] ?? null;
}

export { countryHref };
