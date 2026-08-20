"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import type {
  CountryStatisticsCounts,
  TrustedMediaResource,
  WorldInitiativeCardProjection,
} from "@hu/types";

import {
  fetchCommunitiesByRegion,
  getCountryByCode,
  toGeographyRegionOptions,
} from "@hu/geography";
import { buildSearchUrlForGeographyScope } from "../../../data/geography/helpers";
import { GeographySearchSelect } from "../../../design-system/components/GeographySearchSelect";
import { INITIATIVE_ACTIVITY_AREA_OPTIONS } from "../../initiatives/initiative-activity-areas";
import { TrustedMediaRailCard } from "../../civic-media-center/components/TrustedMediaRailCard";
import { CIVIC_MEDIA_ROUTE } from "../../civic-media-center/routes";
import { HuxDiscoverySection, HuxDirectorySection } from "../../horizontal-experience";
import { ENTITY_TYPE_OPTIONS } from "../../global-search/api";
import { PublicStatisticsGrid } from "../../platform-statistics/components/PublicStatisticsGrid";
import { formatPlatformStatisticValue } from "../../platform-statistics/platform-statistics-api";
import { COUNTRY_STATISTIC_CARDS } from "../../platform-statistics/public-statistics-config";
import {
  fetchCountryInitiatives,
  fetchCountryMedia,
  fetchCountryStatistics,
} from "../country-experience-api";
import { CountryPublicNewsWidget } from "../../public-news/components/CountryPublicNewsWidget";
import { CountryInitiativeRailCard } from "./CountryInitiativeRailCard";

import "../../civic-media-center/components/civic-media-resource-cards.css";
import "../../horizontal-experience/hux.css";
import "../country-experience-dynamic.css";

interface CountryExperienceDynamicPageProps {
  countryCode: string;
}

function countryFlagSrc(countryCode: string): string {
  return `/images/flags/4x3/${countryCode.toLowerCase()}.svg`;
}

export function CountryExperienceDynamicPage({ countryCode }: CountryExperienceDynamicPageProps) {
  const router = useRouter();
  const country = getCountryByCode(countryCode);
  const [statistics, setStatistics] = useState<CountryStatisticsCounts | null>(null);
  const [initiatives, setInitiatives] = useState<WorldInitiativeCardProjection[]>([]);
  const [media, setMedia] = useState<TrustedMediaResource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const [query, setQuery] = useState("");
  const [regionCode, setRegionCode] = useState("");
  const [communityCode, setCommunityCode] = useState("");
  const [activityArea, setActivityArea] = useState("");
  const [entityType, setEntityType] = useState("");
  const [lifecycleProfile, setLifecycleProfile] = useState<"" | "STANDARD" | "PUBLIC_CHOICE">("");
  const [communityOptions, setCommunityOptions] = useState<
    Awaited<ReturnType<typeof fetchCommunitiesByRegion>>
  >([]);

  const regionOptions = useMemo(() => toGeographyRegionOptions(countryCode, false), [countryCode]);

  const countryInitiativesHref = buildSearchUrlForGeographyScope({ countrySlug: countryCode });

  useEffect(() => {
    if (!regionCode) {
      setCommunityOptions([]);
      return;
    }

    void fetchCommunitiesByRegion(countryCode, regionCode)
      .then((communities: Awaited<ReturnType<typeof fetchCommunitiesByRegion>>) =>
        setCommunityOptions(communities),
      )
      .catch(() => setCommunityOptions([]));
  }, [countryCode, regionCode]);

  useEffect(() => {
    void Promise.all([
      fetchCountryStatistics(countryCode),
      fetchCountryInitiatives(countryCode),
      fetchCountryMedia(countryCode),
    ])
      .then(([statisticsResponse, initiativeItems, mediaItems]) => {
        setStatistics(statisticsResponse.data);
        setInitiatives(initiativeItems);
        setMedia(mediaItems);
        setError(false);
      })
      .catch(() => {
        setStatistics(null);
        setInitiatives([]);
        setMedia([]);
        setError(true);
      })
      .finally(() => setLoading(false));
  }, [countryCode]);

  if (!country) {
    return null;
  }

  function handleSearchSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const params = new URLSearchParams();
    params.set("country", countryCode.toUpperCase());

    if (query.trim()) {
      params.set("q", query.trim());
    }

    if (regionCode) {
      params.set("region", regionCode);
    }

    if (communityCode) {
      params.set("community", communityCode);
    }

    if (activityArea) {
      params.set("activityArea", activityArea);
    }

    if (entityType) {
      params.set("entityType", entityType);
    }

    if (lifecycleProfile) {
      params.set("lifecycleProfile", lifecycleProfile);
    }

    router.push(`/search?${params.toString()}`);
  }

  function handleClearFilters() {
    setQuery("");
    setRegionCode("");
    setCommunityCode("");
    setActivityArea("");
    setEntityType("");
    setLifecycleProfile("");
  }

  return (
    <div className="country-experience-dynamic">
      <nav className="country-experience-dynamic__breadcrumb" aria-label="Breadcrumb">
        <ol>
          <li>
            <Link href="/">Home</Link>
          </li>
          <li>
            <Link href="/search">Countries</Link>
          </li>
          <li aria-current="page">{country.name}</li>
        </ol>
      </nav>

      <header className="country-experience-dynamic__hero">
        <img
          src={countryFlagSrc(countryCode)}
          alt=""
          className="country-experience-dynamic__flag"
          width={120}
          height={80}
          onError={(event) => {
            event.currentTarget.src = "/images/flags/placeholder-country.svg";
          }}
        />
        <div>
          <h1>{country.name}</h1>
          <p className="country-experience-dynamic__region">
            {country.region} · {country.subregion}
          </p>
          <p className="country-experience-dynamic__intro">
            Explore public civic activity, initiatives, and trusted media connected to{" "}
            {country.name}. Aggregate statistics summarize participation without exposing private
            participant records.
          </p>
        </div>
      </header>

      <section
        className="country-experience-dynamic__section platform-statistics"
        aria-labelledby="country-statistics-title"
        aria-busy={loading}
      >
        <h2 id="country-statistics-title">Country Statistics</h2>
        <PublicStatisticsGrid
          cards={COUNTRY_STATISTIC_CARDS}
          loading={loading}
          allUnavailable={error}
          unavailableMessage="Country statistics are temporarily unavailable."
          loadingMessage="Loading country statistics..."
          resolveValue={(key) => {
            if (error || !statistics) {
              return null;
            }

            const value = statistics[key as keyof CountryStatisticsCounts];

            return typeof value === "number" ? value : null;
          }}
          formatValue={(_, value) => formatPlatformStatisticValue(value)}
        />
      </section>

      <section
        className="country-experience-dynamic__section"
        aria-labelledby="country-search-title"
      >
        <h2 id="country-search-title">Search Civic Activity in This Country</h2>
        <form
          className="country-experience-dynamic__search-card"
          onSubmit={handleSearchSubmit}
          aria-label={`Search civic activity in ${country.name}`}
        >
          <div className="country-experience-dynamic__search-primary">
            <label className="country-experience-dynamic__search-query">
              <span>Search</span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search initiatives, decisions, archive records…"
              />
            </label>
            <label className="country-experience-dynamic__search-query">
              <span>Initiative type</span>
              <select
                value={lifecycleProfile}
                onChange={(event) =>
                  setLifecycleProfile(event.target.value as "" | "STANDARD" | "PUBLIC_CHOICE")
                }
              >
                <option value="">All</option>
                <option value="STANDARD">Standard Initiatives</option>
                <option value="PUBLIC_CHOICE">Public Choice</option>
              </select>
            </label>
            <div className="hu-form-actions country-experience-dynamic__search-primary-actions">
              <button type="submit" className="hu-button hu-button--primary">
                Search
              </button>
              <button
                type="button"
                className="country-experience-dynamic__clear-filters"
                onClick={handleClearFilters}
              >
                Clear Filters
              </button>
            </div>
          </div>
          <div className="country-experience-dynamic__search-filters">
            <GeographySearchSelect
              id="country-page-region"
              label="Region"
              value={regionCode}
              options={regionOptions}
              onChange={(value: string) => {
                setRegionCode(value);
                setCommunityCode("");
              }}
              placeholder="All regions"
            />
            <GeographySearchSelect
              id="country-page-community"
              label="City / Community"
              value={communityCode}
              options={communityOptions.map((community: (typeof communityOptions)[number]) => ({
                slug: community.code,
                label: community.name,
              }))}
              onChange={setCommunityCode}
              placeholder="All communities"
              disabled={!regionCode}
            />
            <label>
              <span>Activity Area</span>
              <select
                value={activityArea}
                onChange={(event) => setActivityArea(event.target.value)}
              >
                <option value="">All activity areas</option>
                {INITIATIVE_ACTIVITY_AREA_OPTIONS.map((option: string) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Entity Type</span>
              <select value={entityType} onChange={(event) => setEntityType(event.target.value)}>
                <option value="">All entity types</option>
                {ENTITY_TYPE_OPTIONS.map((option: { value: string; label: string }) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p className="country-experience-dynamic__search-scope">
            Country scope: <strong>{country.name}</strong>
          </p>
        </form>
      </section>

      <HuxDirectorySection
        sectionId={`country-media-${countryCode.toLowerCase()}`}
        eyebrow="COUNTRY MEDIA"
        title="Recommended Media"
        description={`Trusted national and regional sources selected for ${country.name}.`}
        label="recommended trusted media"
        items={media}
        getItemKey={(resource) => resource.id}
        renderItem={(resource) => <TrustedMediaRailCard resource={resource} />}
        emptyState={
          <p>No verified civic media providers are available for this country yet.</p>
        }
        footerAction={
          <Link href={`${CIVIC_MEDIA_ROUTE}#selection-principles`}>View global media standards</Link>
        }
      />

      <CountryPublicNewsWidget
        countryCode={countryCode}
        countryName={country.name}
        regionName={country.region}
        recommendedMedia={media}
      />

      <HuxDiscoverySection
        sectionId={`country-initiatives-${countryCode.toLowerCase()}`}
        surfaceStyle="grouped"
        eyebrow="COUNTRY ACTION"
        title="Country Initiatives"
        description={`Active civic initiatives connected to ${country.name}.`}
        label="country initiatives"
        items={initiatives}
        getItemKey={(initiative) => initiative.initiativeId}
        renderItem={(initiative) => <CountryInitiativeRailCard initiative={initiative} />}
        emptyState={
          <div className="country-experience-dynamic__initiatives-empty">
            <p>No public initiatives have been published for this country yet.</p>
            <Link href="/initiatives/create" className="hu-button hu-button--primary">
              Create Initiative
            </Link>
          </div>
        }
        footerAction={
          initiatives.length > 0 ? (
            <Link href={countryInitiativesHref}>View all country initiatives</Link>
          ) : undefined
        }
      />
    </div>
  );
}
