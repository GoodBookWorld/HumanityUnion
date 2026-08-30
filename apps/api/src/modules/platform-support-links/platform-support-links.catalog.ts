/**
 * Production Completion Pack 01 — Support operational link catalog + defaults.
 * Mirrors platform-social-accounts architecture (URLs only; no credentials).
 */
import type { PlatformSupportLink, PlatformSupportLinkId } from "@hu/types";
import { PLATFORM_SUPPORT_LINKS } from "@hu/types";

/**
 * Historical Support page destinations used as first-run seeds / public fallbacks.
 * Volunteer starts cleared (button was disabled / coming soon).
 */
export const PLATFORM_SUPPORT_LINK_SEED_URLS: Record<
  PlatformSupportLinkId,
  string | null
> = {
  donation: "https://buy.stripe.com/6oE03n4bc9Vm9A45kl",
  volunteer: null,
  regional_program: "https://huws.org/regional-program/",
};

const EPOCH = "1970-01-01T00:00:00.000Z";

export function labelForSupportLink(linkId: PlatformSupportLinkId): string {
  const match = PLATFORM_SUPPORT_LINKS.find((link) => link.linkId === linkId);
  return match?.label ?? linkId;
}

export function buildSeedPlatformSupportLink(
  linkId: PlatformSupportLinkId,
): PlatformSupportLink {
  const url = PLATFORM_SUPPORT_LINK_SEED_URLS[linkId];
  return {
    linkId,
    label: labelForSupportLink(linkId),
    url,
    enabled: Boolean(url),
    updatedAt: EPOCH,
  };
}

export function isPlatformSupportLinkId(value: string): value is PlatformSupportLinkId {
  return PLATFORM_SUPPORT_LINKS.some((link) => link.linkId === value);
}
