"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";

import type { CountryStatisticsCounts, TrustedMediaResource } from "@hu/types";

import { getCountryByCode } from "@hu/geography";
import {
  getLocalizedAdminRegionDisplayName,
  getLocalizedCountryDisplayName,
  resolveUnRegionDisplayName,
  resolveUnSubregionDisplayName,
} from "@hu/geography";
import { INITIATIVE_ACTIVITY_AREA_OPTIONS } from "../../initiatives/initiative-activity-areas";
import { CitySelect, RegionSelect, useGeographyCommunityOptions } from "../../geography-integrity";
import { TrustedMediaRailCard } from "../../civic-media-center/components/TrustedMediaRailCard";
import { CIVIC_MEDIA_ROUTE } from "../../civic-media-center/routes";
import { HuxDirectorySection } from "../../horizontal-experience";
import { ENTITY_TYPE_OPTIONS } from "../../global-search/api";
import { resolveActivityAreaDisplayLabel } from "../../public-initiative-experience/initiative-experience-i18n";
import { PublicStatisticsGrid } from "../../platform-statistics/components/PublicStatisticsGrid";
import { localizePublicStatisticCards } from "../../platform-statistics/localize-public-statistic-cards";
import { formatPlatformStatisticValue } from "../../platform-statistics/platform-statistics-api";
import {
  COUNTRY_STATISTIC_CARDS,
  type CountryStatisticKey,
} from "../../platform-statistics/public-statistics-config";
import {
  fetchCountryMedia,
  fetchCountryStatistics,
} from "../country-experience-api";
import {
  COUNTRY_DISCOVERY_ENTITY_TYPE_OPTION_VALUES,
  resolveCountrySearchFilterParams,
  type CountryDiscoveryEntityTypeValue,
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
  const locale = useLocale();
  const t = useTranslations("publicGeo");
  const tStats = useTranslations("publicStatistics");
  const tSearch = useTranslations("search");
  const tExperience = useTranslations("initiativeExperience");
  const country = getCountryByCode(countryCode);
  const countryDisplayName = useMemo(
    () =>
      country
        ? getLocalizedCountryDisplayName(countryCode, locale, country.name)
        : countryCode,
    [country, countryCode, locale],
  );
  const unRegionDisplayName = useMemo(
    () =>
      country?.region
        ? resolveUnRegionDisplayName({ englishRegion: country.region, locale }).displayName
        : "",
    [country?.region, locale],
  );
  const unSubregionDisplayName = useMemo(
    () =>
      country?.subregion
        ? resolveUnSubregionDisplayName({
            englishSubregion: country.subregion,
            locale,
          }).displayName
        : "",
    [country?.subregion, locale],
  );
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
    () =>
      regionCode
        ? getLocalizedAdminRegionDisplayName(countryCode, regionCode, locale)
        : "",
    [countryCode, locale, regionCode],
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

  function entityTypeLabel(value: CountryDiscoveryEntityTypeValue): string {
    if (value === "") {
      return t("country.search.entityAll");
    }
    if (value === "standard_initiatives") {
      return t("country.search.entityStandard");
    }
    if (value === "public_choice") {
      return t("country.search.entityPublicChoice");
    }
    const key = `entityTypes.${value}` as "entityTypes.initiative";
    if (tSearch.has(key)) {
      return tSearch(key);
    }
    return ENTITY_TYPE_OPTIONS.find((option) => option.value === value)?.label ?? String(value);
  }

  return (
    <div className="country-experience-dynamic">
      <nav
        className="country-experience-dynamic__breadcrumb"
        aria-label={t("shared.breadcrumbAria")}
      >
        <ol>
          <li>
            <Link href="/">{t("shared.home")}</Link>
          </li>
          <li>
            <Link href="/search">{t("country.breadcrumbCountries")}</Link>
          </li>
          <li aria-current="page">{countryDisplayName}</li>
        </ol>
      </nav>

      <header className="country-experience-dynamic__hero">
        <div className="country-experience-dynamic__hero-copy">
          <h1>{countryDisplayName}</h1>
          <p className="country-experience-dynamic__region">
            {unRegionDisplayName}
            {unRegionDisplayName && unSubregionDisplayName ? " · " : null}
            {unSubregionDisplayName}
          </p>
          <p className="country-experience-dynamic__intro">
            {t("country.heroIntro", { countryName: countryDisplayName })}
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
        <h2 id="country-statistics-title">{tStats("country.title")}</h2>
        <PublicStatisticsGrid
          cards={localizePublicStatisticCards(COUNTRY_STATISTIC_CARDS, tStats, {
            labelPath: (key) => `metrics.${key as CountryStatisticKey}.label`,
            descriptionPath: (key) => `country.cards.${key as CountryStatisticKey}.description`,
          })}
          loading={loading}
          allUnavailable={error}
          unavailableMessage={tStats("country.unavailable")}
          loadingMessage={tStats("country.loading")}
          aboutMetricLabel={tStats("shared.aboutMetric")}
          unavailableValueLabel={tStats("shared.unavailableValue")}
          formatUnavailableAriaLabel={(label) => tStats("shared.unavailableAria", { label })}
          resolveValue={(key) => {
            if (error || !statistics) {
              return null;
            }

            const value = statistics[key as keyof CountryStatisticsCounts];

            return typeof value === "number" ? value : null;
          }}
          formatValue={(_, value) => formatPlatformStatisticValue(value, locale)}
          showDescriptions
        />
      </section>

      <section
        className="country-experience-dynamic__section"
        aria-labelledby="country-search-title"
      >
        <h2 id="country-search-title">{t("country.search.title")}</h2>
        <form
          className="country-experience-dynamic__search-card"
          onSubmit={handleSearchSubmit}
          aria-label={t("country.search.formAria", { countryName: countryDisplayName })}
        >
          <div className="country-experience-dynamic__search-primary">
            <label className="country-experience-dynamic__search-query">
              <span>{t("country.search.label")}</span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t("country.search.placeholder")}
              />
            </label>
            <div className="hu-form-actions country-experience-dynamic__search-primary-actions">
              <button type="submit" className="hu-button hu-button--primary">
                {t("country.search.submit")}
              </button>
              <button
                type="button"
                className="country-experience-dynamic__clear-filters"
                onClick={handleClearFilters}
              >
                {t("country.search.clear")}
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
              placeholder={t("country.search.allRegions")}
            />
            <CitySelect
              id="country-page-community"
              countryCode={countryCode}
              regionCode={regionCode}
              value={communityCode}
              includeOther={false}
              onChange={setCommunityCode}
              placeholder={t("country.search.allCommunities")}
            />
            <label>
              <span>{t("country.search.entityType")}</span>
              <select
                className="hu-form-control"
                value={entityTypeValue}
                onChange={(event) => setEntityTypeValue(event.target.value)}
              >
                {COUNTRY_DISCOVERY_ENTITY_TYPE_OPTION_VALUES.map((value) => (
                  <option key={value || "all"} value={value}>
                    {entityTypeLabel(value)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>{t("country.search.activityArea")}</span>
              <select
                className="hu-form-control"
                value={activityArea}
                onChange={(event) => setActivityArea(event.target.value)}
              >
                <option value="">{t("country.search.allActivityAreas")}</option>
                {INITIATIVE_ACTIVITY_AREA_OPTIONS.map((option: string) => (
                  <option key={option} value={option}>
                    {resolveActivityAreaDisplayLabel(option, tExperience)}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p className="country-experience-dynamic__search-scope">
            {t("country.search.scopeCountry")} <strong>{countryDisplayName}</strong>
            {regionLabel ? (
              <>
                {" "}
                · {t("country.search.scopeRegion")} <strong>{regionLabel}</strong>
              </>
            ) : null}
            {communityLabel ? (
              <>
                {" "}
                · {t("country.search.scopeCity")} <strong>{communityLabel}</strong>
              </>
            ) : null}
          </p>
        </form>
      </section>

      <CountryCivicActionSection
        countryCode={countryCode}
        countryName={countryDisplayName}
        regionCode={regionCode}
        regionLabel={regionLabel}
        communityCode={communityCode}
        communityLabel={communityLabel}
      />

      <HuxDirectorySection
        sectionId={`country-media-${countryCode.toLowerCase()}`}
        eyebrow={t("country.media.eyebrow")}
        title={t("country.media.title")}
        description={t("country.media.description", { countryName: countryDisplayName })}
        label={t("country.media.railLabel")}
        items={media}
        getItemKey={(resource) => resource.id}
        renderItem={(resource) => <TrustedMediaRailCard resource={resource} />}
        emptyState={<p>{t("country.media.empty")}</p>}
        footerAction={
          <Link href={`${CIVIC_MEDIA_ROUTE}#selection-principles`}>
            {t("country.media.footerStandards")}
          </Link>
        }
      />

      <CountryPublicNewsWidget
        countryCode={countryCode}
        countryName={countryDisplayName}
        regionName={country.region}
        recommendedMedia={media}
      />

      <CountryTeamSection countryCode={countryCode} countryName={countryDisplayName} />
      <CountryPartnersSection countryCode={countryCode} countryName={countryDisplayName} />
    </div>
  );
}
