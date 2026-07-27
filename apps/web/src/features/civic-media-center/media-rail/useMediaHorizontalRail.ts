"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type UIEvent,
} from "react";

import type { HorizontalRailLayout } from "./horizontal-section.types";

function getDefaultVisibleCount(layout: HorizontalRailLayout): number {
  if (layout === "four-two-one" || layout === "four-three-one") {
    return 4;
  }

  return 3;
}

function resolveVisibleCount(layout: HorizontalRailLayout): number {
  if (typeof window === "undefined") {
    return getDefaultVisibleCount(layout);
  }

  if (window.matchMedia("(max-width: 767px)").matches) {
    return 1;
  }

  if (window.matchMedia("(max-width: 1279px)").matches) {
    return layout === "four-three-one" ? 3 : 2;
  }

  return getDefaultVisibleCount(layout);
}

export interface UseHorizontalRailOptions {
  itemCount: number;
  layout?: HorizontalRailLayout;
  label: string;
}

/** @deprecated Use UseHorizontalRailOptions */
export type UseMediaHorizontalRailOptions = UseHorizontalRailOptions;

export function useHorizontalRail({
  itemCount,
  layout = "three-two-one",
  label,
}: UseHorizontalRailOptions) {
  const instructionsId = useId();
  const viewportRef = useRef<HTMLDivElement>(null);
  const [startIndex, setStartIndex] = useState(0);
  const [visibleCount, setVisibleCount] = useState(() => getDefaultVisibleCount(layout));

  useEffect(() => {
    setStartIndex(0);
    viewportRef.current?.scrollTo({ left: 0, behavior: "auto" });
  }, [itemCount]);

  useEffect(() => {
    const updateVisibleCount = () => {
      setVisibleCount(resolveVisibleCount(layout));
      setStartIndex(0);
    };

    updateVisibleCount();

    const mobileQuery = window.matchMedia("(max-width: 767px)");
    const tabletQuery = window.matchMedia("(max-width: 1279px)");

    mobileQuery.addEventListener("change", updateVisibleCount);
    tabletQuery.addEventListener("change", updateVisibleCount);
    window.addEventListener("resize", updateVisibleCount);

    return () => {
      mobileQuery.removeEventListener("change", updateVisibleCount);
      tabletQuery.removeEventListener("change", updateVisibleCount);
      window.removeEventListener("resize", updateVisibleCount);
    };
  }, [itemCount, layout]);

  const maxStart = Math.max(0, itemCount - visibleCount);
  const allItemsVisible = itemCount <= visibleCount;

  useEffect(() => {
    if (startIndex > maxStart) {
      setStartIndex(maxStart);
    }
  }, [itemCount, maxStart, startIndex]);

  const scrollToIndex = useCallback(
    (nextIndex: number) => {
      const clamped = Math.max(0, Math.min(maxStart, nextIndex));
      setStartIndex(clamped);

      const viewport = viewportRef.current;

      if (!viewport) {
        return;
      }

      const slide = viewport.querySelector<HTMLElement>(`[data-horizontal-rail-index="${clamped}"]`);

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

  useEffect(() => {
    const viewport = viewportRef.current;

    if (!viewport) {
      return;
    }

    const handleWheel = (event: WheelEvent) => {
      if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) {
        return;
      }

      event.preventDefault();
      viewport.scrollLeft += event.deltaY;
    };

    viewport.addEventListener("wheel", handleWheel, { passive: false });

    return () => {
      viewport.removeEventListener("wheel", handleWheel);
    };
  }, [itemCount]);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        showPrevious();
      }

      if (event.key === "ArrowRight") {
        event.preventDefault();
        showNext();
      }
    },
    [showNext, showPrevious],
  );

  const handleScroll = useCallback(
    (event: UIEvent<HTMLDivElement>) => {
      const viewport = event.currentTarget;
      const slides = Array.from(
        viewport.querySelectorAll<HTMLElement>("[data-horizontal-rail-index]"),
      );

      if (slides.length === 0) {
        return;
      }

      const viewportLeft = viewport.scrollLeft;
      let nearestIndex = 0;
      let nearestDistance = Number.POSITIVE_INFINITY;

      for (const slide of slides) {
        const index = Number(slide.dataset.horizontalRailIndex ?? "0");
        const distance = Math.abs(slide.offsetLeft - viewportLeft);

        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearestIndex = index;
        }
      }

      if (nearestIndex !== startIndex) {
        setStartIndex(nearestIndex);
      }
    },
    [startIndex],
  );

  const canScrollPrevious = startIndex > 0;
  const canScrollNext = startIndex < maxStart;
  const visibleEnd = Math.min(startIndex + visibleCount, itemCount);

  return {
    instructionsId,
    viewportRef,
    startIndex,
    visibleCount,
    canScrollPrevious,
    canScrollNext,
    allItemsVisible,
    visibleEnd,
    showPrevious,
    showNext,
    handleKeyDown,
    handleScroll,
    label,
  };
}

/** @deprecated Use useHorizontalRail */
export const useMediaHorizontalRail = useHorizontalRail;

export type { HorizontalRailLayout as MediaRailLayout };
