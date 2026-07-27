"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import type { InitiativeLifecycleSearchGroup } from "@hu/types";

import {
  fetchCommunitiesByRegion,
  formatPublicGeography,
  getCountryLabel,
  normalizeCountryInput,
  toGeographyCommunityOptions,
  toGeographyCountryOptions,
  toGeographyRegionOptions,
} from "../../../data/geography";
import { buildSearchUrlForGeographyScope } from "../../../data/geography/helpers";
import { Button } from "../../../design-system";
import { GeographySearchSelect } from "../../../design-system/components/GeographySearchSelect";
import { INITIATIVE_ACTIVITY_AREA_OPTIONS } from "../../initiatives/initiative-activity-areas";
import { InitiativeImage } from "../../initiatives/components/InitiativeImage";
import {
  ENTITY_TYPE_OPTIONS,
  entityTypeLabel,
  fetchPublicSearch,
  type CivicSearchResponse,
} from "../api";
import { InitiativeTimelineGroup } from "./InitiativeTimelineGroup";

import "../global-search-page.css";
import "./initiative-timeline-group.css";

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatLocation(result: {
  community?: string;
  region?: string;
  country?: string;
  countryCode?: string;
  regionCode?: string;
  countryLabel?: string;
  regionLabel?: string;
}): string {
  return formatPublicGeography({
    countryCode: result.countryCode ?? result.country,
    regionCode: result.regionCode ?? result.region,
    communityAssociation: result.community,
    regionLabel: result.regionLabel,
    knownCommunityCountryLabel: result.countryLabel,
  });
}

function formatGroupLocation(group: InitiativeLifecycleSearchGroup): string {
  return formatLocation(group);
}

function resultLinkLabel(entityType: string): string {
  return entityType === "initiative" ? "View Initiative →" : "View Public Page →";
}

function buildActiveFilterSummary(input: {
  q: string;
  entityType: string;
  country: string;
  region: string;
  community: string;
  activityArea: string;
  status: string;
  fromDate: string;
  toDate: string;
}): string[] {
  const summary: string[] = [];

  if (input.q) {
    summary.push(`Keywords: "${input.q}"`);
  }

  if (input.entityType) {
    summary.push(`Type: ${entityTypeLabel(input.entityType)}`);
  }

  if (input.country) {
    summary.push(`Country: ${getCountryLabel(input.country) ?? input.country}`);
  }

  if (input.region) {
    summary.push(`Region: ${input.region}`);
  }

  if (input.community) {
    summary.push(`Community: ${input.community}`);
  }

  if (input.activityArea) {
    summary.push(`Activity area: ${input.activityArea}`);
  }

  if (input.status) {
    summary.push(`Status: ${input.status}`);
  }

  if (input.fromDate || input.toDate) {
    summary.push(`Dates: ${input.fromDate || "…"} – ${input.toDate || "…"}`);
  }

  return summary;
}

function buildResultsHeading(input: { q: string; country: string }): string {
  if (input.q.trim()) {
    return `Search Results for “${input.q.trim()}”`;
  }

  if (input.country.trim()) {
    return `Search Results in ${getCountryLabel(input.country) ?? input.country}`;
  }

  return "Search Results";
}

export function GlobalSearchPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [response, setResponse] = useState<CivicSearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const resultsSectionRef = useRef<HTMLElement | null>(null);
  const resultsHeadingRef = useRef<HTMLHeadingElement | null>(null);
  const lastScrolledSearchKeyRef = useRef<string | null>(null);

  const q = searchParams.get("q") ?? "";
  const entityType = searchParams.get("entityType") ?? searchParams.get("type") ?? "";
  const country = searchParams.get("country") ?? "";
  const region = searchParams.get("region") ?? "";
  const community = searchParams.get("community") ?? "";
  const activityArea = searchParams.get("activityArea") ?? "";
  const status = searchParams.get("status") ?? "";
  const fromDate = searchParams.get("fromDate") ?? "";
  const toDate = searchParams.get("toDate") ?? "";
  const offset = Number.parseInt(searchParams.get("offset") ?? "0", 10) || 0;

  const [countryCode, setCountryCode] = useState(country);
  const [regionCode, setRegionCode] = useState(region);
  const [communityCode, setCommunityCode] = useState(community);
  const [communityOptions, setCommunityOptions] = useState<
    ReturnType<typeof toGeographyCommunityOptions>
  >([]);
  const [communitiesLoading, setCommunitiesLoading] = useState(false);

  const countryOptions = useMemo(() => toGeographyCountryOptions(), []);
  const regionOptions = useMemo(() => toGeographyRegionOptions(countryCode, false), [countryCode]);

  const hasActiveSearch = useMemo(
    () =>
      Boolean(
        q ||
        entityType ||
        country ||
        region ||
        community ||
        activityArea ||
        status ||
        fromDate ||
        toDate ||
        offset > 0,
      ),
    [q, entityType, country, region, community, activityArea, status, fromDate, toDate, offset],
  );

  const activeFilterSummary = useMemo(
    () =>
      buildActiveFilterSummary({
        q,
        entityType,
        country,
        region,
        community,
        activityArea,
        status,
        fromDate,
        toDate,
      }),
    [q, entityType, country, region, community, activityArea, status, fromDate, toDate],
  );

  useEffect(() => {
    setCountryCode(country);
    setRegionCode(region);
    setCommunityCode(community);
  }, [country, region, community]);

  useEffect(() => {
    if (!regionCode || !countryCode) {
      setCommunityOptions([]);
      return;
    }

    let cancelled = false;
    setCommunitiesLoading(true);

    void fetchCommunitiesByRegion(countryCode, regionCode)
      .then((communities) => {
        if (!cancelled) {
          setCommunityOptions(toGeographyCommunityOptions(countryCode, regionCode, communities));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setCommunityOptions(toGeographyCommunityOptions(countryCode, regionCode, []));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setCommunitiesLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [countryCode, regionCode]);

  useEffect(() => {
    if (!hasActiveSearch) {
      setResponse(null);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;

    setLoading(true);
    setError(null);

    void fetchPublicSearch({
      q: q || undefined,
      entityType: entityType || undefined,
      country: country || undefined,
      region: region || undefined,
      community: community || undefined,
      activityArea: activityArea || undefined,
      status: status || undefined,
      fromDate: fromDate || undefined,
      toDate: toDate || undefined,
      limit: 20,
      offset,
      view: "grouped",
    })
      .then((data) => {
        if (!cancelled) {
          setResponse(data);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setResponse(null);
          setError("Search is temporarily unavailable.");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [
    hasActiveSearch,
    q,
    entityType,
    country,
    region,
    community,
    activityArea,
    status,
    fromDate,
    toDate,
    offset,
  ]);

  const groupedPage = useMemo(() => {
    const displayResults = response?.displayResults ?? [];
    const initiativeGroups = displayResults.filter(
      (entry): entry is InitiativeLifecycleSearchGroup => entry.kind === "initiative_group",
    );
    const standaloneResults = displayResults
      .filter((entry) => entry.kind === "standalone")
      .map((entry) => entry.result);

    return { displayResults, initiativeGroups, standaloneResults };
  }, [response]);

  function buildQueryString(nextOffset: number): string {
    const params = new URLSearchParams();

    if (q) {
      params.set("q", q);
    }

    if (entityType) {
      params.set("entityType", entityType);
    }

    if (country) {
      params.set("country", country);
    }

    if (region) {
      params.set("region", region);
    }

    if (community) {
      params.set("community", community);
    }

    if (activityArea) {
      params.set("activityArea", activityArea);
    }

    if (status) {
      params.set("status", status);
    }

    if (fromDate) {
      params.set("fromDate", fromDate);
    }

    if (toDate) {
      params.set("toDate", toDate);
    }

    if (nextOffset > 0) {
      params.set("offset", String(nextOffset));
    }

    const serialized = params.toString();
    return serialized.length > 0 ? `?${serialized}` : "";
  }

  const visibleCount = groupedPage.displayResults.length;
  const resultsHeading = buildResultsHeading({ q, country });
  const searchResultsKey = useMemo(
    () =>
      [
        q,
        entityType,
        country,
        region,
        community,
        activityArea,
        status,
        fromDate,
        toDate,
        offset,
      ].join("|"),
    [q, entityType, country, region, community, activityArea, status, fromDate, toDate, offset],
  );

  useEffect(() => {
    if (!hasActiveSearch || loading || error || !response) {
      return;
    }

    if (lastScrolledSearchKeyRef.current === searchResultsKey) {
      return;
    }

    lastScrolledSearchKeyRef.current = searchResultsKey;

    requestAnimationFrame(() => {
      const target = resultsSectionRef.current ?? resultsHeadingRef.current;

      if (!target) {
        return;
      }

      target.scrollIntoView({ behavior: "smooth", block: "start" });
      resultsHeadingRef.current?.focus({ preventScroll: true });
    });
  }, [hasActiveSearch, loading, error, response, searchResultsKey]);

  return (
    <main className="global-search-page">
      <header className="global-search-page__header">
        <h1>Search civic records</h1>
      </header>

      <form
        className="global-search-page__filters"
        aria-label="Search filters"
        onSubmit={(event) => {
          event.preventDefault();
          const formData = new FormData(event.currentTarget);
          const params = new URLSearchParams();

          for (const [key, value] of formData.entries()) {
            if (typeof value === "string" && value.trim()) {
              params.set(key, value.trim());
            }
          }

          const normalizedCountry = normalizeCountryInput(countryCode);
          if (normalizedCountry) {
            params.set("country", normalizedCountry);
          } else {
            params.delete("country");
          }

          if (regionCode.trim()) {
            params.set("region", regionCode.trim());
          } else {
            params.delete("region");
          }

          if (communityCode.trim()) {
            params.set("community", communityCode.trim());
          } else {
            params.delete("community");
          }

          router.push(`/search${params.toString() ? `?${params.toString()}` : ""}`);
        }}
      >
        <label>
          Search
          <input name="q" defaultValue={q} placeholder="Search titles, summaries, locations..." />
        </label>

        <label>
          Record type
          <select name="entityType" defaultValue={entityType}>
            {ENTITY_TYPE_OPTIONS.map((option) => (
              <option key={option.label} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <GeographySearchSelect
          id="search-country"
          label="Country"
          value={countryCode}
          options={countryOptions}
          onChange={(nextCountry) => {
            setCountryCode(nextCountry);
            setRegionCode("");
            setCommunityCode("");
          }}
        />

        <GeographySearchSelect
          id="search-region"
          label="Region"
          value={regionCode}
          options={regionOptions}
          disabled={!countryCode}
          onChange={(nextRegion) => {
            setRegionCode(nextRegion);
            setCommunityCode("");
          }}
        />

        <GeographySearchSelect
          id="search-community"
          label="City / Community"
          helperText={
            communitiesLoading
              ? "Loading cities for the selected region…"
              : "City, municipality, or district within the selected region."
          }
          value={communityCode}
          options={communityOptions}
          disabled={!regionCode || communitiesLoading}
          onChange={setCommunityCode}
        />

        <label>
          Activity area
          <select name="activityArea" defaultValue={activityArea}>
            <option value="">All activity areas</option>
            {INITIATIVE_ACTIVITY_AREA_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        <label>
          Status
          <input name="status" defaultValue={status} placeholder="Status" />
        </label>

        <label>
          From date
          <input name="fromDate" type="date" defaultValue={fromDate} />
        </label>

        <label>
          To date
          <input name="toDate" type="date" defaultValue={toDate} />
        </label>

        <Button type="submit" variant="primary">
          Search
        </Button>
      </form>

      <section
        id="search-results"
        ref={resultsSectionRef}
        className="global-search-page__results"
        aria-labelledby="search-results-heading"
      >
        <h2 id="search-results-heading" tabIndex={-1} ref={resultsHeadingRef}>
          {resultsHeading}
        </h2>

        {activeFilterSummary.length > 0 ? (
          <p className="global-search-page__filter-summary">{activeFilterSummary.join(" · ")}</p>
        ) : null}

        {!hasActiveSearch ? (
          <p className="global-search-page__initial" role="status">
            Enter keywords or select filters to find public civic records.
          </p>
        ) : null}

        {hasActiveSearch && loading ? (
          <p className="global-search-page__status" role="status">
            Searching civic records…
          </p>
        ) : null}

        {hasActiveSearch && error ? (
          <p className="global-search-page__error" role="alert">
            {error}
          </p>
        ) : null}

        {hasActiveSearch && !loading && !error && response ? (
          <>
            <p className="global-search-page__metrics">
              {response.totalDisplayResults} result{response.totalDisplayResults === 1 ? "" : "s"}
              {response.totalDisplayResults > visibleCount
                ? ` · showing ${response.offset + 1}–${response.offset + visibleCount}`
                : null}
            </p>

            {groupedPage.displayResults.length === 0 ? (
              <div className="global-search-page__empty" role="status">
                <p>No public civic records match your search.</p>
                <div className="global-search-page__empty-actions">
                  <Link href="/search">Clear filters</Link>
                  {country ? (
                    <>
                      <Link href={`/countries/${encodeURIComponent(country)}`}>
                        Return to country
                      </Link>
                      <Link href={buildSearchUrlForGeographyScope({ countrySlug: country })}>
                        Browse all records in this country
                      </Link>
                    </>
                  ) : null}
                </div>
              </div>
            ) : (
              <>
                {groupedPage.initiativeGroups.length > 0 ? (
                  <ul className="global-search-page__timeline-list">
                    {groupedPage.initiativeGroups.map((group) => (
                      <InitiativeTimelineGroup
                        key={group.initiativeId}
                        group={group}
                        locationLabel={formatGroupLocation(group)}
                      />
                    ))}
                  </ul>
                ) : null}

                {groupedPage.standaloneResults.length > 0 ? (
                  <ul className="global-search-page__list">
                    {groupedPage.standaloneResults.map((result) => (
                      <li
                        key={`${result.entityType}-${result.entityId}`}
                        className="global-search-page__item"
                      >
                        <div className="global-search-page__item-media">
                          <InitiativeImage title={result.title} imageUrl={result.imageUrl} />
                        </div>
                        <div className="global-search-page__item-body">
                          <span className="global-search-page__badge">
                            {entityTypeLabel(result.entityType)}
                          </span>
                          <h3>{result.title}</h3>
                          <p>{result.summary}</p>
                          {result.activityArea ? (
                            <p className="global-search-page__activity-area">
                              {result.activityArea}
                            </p>
                          ) : null}
                          <p className="global-search-page__meta">
                            {formatLocation(result)} · {result.status} · Updated{" "}
                            {formatDate(result.updatedAt)}
                          </p>
                          <Link href={result.publicUrl}>{resultLinkLabel(result.entityType)}</Link>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </>
            )}

            <nav className="global-search-page__pagination" aria-label="Search pagination">
              {response.offset > 0 ? (
                <Link
                  href={`/search${buildQueryString(Math.max(0, response.offset - response.limit))}`}
                >
                  Previous
                </Link>
              ) : null}
              {response.hasMore ? (
                <Link href={`/search${buildQueryString(response.offset + response.limit)}`}>
                  Next
                </Link>
              ) : null}
            </nav>
          </>
        ) : null}
      </section>
    </main>
  );
}
