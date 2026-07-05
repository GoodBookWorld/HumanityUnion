export interface KnownInitiativeCommunity {
  slug: string;
  name: string;
  regionLabel: string;
  countryLabel: string;
}

export const KNOWN_INITIATIVE_COMMUNITIES: readonly KnownInitiativeCommunity[] = [
  {
    slug: "nelson-community-garden",
    name: "Nelson Community Garden",
    regionLabel: "Central Kootenay",
    countryLabel: "Canada",
  },
  {
    slug: "kootenay-lake-protection-society",
    name: "Kootenay Lake Protection Society",
    regionLabel: "Central Kootenay",
    countryLabel: "Canada",
  },
];

export function getKnownInitiativeCommunity(
  communitySlug: string,
): KnownInitiativeCommunity | undefined {
  return KNOWN_INITIATIVE_COMMUNITIES.find((community) => community.slug === communitySlug);
}

export function isKnownInitiativeCommunitySlug(communitySlug: string): boolean {
  return KNOWN_INITIATIVE_COMMUNITIES.some((community) => community.slug === communitySlug);
}
