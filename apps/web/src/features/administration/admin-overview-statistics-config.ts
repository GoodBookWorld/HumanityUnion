import type { PlatformStatisticsCounts } from "@hu/types";

import {
  PUBLIC_STATISTIC_ICONS,
  type PublicStatisticCardConfig,
} from "../platform-statistics/public-statistics-config";

export type AdminOverviewStatisticKey =
  | keyof PlatformStatisticsCounts
  | "humanityUnionMembers"
  | "publishedBlogPosts";

/** Pack 04 — Operational Overview exactly 12 metrics, order fixed, 6+6 desktop. */
export const ADMIN_OVERVIEW_STATISTIC_CARDS: ReadonlyArray<
  PublicStatisticCardConfig & { key: AdminOverviewStatisticKey }
> = [
  {
    key: "countries",
    label: "Countries",
    iconSrc: PUBLIC_STATISTIC_ICONS.countries,
    description: "Distinct countries from active participation areas (or member profiles).",
  },
  {
    key: "regions",
    label: "Regions",
    iconSrc: PUBLIC_STATISTIC_ICONS.regions,
    description: "Distinct country and region combinations on the platform.",
  },
  {
    key: "users",
    label: "Participants",
    iconSrc: PUBLIC_STATISTIC_ICONS.participants,
    description: "Active authentication accounts (registered Participants).",
  },
  {
    key: "humanityUnionMembers",
    label: "Members",
    iconSrc: PUBLIC_STATISTIC_ICONS.members,
    description: "Confirmed Humanity Union Members with active Membership status.",
  },
  {
    key: "authors",
    label: "Authors",
    iconSrc: "/icons/workspace/author.svg",
    description:
      "Participants with Author or Trusted Author blog capability grants.",
  },
  {
    key: "publishedBlogPosts",
    label: "Published Blog posts",
    iconSrc: "/icons/workspace/blog.svg",
    description: "Publicly listed Blog publications.",
  },
  {
    key: "initiatives",
    label: "Initiatives",
    iconSrc: PUBLIC_STATISTIC_ICONS.initiatives,
    description: "Publicly visible civic initiatives.",
  },
  {
    key: "proposals",
    label: "Proposals",
    iconSrc: "/icons/workspace/proposals.svg",
    description:
      "Canonical Initiative Improvement Proposals in submitted or decided public statuses.",
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

export const ADMIN_OVERVIEW_METRIC_ORDER: readonly AdminOverviewStatisticKey[] =
  ADMIN_OVERVIEW_STATISTIC_CARDS.map((card) => card.key);
