"use client";

import type { PublicNewsArticleItem } from "@hu/types";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";

import {
  MediaRailControls,
  MediaRailViewport,
  useMediaHorizontalRail,
} from "../../civic-media-center/media-rail";
import { HuxDiscoveryShell } from "../../horizontal-experience";
import { isApiUnavailableError } from "../../../lib/api-client";
import { fetchPublicNewsArticles } from "../api";
import {
  collectFilterOptions,
  DEFAULT_PUBLIC_NEWS_FILTERS,
  filterPublicNewsArticles,
  PUBLIC_NEWS_RAIL_LIMIT,
  sortPublicNewsArticles,
  type PublicNewsFilters,
} from "../public-news-discovery.utils";
import {
  filterPublicNewsForCountry,
  type CountryPublicNewsMediaRef,
} from "../public-news-country.utils";
import { PublicNewsPlaceholder } from "./PublicNewsPlaceholder";
import { PublicNewsToolbar } from "./PublicNewsToolbar";
import { PublicNewsCard } from "./PublicNewsCard";

import "../public-news-discovery.css";
import "../../horizontal-experience/hux.css";
import "../../civic-media-center/media-rail/media-rail.css";

export interface PublicNewsSectionProps {
  variant?: "discovery" | "country";
  countryCode?: string;
  countryName?: string;
  regionName?: string;
  recommendedMedia?: CountryPublicNewsMediaRef[];
  showToolbar?: boolean;
  showIntro?: boolean;
  sectionId?: string;
  eyebrow?: string;
  heading?: string;
  description?: string;
  className?: string;
}

function hasActiveDiscoveryFilters(filters: PublicNewsFilters): boolean {
  return (
    filters.search.trim().length > 0 ||
    filters.provider !== "all" ||
    filters.topic !== "all" ||
    filters.country !== "all" ||
    filters.sort !== "newest"
  );
}

export function PublicNewsSection({
  variant = "discovery",
  countryCode,
  countryName,
  regionName,
  recommendedMedia = [],
  showToolbar,
  showIntro = true,
  sectionId = "news-widgets",
  eyebrow,
  heading,
  description,
  className,
}: PublicNewsSectionProps = {}) {
  const tDiscovery = useTranslations("publicNews.discovery");
  const tCountry = useTranslations("publicNews.country");
  const tErrors = useTranslations("publicNews.errors");
  const [articles, setArticles] = useState<PublicNewsArticleItem[]>([]);
  const [activeProviders, setActiveProviders] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<PublicNewsFilters>(DEFAULT_PUBLIC_NEWS_FILTERS);
  const [countryProvider, setCountryProvider] = useState("all");

  const resolvedShowToolbar = showToolbar ?? variant === "discovery";
  const resolvedEyebrow =
    eyebrow ?? (variant === "country" ? tCountry("eyebrow") : tDiscovery("eyebrow"));
  const resolvedHeading =
    heading ?? (variant === "country" ? tCountry("heading") : tDiscovery("heading"));
  const resolvedDescription =
    description ??
    (variant === "country" && countryName
      ? tCountry("description", { countryName })
      : tDiscovery("description"));

  const loadArticles = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetchPublicNewsArticles({
        limit: PUBLIC_NEWS_RAIL_LIMIT,
        language: "en",
      });
      setArticles(response.items);
      setActiveProviders(response.activeProviders ?? []);
    } catch (fetchError) {
      setArticles([]);
      setActiveProviders([]);
      setError(
        fetchError instanceof Error && isApiUnavailableError(fetchError)
          ? tErrors("temporarilyUnavailable")
          : tErrors("temporarilyUnavailable"),
      );
    } finally {
      setLoading(false);
    }
  }, [tErrors]);

  useEffect(() => {
    void loadArticles();
  }, [loadArticles]);

  const filterOptions = useMemo(
    () => collectFilterOptions(articles, activeProviders),
    [activeProviders, articles],
  );

  const { processedArticles, usedGlobalFallback, countryScopedArticles } = useMemo(() => {
    if (variant === "country" && countryCode && countryName) {
      const countryResult = filterPublicNewsForCountry(articles, {
        countryCode,
        countryName,
        regionName,
        recommendedMedia,
        language: "en",
      });

      const sorted = sortPublicNewsArticles(countryResult.articles, "newest", "").slice(
        0,
        PUBLIC_NEWS_RAIL_LIMIT,
      );

      const providerFiltered =
        countryProvider === "all"
          ? sorted
          : sorted.filter((article) => article.sourceName === countryProvider);

      return {
        processedArticles: providerFiltered,
        usedGlobalFallback: countryResult.usedFallback,
        countryScopedArticles: sorted,
      };
    }

    const filtered = filterPublicNewsArticles(articles, filters);

    return {
      processedArticles: sortPublicNewsArticles(filtered, filters.sort, filters.search).slice(
        0,
        PUBLIC_NEWS_RAIL_LIMIT,
      ),
      usedGlobalFallback: false,
      countryScopedArticles: [],
    };
  }, [
    articles,
    countryCode,
    countryName,
    countryProvider,
    filters,
    recommendedMedia,
    regionName,
    variant,
  ]);

  const countryProviders = useMemo(() => {
    const names = new Set(countryScopedArticles.map((article) => article.sourceName));
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [countryScopedArticles]);

  function updateFilters(patch: Partial<PublicNewsFilters>) {
    setFilters((current) => ({ ...current, ...patch }));
  }

  const railLabel =
    variant === "country" ? tCountry("railLabel") : tDiscovery("railLabel");

  const rail = useMediaHorizontalRail({
    itemCount: processedArticles.length,
    layout: "three-two-one",
    label: railLabel,
  });

  const controls =
    processedArticles.length > 0 && !rail.allItemsVisible ? (
      <MediaRailControls
        label={railLabel}
        canScrollPrevious={rail.canScrollPrevious}
        canScrollNext={rail.canScrollNext}
        onPrevious={rail.showPrevious}
        onNext={rail.showNext}
      />
    ) : null;

  const resultSummary =
    variant === "country" && countryName ? (
      <>
        <span className="civic-media-chip civic-media-chip--active">
          {tCountry(
            processedArticles.length === 1 ? "eventsForCountry" : "eventsForCountryPlural",
            { count: processedArticles.length, countryName },
          )}
        </span>
        {countryProvider !== "all" ? (
          <span className="civic-media-chip civic-media-chip--active">{countryProvider}</span>
        ) : null}
        {usedGlobalFallback ? (
          <span className="civic-media-chip">
            {tCountry("globalSources", { countryName })}
          </span>
        ) : null}
      </>
    ) : (
      <>
        <span className="civic-media-chip civic-media-chip--active">
          {tDiscovery(
            processedArticles.length === 1 ? "eventsFound" : "eventsFoundPlural",
            { count: processedArticles.length },
          )}
        </span>
        {filters.provider !== "all" ? (
          <span className="civic-media-chip civic-media-chip--active">{filters.provider}</span>
        ) : null}
        {filters.topic !== "all" ? (
          <span className="civic-media-chip civic-media-chip--active">{filters.topic}</span>
        ) : null}
        {filters.country !== "all" ? (
          <span className="civic-media-chip civic-media-chip--active">{filters.country}</span>
        ) : null}
      </>
    );

  return (
    <HuxDiscoveryShell
      sectionId={sectionId}
      surfaceStyle={variant === "country" ? "grouped" : "elevated"}
      eyebrow={showIntro ? resolvedEyebrow : undefined}
      title={showIntro ? resolvedHeading : tDiscovery("titleCollapsed")}
      description={showIntro ? resolvedDescription : undefined}
      metadata={!loading && !error ? resultSummary : null}
      controls={!loading && !error && processedArticles.length > 0 ? controls : null}
      className={className}
      footer={
        variant === "discovery" ? (
          <Link href="/initiatives/create">{tDiscovery("footerCreate")}</Link>
        ) : undefined
      }
    >
      {!loading && !error ? (
        <div className="hux-discovery-toolbar public-news-discovery__panel">
          {variant === "country" && countryName ? (
            <div className="public-news-toolbar public-news-toolbar--country">
              <div className="public-news-toolbar__field">
                <label htmlFor={`${sectionId}-country-provider`}>{tCountry("providerLabel")}</label>
                <select
                  id={`${sectionId}-country-provider`}
                  value={countryProvider}
                  onChange={(event) => setCountryProvider(event.target.value)}
                >
                  <option value="all">{tCountry("allTrustedMedia", { countryName })}</option>
                  {countryProviders.map((provider) => (
                    <option key={provider} value={provider}>
                      {provider}
                    </option>
                  ))}
                </select>
              </div>
              {countryProvider !== "all" ? (
                <button
                  type="button"
                  className="public-news-toolbar__clear"
                  onClick={() => setCountryProvider("all")}
                >
                  {tCountry("clearFilter")}
                </button>
              ) : null}
            </div>
          ) : null}

          {resolvedShowToolbar ? (
            <PublicNewsToolbar
              filters={filters}
              providers={filterOptions.providers}
              topics={filterOptions.topics}
              countries={filterOptions.countries}
              resultCount={processedArticles.length}
              onChange={updateFilters}
              showClearFilters={hasActiveDiscoveryFilters(filters)}
              onClearFilters={() => setFilters(DEFAULT_PUBLIC_NEWS_FILTERS)}
            />
          ) : null}
        </div>
      ) : null}

      {loading ? <PublicNewsPlaceholder variant="loading" /> : null}

      {!loading && error ? (
        <PublicNewsPlaceholder variant="error" onRetry={() => void loadArticles()} />
      ) : null}

      {!loading && !error && articles.length === 0 ? (
        <PublicNewsPlaceholder variant="empty" />
      ) : null}

      {!loading && !error && articles.length > 0 && processedArticles.length === 0 ? (
        <PublicNewsPlaceholder
          variant="no-results"
          message={
            variant === "country" && countryName
              ? tCountry("noResults", { countryName })
              : undefined
          }
        />
      ) : null}

      {!loading && !error && processedArticles.length > 0 ? (
        <MediaRailViewport
          label={railLabel}
          layout="three-two-one"
          items={processedArticles}
          getItemKey={(article) => article.id}
          renderItem={(article) => <PublicNewsCard article={article} />}
          rail={rail}
          hideSummary
          showCount={false}
          slideClassName="public-news-rail__slide"
          viewportClassName="public-news-rail__viewport"
        />
      ) : null}
    </HuxDiscoveryShell>
  );
}
