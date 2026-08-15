export interface CountryOption {
  code: string;
  alpha3: string;
  name: string;
  region: string;
  subregion: string;
}

export interface AdministrativeRegionOption {
  countryCode: string;
  code: string;
  localCode?: string;
  name: string;
  type?: string;
}

/** @deprecated Use CountryOption — retained for existing selector components. */
export interface GeographyCountryOption {
  slug: string;
  label: string;
  code: string;
}

/** @deprecated Use AdministrativeRegionOption — retained for existing selector components. */
export interface GeographyRegionOption {
  slug: string;
  label: string;
  countrySlug: string;
}

export interface CommunityOption {
  countryCode: string;
  regionCode: string;
  code: string;
  name: string;
}

/** @deprecated Use CommunityOption — retained for existing selector components. */
export interface GeographyCommunityOption {
  slug: string;
  label: string;
  countrySlug: string;
  regionSlug: string;
}
