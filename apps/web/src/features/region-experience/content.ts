export function regionIdentityContextIntroduction(regionName: string): string {
  return `This page shows public civic activity associated with ${regionName} on Humanity Union. Observation here sits between national and community scope within one connected civic space.`;
}

export function regionalStatisticsContextIntroduction(regionName: string): string {
  return `These figures summarize public civic activity associated with ${regionName} on Humanity Union. Counts and indicators are computed from public records — derived values are labeled accordingly.`;
}

export function regionalPipelineContextIntroduction(regionName: string): string {
  return `Participation on Humanity Union follows a structured civic path from proposal through collective action. This overview shows how many public initiatives are visible at each stage associated with ${regionName}.`;
}

export function regionalInitiativesContextIntroduction(regionName: string): string {
  return `These are recent public initiatives associated with ${regionName} on Humanity Union. Active cards link to verifiable public records you may read without registering.`;
}

export const REGIONAL_INTERACTIVE_MAP_CONTENT = {
  title: "Regional Interactive Map",
  contextIntroduction:
    "This map previews how civic activity appears geographically within a region on Humanity Union. Only routes that exist today are linked — unavailable sub-regions remain preview-only.",
  regionScopeLabel: "Region scope: British Columbia",
  subRegionUnavailableMessage:
    "No Region Experience route exists for this sub-area yet. This selection previews future scope only.",
  returnToRegionLabel: "Return to regional scope",
} as const;

export const BC_MAP_COMMUNITIES = [
  {
    id: "nelson-community-garden",
    label: "Nelson Community Garden",
    href: "/community/nelson-community-garden",
  },
  {
    id: "kootenay-lake-protection-society",
    label: "Kootenay Lake Protection Society",
    href: "/community/kootenay-lake-protection-society",
  },
] as const;

export const BC_MAP_SUBREGIONS = [{ id: "central-kootenay", label: "Central Kootenay" }] as const;

export const COMMUNITY_DISCOVERY_CONTENT = {
  title: "Community Discovery",
  contextIntroduction:
    "Communities on Humanity Union emerge through civic participation — they are not assigned by administrators. The participant-created communities below belong to this region and may be observed when a public route exists.",
  browseLabel: "Participant-created communities in this region",
  participationNote:
    "Listed communities are observation entry points created through participation — not an exhaustive administrator-maintained directory.",
  visitorConclusion:
    "Community pages use the same Public Experience architecture at community scope. Discovery here prepares descent from regional observation to community context.",
} as const;

export const REGIONAL_STATISTICS_PUBLIC_NOTE =
  "Public aggregate indicators only — no private participant identities and no operational database access.";

export const REGIONAL_STATISTICS_VISITOR_CONCLUSION =
  "These aggregates describe observable public activity — not regional performance rankings or promotional claims.";

export const REGIONAL_PIPELINE_VISITOR_CONCLUSION =
  "Stage distribution shows how structured participation appears regionally — the same civic path used at country and community scopes.";

export const REGIONAL_INITIATIVES_EMPTY_MESSAGE =
  "No public initiatives are associated with this region yet.";

export const REGIONAL_INITIATIVES_VISITOR_CONCLUSION =
  "Cards with an active public record link to verifiable civic detail. Demonstration cards without public records are labeled and not linked.";
