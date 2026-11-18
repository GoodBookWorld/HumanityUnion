"use client";

import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import "./geography-search-select.css";
import {
  computeGeographyWindowSlice,
  GEOGRAPHY_LIST_ROW_HEIGHT_PX,
  GEOGRAPHY_LIST_VIEWPORT_HEIGHT_PX,
  shouldWindowGeographyOptions,
} from "./geography-list-window";

interface GeographyPanelPosition {
  top: number;
  left: number;
  width: number;
}

export interface GeographyOption {
  slug: string;
  label: string;
  /** Extra text the filter also matches (not displayed). */
  searchText?: string;
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
  /** Placeholder shown in the filter input while options are loading. */
  loadingPlaceholder?: string;
  /** Accessible name for the filter input. */
  filterAriaLabel?: string;
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
  loadingPlaceholder = "Loading…",
  filterAriaLabel,
}: GeographySearchSelectProps) {
  const listboxId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [scrollTop, setScrollTop] = useState(0);
  const [panelPosition, setPanelPosition] = useState<GeographyPanelPosition | null>(null);
  const [portalReady, setPortalReady] = useState(false);

  const selectedLabel = options.find((option) => option.slug === value)?.label ?? "";
  const needle = query.trim().toLowerCase();
  const hasQuery = needle.length > 0;

  const filteredOptions = useMemo(() => {
    if (!hasQuery) {
      return options;
    }

    return options.filter(
      (option) =>
        option.label.toLowerCase().includes(needle) ||
        option.slug.includes(needle) ||
        (option.searchText?.toLowerCase().includes(needle) ?? false),
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
    setPortalReady(true);
  }, []);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (containerRef.current?.contains(target) || panelRef.current?.contains(target)) {
        return;
      }
      setOpen(false);
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  useEffect(() => {
    if (activeIndex >= selectableRows.length) {
      setActiveIndex(Math.max(selectableRows.length - 1, 0));
    }
  }, [activeIndex, selectableRows.length]);

  /**
   * Escape overflow:auto ancestors (e.g. RRP application modal scroll) by
   * portaling a fixed panel. Apply follow-up coordinates via DOM mutation so
   * scroll/resize never remounts the panel mid-pointer interaction.
   */
  useLayoutEffect(() => {
    if (!open) {
      setPanelPosition(null);
      return;
    }

    function measure(): GeographyPanelPosition | null {
      const trigger = triggerRef.current;
      if (!trigger) {
        return null;
      }
      const rect = trigger.getBoundingClientRect();
      return {
        top: rect.bottom + 4,
        left: rect.left,
        width: Math.max(rect.width, 160),
      };
    }

    function applyDomPosition(next: GeographyPanelPosition) {
      const panel = panelRef.current;
      if (!panel) {
        return;
      }
      panel.style.top = `${next.top}px`;
      panel.style.left = `${next.left}px`;
      panel.style.width = `${next.width}px`;
    }

    const initial = measure();
    if (initial) {
      setPanelPosition(initial);
      applyDomPosition(initial);
    }

    triggerRef.current?.scrollIntoView({ block: "nearest", inline: "nearest" });
    requestAnimationFrame(() => {
      const next = measure();
      if (next) {
        applyDomPosition(next);
      }
    });

    function handleScroll(event: Event) {
      const target = event.target;
      if (
        target instanceof Node &&
        (containerRef.current?.contains(target) || panelRef.current?.contains(target))
      ) {
        return;
      }
      const next = measure();
      if (next) {
        applyDomPosition(next);
      }
    }

    function handleResize() {
      const next = measure();
      if (next) {
        applyDomPosition(next);
      }
    }

    window.addEventListener("resize", handleResize);
    window.addEventListener("scroll", handleScroll, true);
    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("scroll", handleScroll, true);
    };
  }, [open]);

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
    // Focus filter so keyboard selection works immediately.
    queueMicrotask(() => searchInputRef.current?.focus());
  }, [open, selectableRows, value]);

  useEffect(() => {
    if (!open || !useWindow || !listRef.current) {
      return;
    }
    const list = listRef.current;
    const rowTop = activeIndex * GEOGRAPHY_LIST_ROW_HEIGHT_PX;
    const rowBottom = rowTop + GEOGRAPHY_LIST_ROW_HEIGHT_PX;
    if (rowTop < list.scrollTop) {
      list.scrollTop = rowTop;
    } else if (rowBottom > list.scrollTop + GEOGRAPHY_LIST_VIEWPORT_HEIGHT_PX) {
      list.scrollTop = rowBottom - GEOGRAPHY_LIST_VIEWPORT_HEIGHT_PX;
    }
  }, [activeIndex, open, useWindow]);

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
        ref={triggerRef}
        type="button"
        id={id}
        className={
          selectedLabel
            ? "geography-search-select__trigger geography-search-select__trigger--filled hu-form-control"
            : "geography-search-select__trigger hu-form-control"
        }
        disabled={controlDisabled}
        aria-labelledby={`${id}-label ${id}-value`}
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
        <span className="geography-search-select__trigger-value" id={`${id}-value`}>
          {selectedLabel || emptyOptionLabel}
        </span>
        <span className="geography-search-select__chevron" aria-hidden="true" />
      </button>

      {selectedLabel ? (
        <span className="hu-visually-hidden" aria-live="polite">
          Selected: {selectedLabel}
        </span>
      ) : null}

      {portalReady &&
      open &&
      !controlDisabled &&
      panelPosition &&
      typeof document !== "undefined"
        ? createPortal(
            <div
              ref={panelRef}
              className="geography-search-select__panel geography-search-select__panel--fixed"
              style={{
                top: panelPosition.top,
                left: panelPosition.left,
                width: panelPosition.width,
              }}
            >
              <div className="geography-search-select__search-wrap">
                <span className="geography-search-select__search-icon" aria-hidden="true">
                  <svg viewBox="0 0 20 20" width="16" height="16" focusable="false">
                    <circle
                      cx="8.5"
                      cy="8.5"
                      r="5.5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.75"
                    />
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
                  ref={searchInputRef}
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
                  placeholder={loading ? loadingPlaceholder : placeholder}
                  disabled={controlDisabled}
                  autoComplete="off"
                  aria-label={filterAriaLabel ?? `Filter ${label}`}
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
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

export const OTHER_REGION_SLUG = "other-not-listed";
