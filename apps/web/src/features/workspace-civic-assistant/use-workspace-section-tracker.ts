"use client";

import { useEffect, useState } from "react";

const DEFAULT_SECTION = "Overview";

function sectionIdFromTitle(title: string): string {
  return `section-${title.replace(/\s+/g, "-").toLowerCase()}`;
}

export function useWorkspaceSectionTracker(sectionTitles: readonly string[]): string {
  const [currentSection, setCurrentSection] = useState(DEFAULT_SECTION);

  useEffect(() => {
    const sectionIds = sectionTitles.map(sectionIdFromTitle);
    const elements = sectionIds
      .map((id) => document.getElementById(id))
      .filter((element): element is HTMLElement => element !== null);

    if (elements.length === 0) {
      return;
    }

    const visibility = new Map<string, number>();

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          visibility.set(entry.target.id, entry.isIntersecting ? entry.intersectionRatio : 0);
        }

        let bestId = sectionIdFromTitle(DEFAULT_SECTION);
        let bestRatio = 0;

        for (const [id, ratio] of visibility.entries()) {
          if (ratio > bestRatio) {
            bestRatio = ratio;
            bestId = id;
          }
        }

        const matchedTitle = sectionTitles.find((title) => sectionIdFromTitle(title) === bestId);

        if (matchedTitle && bestRatio > 0) {
          setCurrentSection(matchedTitle);
        }
      },
      {
        root: null,
        rootMargin: "-20% 0px -55% 0px",
        threshold: [0, 0.15, 0.35, 0.55, 0.75, 1],
      },
    );

    for (const element of elements) {
      observer.observe(element);
    }

    return () => {
      observer.disconnect();
    };
  }, [sectionTitles]);

  return currentSection;
}
