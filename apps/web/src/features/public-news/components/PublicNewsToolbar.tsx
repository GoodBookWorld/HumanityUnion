"use client";

import { useTranslations } from "next-intl";

import type { PublicNewsFilters } from "../public-news-discovery.utils";

interface PublicNewsToolbarProps {
  filters: PublicNewsFilters;
  providers: string[];
  topics: string[];
  countries: string[];
  resultCount: number;
  onChange: (patch: Partial<PublicNewsFilters>) => void;
  showClearFilters?: boolean;
  onClearFilters?: () => void;
}

export function PublicNewsToolbar({
  filters,
  providers,
  topics,
  countries,
  resultCount,
  onChange,
  showClearFilters = false,
  onClearFilters,
}: PublicNewsToolbarProps) {
  const t = useTranslations("publicNews.toolbar");
  const summaryKey = resultCount === 1 ? "summary" : "summaryPlural";

  return (
    <div className="public-news-toolbar" role="search" aria-label={t("ariaLabel")}>
      <div className="public-news-toolbar__search">
        <label htmlFor="public-news-search">{t("searchLabel")}</label>
        <input
          id="public-news-search"
          type="search"
          value={filters.search}
          placeholder={t("searchPlaceholder")}
          onChange={(event) => onChange({ search: event.target.value })}
        />
      </div>

      <div className="public-news-toolbar__filters">
        <div className="public-news-toolbar__field">
          <label htmlFor="public-news-provider">{t("provider")}</label>
          <select
            id="public-news-provider"
            value={filters.provider}
            onChange={(event) => onChange({ provider: event.target.value })}
          >
            <option value="all">{t("allProviders")}</option>
            {providers.map((provider) => (
              <option key={provider} value={provider}>
                {provider}
              </option>
            ))}
          </select>
        </div>

        <div className="public-news-toolbar__field">
          <label htmlFor="public-news-topic">{t("topic")}</label>
          <select
            id="public-news-topic"
            value={filters.topic}
            onChange={(event) => onChange({ topic: event.target.value })}
          >
            <option value="all">{t("allTopics")}</option>
            {topics.map((topic) => (
              <option key={topic} value={topic}>
                {topic}
              </option>
            ))}
          </select>
        </div>

        <div className="public-news-toolbar__field">
          <label htmlFor="public-news-country">{t("country")}</label>
          <select
            id="public-news-country"
            value={filters.country}
            onChange={(event) => onChange({ country: event.target.value })}
          >
            <option value="all">{t("allRegions")}</option>
            {countries.map((country) => (
              <option key={country} value={country}>
                {country}
              </option>
            ))}
          </select>
        </div>

        <div className="public-news-toolbar__field">
          <label htmlFor="public-news-sort">{t("sort")}</label>
          <select
            id="public-news-sort"
            value={filters.sort}
            onChange={(event) =>
              onChange({ sort: event.target.value as PublicNewsFilters["sort"] })
            }
          >
            <option value="newest">{t("sortNewest")}</option>
            <option value="most-discussed">{t("sortMostDiscussed")}</option>
            <option value="most-relevant">{t("sortMostRelevant")}</option>
          </select>
        </div>
      </div>

      <div className="public-news-toolbar__footer">
        <p className="public-news-toolbar__summary">{t(summaryKey, { count: resultCount })}</p>
        {showClearFilters && onClearFilters ? (
          <button type="button" className="public-news-toolbar__clear" onClick={onClearFilters}>
            {t("clearFilters")}
          </button>
        ) : null}
      </div>
    </div>
  );
}
