export function countryIdentityContextIntroduction(countryName: string): string {
  return `This page shows public civic activity associated with ${countryName} on Humanity Union. Observation here is part of one connected national, regional and global civic space — not a separate platform.`;
}

export function nationalStatisticsContextIntroduction(countryName: string): string {
  return `These figures summarize public civic activity associated with ${countryName} on Humanity Union. Counts and indicators are computed from public records — derived values are labeled accordingly.`;
}

export function nationalPipelineContextIntroduction(countryName: string): string {
  return `Participation on Humanity Union follows a structured civic path from proposal through collective action. This overview shows how many public initiatives are visible at each stage associated with ${countryName}.`;
}

export function nationalInitiativesContextIntroduction(countryName: string): string {
  return `These are recent public initiatives associated with ${countryName} on Humanity Union. Active cards link to verifiable public records you may read without registering.`;
}

export const NATIONAL_INTERACTIVE_MAP_CONTENT = {
  title: "National Interactive Map",
  contextIntroduction:
    "This map previews how civic activity appears geographically within a country on Humanity Union. Selecting a region prepares descent to Region scope when Region Experience is available.",
  countryScopeLabel: "Country scope: Canada",
  regionUnavailableMessage:
    "Region Experience is not yet available. This selection previews future regional scope only.",
  returnToCountryLabel: "Return to country scope",
} as const;

export const CANADA_MAP_REGIONS = [
  { id: "central-kootenay", label: "Central Kootenay" },
  { id: "british-columbia", label: "British Columbia" },
  { id: "prairies", label: "Prairies" },
] as const;

export const TRUSTED_NATIONAL_MEDIA_CONTENT = {
  title: "Trusted National Media",
  contextIntroduction:
    "Supporting national media may provide additional civic context when public-safe country associations exist. These records support observation — they are not primary evidence and do not assert truth.",
  visitorConclusion:
    "Media listed here is supporting context only. Primary civic evidence remains in public participation records above.",
} as const;

export const REGIONAL_EXPLORATION_CONTENT = {
  title: "Regional Exploration",
  contextIntroduction:
    "Regions within a country provide the next level of geographic civic observation on Humanity Union. Browse regions below to prepare descent from national to regional scope.",
  browseLabel: "Regions within this country",
  visitorConclusion:
    "Region pages use the same Public Experience architecture at regional scope. Community discovery remains participant-driven at Community Experience.",
} as const;

export const NATIONAL_STATISTICS_PUBLIC_NOTE =
  "Public aggregate indicators only — no private participant identities and no operational database access.";

export const NATIONAL_STATISTICS_VISITOR_CONCLUSION =
  "These aggregates describe observable public activity — not national performance rankings or promotional claims.";

export const NATIONAL_PIPELINE_VISITOR_CONCLUSION =
  "Stage distribution shows how structured participation appears nationally — the same civic path used at world and community scopes.";

export const NATIONAL_INITIATIVES_EMPTY_MESSAGE =
  "No public initiatives are associated with this country yet.";

export const NATIONAL_INITIATIVES_VISITOR_CONCLUSION =
  "Cards with an active public record link to verifiable civic detail. Demonstration cards without public records are labeled and not linked.";
