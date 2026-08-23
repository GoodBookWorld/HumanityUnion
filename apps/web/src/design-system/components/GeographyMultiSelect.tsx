"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";

import "./geography-search-select.css";

export interface GeographyOption {
  slug: string;
  label: string;
}

interface GeographyMultiSelectProps {
  id?: string;
  label: string;
  values: string[];
  options: readonly GeographyOption[];
  onChange: (values: string[]) => void;
  disabled?: boolean;
  placeholder?: string;
  helperText?: string;
  maxSelections?: number;
  limitReachedMessage?: string;
  /**
   * Pack 10G — for large city lists, hide options until the user types.
   */
  requireSearchAbove?: number;
  requireSearch?: boolean;
  noMatchMessage?: string;
  searchInviteMessage?: string;
}

export function GeographyMultiSelect({
  id,
  label,
  values,
  options,
  onChange,
  disabled = false,
  placeholder = "Search countries…",
  helperText,
  maxSelections,
  limitReachedMessage,
  requireSearchAbove,
  requireSearch = false,
  noMatchMessage = "No matching cities or communities found.",
  searchInviteMessage = "Type in the search field to find a city or community.",
}: GeographyMultiSelectProps) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const listboxId = `${fieldId}-listbox`;
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOptions = useMemo(
    () =>
      values.map((value) => ({
        slug: value,
        label: options.find((option) => option.slug === value)?.label ?? value,
      })),
    [options, values],
  );

  const remainingOptions = useMemo(
    () => options.filter((option) => !values.includes(option.slug)),
    [options, values],
  );

  const isLargeList =
    requireSearch ||
    (typeof requireSearchAbove === "number" && remainingOptions.length > requireSearchAbove);

  const needle = query.trim().toLowerCase();
  const hasQuery = needle.length > 0;

  const availableOptions = useMemo(() => {
    if (!hasQuery) {
      if (isLargeList) {
        return [];
      }

      return remainingOptions;
    }

    return remainingOptions.filter(
      (option) =>
        option.label.toLowerCase().includes(needle) || option.slug.toLowerCase().includes(needle),
    );
  }, [hasQuery, isLargeList, needle, remainingOptions]);

  const awaitingSearch = isLargeList && !hasQuery && !disabled && options.length > 0;
  const noMatches =
    !disabled && hasQuery && remainingOptions.length > 0 && availableOptions.length === 0;

  const limitReached = typeof maxSelections === "number" && values.length >= maxSelections;

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  useEffect(() => {
    if (activeIndex >= availableOptions.length) {
      setActiveIndex(Math.max(availableOptions.length - 1, 0));
    }
  }, [activeIndex, availableOptions.length]);

  function addValue(slug: string) {
    if (values.includes(slug) || limitReached) {
      return;
    }

    onChange([...values, slug]);
    setQuery("");
    setActiveIndex(0);
  }

  function removeValue(slug: string) {
    onChange(values.filter((entry) => entry !== slug));
  }

  function handleSearchKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((index) => Math.min(index + 1, Math.max(availableOptions.length - 1, 0)));
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((index) => Math.max(index - 1, 0));
      return;
    }

    if (event.key === "Enter" && open && availableOptions[activeIndex]) {
      event.preventDefault();
      addValue(availableOptions[activeIndex].slug);
      return;
    }

    if (event.key === "Escape") {
      setOpen(false);
    }
  }

  const showDropdown =
    open &&
    !limitReached &&
    (availableOptions.length > 0 || awaitingSearch || noMatches);

  return (
    <div
      ref={containerRef}
      className={
        awaitingSearch
          ? "geography-multi-select geography-multi-select--combobox geography-multi-select--awaiting-search"
          : "geography-multi-select geography-multi-select--combobox"
      }
    >
      <label className="geography-search-select__label" htmlFor={fieldId}>
        {label}
      </label>
      {helperText ? (
        <span className="geography-search-select__helper" id={`${fieldId}-helper`}>
          {helperText}
        </span>
      ) : null}

      <div className="geography-multi-select__chips" aria-label={`Selected ${label}`}>
        {selectedOptions.length > 0 ? (
          selectedOptions.map((option) => (
            <span key={option.slug} className="geography-multi-select__chip">
              <span>{option.label}</span>
              <button
                type="button"
                className="geography-multi-select__chip-remove"
                disabled={disabled}
                aria-label={`Remove ${option.label}`}
                onClick={() => removeValue(option.slug)}
              >
                ×
              </button>
            </span>
          ))
        ) : (
          <span className="geography-multi-select__empty">None selected</span>
        )}
      </div>

      <div className="geography-multi-select__combobox">
        <input
          id={fieldId}
          className="geography-search-select__search hu-form-control"
          type="search"
          role="combobox"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-describedby={helperText ? `${fieldId}-helper` : undefined}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
            setActiveIndex(0);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleSearchKeyDown}
          placeholder={placeholder}
          disabled={disabled || limitReached}
          autoComplete="off"
        />

        {showDropdown ? (
          <ul
            id={listboxId}
            className="geography-multi-select__dropdown"
            role="listbox"
            aria-label={`${label} options`}
          >
            {awaitingSearch ? (
              <li className="geography-multi-select__invite" role="presentation">
                {searchInviteMessage}
              </li>
            ) : null}
            {noMatches ? (
              <li className="geography-multi-select__invite" role="status">
                {noMatchMessage}
              </li>
            ) : null}
            {availableOptions.map((option, index) => (
              <li key={option.slug}>
                <button
                  type="button"
                  role="option"
                  aria-selected={index === activeIndex}
                  className={
                    index === activeIndex
                      ? "geography-multi-select__option geography-multi-select__option--active"
                      : "geography-multi-select__option"
                  }
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => addValue(option.slug)}
                >
                  {option.label}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <div className="geography-multi-select__actions">
        <button
          type="button"
          className="geography-multi-select__clear"
          disabled={disabled || values.length === 0}
          onClick={() => onChange([])}
        >
          Clear All
        </button>
      </div>

      {limitReached ? (
        <p className="geography-multi-select__limit" role="status">
          {limitReachedMessage ?? `You may select up to ${maxSelections} countries.`}
        </p>
      ) : null}
    </div>
  );
}
