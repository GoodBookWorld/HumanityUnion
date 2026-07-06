export interface KnownInitiativeCommunity {
  slug: string;
  name: string;
  regionLabel: string;
  countryLabel: string;
  countrySlug: string;
  regionSlug: string;
}

export const KNOWN_INITIATIVE_COMMUNITIES: readonly KnownInitiativeCommunity[] = [
  {
    slug: "nelson-community-garden",
    name: "Nelson Community Garden",
    regionLabel: "Central Kootenay",
    countryLabel: "Canada",
    countrySlug: "canada",
    regionSlug: "british-columbia",
  },
  {
    slug: "kootenay-lake-protection-society",
    name: "Kootenay Lake Protection Society",
    regionLabel: "Central Kootenay",
    countryLabel: "Canada",
    countrySlug: "canada",
    regionSlug: "british-columbia",
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

export function resolveInitiativeParticipationScopeMetadata(input: {
  communitySlug: string;
  isGlobal?: boolean;
}): {
  countrySlug: string;
  regionSlug: string;
  communitySlug: string;
  isGlobal: boolean;
} {
  const community = getKnownInitiativeCommunity(input.communitySlug);

  if (!community) {
    return {
      countrySlug: "",
      regionSlug: "",
      communitySlug: input.communitySlug,
      isGlobal: input.isGlobal ?? false,
    };
  }

  return {
    countrySlug: community.countrySlug,
    regionSlug: community.regionSlug,
    communitySlug: community.slug,
    isGlobal: input.isGlobal ?? false,
  };
}
