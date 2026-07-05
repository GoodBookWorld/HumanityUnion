"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import type { CommunityCatalogPublicProjection } from "@hu/types";

import { FIND_YOUR_COMMUNITY_CONTENT } from "../content";

interface FindYourCommunityEvidenceProps {
  catalog: CommunityCatalogPublicProjection;
  currentCommunitySlug: string;
}

function normalizeSearchQuery(query: string): string {
  return query.trim().toLowerCase();
}

export function FindYourCommunityEvidence({
  catalog,
  currentCommunitySlug,
}: FindYourCommunityEvidenceProps) {
  const [query, setQuery] = useState("");

  const results = useMemo(() => {
    const normalizedQuery = normalizeSearchQuery(query);

    if (!normalizedQuery) {
      return catalog.communities;
    }

    return catalog.communities.filter((community) => {
      const haystack =
        `${community.name} ${community.description} ${community.activityArea}`.toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [catalog.communities, query]);

  return (
    <div className="find-your-community">
      <p className="find-your-community__note">
        {FIND_YOUR_COMMUNITY_CONTENT.currentCommunityNote}
      </p>

      <label className="find-your-community__search" htmlFor="find-your-community-query">
        {FIND_YOUR_COMMUNITY_CONTENT.searchLabel}
      </label>
      <input
        id="find-your-community-query"
        className="find-your-community__input"
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={FIND_YOUR_COMMUNITY_CONTENT.searchPlaceholder}
        autoComplete="off"
      />

      {results.length > 0 ? (
        <ul className="find-your-community__results" aria-live="polite">
          {results.map((community) => (
            <li key={community.slug} className="find-your-community__result">
              <article aria-labelledby={`community-result-${community.slug}`}>
                <h3
                  className="find-your-community__result-title"
                  id={`community-result-${community.slug}`}
                >
                  {community.slug === currentCommunitySlug ? (
                    <span>{community.name} (current)</span>
                  ) : (
                    <Link href={community.communityHref}>{community.name}</Link>
                  )}
                </h3>
                <p className="find-your-community__result-description">{community.description}</p>
                <dl className="find-your-community__result-meta">
                  <div>
                    <dt>Activity Area</dt>
                    <dd>{community.activityArea}</dd>
                  </div>
                  <div>
                    <dt>Public initiatives</dt>
                    <dd>{community.initiativeCount}</dd>
                  </div>
                </dl>
              </article>
            </li>
          ))}
        </ul>
      ) : (
        <p className="find-your-community__empty" role="status">
          {FIND_YOUR_COMMUNITY_CONTENT.emptyResults}
        </p>
      )}

      {catalog.source === "bootstrap" ? (
        <p className="find-your-community__source" role="note">
          Bootstrap demonstration data
        </p>
      ) : null}
    </div>
  );
}
