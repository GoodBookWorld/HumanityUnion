"use client";

import { useMemo } from "react";

import { toGeographyCountryOptions } from "@hu/geography";

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

/** Canonical Country control — single source via @hu/geography. */
export function CountrySelect({
  id,
  value,
  onChange,
  disabled = false,
  required = false,
  placeholder = "Search countries…",
  helperText,
  label = "Country",
  error,
}: CountrySelectProps) {
  const options = useMemo(() => toGeographyCountryOptions(), []);

  return (
    <GeographySearchSelect
      id={id}
      label={label}
      value={value}
      options={options}
      onChange={onChange}
      disabled={disabled}
      required={required}
      placeholder={placeholder}
      helperText={helperText}
      error={error}
    />
  );
}
