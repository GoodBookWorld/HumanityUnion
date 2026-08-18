"use client";

import { Suspense, useEffect } from "react";
import { useParams, useSearchParams } from "next/navigation";

function InitiativeExperienceRouteRedirectInner() {
  const params = useParams<{ initiativeId: string }>();
  const searchParams = useSearchParams();
  const initiativeId = params.initiativeId;

  useEffect(() => {
    if (!initiativeId) {
      return;
    }

    const query = searchParams.toString();
    const hash = window.location.hash;
    const target = `/initiatives/public/${encodeURIComponent(initiativeId)}${
      query ? `?${query}` : ""
    }${hash}`;
    window.location.replace(target);
  }, [initiativeId, searchParams]);

  return (
    <main className="pie-page">
      <p role="status">Opening initiative experience…</p>
    </main>
  );
}

/**
 * Legacy `/initiatives/{id}` entry — client redirect into the canonical
 * `/initiatives/public/{id}` experience, preserving query + hash (#manage).
 */
export default function InitiativeExperienceRouteRedirect() {
  return (
    <Suspense
      fallback={
        <main className="pie-page">
          <p role="status">Opening initiative experience…</p>
        </main>
      }
    >
      <InitiativeExperienceRouteRedirectInner />
    </Suspense>
  );
}
