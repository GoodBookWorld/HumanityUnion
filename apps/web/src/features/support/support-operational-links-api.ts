import { apiRequest } from "../../lib/api-client";
import type { PlatformSupportLinkPublicListResponse } from "@hu/types";

import { SUPPORT_LINK_FALLBACKS } from "./support.constants";

export interface ResolvedSupportOperationalLinks {
  readonly donationUrl: string | null;
  readonly volunteerUrl: string | null;
  readonly regionalProgramUrl: string | null;
}

const RETIRED_WORDPRESS_REGIONAL_PROGRAM = "huws.org/regional-program";

function resolveRegionalProgramUrl(stored: string | undefined): string {
  if (!stored || stored.includes(RETIRED_WORDPRESS_REGIONAL_PROGRAM) || stored === "#") {
    return SUPPORT_LINK_FALLBACKS.regional_program;
  }
  return stored;
}

/**
 * Public Support operational links from canonical platform settings,
 * with historical Support page defaults as fallbacks.
 *
 * Retired WordPress `/regional-program/` values are never returned;
 * they resolve to the HU-owned `/regional-program` page.
 */
export async function fetchPublicSupportOperationalLinks(): Promise<ResolvedSupportOperationalLinks> {
  try {
    const response = await apiRequest<PlatformSupportLinkPublicListResponse>(
      "/api/v1/platform/support-links",
    );
    const byId = new Map(response.links.map((link) => [link.linkId, link.url] as const));
    return {
      donationUrl: byId.get("donation") ?? SUPPORT_LINK_FALLBACKS.donation,
      volunteerUrl: byId.get("volunteer") ?? SUPPORT_LINK_FALLBACKS.volunteer,
      regionalProgramUrl: resolveRegionalProgramUrl(byId.get("regional_program")),
    };
  } catch {
    return {
      donationUrl: SUPPORT_LINK_FALLBACKS.donation,
      volunteerUrl: SUPPORT_LINK_FALLBACKS.volunteer,
      regionalProgramUrl: SUPPORT_LINK_FALLBACKS.regional_program,
    };
  }
}
