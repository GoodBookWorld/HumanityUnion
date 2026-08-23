"use client";

import { GeographySearchSelect } from "../../design-system/components/GeographySearchSelect";
import {
  CITY_REQUIRE_SEARCH_ABOVE,
  formatLargeCitySearchHelper,
  GEOGRAPHY_EMPTY_COPY,
  isCanonicalOtherRegion,
} from "./geography-cascade-contract";
import { useGeographyCommunityOptions } from "./useGeographyCommunityOptions";

export interface CitySelectProps {
  id: string;
  countryCode: string;
  regionCode: string;
  value: string;
  onChange: (communityCode: string) => void;
  includeOther?: boolean;
  disabled?: boolean;
  required?: boolean;
  placeholder?: string;
  helperText?: string;
  label?: string;
  error?: string;
}

/**
 * City / Community control dependent on Country + Region.
 * Uses searchable select; does not render giant unfiltered option lists.
 */
export function CitySelect({
  id,
  countryCode,
  regionCode,
  value,
  onChange,
  includeOther = true,
  disabled = false,
  required = false,
  placeholder = GEOGRAPHY_EMPTY_COPY.citySearchPlaceholder,
  helperText,
  label = "City / Community",
  error,
}: CitySelectProps) {
  const { options, loading, hasStructuredData, structuredCount, deliveryFailed } =
    useGeographyCommunityOptions(countryCode, regionCode, includeOther);

  const regionReady = Boolean(countryCode && regionCode && !isCanonicalOtherRegion(regionCode));
  const isLargeList = structuredCount > CITY_REQUIRE_SEARCH_ABOVE;

  const resolvedHelper =
    helperText ??
    (!countryCode || !regionCode
      ? GEOGRAPHY_EMPTY_COPY.selectRegionFirst
      : isCanonicalOtherRegion(regionCode)
        ? GEOGRAPHY_EMPTY_COPY.selectRegionFirst
        : loading
          ? GEOGRAPHY_EMPTY_COPY.loadingCities
          : deliveryFailed
            ? undefined
            : !hasStructuredData
              ? includeOther
                ? GEOGRAPHY_EMPTY_COPY.noCitiesUseOther
                : GEOGRAPHY_EMPTY_COPY.noCities
              : isLargeList
                ? formatLargeCitySearchHelper(structuredCount)
                : GEOGRAPHY_EMPTY_COPY.cityHelper);

  const resolvedError = error ?? (deliveryFailed ? GEOGRAPHY_EMPTY_COPY.cityDeliveryFailure : undefined);

  return (
    <GeographySearchSelect
      key={`${countryCode}::${regionCode}`}
      id={id}
      label={label}
      value={value}
      options={options}
      onChange={onChange}
      disabled={disabled || !regionReady || deliveryFailed}
      required={required}
      placeholder={placeholder}
      helperText={resolvedHelper}
      error={resolvedError}
      loading={loading}
      // Pack 10B/10G — empty / no-match states live in helperText + noMatchMessage.
      emptyMessage={undefined}
      noMatchMessage={GEOGRAPHY_EMPTY_COPY.noCityMatches}
      requireSearch={isLargeList}
      requireSearchAbove={CITY_REQUIRE_SEARCH_ABOVE}
    />
  );
}
