export type ApproximateIpGeographySource =
  "hosting_header" | "provider" | "dev_fixture" | "unavailable";

export interface ApproximateIpGeography {
  countryCode?: string;
  countryName?: string;
  regionCode?: string;
  regionName?: string;
  cityName?: string;
  source: ApproximateIpGeographySource;
}
