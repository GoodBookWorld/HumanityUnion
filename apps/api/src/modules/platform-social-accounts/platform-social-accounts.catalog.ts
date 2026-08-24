/**
 * Pack 17C — canonical network catalog + seed defaults for official public URLs.
 * Credentials / OAuth / API tokens are never part of this model.
 */
import type { PlatformSocialAccount, PlatformSocialNetworkId } from "@hu/types";
import { PLATFORM_SOCIAL_NETWORKS } from "@hu/types";

/** Host allowlists used for reasonable HTTPS social URL validation. */
export const PLATFORM_SOCIAL_HOST_ALLOWLIST: Record<
  PlatformSocialNetworkId,
  readonly string[]
> = {
  facebook: ["facebook.com", "www.facebook.com", "fb.com", "www.fb.com", "m.facebook.com"],
  youtube: ["youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be"],
  instagram: ["instagram.com", "www.instagram.com"],
  x: ["x.com", "www.x.com", "twitter.com", "www.twitter.com", "mobile.twitter.com"],
};

/** Historical public footer destinations used as first-run seeds (URLs only). */
export const PLATFORM_SOCIAL_SEED_URLS: Record<PlatformSocialNetworkId, string> = {
  facebook: "https://www.facebook.com/HumanityUnionWS/",
  youtube: "https://www.youtube.com/@HumanityUnionWS",
  instagram: "https://www.instagram.com/humanity_union/",
  x: "https://x.com/HumanityUnionWS",
};

const EPOCH = "1970-01-01T00:00:00.000Z";

export function labelForNetwork(networkId: PlatformSocialNetworkId): string {
  const match = PLATFORM_SOCIAL_NETWORKS.find((network) => network.networkId === networkId);
  return match?.label ?? networkId;
}

export function buildSeedPlatformSocialAccount(
  networkId: PlatformSocialNetworkId,
): PlatformSocialAccount {
  return {
    networkId,
    label: labelForNetwork(networkId),
    url: PLATFORM_SOCIAL_SEED_URLS[networkId],
    enabled: true,
    updatedAt: EPOCH,
  };
}

export function isPlatformSocialNetworkId(value: string): value is PlatformSocialNetworkId {
  return PLATFORM_SOCIAL_NETWORKS.some((network) => network.networkId === value);
}
