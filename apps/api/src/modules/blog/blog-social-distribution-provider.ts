/**
 * Pack 17D — external social API provider boundary.
 *
 * A configured Pack 17C profile URL is not sufficient to auto-post.
 * Until a real OAuth/API provider is wired, readiness stays not_connected.
 * Never store or return provider credentials here.
 */
import type { PlatformSocialNetworkId } from "@hu/types";
import { PLATFORM_SOCIAL_NETWORK_IDS } from "@hu/types";

export type BlogSocialExternalProviderReadiness = "not_connected" | "ready" | "error";

export interface BlogSocialExternalProviderDescriptor {
  readonly networkId: PlatformSocialNetworkId;
  readonly readiness: BlogSocialExternalProviderReadiness;
  readonly note: string;
}

/**
 * Future OAuth/API integrations implement this interface.
 * Pack 17D ships descriptors only — no live publish calls.
 */
export interface BlogSocialExternalProvider {
  readonly networkId: PlatformSocialNetworkId;
  getReadiness(): Promise<BlogSocialExternalProviderReadiness>;
  /**
   * Reserved for future provider publish. Must never be called as a fake success path.
   */
  publish?(input: {
    postId: string;
    destinationUrl: string;
  }): Promise<{ delivered: boolean; reason: string }>;
}

export function listBlogSocialExternalProviderDescriptors(): readonly BlogSocialExternalProviderDescriptor[] {
  return PLATFORM_SOCIAL_NETWORK_IDS.map((networkId) => ({
    networkId,
    readiness: "not_connected" as const,
    note: "Pack 17D — no external API/OAuth provider is connected yet.",
  }));
}

export function getBlogSocialExternalProviderReadiness(
  networkId: PlatformSocialNetworkId,
): BlogSocialExternalProviderReadiness {
  void networkId;
  return "not_connected";
}
