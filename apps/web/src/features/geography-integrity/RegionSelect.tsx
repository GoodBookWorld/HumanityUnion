"use client";

import { useMemo } from "react";

import { toGeographyRegionOptions } from "@hu/geography";

import { GeographySearchSelect } from "../../design-system/components/GeographySearchSelect";
import {
  countryHasStructuredRegions,
  GEOGRAPHY_EMPTY_COPY,
} from "./geography-cascade-contract";

export interface RegionSelectProps {
  id: string;
  countryCode: string;
  value: string;
  onChange: (regionCode: string) => void;
  /** When true, includes explicit Other / Not listed fallback. */
  includeOther?: boolean;
  disabled?: boolean;
  required?: boolean;
  placeholder?: string;
  helperText?: string;
  label?: string;
  error?: string;
}

/** Region control dependent on Country — options from @hu/geography. */
export function RegionSelect({
  id,
  countryCode,
  value,
  onChange,
  includeOther = true,
  disabled = false,
  required = false,
  placeholder = "Search regions…",
  helperText,
  label = "Region",
  error,
}: RegionSelectProps) {
  const options = useMemo(
    () => (countryCode ? toGeographyRegionOptions(countryCode, includeOther) : []),
    [countryCode, includeOther],
  );

  const hasStructured = countryHasStructuredRegions(countryCode);

  const resolvedHelper =
    helperText ??
    (!countryCode
      ? GEOGRAPHY_EMPTY_COPY.selectCountryFirst
      : !hasStructured
        ? includeOther
          ? GEOGRAPHY_EMPTY_COPY.noRegionsUseOther
          : GEOGRAPHY_EMPTY_COPY.noRegions
        : undefined);

  return (
    <GeographySearchSelect
      id={id}
      label={label}
      value={value}
      options={options}
      onChange={onChange}
      disabled={disabled || !countryCode}
      required={required}
      placeholder={placeholder}
      helperText={resolvedHelper}
      error={error}
      emptyMessage={
        countryCode && !hasStructured && !includeOther
          ? GEOGRAPHY_EMPTY_COPY.noRegions
          : undefined
      }
    />
  );
}
