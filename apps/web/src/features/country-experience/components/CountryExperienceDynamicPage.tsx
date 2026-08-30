"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import type { CountryStatisticsCounts, TrustedMediaResource } from "@hu/types";

import { getCountryByCode, getRegionLabel } from "@hu/geography";
import { INITIATIVE_ACTIVITY_AREA_OPTIONS } from "../../initiatives/initiative-activity-areas";
import { CitySelect, RegionSelect, useGeographyCommunityOptions } from "../../geography-integrity";
import { TrustedMediaRailCard } from "../../civic-media-center/components/TrustedMediaRailCard";
import { CIVIC_MEDIA_ROUTE } from "../../civic-media-center/routes";
import { HuxDirectorySection } from "../../horizontal-experience";
import { PublicStatisticsGrid } from "../../platform-statistics/components/PublicStatisticsGrid";
import { formatPlatformStatisticValue } from "../../platform-statistics/platform-statistics-api";
import { COUNTRY_STATISTIC_CARDS } from "../../platform-statistics/public-statistics-config";
import {
  fetchCountryMedia,
  fetchCountryStatistics,
} from "../country-experience-api";
import {
  COUNTRY_DISCOVERY_ENTITY_TYPE_OPTIONS,
  resolveCountrySearchFilterParams,
} from "../country-discovery-entity-types";
import { CountryPublicNewsWidget } from "../../public-news/components/CountryPublicNewsWidget";
import { CountryCivicActionSection } from "./CountryCivicActionSection";
import { CountryPartnersSection } from "./CountryPartnersSection";
import { CountryTeamSection } from "./CountryTeamSection";

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
  const [media, setMedia] = useState<TrustedMediaResource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const [query, setQuery] = useState("");
  const [regionCode, setRegionCode] = useState("");
  const [communityCode, setCommunityCode] = useState("");
  const [activityArea, setActivityArea] = useState("");
  const [entityTypeValue, setEntityTypeValue] = useState("");

  const regionLabel = useMemo(
    () => (regionCode ? (getRegionLabel(countryCode, regionCode) ?? "") : ""),
    [countryCode, regionCode],
  );
  const { options: cityOptions } = useGeographyCommunityOptions(countryCode, regionCode, false);
  const communityLabel = useMemo(() => {
    if (!communityCode) {
      return "";
    }

    return cityOptions.find((option) => option.slug === communityCode)?.label ?? "";
  }, [cityOptions, communityCode]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    void fetchCountryStatistics(countryCode)
      .then((statisticsResponse) => {
        if (cancelled) {
          return;
        }

        setStatistics(statisticsResponse.data);
        setError(false);
      })
      .catch(() => {
        if (!cancelled) {
          setStatistics(null);
          setError(true);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    void fetchCountryMedia(countryCode)
      .then((mediaItems) => {
        if (!cancelled) {
          setMedia(mediaItems);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setMedia([]);
        }
      });

    return () => {
      cancelled = true;
    };
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

    const filterParams = resolveCountrySearchFilterParams(entityTypeValue);

    if (filterParams.entityType) {
      params.set("entityType", filterParams.entityType);
    }

    if (filterParams.lifecycleProfile) {
      params.set("lifecycleProfile", filterParams.lifecycleProfile);
    }

    router.push(`/search?${params.toString()}`);
  }

  function handleClearFilters() {
    setQuery("");
    setRegionCode("");
    setCommunityCode("");
    setActivityArea("");
    setEntityTypeValue("");
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
        <div className="country-experience-dynamic__hero-copy">
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
        <div className="country-experience-dynamic__flag-wrap">
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
                placeholder="Search initiatives, elections, decisions, archive records…"
              />
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
            <RegionSelect
              id="country-page-region"
              countryCode={countryCode}
              value={regionCode}
              includeOther={false}
              onChange={(value: string) => {
                setRegionCode(value);
                setCommunityCode("");
              }}
              placeholder="All regions"
            />
            <CitySelect
              id="country-page-community"
              countryCode={countryCode}
              regionCode={regionCode}
              value={communityCode}
              includeOther={false}
              onChange={setCommunityCode}
              placeholder="All communities"
            />
            <label>
              <span>Entity Type</span>
              <select
                className="hu-form-control"
                value={entityTypeValue}
                onChange={(event) => setEntityTypeValue(event.target.value)}
              >
                {COUNTRY_DISCOVERY_ENTITY_TYPE_OPTIONS.map((option) => (
                  <option key={option.value || "all"} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Activity Area</span>
              <select
                className="hu-form-control"
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
          </div>
          <p className="country-experience-dynamic__search-scope">
            Country scope: <strong>{country.name}</strong>
            {regionLabel ? (
              <>
                {" "}
                · Region: <strong>{regionLabel}</strong>
              </>
            ) : null}
            {communityLabel ? (
              <>
                {" "}
                · City: <strong>{communityLabel}</strong>
              </>
            ) : null}
          </p>
        </form>
      </section>

      <CountryCivicActionSection
        countryCode={countryCode}
        countryName={country.name}
        regionCode={regionCode}
        regionLabel={regionLabel}
        communityCode={communityCode}
        communityLabel={communityLabel}
      />

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

      <CountryTeamSection countryCode={countryCode} countryName={country.name} />
      <CountryPartnersSection countryCode={countryCode} countryName={country.name} />
    </div>
  );
}
