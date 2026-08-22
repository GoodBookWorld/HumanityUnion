"use client";

import { GeographySearchSelect } from "../../design-system/components/GeographySearchSelect";
import { GEOGRAPHY_EMPTY_COPY, isCanonicalOtherRegion } from "./geography-cascade-contract";
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
  placeholder = "Search cities…",
  helperText,
  label = "City / Community",
  error,
}: CitySelectProps) {
  const { options, loading, hasStructuredData } = useGeographyCommunityOptions(
    countryCode,
    regionCode,
    includeOther,
  );

  const regionReady = Boolean(countryCode && regionCode && !isCanonicalOtherRegion(regionCode));

  const resolvedHelper =
    helperText ??
    (!countryCode || !regionCode
      ? GEOGRAPHY_EMPTY_COPY.selectRegionFirst
      : isCanonicalOtherRegion(regionCode)
        ? GEOGRAPHY_EMPTY_COPY.selectRegionFirst
        : loading
          ? GEOGRAPHY_EMPTY_COPY.loadingCities
          : !hasStructuredData
            ? includeOther
              ? GEOGRAPHY_EMPTY_COPY.noCitiesUseOther
              : GEOGRAPHY_EMPTY_COPY.noCities
            : GEOGRAPHY_EMPTY_COPY.cityHelper);

  return (
    <GeographySearchSelect
      id={id}
      label={label}
      value={value}
      options={options}
      onChange={onChange}
      disabled={disabled || !regionReady || loading}
      required={required}
      placeholder={placeholder}
      helperText={resolvedHelper}
      error={error}
      loading={loading}
      // Pack 10B — empty state lives only in helperText (avoid duplicate copy).
      emptyMessage={undefined}
      requireSearchAbove={80}
    />
  );
}
