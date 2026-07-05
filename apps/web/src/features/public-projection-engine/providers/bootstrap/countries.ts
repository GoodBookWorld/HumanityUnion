import type { CountryExperiencePublicProjections } from "@hu/types";

function publicInitiativeHref(initiativeId: string): string {
  return `/initiatives/public/${encodeURIComponent(initiativeId)}`;
}

function regionHref(slug: string): string {
  return `/region/${encodeURIComponent(slug)}`;
}

const CANADA_PROJECTIONS: CountryExperiencePublicProjections = {
  identity: {
    slug: "canada",
    name: "Canada",
    description:
      "National public civic activity on Humanity Union within Canada — observable participation across regions and participant-created communities.",
    representativeVisual: {
      kind: "placeholder",
      initials: "CA",
      caption:
        "Representative national visual placeholder — country imagery policy not yet available.",
    },
    source: "bootstrap",
  },
  statistics: {
    scope: "country",
    scopeLabel: "Canada",
    source: "bootstrap",
    generatedAt: "2026-01-01T00:00:00.000Z",
    indicators: [
      {
        id: "national-participant-indicators",
        label: "Public participant indicators",
        value: 24,
        derived: true,
      },
      {
        id: "national-initiatives",
        label: "Public initiatives associated",
        value: 2,
        derived: false,
      },
      {
        id: "national-evidence-records",
        label: "Public civic records",
        value: 7,
        derived: true,
      },
    ],
  },
  pipeline: {
    scope: "country",
    scopeLabel: "Canada",
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
    scope: "country",
    scopeLabel: "Canada",
    source: "bootstrap",
    generatedAt: "2026-01-01T00:00:00.000Z",
    initiatives: [
      {
        initiativeId: "initiative-bootstrap-001",
        title: "Community Garden Initiative",
        summary:
          "Establish a shared community garden to improve local food access and neighborhood cooperation.",
        geographicScope: "Central Kootenay, Canada",
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
        geographicScope: "Central Kootenay, Canada",
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
  trustedNationalMedia: {
    scopeLabel: "Canada",
    countryName: "Canada",
    source: "bootstrap",
    generatedAt: "2026-01-01T00:00:00.000Z",
    media: [
      {
        id: "media-bootstrap-canada-001",
        title: "National Civic Reporting Placeholder",
        publisher: "Bootstrap demonstration publisher",
        summary:
          "Supporting national media context for observable civic activity — not a truth claim or editorial endorsement.",
        mediaRouteStatus: "unavailable",
        unavailableNotice:
          "Trusted media links are not yet available — Verified Media capability not implemented.",
      },
      {
        id: "media-bootstrap-canada-002",
        title: "Regional Civic Context Brief",
        publisher: "Bootstrap demonstration publisher",
        summary:
          "Example supporting media record associated with national civic observation on Humanity Union.",
        mediaRouteStatus: "unavailable",
        unavailableNotice:
          "Trusted media links are not yet available — Verified Media capability not implemented.",
      },
    ],
  },
  regionalCatalog: {
    source: "bootstrap",
    generatedAt: "2026-01-01T00:00:00.000Z",
    regions: [
      {
        slug: "central-kootenay",
        name: "Central Kootenay",
        description:
          "Regional civic activity in the Central Kootenay area of British Columbia, including participant-created communities around Nelson and Kootenay Lake.",
        countryLabel: "Canada",
        initiativeCount: 2,
        regionHref: regionHref("central-kootenay"),
        regionRouteStatus: "unavailable",
      },
      {
        slug: "british-columbia",
        name: "British Columbia",
        description:
          "Provincial civic activity context within Canada — broader than a single community but narrower than national scope.",
        countryLabel: "Canada",
        initiativeCount: 2,
        regionHref: regionHref("british-columbia"),
        regionRouteStatus: "unavailable",
      },
      {
        slug: "prairies",
        name: "Prairies",
        description:
          "Placeholder regional civic context for future Region Experience — no bootstrap activity records yet.",
        countryLabel: "Canada",
        initiativeCount: 0,
        regionHref: regionHref("prairies"),
        regionRouteStatus: "unavailable",
      },
    ],
  },
};

export const BOOTSTRAP_COUNTRY_PROJECTIONS_BY_SLUG: Record<
  string,
  CountryExperiencePublicProjections
> = {
  canada: CANADA_PROJECTIONS,
};

export const BOOTSTRAP_COUNTRY_SLUGS = Object.keys(BOOTSTRAP_COUNTRY_PROJECTIONS_BY_SLUG);

export function isBootstrapCountrySlug(
  slug: string,
): slug is keyof typeof BOOTSTRAP_COUNTRY_PROJECTIONS_BY_SLUG {
  return slug in BOOTSTRAP_COUNTRY_PROJECTIONS_BY_SLUG;
}

export function getBootstrapCountryProjections(
  slug: string,
): CountryExperiencePublicProjections | null {
  if (!isBootstrapCountrySlug(slug)) {
    return null;
  }

  return BOOTSTRAP_COUNTRY_PROJECTIONS_BY_SLUG[slug] ?? null;
}
