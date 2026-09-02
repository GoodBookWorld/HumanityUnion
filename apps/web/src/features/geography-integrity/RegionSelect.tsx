"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";

import { OTHER_REGION_SLUG, toGeographyRegionOptions } from "@hu/geography";

import { GeographySearchSelect } from "../../design-system/components/GeographySearchSelect";
import { countryHasStructuredRegions } from "./geography-cascade-contract";

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
  placeholder,
  helperText,
  label,
  error,
}: RegionSelectProps) {
  const t = useTranslations("initiativeExperience");
  const resolvedLabel = label ?? t("manage.fields.region");
  const resolvedPlaceholder = placeholder ?? t("manage.fields.searchRegions");
  const otherLabel = t("manage.geography.otherNotListed");

  const options = useMemo(() => {
    if (!countryCode) {
      return [];
    }
    return toGeographyRegionOptions(countryCode, includeOther).map((option) =>
      option.slug === OTHER_REGION_SLUG ? { ...option, label: otherLabel } : option,
    );
  }, [countryCode, includeOther, otherLabel]);

  const hasStructured = countryHasStructuredRegions(countryCode);

  const resolvedHelper =
    helperText ??
    (!countryCode
      ? t("manage.geography.selectCountryFirst")
      : !hasStructured
        ? includeOther
          ? t("manage.geography.noRegionsUseOther")
          : t("manage.geography.noRegions")
        : undefined);

  return (
    <GeographySearchSelect
      id={id}
      label={resolvedLabel}
      value={value}
      options={options}
      onChange={onChange}
      disabled={disabled || !countryCode}
      required={required}
      placeholder={resolvedPlaceholder}
      helperText={resolvedHelper}
      error={error}
      loadingPlaceholder={t("manage.geography.loading")}
      filterAriaLabel={t("manage.geography.filterAria", { label: resolvedLabel })}
      // Pack 10B — empty state lives only in helperText (avoid duplicate copy).
      emptyMessage={undefined}
    />
  );
}
