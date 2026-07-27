"use client";

import { useMemo, useState } from "react";

import "./geography-search-select.css";

export interface GeographyOption {
  slug: string;
  label: string;
}

interface GeographySearchSelectProps {
  id: string;
  label: string;
  value: string;
  options: readonly GeographyOption[];
  onChange: (slug: string) => void;
  disabled?: boolean;
  required?: boolean;
  placeholder?: string;
  helperText?: string;
}

export function GeographySearchSelect({
  id,
  label,
  value,
  options,
  onChange,
  disabled = false,
  required = false,
  placeholder = "Search…",
  helperText,
}: GeographySearchSelectProps) {
  const [query, setQuery] = useState("");

  const selectedLabel = options.find((option) => option.slug === value)?.label ?? "";

  const filteredOptions = useMemo(() => {
    const needle = query.trim().toLowerCase();

    if (!needle) {
      return options;
    }

    return options.filter(
      (option) => option.label.toLowerCase().includes(needle) || option.slug.includes(needle),
    );
  }, [options, query]);

  const visibleOptions = useMemo(() => {
    if (!value || filteredOptions.some((option) => option.slug === value)) {
      return filteredOptions;
    }

    const selectedOption = options.find((option) => option.slug === value);

    if (!selectedOption) {
      return filteredOptions;
    }

    return [selectedOption, ...filteredOptions];
  }, [filteredOptions, options, value]);

  return (
    <label className="geography-search-select" htmlFor={id}>
      <span className="geography-search-select__label">{label}</span>
      {helperText ? <span className="geography-search-select__helper">{helperText}</span> : null}
      <input
        id={id}
        className="geography-search-select__search hu-form-control"
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        autoComplete="off"
      />
      <select
        className="geography-search-select__select hu-form-control"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        required={required}
        aria-label={label}
      >
        <option value="">Select…</option>
        {visibleOptions.map((option) => (
          <option key={option.slug} value={option.slug}>
            {option.label}
          </option>
        ))}
      </select>
      {selectedLabel ? (
        <span className="geography-search-select__selected">Selected: {selectedLabel}</span>
      ) : null}
    </label>
  );
}

export const OTHER_REGION_SLUG = "other-not-listed";
