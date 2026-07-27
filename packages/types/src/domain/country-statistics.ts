/** Aggregate public-safe country statistics (TASK-095). */
export interface CountryStatisticsCounts {
  participants: number;
  members: number;
  regions: number;
  citiesCommunities: number;
  initiatives: number;
  collectiveDecisions: number;
  civicActionPackages: number;
  officialResponses: number;
  civicArchive: number;
}

export interface CountryStatisticsPayload {
  countryCode: string;
  countryName: string;
  data: CountryStatisticsCounts;
  meta: {
    generatedAt: string;
    transparencyNote: string;
  };
}
