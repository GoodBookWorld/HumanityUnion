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
  /** Shown when the user has typed a query that matches nothing. */
  noMatchMessage?: string;
  /**
   * When options exceed this count and the search box is empty,
   * only the selected option (if any) is listed — forces search for large city sets.
   */
  requireSearchAbove?: number;
  /**
   * Pack 10G — force large-list search UX (hide options until query) even when
   * option count includes sentinels that would skew requireSearchAbove.
   */
  requireSearch?: boolean;
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
  noMatchMessage = "No matching cities or communities found.",
  requireSearchAbove,
  requireSearch = false,
}: GeographySearchSelectProps) {
  const [query, setQuery] = useState("");

  const selectedLabel = options.find((option) => option.slug === value)?.label ?? "";
  const needle = query.trim().toLowerCase();
  const hasQuery = needle.length > 0;

  const isLargeList =
    requireSearch ||
    (typeof requireSearchAbove === "number" && options.length > requireSearchAbove);

  const filteredOptions = useMemo(() => {
    if (!hasQuery) {
      if (isLargeList) {
        const selectedOption = options.find((option) => option.slug === value);
        return selectedOption ? [selectedOption] : [];
      }

      return options;
    }

    return options.filter(
      (option) => option.label.toLowerCase().includes(needle) || option.slug.includes(needle),
    );
  }, [hasQuery, isLargeList, needle, options, value]);

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

  /** Large dataset loaded; user has not searched yet — invite typing (not a false empty). */
  const awaitingSearch = isLargeList && !hasQuery && !value;

  const noMatches =
    !loading && !disabled && hasQuery && options.length > 0 && filteredOptions.length === 0;

  const helperId = helperText ? `${id}-helper` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const emptyId = emptyMessage && options.length === 0 && !loading ? `${id}-empty` : undefined;
  const noMatchId = noMatches ? `${id}-nomatch` : undefined;
  const searchStatusId = awaitingSearch ? `${id}-search-status` : undefined;

  const describedBy = [helperId, errorId, emptyId, noMatchId, searchStatusId]
    .filter(Boolean)
    .join(" ");

  const searchPlaceholder = loading
    ? "Loading…"
    : awaitingSearch
      ? placeholder
      : placeholder;

  const blankOptionLabel = awaitingSearch ? "Start typing to search…" : "Select…";

  const controlDisabled = disabled || loading;

  return (
    <label
      className={
        awaitingSearch
          ? "geography-search-select geography-search-select--awaiting-search"
          : "geography-search-select"
      }
      htmlFor={id}
    >
      <span className="geography-search-select__label">{label}</span>
      {helperText ? (
        <span className="geography-search-select__helper" id={helperId}>
          {helperText}
        </span>
      ) : null}
      {error ? (
        <span className="geography-search-select__error" id={errorId} role="alert">
          {error}
        </span>
      ) : null}
      {emptyMessage && options.length === 0 && !loading ? (
        <span className="geography-search-select__empty" id={emptyId} role="status">
          {emptyMessage}
        </span>
      ) : null}
      {awaitingSearch ? (
        <span className="geography-search-select__search-status" id={searchStatusId} role="status">
          Type in the search field to find a city or community.
        </span>
      ) : null}
      {noMatches ? (
        <span className="geography-search-select__empty" id={noMatchId} role="status">
          {noMatchMessage}
        </span>
      ) : null}
      <input
        id={id}
        className="geography-search-select__search hu-form-control"
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={searchPlaceholder}
        disabled={controlDisabled}
        autoComplete="off"
        aria-busy={loading || undefined}
        aria-describedby={describedBy || undefined}
        aria-invalid={error ? true : undefined}
        aria-controls={`${id}-options`}
      />
      <select
        id={`${id}-options`}
        className="geography-search-select__select hu-form-control"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={controlDisabled}
        required={required}
        aria-label={label}
        aria-busy={loading || undefined}
        aria-describedby={describedBy || undefined}
        aria-invalid={error ? true : undefined}
      >
        <option value="">{blankOptionLabel}</option>
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
