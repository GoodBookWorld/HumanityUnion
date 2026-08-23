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
  /** Structured community count before optional Other sentinel. */
  structuredCount: number;
  /**
   * Pack 10F — true when the community asset request failed (404 / network / invalid).
   * Distinct from a successful empty dataset.
   */
  deliveryFailed: boolean;
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
  const [structuredCount, setStructuredCount] = useState(0);
  const [deliveryFailed, setDeliveryFailed] = useState(false);

  useEffect(() => {
    if (!countryCode || !regionCode || regionCode === OTHER_REGION_SLUG) {
      setOptions([]);
      setHasStructuredData(false);
      setStructuredCount(0);
      setDeliveryFailed(false);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setDeliveryFailed(false);

    void fetchCommunitiesByRegion(countryCode, regionCode)
      .then((communities) => {
        if (cancelled) {
          return;
        }

        setDeliveryFailed(false);
        setStructuredCount(communities.length);
        setHasStructuredData(communities.length > 0);
        setOptions(
          toGeographyCommunityOptions(countryCode, regionCode, communities, includeOther),
        );
      })
      .catch(() => {
        if (!cancelled) {
          setDeliveryFailed(true);
          setHasStructuredData(false);
          setStructuredCount(0);
          setOptions([]);
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

  return { options, loading, hasStructuredData, structuredCount, deliveryFailed };
}
