export interface GeographySearchScope {
  countrySlug?: string;
  regionSlug?: string;
  communitySlug?: string;
}

export function buildSearchUrlForGeographyScope(scope: GeographySearchScope): string {
  const params = new URLSearchParams();

  if (scope.countrySlug) {
    params.set("country", scope.countrySlug);
  }

  if (scope.regionSlug) {
    params.set("region", scope.regionSlug);
  }

  if (scope.communitySlug) {
    params.set("community", scope.communitySlug);
  }

  const query = params.toString();
  return query.length > 0 ? `/search?${query}` : "/search";
}
