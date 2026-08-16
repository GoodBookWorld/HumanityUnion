export interface PlatformStatisticsCounts {
  users: number;
  activeMembers: number;
  countries: number;
  regions: number;
  /** Participants with Author or Trusted Author blog capability grants. */
  authors: number;
  initiatives: number;
  /**
   * Canonical civic Proposals: Initiative Improvement Proposals in public
   * lifecycle statuses (submitted, accepted, partially_accepted, declined).
   */
  proposals: number;
  collectiveDecisions: number;
  civicActionPackages: number;
  officialResponses: number;
  civicArchive: number;
}

export interface PlatformStatisticsMeta {
  activeMemberWindowDays: number;
  generatedAt: string;
}

export interface PlatformStatisticsPayload {
  data: PlatformStatisticsCounts;
  meta: PlatformStatisticsMeta;
}
