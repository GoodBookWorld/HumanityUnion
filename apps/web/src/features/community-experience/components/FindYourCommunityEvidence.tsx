"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";

import type { CommunityCatalogPublicProjection } from "@hu/types";

interface FindYourCommunityEvidenceProps {
  catalog: CommunityCatalogPublicProjection;
  currentCommunitySlug: string;
}

function normalizeSearchQuery(query: string): string {
  return query.trim().toLowerCase();
}

function isActiveCommunityRoute(
  community: CommunityCatalogPublicProjection["communities"][number],
): boolean {
  return community.communityRouteStatus === "active" && community.communityHref.length > 0;
}

export function FindYourCommunityEvidence({
  catalog,
  currentCommunitySlug,
}: FindYourCommunityEvidenceProps) {
  const t = useTranslations("publicGeo");
  const [query, setQuery] = useState("");

  const availableCommunities = useMemo(
    () => catalog.communities.filter(isActiveCommunityRoute),
    [catalog.communities],
  );

  const results = useMemo(() => {
    const normalizedQuery = normalizeSearchQuery(query);

    if (!normalizedQuery) {
      return availableCommunities;
    }

    return availableCommunities.filter((community) => {
      const haystack =
        `${community.name} ${community.description} ${community.activityArea} ${community.regionLabel}`.toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [availableCommunities, query]);

  return (
    <div className="find-your-community">
      <p className="find-your-community__note">{t("community.find.currentCommunityNote")}</p>

      <p className="find-your-community__browse-label">{t("community.find.browseLabel")}</p>

      <label className="find-your-community__search" htmlFor="find-your-community-query">
        {t("community.find.searchLabel")}
      </label>
      <input
        id="find-your-community-query"
        className="find-your-community__input"
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={t("community.find.searchPlaceholder")}
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
                    <span>
                      {community.name} {t("shared.currentSuffix")}
                    </span>
                  ) : (
                    <Link href={community.communityHref}>{community.name}</Link>
                  )}
                </h3>
                <p className="find-your-community__result-description">{community.description}</p>
                <dl className="find-your-community__result-meta">
                  <div>
                    <dt>{t("shared.activityArea")}</dt>
                    <dd>{community.activityArea}</dd>
                  </div>
                  <div>
                    <dt>{t("shared.geographicContext")}</dt>
                    <dd>
                      {community.regionLabel}, {community.countryLabel}
                    </dd>
                  </div>
                  <div>
                    <dt>{t("shared.publicInitiatives")}</dt>
                    <dd>{community.initiativeCount}</dd>
                  </div>
                </dl>
                {community.slug !== currentCommunitySlug ? (
                  <p className="find-your-community__result-link">
                    <Link href={community.communityHref}>{t("shared.observeCommunity")}</Link>
                  </p>
                ) : null}
              </article>
            </li>
          ))}
        </ul>
      ) : (
        <p className="find-your-community__empty" role="status">
          {t("community.find.emptyResults")}
        </p>
      )}

      {catalog.source === "bootstrap" ? (
        <p className="find-your-community__source" role="note">
          {t("shared.bootstrapCommunitiesObserve", { count: availableCommunities.length })}
        </p>
      ) : null}
    </div>
  );
}
