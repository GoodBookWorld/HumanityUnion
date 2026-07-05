import type {
  CommunityCatalogPublicProjection,
  CommunityExperiencePublicProjections,
  CommunityPublicRecord,
} from "@hu/types";

function communityHref(slug: string): string {
  return `/community/${encodeURIComponent(slug)}`;
}

function publicInitiativeHref(initiativeId: string): string {
  return `/initiatives/public/${encodeURIComponent(initiativeId)}`;
}

export const BOOTSTRAP_COMMUNITY_CATALOG: CommunityCatalogPublicProjection = {
  source: "bootstrap",
  generatedAt: "2026-01-01T00:00:00.000Z",
  communities: [
    {
      slug: "nelson-community-garden",
      name: "Nelson Community Garden",
      description:
        "Participant-created community coordinating shared garden civic activity, local food access, and neighbourhood cooperation in Nelson.",
      activityArea: "Environment",
      regionLabel: "Central Kootenay",
      countryLabel: "Canada",
      initiativeCount: 1,
      communityHref: communityHref("nelson-community-garden"),
    },
    {
      slug: "kootenay-lake-protection-society",
      name: "Kootenay Lake Protection Society",
      description:
        "Participant-created environmental society observing and supporting watershed protection civic activity around Kootenay Lake.",
      activityArea: "Environment",
      regionLabel: "Central Kootenay",
      countryLabel: "Canada",
      initiativeCount: 1,
      communityHref: communityHref("kootenay-lake-protection-society"),
    },
  ],
};

const NELSON_COMMUNITY_GARDEN_PROJECTIONS: CommunityExperiencePublicProjections = {
  identity: {
    slug: "nelson-community-garden",
    name: "Nelson Community Garden",
    description:
      "Participant-created community coordinating shared garden civic activity, local food access, and neighbourhood cooperation in Nelson.",
    activityArea: "Environment",
    regionLabel: "Central Kootenay",
    countryLabel: "Canada",
    source: "bootstrap",
  },
  statistics: {
    scope: "community",
    scopeLabel: "Nelson Community Garden",
    source: "bootstrap",
    generatedAt: "2026-01-01T00:00:00.000Z",
    indicators: [
      {
        id: "community-participants",
        label: "Public participant indicators",
        value: 12,
        derived: true,
      },
      {
        id: "community-initiatives",
        label: "Public initiatives associated",
        value: 1,
        derived: false,
      },
      {
        id: "community-evidence-records",
        label: "Public civic records",
        value: 5,
        derived: true,
      },
    ],
  },
  pipeline: {
    scope: "community",
    scopeLabel: "Nelson Community Garden",
    source: "bootstrap",
    generatedAt: "2026-01-01T00:00:00.000Z",
    stages: [
      { stageId: "initiative", label: "Initiative", count: 1 },
      { stageId: "collaborative-analysis", label: "Collaborative Analysis", count: 1 },
      { stageId: "collective-decision", label: "Collective Decision", count: 0 },
      { stageId: "petition", label: "Petition", count: 1 },
      { stageId: "implementation-commitment", label: "Implementation Commitment", count: 1 },
      { stageId: "implementation", label: "Implementation", count: 1 },
    ],
  },
  latestInitiatives: {
    scope: "community",
    scopeLabel: "Nelson Community Garden",
    source: "bootstrap",
    generatedAt: "2026-01-01T00:00:00.000Z",
    initiatives: [
      {
        initiativeId: "initiative-bootstrap-001",
        title: "Community Garden Initiative",
        summary:
          "Establish a shared community garden to improve local food access and neighborhood cooperation.",
        geographicScope: "Nelson Community Garden, Central Kootenay, Canada",
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
    ],
  },
  impactOverview: {
    scopeLabel: "Nelson Community Garden",
    communityName: "Nelson Community Garden",
    source: "bootstrap",
    generatedAt: "2026-01-01T00:00:00.000Z",
    signals: [
      {
        id: "completed-initiatives",
        label: "Initiatives at implementation-visible stage",
        value: "1",
        derived: true,
        verificationHref: publicInitiativeHref("initiative-bootstrap-001"),
        verificationRouteStatus: "active",
      },
      {
        id: "public-evidence",
        label: "Verifiable public civic records",
        value: "5",
        derived: true,
      },
      {
        id: "pipeline-presence",
        label: "Structured participation stages with public activity",
        value: "4 of 6",
        derived: true,
      },
    ],
  },
};

const KOOTENAY_LAKE_PROJECTIONS: CommunityExperiencePublicProjections = {
  identity: {
    slug: "kootenay-lake-protection-society",
    name: "Kootenay Lake Protection Society",
    description:
      "Participant-created environmental society observing and supporting watershed protection civic activity around Kootenay Lake.",
    activityArea: "Environment",
    regionLabel: "Central Kootenay",
    countryLabel: "Canada",
    source: "bootstrap",
  },
  statistics: {
    scope: "community",
    scopeLabel: "Kootenay Lake Protection Society",
    source: "bootstrap",
    generatedAt: "2026-01-01T00:00:00.000Z",
    indicators: [
      {
        id: "community-participants",
        label: "Public participant indicators",
        value: 8,
        derived: true,
      },
      {
        id: "community-initiatives",
        label: "Public initiatives associated",
        value: 1,
        derived: false,
      },
      {
        id: "community-evidence-records",
        label: "Public civic records",
        value: 2,
        derived: true,
      },
    ],
  },
  pipeline: {
    scope: "community",
    scopeLabel: "Kootenay Lake Protection Society",
    source: "bootstrap",
    generatedAt: "2026-01-01T00:00:00.000Z",
    stages: [
      { stageId: "initiative", label: "Initiative", count: 1 },
      { stageId: "collaborative-analysis", label: "Collaborative Analysis", count: 0 },
      { stageId: "collective-decision", label: "Collective Decision", count: 1 },
      { stageId: "petition", label: "Petition", count: 1 },
      { stageId: "implementation-commitment", label: "Implementation Commitment", count: 0 },
      { stageId: "implementation", label: "Implementation", count: 0 },
    ],
  },
  latestInitiatives: {
    scope: "community",
    scopeLabel: "Kootenay Lake Protection Society",
    source: "bootstrap",
    generatedAt: "2026-01-01T00:00:00.000Z",
    initiatives: [
      {
        initiativeId: "initiative-bootstrap-demo-002",
        title: "Clean Water Access Proposal",
        summary:
          "Public proposal to improve shared water infrastructure and transparent community oversight.",
        geographicScope: "Kootenay Lake Protection Society, Central Kootenay, Canada",
        participationStage: "Petition",
        publicStatus: "Proposal",
        publicRouteStatus: "unavailable",
        publicUnavailableNotice:
          "Demonstration card only — no public initiative record exists yet for this example.",
        recencyOrder: 1,
        relatedPublicLinks: [],
      },
    ],
  },
  impactOverview: {
    scopeLabel: "Kootenay Lake Protection Society",
    communityName: "Kootenay Lake Protection Society",
    source: "bootstrap",
    generatedAt: "2026-01-01T00:00:00.000Z",
    signals: [
      {
        id: "active-initiatives",
        label: "Public initiatives associated with this community",
        value: "1",
        derived: false,
        verificationRouteStatus: "unavailable",
      },
      {
        id: "petition-stage",
        label: "Initiatives visible at petition stage",
        value: "1",
        derived: true,
      },
    ],
  },
};

export const BOOTSTRAP_COMMUNITY_PROJECTIONS_BY_SLUG: Record<
  string,
  CommunityExperiencePublicProjections
> = {
  "nelson-community-garden": NELSON_COMMUNITY_GARDEN_PROJECTIONS,
  "kootenay-lake-protection-society": KOOTENAY_LAKE_PROJECTIONS,
};

export const BOOTSTRAP_COMMUNITY_SLUGS = Object.keys(BOOTSTRAP_COMMUNITY_PROJECTIONS_BY_SLUG);

export function isBootstrapCommunitySlug(
  slug: string,
): slug is keyof typeof BOOTSTRAP_COMMUNITY_PROJECTIONS_BY_SLUG {
  return slug in BOOTSTRAP_COMMUNITY_PROJECTIONS_BY_SLUG;
}

export function getBootstrapCommunityRecord(slug: string): CommunityPublicRecord | undefined {
  return BOOTSTRAP_COMMUNITY_CATALOG.communities.find((community) => community.slug === slug);
}
