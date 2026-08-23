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
  /** Label for the empty value that clears the selection. */
  emptyOptionLabel?: string;
}

/**
 * Pack 10H1 — browseable geography combobox.
 * Search filters the open list but is never required to reveal options.
 */
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
  emptyOptionLabel = "Select…",
}: GeographySearchSelectProps) {
  const listboxId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [scrollTop, setScrollTop] = useState(0);

  const selectedLabel = options.find((option) => option.slug === value)?.label ?? "";
  const needle = query.trim().toLowerCase();
  const hasQuery = needle.length > 0;

  const filteredOptions = useMemo(() => {
    if (!hasQuery) {
      return options;
    }

    return options.filter(
      (option) => option.label.toLowerCase().includes(needle) || option.slug.includes(needle),
    );
  }, [hasQuery, needle, options]);

  /** Empty clear row + filtered options for keyboard indices. */
  const selectableRows = useMemo(
    () => [{ slug: "", label: emptyOptionLabel }, ...filteredOptions],
    [emptyOptionLabel, filteredOptions],
  );

  const noMatches =
    !loading && !disabled && hasQuery && options.length > 0 && filteredOptions.length === 0;

  const useWindow = shouldWindowGeographyOptions(selectableRows.length);
  const windowSlice = useMemo(
    () =>
      useWindow
        ? computeGeographyWindowSlice(selectableRows.length, scrollTop)
        : {
            startIndex: 0,
            endIndex: selectableRows.length,
            offsetY: 0,
            totalHeight: selectableRows.length * GEOGRAPHY_LIST_ROW_HEIGHT_PX,
          },
    [scrollTop, selectableRows.length, useWindow],
  );

  const windowedRows = selectableRows.slice(windowSlice.startIndex, windowSlice.endIndex);

  const helperId = helperText ? `${id}-helper` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const emptyId = emptyMessage && options.length === 0 && !loading ? `${id}-empty` : undefined;
  const noMatchId = noMatches ? `${id}-nomatch` : undefined;
  const describedBy = [helperId, errorId, emptyId, noMatchId].filter(Boolean).join(" ");

  const controlDisabled = disabled || loading;

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
    if (activeIndex >= selectableRows.length) {
      setActiveIndex(Math.max(selectableRows.length - 1, 0));
    }
  }, [activeIndex, selectableRows.length]);

  const wasOpenRef = useRef(false);

  useEffect(() => {
    const justOpened = open && !wasOpenRef.current;
    wasOpenRef.current = open;

    if (!justOpened) {
      return;
    }

    setScrollTop(0);
    const list = listRef.current;
    if (list) {
      list.scrollTop = 0;
    }

    const selectedIdx = selectableRows.findIndex((row) => row.slug === value);
    setActiveIndex(selectedIdx >= 0 ? selectedIdx : 0);
  }, [open, selectableRows, value]);

  function choose(slug: string) {
    onChange(slug);
    setQuery("");
    setOpen(false);
    setActiveIndex(0);
  }

  function handleSearchKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((index) => Math.min(index + 1, Math.max(selectableRows.length - 1, 0)));
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((index) => Math.max(index - 1, 0));
      return;
    }

    if (event.key === "Enter" && open && selectableRows[activeIndex]) {
      event.preventDefault();
      choose(selectableRows[activeIndex].slug);
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
      setQuery("");
    }
  }

  return (
    <div
      ref={containerRef}
      className="geography-search-select geography-search-select--combobox"
    >
      <span className="geography-search-select__label" id={`${id}-label`}>
        {label}
      </span>
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
      {noMatches ? (
        <span className="geography-search-select__empty" id={noMatchId} role="status">
          {noMatchMessage}
        </span>
      ) : null}

      <button
        type="button"
        id={id}
        className={
          selectedLabel
            ? "geography-search-select__trigger geography-search-select__trigger--filled hu-form-control"
            : "geography-search-select__trigger hu-form-control"
        }
        disabled={controlDisabled}
        aria-labelledby={`${id}-label`}
        aria-describedby={describedBy || undefined}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-busy={loading || undefined}
        aria-invalid={error ? true : undefined}
        aria-required={required || undefined}
        onClick={() => {
          if (controlDisabled) {
            return;
          }
          setOpen((current) => !current);
        }}
      >
        <span className="geography-search-select__trigger-value">
          {selectedLabel || emptyOptionLabel}
        </span>
        <span className="geography-search-select__chevron" aria-hidden="true" />
      </button>

      {open && !controlDisabled ? (
        <div className="geography-search-select__panel">
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
              id={`${id}-search`}
              className="geography-search-select__search hu-form-control"
              type="search"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setActiveIndex(0);
                setScrollTop(0);
                if (listRef.current) {
                  listRef.current.scrollTop = 0;
                }
              }}
              onKeyDown={handleSearchKeyDown}
              placeholder={loading ? "Loading…" : placeholder}
              disabled={controlDisabled}
              autoComplete="off"
              aria-label={`Filter ${label}`}
              aria-controls={listboxId}
              aria-autocomplete="list"
              aria-describedby={describedBy || undefined}
            />
          </div>
          <div
            ref={listRef}
            id={listboxId}
            className="geography-search-select__list"
            role="listbox"
            aria-labelledby={`${id}-label`}
            tabIndex={-1}
            style={{ maxHeight: GEOGRAPHY_LIST_VIEWPORT_HEIGHT_PX }}
            onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
          >
            {noMatches ? (
              <div className="geography-search-select__invite" role="status">
                {noMatchMessage}
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
                    const selected = option.slug === value;
                    const active = index === activeIndex;

                    return (
                      <button
                        key={option.slug || "__empty"}
                        type="button"
                        role="option"
                        aria-selected={selected}
                        className={
                          active
                            ? "geography-search-select__option geography-search-select__option--active"
                            : "geography-search-select__option"
                        }
                        style={{ height: GEOGRAPHY_LIST_ROW_HEIGHT_PX }}
                        onMouseEnter={() => setActiveIndex(index)}
                        onClick={() => choose(option.slug)}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      ) : null}

      {selectedLabel ? (
        <span className="hu-visually-hidden" aria-live="polite">
          Selected: {selectedLabel}
        </span>
      ) : null}
    </div>
  );
}

export const OTHER_REGION_SLUG = "other-not-listed";
