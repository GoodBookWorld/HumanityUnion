"use client";

import { useEffect, useState } from "react";

import {
  fetchCommunitiesByRegion,
  OTHER_REGION_SLUG,
  toGeographyCommunityOptions,
  type GeographyCommunityOption,
} from "@hu/geography";

export interface UseGeographyCommunityOptionsResult {
  options: readonly GeographyCommunityOption[];
  loading: boolean;
  /** True when at least one structured city record was returned (before Other). */
  hasStructuredData: boolean;
}

/**
 * Loads City/Community options for Country + Region.
 * Clears when region is missing or is the free-text Other sentinel.
 */
export function useGeographyCommunityOptions(
  countryCode: string,
  regionCode: string,
  includeOther = true,
): UseGeographyCommunityOptionsResult {
  const [options, setOptions] = useState<readonly GeographyCommunityOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasStructuredData, setHasStructuredData] = useState(false);

  useEffect(() => {
    if (!countryCode || !regionCode || regionCode === OTHER_REGION_SLUG) {
      setOptions([]);
      setHasStructuredData(false);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    void fetchCommunitiesByRegion(countryCode, regionCode)
      .then((communities) => {
        if (cancelled) {
          return;
        }

        setHasStructuredData(communities.length > 0);
        setOptions(
          toGeographyCommunityOptions(countryCode, regionCode, communities, includeOther),
        );
      })
      .catch(() => {
        if (!cancelled) {
          setHasStructuredData(false);
          setOptions(toGeographyCommunityOptions(countryCode, regionCode, [], includeOther));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [countryCode, regionCode, includeOther]);

  return { options, loading, hasStructuredData };
}
