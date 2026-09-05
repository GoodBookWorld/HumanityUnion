"use client";

import { useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";

import {
  getLocalizedCountryDisplayName,
  toGeographyCountryOptions,
} from "@hu/geography";

import { GeographySearchSelect } from "../../design-system/components/GeographySearchSelect";

export interface CountrySelectProps {
  id: string;
  value: string;
  onChange: (countryCode: string) => void;
  disabled?: boolean;
  required?: boolean;
  placeholder?: string;
  helperText?: string;
  label?: string;
  error?: string;
}

/** Canonical Country control — single source via @hu/geography (Pack 08K.3 localized labels). */
export function CountrySelect({
  id,
  value,
  onChange,
  disabled = false,
  required = false,
  placeholder,
  helperText,
  label,
  error,
}: CountrySelectProps) {
  const locale = useLocale();
  const t = useTranslations("initiativeExperience");
  const options = useMemo(
    () =>
      toGeographyCountryOptions().map((option) => ({
        ...option,
        label: getLocalizedCountryDisplayName(option.code, locale, option.label),
      })),
    [locale],
  );
  const resolvedLabel = label ?? t("manage.fields.country");
  const resolvedPlaceholder = placeholder ?? t("manage.fields.searchCountries");

  return (
    <GeographySearchSelect
      id={id}
      label={resolvedLabel}
      value={value}
      options={options}
      onChange={onChange}
      disabled={disabled}
      required={required}
      placeholder={resolvedPlaceholder}
      helperText={helperText}
      error={error}
      loadingPlaceholder={t("manage.geography.loading")}
      filterAriaLabel={t("manage.geography.filterAria", { label: resolvedLabel })}
    />
  );
}
