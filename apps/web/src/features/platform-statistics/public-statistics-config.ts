import type { CountryStatisticsCounts, PlatformStatisticsCounts } from "@hu/types";

export const PUBLIC_STATISTIC_ICONS = {
  participants: "/icons/workspace/members.svg",
  members: "/icons/workspace/member-check.svg",
  countries: "/icons/workspace/countries.svg",
  regions: "/icons/workspace/regions.svg",
  citiesCommunities: "/icons/workspace/city.svg",
  initiatives: "/icons/workspace/initiatives.svg",
  collectiveDecisions: "/icons/workspace/collective-decisions.svg",
  civicActionPackages: "/icons/workspace/packages.svg",
  officialResponses: "/icons/workspace/responses.svg",
  civicArchive: "/icons/workspace/archive.svg",
} as const;

export type HomeStatisticKey = keyof PlatformStatisticsCounts | "humanityUnionMembers";

export interface PublicStatisticCardConfig {
  key: string;
  label: string;
  iconSrc: string;
  description: string;
}

export const HOME_STATISTIC_CARDS: ReadonlyArray<
  PublicStatisticCardConfig & { key: HomeStatisticKey }
> = [
  {
    key: "users",
    label: "Participants",
    iconSrc: PUBLIC_STATISTIC_ICONS.participants,
    description: "Active authentication accounts on the platform.",
  },
  {
    key: "humanityUnionMembers",
    label: "Members",
    iconSrc: PUBLIC_STATISTIC_ICONS.members,
    description:
      "Confirmed Humanity Union Members with active Membership status. Membership never changes vote weight.",
  },
  {
    key: "countries",
    label: "Countries",
    iconSrc: PUBLIC_STATISTIC_ICONS.countries,
    description: "Distinct countries represented through participation areas and profiles.",
  },
  {
    key: "regions",
    label: "Regions",
    iconSrc: PUBLIC_STATISTIC_ICONS.regions,
    description: "Distinct country and region combinations represented on the platform.",
  },
  {
    key: "initiatives",
    label: "Initiatives",
    iconSrc: PUBLIC_STATISTIC_ICONS.initiatives,
    description: "Publicly visible civic initiatives.",
  },
  {
    key: "collectiveDecisions",
    label: "Collective Decisions",
    iconSrc: PUBLIC_STATISTIC_ICONS.collectiveDecisions,
    description: "Public collective decision records.",
  },
  {
    key: "civicActionPackages",
    label: "Civic Action Packages",
    iconSrc: PUBLIC_STATISTIC_ICONS.civicActionPackages,
    description: "Issued civic action packages connected to public initiatives.",
  },
  {
    key: "officialResponses",
    label: "Official Responses",
    iconSrc: PUBLIC_STATISTIC_ICONS.officialResponses,
    description: "Published or archived public official responses.",
  },
  {
    key: "civicArchive",
    label: "Civic Archive",
    iconSrc: PUBLIC_STATISTIC_ICONS.civicArchive,
    description: "Published public civic archive records.",
  },
];

export type CountryStatisticKey = keyof CountryStatisticsCounts;

export const COUNTRY_STATISTIC_CARDS: ReadonlyArray<
  PublicStatisticCardConfig & { key: CountryStatisticKey }
> = [
  {
    key: "participants",
    label: "Participants",
    iconSrc: PUBLIC_STATISTIC_ICONS.participants,
    description: "Active registered participants without active Member status, scoped to country.",
  },
  {
    key: "members",
    label: "Members",
    iconSrc: PUBLIC_STATISTIC_ICONS.members,
    description: "Active Members scoped to country.",
  },
  {
    key: "regions",
    label: "Regions",
    iconSrc: PUBLIC_STATISTIC_ICONS.regions,
    description: "Known administrative regions for the country.",
  },
  {
    key: "citiesCommunities",
    label: "Cities / Communities",
    iconSrc: PUBLIC_STATISTIC_ICONS.citiesCommunities,
    description: "Known selectable cities and communities for the country.",
  },
  {
    key: "initiatives",
    label: "Initiatives",
    iconSrc: PUBLIC_STATISTIC_ICONS.initiatives,
    description: "Public initiatives scoped to country.",
  },
  {
    key: "collectiveDecisions",
    label: "Collective Decisions",
    iconSrc: PUBLIC_STATISTIC_ICONS.collectiveDecisions,
    description: "Public collective decisions scoped to country.",
  },
  {
    key: "civicActionPackages",
    label: "Civic Action Packages",
    iconSrc: PUBLIC_STATISTIC_ICONS.civicActionPackages,
    description: "Issued civic action packages for initiatives in this country.",
  },
  {
    key: "officialResponses",
    label: "Official Responses",
    iconSrc: PUBLIC_STATISTIC_ICONS.officialResponses,
    description: "Published or archived official responses for initiatives in this country.",
  },
  {
    key: "civicArchive",
    label: "Civic Archive",
    iconSrc: PUBLIC_STATISTIC_ICONS.civicArchive,
    description: "Published civic archive records scoped to country.",
  },
];
