export interface PlatformStatisticsCounts {
  users: number;
  activeMembers: number;
  countries: number;
  regions: number;
  initiatives: number;
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
