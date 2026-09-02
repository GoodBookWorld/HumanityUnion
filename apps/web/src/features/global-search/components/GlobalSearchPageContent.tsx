"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";

import type { InitiativeLifecycleSearchGroup } from "@hu/types";

import {
  formatPublicGeography,
  getCountryLabel,
  normalizeCountryInput,
} from "@hu/geography";
import { buildSearchUrlForGeographyScope } from "../../../data/geography/helpers";
import { Button } from "../../../design-system";
import { CitySelect, CountrySelect, RegionSelect } from "../../geography-integrity";
import { INITIATIVE_ACTIVITY_AREA_OPTIONS } from "../../initiatives/initiative-activity-areas";
import { InitiativeImage } from "../../initiatives/components/InitiativeImage";
import { resolveActivityAreaDisplayLabel } from "../../public-initiative-experience/initiative-experience-i18n";
import {
  ENTITY_TYPE_OPTIONS,
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

function entityTypeMessageKey(entityType: string): string {
  return entityType.trim() ? entityType : "all";
}

export function GlobalSearchPageContent() {
  const t = useTranslations("search");
  const tExperience = useTranslations("initiativeExperience");
  const locale = useLocale();
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
  const lifecycleProfileRaw = searchParams.get("lifecycleProfile") ?? "";
  const lifecycleProfile =
    lifecycleProfileRaw === "STANDARD" || lifecycleProfileRaw === "PUBLIC_CHOICE"
      ? lifecycleProfileRaw
      : "";
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

  const hasActiveSearch = useMemo(
    () =>
      Boolean(
        q ||
        entityType ||
        lifecycleProfile ||
        country ||
        region ||
        community ||
        activityArea ||
        status ||
        fromDate ||
        toDate ||
        offset > 0,
      ),
    [
      q,
      entityType,
      lifecycleProfile,
      country,
      region,
      community,
      activityArea,
      status,
      fromDate,
      toDate,
      offset,
    ],
  );

  function localizeEntityTypeLabel(value: string): string {
    const key = entityTypeMessageKey(value);
    try {
      return t(`entityTypes.${key}` as "entityTypes.all");
    } catch {
      return value || t("entityTypes.all");
    }
  }

  const activeFilterSummary = useMemo(() => {
    const summary: string[] = [];

    if (q) {
      summary.push(t("filterKeywords", { q }));
    }

    if (lifecycleProfile === "STANDARD") {
      summary.push(t("filterTypeStandard"));
    } else if (lifecycleProfile === "PUBLIC_CHOICE") {
      summary.push(t("filterTypePublicChoice"));
    } else if (entityType) {
      summary.push(t("filterType", { type: localizeEntityTypeLabel(entityType) }));
    }

    if (country) {
      summary.push(
        t("filterCountry", { country: getCountryLabel(country) ?? country }),
      );
    }

    if (region) {
      summary.push(t("filterRegion", { region }));
    }

    if (community) {
      summary.push(t("filterCommunity", { community }));
    }

    if (activityArea) {
      summary.push(
        t("filterActivityArea", {
          area: resolveActivityAreaDisplayLabel(activityArea, tExperience),
        }),
      );
    }

    if (status) {
      summary.push(t("filterStatus", { status }));
    }

    if (fromDate || toDate) {
      summary.push(
        t("filterDates", {
          from: fromDate || "…",
          to: toDate || "…",
        }),
      );
    }

    return summary;
  }, [
    q,
    entityType,
    country,
    region,
    community,
    activityArea,
    status,
    fromDate,
    toDate,
    lifecycleProfile,
    t,
    tExperience,
  ]);

  useEffect(() => {
    setCountryCode(country);
    setRegionCode(region);
    setCommunityCode(community);
  }, [country, region, community]);

  useEffect(() => {
    if (!hasActiveSearch) {
      setResponse(null);
      setLoading(false);
      setError(null);
      return;
    }

    const controller = new AbortController();

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
      lifecycleProfile: lifecycleProfile || undefined,
      locale: locale || undefined,
      limit: 20,
      offset,
      view: "grouped",
      signal: controller.signal,
    })
      .then((data) => {
        if (!controller.signal.aborted) {
          setResponse(data);
        }
      })
      .catch((caught: unknown) => {
        if (controller.signal.aborted) {
          return;
        }
        if (caught instanceof DOMException && caught.name === "AbortError") {
          return;
        }
        setResponse(null);
        setError(t("unavailable"));
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => {
      controller.abort();
    };
  }, [
    hasActiveSearch,
    q,
    entityType,
    lifecycleProfile,
    country,
    region,
    community,
    activityArea,
    status,
    fromDate,
    toDate,
    offset,
    locale,
    t,
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

    if (lifecycleProfile) {
      params.set("lifecycleProfile", lifecycleProfile);
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
  const resultsHeading = q.trim()
    ? t("resultsHeadingForQuery", { q: q.trim() })
    : country.trim()
      ? t("resultsHeadingInCountry", {
          country: getCountryLabel(country) ?? country,
        })
      : t("resultsHeading");
  const searchResultsKey = useMemo(
    () =>
      [
        q,
        entityType,
        lifecycleProfile,
        country,
        region,
        community,
        activityArea,
        status,
        fromDate,
        toDate,
        offset,
      ].join("|"),
    [
      q,
      entityType,
      lifecycleProfile,
      country,
      region,
      community,
      activityArea,
      status,
      fromDate,
      toDate,
      offset,
    ],
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
        <h1>{t("title")}</h1>
      </header>

      <form
        className="global-search-page__filters"
        aria-label={t("filtersAria")}
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

          if (lifecycleProfile) {
            params.set("lifecycleProfile", lifecycleProfile);
          } else {
            params.delete("lifecycleProfile");
          }

          router.push(`/search${params.toString() ? `?${params.toString()}` : ""}`);
        }}
      >
        {lifecycleProfile ? (
          <input type="hidden" name="lifecycleProfile" value={lifecycleProfile} />
        ) : null}
        <label>
          {t("queryLabel")}
          <input
            className="hu-form-control"
            name="q"
            defaultValue={q}
            placeholder={t("queryPlaceholder")}
          />
        </label>

        <label>
          {t("recordType")}
          <select className="hu-form-control" name="entityType" defaultValue={entityType}>
            {ENTITY_TYPE_OPTIONS.map((option) => (
              <option key={option.label} value={option.value}>
                {localizeEntityTypeLabel(option.value)}
              </option>
            ))}
          </select>
        </label>

        <CountrySelect
          id="search-country"
          value={countryCode}
          onChange={(nextCountry) => {
            setCountryCode(nextCountry);
            setRegionCode("");
            setCommunityCode("");
          }}
        />

        <RegionSelect
          id="search-region"
          countryCode={countryCode}
          value={regionCode}
          includeOther={false}
          onChange={(nextRegion) => {
            setRegionCode(nextRegion);
            setCommunityCode("");
          }}
        />

        <CitySelect
          id="search-community"
          countryCode={countryCode}
          regionCode={regionCode}
          value={communityCode}
          includeOther={false}
          onChange={setCommunityCode}
        />

        <label>
          {t("activityArea")}
          <select className="hu-form-control" name="activityArea" defaultValue={activityArea}>
            <option value="">{t("allActivityAreas")}</option>
            {INITIATIVE_ACTIVITY_AREA_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {resolveActivityAreaDisplayLabel(option, tExperience)}
              </option>
            ))}
          </select>
        </label>

        <label>
          {t("status")}
          <input
            className="hu-form-control"
            name="status"
            defaultValue={status}
            placeholder={t("statusPlaceholder")}
          />
        </label>

        <label>
          {t("fromDate")}
          <input
            className="hu-form-control"
            name="fromDate"
            type="date"
            defaultValue={fromDate}
          />
        </label>

        <label>
          {t("toDate")}
          <input className="hu-form-control" name="toDate" type="date" defaultValue={toDate} />
        </label>

        <div className="global-search-page__actions">
          <Button type="submit" variant="primary">
            {t("submit")}
          </Button>
        </div>
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
            {t("initialPrompt")}
          </p>
        ) : null}

        {hasActiveSearch && loading ? (
          <p className="global-search-page__status" role="status">
            {t("searching")}
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
              {response.totalDisplayResults === 1
                ? t("resultsCountOne", { count: response.totalDisplayResults })
                : t("resultsCount", { count: response.totalDisplayResults })}
              {response.totalDisplayResults > visibleCount
                ? ` · ${t("showingRange", {
                    from: response.offset + 1,
                    to: response.offset + visibleCount,
                  })}`
                : null}
            </p>

            {groupedPage.displayResults.length === 0 ? (
              <div className="global-search-page__empty" role="status">
                <p>{t("empty")}</p>
                <div className="global-search-page__empty-actions">
                  <Link href="/search">{t("clearFilters")}</Link>
                  {country ? (
                    <>
                      <Link href={`/countries/${encodeURIComponent(country)}`}>
                        {t("returnToCountry")}
                      </Link>
                      <Link href={buildSearchUrlForGeographyScope({ countrySlug: country })}>
                        {t("browseCountry")}
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
                            {localizeEntityTypeLabel(result.entityType)}
                          </span>
                          <h3>{result.title}</h3>
                          <p>{result.summary}</p>
                          {result.activityArea ? (
                            <p className="global-search-page__activity-area">
                              {resolveActivityAreaDisplayLabel(result.activityArea, tExperience)}
                            </p>
                          ) : null}
                          <p className="global-search-page__meta">
                            {formatLocation(result)} · {result.status} ·{" "}
                            {t("updated", { date: formatDate(result.updatedAt) })}
                          </p>
                          <Link href={result.publicUrl}>
                            {result.entityType === "initiative"
                              ? t("viewInitiative")
                              : t("viewPublicPage")}
                          </Link>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </>
            )}

            <nav className="global-search-page__pagination" aria-label={t("paginationAria")}>
              {response.offset > 0 ? (
                <Link
                  href={`/search${buildQueryString(Math.max(0, response.offset - response.limit))}`}
                >
                  {t("previous")}
                </Link>
              ) : null}
              {response.hasMore ? (
                <Link href={`/search${buildQueryString(response.offset + response.limit)}`}>
                  {t("next")}
                </Link>
              ) : null}
            </nav>
          </>
        ) : null}
      </section>
    </main>
  );
}
