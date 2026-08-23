"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";

import "./geography-search-select.css";
import {
  computeGeographyWindowSlice,
  GEOGRAPHY_LIST_ROW_HEIGHT_PX,
  GEOGRAPHY_LIST_VIEWPORT_HEIGHT_PX,
  shouldWindowGeographyOptions,
} from "./geography-list-window";

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
  noMatchMessage?: string;
}

/**
 * Pack 10H1 — multi-select stays multi; list is always browseable.
 * Search filters but is never required to reveal options.
 */
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
  noMatchMessage = "No matching cities or communities found.",
}: GeographyMultiSelectProps) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const listboxId = `${fieldId}-listbox`;
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [scrollTop, setScrollTop] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

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

  const needle = query.trim().toLowerCase();
  const hasQuery = needle.length > 0;

  const availableOptions = useMemo(() => {
    if (!hasQuery) {
      return remainingOptions;
    }

    return remainingOptions.filter(
      (option) =>
        option.label.toLowerCase().includes(needle) || option.slug.toLowerCase().includes(needle),
    );
  }, [hasQuery, needle, remainingOptions]);

  const noMatches =
    !disabled && hasQuery && remainingOptions.length > 0 && availableOptions.length === 0;

  const limitReached = typeof maxSelections === "number" && values.length >= maxSelections;

  const useWindow = shouldWindowGeographyOptions(availableOptions.length);
  const windowSlice = useMemo(
    () =>
      useWindow
        ? computeGeographyWindowSlice(availableOptions.length, scrollTop)
        : {
            startIndex: 0,
            endIndex: availableOptions.length,
            offsetY: 0,
            totalHeight: availableOptions.length * GEOGRAPHY_LIST_ROW_HEIGHT_PX,
          },
    [availableOptions.length, scrollTop, useWindow],
  );
  const windowedRows = availableOptions.slice(windowSlice.startIndex, windowSlice.endIndex);

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
    setScrollTop(0);
    if (listRef.current) {
      listRef.current.scrollTop = 0;
    }
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
      setQuery("");
    }
  }

  const showDropdown = open && !limitReached;

  return (
    <div ref={containerRef} className="geography-multi-select geography-multi-select--combobox">
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
        <div className="geography-search-select__search-wrap">
          <span className="geography-search-select__search-icon" aria-hidden="true">
            <svg viewBox="0 0 20 20" width="16" height="16" focusable="false">
              <circle cx="8.5" cy="8.5" r="5.5" fill="none" stroke="currentColor" strokeWidth="1.75" />
              <path
                d="M12.75 12.75 16.5 16.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
              />
            </svg>
          </span>
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
              setScrollTop(0);
              if (listRef.current) {
                listRef.current.scrollTop = 0;
              }
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={handleSearchKeyDown}
            placeholder={placeholder}
            disabled={disabled || limitReached}
            autoComplete="off"
          />
        </div>

        {showDropdown ? (
          <div
            ref={listRef}
            id={listboxId}
            className="geography-multi-select__dropdown"
            role="listbox"
            aria-label={`${label} options`}
            style={{ maxHeight: GEOGRAPHY_LIST_VIEWPORT_HEIGHT_PX }}
            onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
          >
            {noMatches ? (
              <div className="geography-multi-select__invite" role="status">
                {noMatchMessage}
              </div>
            ) : availableOptions.length === 0 ? (
              <div className="geography-multi-select__invite" role="status">
                No more options available.
              </div>
            ) : (
              <div
                className="geography-search-select__list-spacer"
                style={{ height: windowSlice.totalHeight }}
              >
                <div
                  className="geography-search-select__list-window"
                  style={{ transform: `translateY(${windowSlice.offsetY}px)` }}
                >
                  {windowedRows.map((option, offset) => {
                    const index = windowSlice.startIndex + offset;
                    return (
                      <button
                        key={option.slug}
                        type="button"
                        role="option"
                        aria-selected={index === activeIndex}
                        className={
                          index === activeIndex
                            ? "geography-multi-select__option geography-multi-select__option--active"
                            : "geography-multi-select__option"
                        }
                        style={{ height: GEOGRAPHY_LIST_ROW_HEIGHT_PX }}
                        onMouseEnter={() => setActiveIndex(index)}
                        onClick={() => addValue(option.slug)}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
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
