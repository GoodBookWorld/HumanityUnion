"use client";

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
  return (
    <div className="public-news-toolbar" role="search" aria-label="News discovery filters">
      <div className="public-news-toolbar__search">
        <label htmlFor="public-news-search">Search events</label>
        <input
          id="public-news-search"
          type="search"
          value={filters.search}
          placeholder="Search headlines, topics, or publishers"
          onChange={(event) => onChange({ search: event.target.value })}
        />
      </div>

      <div className="public-news-toolbar__filters">
        <div className="public-news-toolbar__field">
          <label htmlFor="public-news-provider">Provider</label>
          <select
            id="public-news-provider"
            value={filters.provider}
            onChange={(event) => onChange({ provider: event.target.value })}
          >
            <option value="all">All providers</option>
            {providers.map((provider) => (
              <option key={provider} value={provider}>
                {provider}
              </option>
            ))}
          </select>
        </div>

        <div className="public-news-toolbar__field">
          <label htmlFor="public-news-topic">Topic</label>
          <select
            id="public-news-topic"
            value={filters.topic}
            onChange={(event) => onChange({ topic: event.target.value })}
          >
            <option value="all">All topics</option>
            {topics.map((topic) => (
              <option key={topic} value={topic}>
                {topic}
              </option>
            ))}
          </select>
        </div>

        <div className="public-news-toolbar__field">
          <label htmlFor="public-news-country">Country</label>
          <select
            id="public-news-country"
            value={filters.country}
            onChange={(event) => onChange({ country: event.target.value })}
          >
            <option value="all">All regions</option>
            {countries.map((country) => (
              <option key={country} value={country}>
                {country}
              </option>
            ))}
          </select>
        </div>

        <div className="public-news-toolbar__field">
          <label htmlFor="public-news-sort">Sort</label>
          <select
            id="public-news-sort"
            value={filters.sort}
            onChange={(event) =>
              onChange({ sort: event.target.value as PublicNewsFilters["sort"] })
            }
          >
            <option value="newest">Newest</option>
            <option value="most-discussed">Most discussed</option>
            <option value="most-relevant">Most relevant</option>
          </select>
        </div>
      </div>

      <div className="public-news-toolbar__footer">
        <p className="public-news-toolbar__summary">
          {resultCount} trusted event{resultCount === 1 ? "" : "s"} ready for initiative discovery
        </p>
        {showClearFilters && onClearFilters ? (
          <button type="button" className="public-news-toolbar__clear" onClick={onClearFilters}>
            Clear filters
          </button>
        ) : null}
      </div>
    </div>
  );
}
