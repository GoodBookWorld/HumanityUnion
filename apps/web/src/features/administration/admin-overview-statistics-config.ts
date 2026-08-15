import type { PlatformStatisticsCounts } from "@hu/types";

import {
  PUBLIC_STATISTIC_ICONS,
  type PublicStatisticCardConfig,
} from "../platform-statistics/public-statistics-config";

export type AdminOverviewStatisticKey =
  | keyof PlatformStatisticsCounts
  | "humanityUnionMembers"
  | "publishedBlogPosts"
  | "editorialPending";

export const ADMIN_OVERVIEW_STATISTIC_CARDS: ReadonlyArray<
  PublicStatisticCardConfig & { key: AdminOverviewStatisticKey }
> = [
  {
    key: "users",
    label: "Participants",
    iconSrc: PUBLIC_STATISTIC_ICONS.participants,
    description: "Active authentication accounts on the platform (platform statistics).",
  },
  {
    key: "activeMembers",
    label: "Recently active Participants",
    iconSrc: PUBLIC_STATISTIC_ICONS.members,
    description:
      "Participants with recent activity within the platform statistics active window.",
  },
  {
    key: "humanityUnionMembers",
    label: "Members",
    iconSrc: PUBLIC_STATISTIC_ICONS.members,
    description: "Confirmed Humanity Union Members with active Membership status.",
  },
  {
    key: "initiatives",
    label: "Initiatives",
    iconSrc: PUBLIC_STATISTIC_ICONS.initiatives,
    description: "Publicly visible civic initiatives (platform statistics).",
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
  {
    key: "publishedBlogPosts",
    label: "Published Blog posts",
    iconSrc: PUBLIC_STATISTIC_ICONS.initiatives,
    description: "Publicly listed Blog publications.",
  },
  {
    key: "editorialPending",
    label: "Editorial queue",
    iconSrc: PUBLIC_STATISTIC_ICONS.officialResponses,
    description: "Blog publications awaiting Editorial Review.",
  },
];
