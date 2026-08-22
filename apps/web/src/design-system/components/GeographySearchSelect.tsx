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
  error?: string;
  loading?: boolean;
  emptyMessage?: string;
  /**
   * When options exceed this count and the search box is empty,
   * only the selected option (if any) is listed — forces search for large city sets.
   */
  requireSearchAbove?: number;
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
  error,
  loading = false,
  emptyMessage,
  requireSearchAbove,
}: GeographySearchSelectProps) {
  const [query, setQuery] = useState("");

  const selectedLabel = options.find((option) => option.slug === value)?.label ?? "";

  const filteredOptions = useMemo(() => {
    const needle = query.trim().toLowerCase();

    if (!needle) {
      if (typeof requireSearchAbove === "number" && options.length > requireSearchAbove) {
        const selectedOption = options.find((option) => option.slug === value);
        return selectedOption ? [selectedOption] : [];
      }

      return options;
    }

    return options.filter(
      (option) => option.label.toLowerCase().includes(needle) || option.slug.includes(needle),
    );
  }, [options, query, requireSearchAbove, value]);

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

  const showSearchHint =
    typeof requireSearchAbove === "number" &&
    options.length > requireSearchAbove &&
    !query.trim() &&
    !value;

  const describedBy = [
    helperText ? `${id}-helper` : null,
    error ? `${id}-error` : null,
    emptyMessage && options.length === 0 && !loading ? `${id}-empty` : null,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <label className="geography-search-select" htmlFor={id}>
      <span className="geography-search-select__label">{label}</span>
      {helperText ? (
        <span className="geography-search-select__helper" id={`${id}-helper`}>
          {helperText}
        </span>
      ) : null}
      {error ? (
        <span className="geography-search-select__error" id={`${id}-error`} role="alert">
          {error}
        </span>
      ) : null}
      {emptyMessage && options.length === 0 && !loading ? (
        <span className="geography-search-select__empty" id={`${id}-empty`} role="status">
          {emptyMessage}
        </span>
      ) : null}
      <input
        id={id}
        className="geography-search-select__search hu-form-control"
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={
          showSearchHint ? "Type to search…" : loading ? "Loading…" : placeholder
        }
        disabled={disabled || loading}
        autoComplete="off"
        aria-busy={loading || undefined}
        aria-describedby={describedBy || undefined}
        aria-invalid={error ? true : undefined}
      />
      <select
        className="geography-search-select__select hu-form-control"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled || loading}
        required={required}
        aria-label={label}
        aria-busy={loading || undefined}
        aria-describedby={describedBy || undefined}
        aria-invalid={error ? true : undefined}
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
