"use client";

import { useEffect, useState } from "react";

const DEFAULT_SECTION_ID = "section-overview";

export function useWorkspaceSectionTracker(
  sections: readonly { readonly id: string; readonly label: string }[],
): string {
  // Tracker identity is id-order only — ignore translated label / array reference churn.
  const sectionIdsKey = sections.map((section) => section.id).join("\0");

  const [currentSectionId, setCurrentSectionId] = useState(
    () => sections[0]?.id ?? DEFAULT_SECTION_ID,
  );

  useEffect(() => {
    const sectionIds = sectionIdsKey.length === 0 ? [] : sectionIdsKey.split("\0");
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

        let bestId = sectionIds[0] ?? DEFAULT_SECTION_ID;
        let bestRatio = 0;

        for (const [id, ratio] of visibility.entries()) {
          if (ratio > bestRatio) {
            bestRatio = ratio;
            bestId = id;
          }
        }

        if (sectionIds.includes(bestId) && bestRatio > 0) {
          setCurrentSectionId(bestId);
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
  }, [sectionIdsKey]);

  return currentSectionId;
}
