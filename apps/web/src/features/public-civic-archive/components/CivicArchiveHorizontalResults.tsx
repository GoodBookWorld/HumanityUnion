"use client";

import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent } from "react";

import type { CivicArchiveLifecycleRecord } from "@hu/types";

import {
  PublicArchiveInitiativeMiniCard,
  PublicArchiveInitiativeMiniCardSkeleton,
} from "./PublicArchiveInitiativeMiniCard";

function resolveVisibleCount(): number {
  if (typeof window === "undefined") {
    return 3;
  }

  if (window.matchMedia("(max-width: 640px)").matches) {
    return 1;
  }

  if (window.matchMedia("(max-width: 900px)").matches) {
    return 2;
  }

  return 3;
}

interface CivicArchiveHorizontalResultsProps {
  records: CivicArchiveLifecycleRecord[];
  loading?: boolean;
}

export function CivicArchiveHorizontalResults({
  records,
  loading = false,
}: CivicArchiveHorizontalResultsProps) {
  const instructionsId = useId();
  const viewportRef = useRef<HTMLDivElement>(null);
  const [startIndex, setStartIndex] = useState(0);
  const [visibleCount, setVisibleCount] = useState(() => resolveVisibleCount());

  useEffect(() => {
    const updateVisibleCount = () => {
      setVisibleCount(resolveVisibleCount());
      setStartIndex(0);
    };

    updateVisibleCount();

    const mobileQuery = window.matchMedia("(max-width: 640px)");
    const tabletQuery = window.matchMedia("(max-width: 900px)");

    mobileQuery.addEventListener("change", updateVisibleCount);
    tabletQuery.addEventListener("change", updateVisibleCount);
    window.addEventListener("resize", updateVisibleCount);

    return () => {
      mobileQuery.removeEventListener("change", updateVisibleCount);
      tabletQuery.removeEventListener("change", updateVisibleCount);
      window.removeEventListener("resize", updateVisibleCount);
    };
  }, []);

  useEffect(() => {
    setStartIndex(0);
  }, [records]);

  const maxStart = Math.max(0, records.length - visibleCount);

  useEffect(() => {
    if (startIndex > maxStart) {
      setStartIndex(maxStart);
    }
  }, [records.length, startIndex, maxStart]);

  const scrollToIndex = useCallback(
    (nextIndex: number) => {
      const clamped = Math.max(0, Math.min(maxStart, nextIndex));
      setStartIndex(clamped);

      const viewport = viewportRef.current;

      if (!viewport) {
        return;
      }

      const slide = viewport.querySelector<HTMLElement>(`[data-archive-index="${clamped}"]`);

      slide?.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
        block: "nearest",
        inline: "start",
      });
    },
    [maxStart],
  );

  const showPrevious = useCallback(() => {
    scrollToIndex(startIndex - 1);
  }, [scrollToIndex, startIndex]);

  const showNext = useCallback(() => {
    scrollToIndex(startIndex + 1);
  }, [scrollToIndex, startIndex]);

  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      showPrevious();
    }

    if (event.key === "ArrowRight") {
      event.preventDefault();
      showNext();
    }
  }

  if (loading) {
    return (
      <div className="civic-archive-results__horizontal" aria-label="Loading archive results">
        <div
          className="civic-archive-results__viewport civic-archive-results__viewport--loading"
          data-visible-count={visibleCount}
        >
          <div className="civic-archive-results__track">
            {Array.from({ length: visibleCount }).map((_, index) => (
              <div key={index} className="civic-archive-results__slide">
                <PublicArchiveInitiativeMiniCardSkeleton />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const pageCount = Math.max(1, maxStart + 1);
  const activePage = startIndex;
  const canScrollPrevious = startIndex > 0;
  const canScrollNext = startIndex < maxStart;

  return (
    <div className="civic-archive-results__horizontal">
      <p id={instructionsId} className="civic-archive-page__visually-hidden">
        Civic Archive results. Use Previous and Next archive record buttons or horizontal scrolling
        to browse additional cards.
      </p>

      <div
        className={`civic-archive-results__shell ${
          canScrollPrevious ? "civic-archive-results__shell--fade-start" : ""
        } ${canScrollNext ? "civic-archive-results__shell--fade-end" : ""}`}
      >
        <div
          ref={viewportRef}
          className="civic-archive-results__viewport"
          data-visible-count={visibleCount}
          aria-live="polite"
          aria-describedby={instructionsId}
          tabIndex={0}
          onKeyDown={handleKeyDown}
          onScroll={(event) => {
            const viewport = event.currentTarget;
            const slides = Array.from(
              viewport.querySelectorAll<HTMLElement>("[data-archive-index]"),
            );

            if (slides.length === 0) {
              return;
            }

            const viewportLeft = viewport.scrollLeft;
            let nearestIndex = 0;
            let nearestDistance = Number.POSITIVE_INFINITY;

            for (const slide of slides) {
              const index = Number(slide.dataset.archiveIndex ?? "0");
              const distance = Math.abs(slide.offsetLeft - viewportLeft);

              if (distance < nearestDistance) {
                nearestDistance = distance;
                nearestIndex = index;
              }
            }

            if (nearestIndex !== startIndex) {
              setStartIndex(nearestIndex);
            }
          }}
        >
          <div className="civic-archive-results__track">
            {records.map((record, index) => (
              <div
                key={record.initiativeId}
                className="civic-archive-results__slide"
                data-archive-index={index}
              >
                <PublicArchiveInitiativeMiniCard record={record} />
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="civic-archive-results__controls">
        <button
          type="button"
          className="civic-archive-results__control"
          aria-label="Previous archive records"
          disabled={!canScrollPrevious}
          onClick={showPrevious}
        >
          Previous
        </button>

        <div className="civic-archive-results__progress" aria-hidden={pageCount <= 1}>
          {Array.from({ length: pageCount }, (_, pageIndex) => (
            <span
              key={pageIndex}
              className={
                pageIndex === activePage
                  ? "civic-archive-results__dot civic-archive-results__dot--active"
                  : "civic-archive-results__dot"
              }
            />
          ))}
        </div>

        <p className="civic-archive-results__status" aria-live="polite">
          Showing {startIndex + 1}–{Math.min(startIndex + visibleCount, records.length)} of{" "}
          {records.length}
        </p>

        <button
          type="button"
          className="civic-archive-results__control"
          aria-label="Next archive records"
          disabled={!canScrollNext}
          onClick={showNext}
        >
          Next
        </button>
      </div>
    </div>
  );
}
