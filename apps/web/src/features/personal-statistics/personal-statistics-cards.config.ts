import type { ParticipantStatistics } from "@hu/types";

/**
 * Profile UX Pack 02 Part 1/4/11 / Profile UX Pack 03.2 Part 18 — the shared
 * "Personal Statistics" card configuration (key/label/icon), kept in its own
 * CSS-free module so pure presentation logic (e.g. the public profile's
 * Privacy-filtered statistic cards) can import it for Node-test-runner
 * testing without transitively pulling in a `.css` side-effect import that
 * Node's CJS/ESM loader cannot parse outside of Next.js/webpack.
 */
export interface PersonalStatisticsCardConfig {
  key: keyof ParticipantStatistics;
  label: string;
  iconSrc: string;
}

export const PERSONAL_STATISTICS_CARDS: readonly PersonalStatisticsCardConfig[] = [
  {
    key: "initiativesCount",
    label: "Initiatives",
    iconSrc: "/icons/workspace/initiatives.svg",
  },
  {
    key: "collectiveDecisionsCount",
    label: "Collective Decisions",
    iconSrc: "/icons/workspace/collective-decisions.svg",
  },
  {
    key: "alliesCount",
    label: "Allies",
    iconSrc: "/icons/workspace/allies.svg",
  },
];
