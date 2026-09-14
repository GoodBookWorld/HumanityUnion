/**
 * RESET 05A — shared Initiative geography vs election-name separation.
 * PUBLIC_CHOICE communityAssociation is election name (MACHINE_CONTENT), not GEOGRAPHY city.
 */

import { formatPublicGeography } from "@hu/geography";
import { resolveInitiativeLifecycleProfile } from "@hu/types";

export function isPublicGeographyWorldFallback(label: string | undefined): boolean {
  return !label?.trim() || label.trim() === "World";
}

/**
 * Format participant-facing geography for an Initiative.
 * Never mixes PUBLIC_CHOICE election names into the geography label.
 */
export function formatInitiativePublicGeography(input: {
  readonly locale?: string;
  readonly countryCode?: string;
  readonly regionCode?: string;
  readonly communitySlug?: string;
  readonly regionLabel?: string;
  readonly communityAssociation?: string;
  readonly lifecycleProfile?: string | null;
}): string {
  const isPublicChoice =
    resolveInitiativeLifecycleProfile(input.lifecycleProfile) === "PUBLIC_CHOICE";

  return formatPublicGeography({
    countryCode: input.countryCode,
    regionCode: input.regionCode,
    communitySlug: input.communitySlug,
    regionLabel: input.regionLabel,
    locale: input.locale,
    ...(isPublicChoice ? {} : { communityAssociation: input.communityAssociation }),
  });
}
