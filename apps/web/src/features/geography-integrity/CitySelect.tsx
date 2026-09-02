"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";

import { OTHER_COMMUNITY_SLUG } from "@hu/geography";

import { GeographySearchSelect } from "../../design-system/components/GeographySearchSelect";
import { isCanonicalOtherRegion } from "./geography-cascade-contract";
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
 * Pack 10H1 — full community list is browseable after Region; search is optional.
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
  placeholder,
  helperText,
  label,
  error,
}: CitySelectProps) {
  const t = useTranslations("initiativeExperience");
  const resolvedLabel = label ?? t("manage.fields.cityCommunity");
  const resolvedPlaceholder = placeholder ?? t("manage.geography.citySearchPlaceholder");
  const otherLabel = t("manage.geography.otherNotListed");

  const { options: rawOptions, loading, hasStructuredData, structuredCount, deliveryFailed } =
    useGeographyCommunityOptions(countryCode, regionCode, includeOther);

  const options = useMemo(
    () =>
      rawOptions.map((option) =>
        option.slug === OTHER_COMMUNITY_SLUG ? { ...option, label: otherLabel } : option,
      ),
    [otherLabel, rawOptions],
  );

  const regionReady = Boolean(countryCode && regionCode && !isCanonicalOtherRegion(regionCode));

  const resolvedHelper =
    helperText ??
    (!countryCode || !regionCode
      ? t("manage.geography.selectRegionFirst")
      : isCanonicalOtherRegion(regionCode)
        ? t("manage.geography.selectRegionFirst")
        : loading
          ? t("manage.geography.loadingCities")
          : deliveryFailed
            ? undefined
            : !hasStructuredData
              ? includeOther
                ? t("manage.geography.noCitiesUseOther")
                : t("manage.geography.noCities")
              : t("manage.geography.citiesAvailable", { count: structuredCount }));

  const resolvedError =
    error ?? (deliveryFailed ? t("manage.geography.cityDeliveryFailure") : undefined);

  return (
    <GeographySearchSelect
      key={`${countryCode}::${regionCode}`}
      id={id}
      label={resolvedLabel}
      value={value}
      options={options}
      onChange={onChange}
      disabled={disabled || !regionReady || deliveryFailed}
      required={required}
      placeholder={resolvedPlaceholder}
      helperText={resolvedHelper}
      error={resolvedError}
      loading={loading}
      emptyMessage={undefined}
      noMatchMessage={t("manage.geography.noCityMatches")}
      emptyOptionLabel={
        includeOther ? t("manage.geography.selectEllipsis") : t("manage.geography.allCommunities")
      }
      loadingPlaceholder={t("manage.geography.loading")}
      filterAriaLabel={t("manage.geography.filterAria", { label: resolvedLabel })}
    />
  );
}
