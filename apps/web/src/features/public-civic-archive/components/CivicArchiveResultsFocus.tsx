"use client";

import { useSearchParams } from "next/navigation";
import { useEffect } from "react";

export function CivicArchiveResultsFocus() {
  const searchParams = useSearchParams();

  useEffect(() => {
    if (typeof window === "undefined" || window.location.hash !== "#civic-archive-results") {
      return;
    }

    const resultsHeading = document.getElementById("civic-archive-results-title");

    if (!resultsHeading) {
      return;
    }

    resultsHeading.scrollIntoView({ behavior: "smooth", block: "start" });
    resultsHeading.focus({ preventScroll: true });
  }, [searchParams]);

  return null;
}
