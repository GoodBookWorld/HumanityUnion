"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";

import type { ApproximateIpGeography } from "@hu/types";
import {
  getLocalizedAdminRegionDisplayName,
  getLocalizedCountryDisplayName,
} from "@hu/geography";

import { fetchApproximateIpGeography } from "../ip-geography-api";

import "../../global-experience/components/geographic-navigator.css";
import "./approximate-ip-geographic-navigator.css";

interface NavigatorLevel {
  key: string;
  label: string;
  href?: string;
}

function buildNavigatorLevels(
  geography: ApproximateIpGeography,
  worldLabel: string,
  locale: string,
): NavigatorLevel[] {
  const levels: NavigatorLevel[] = [{ key: "world", label: worldLabel, href: "/initiatives" }];

  if (geography.countryCode) {
    const countryLabel = getLocalizedCountryDisplayName(
      geography.countryCode,
      locale,
      geography.countryName ?? geography.countryCode,
    );
    levels.push({
      key: "country",
      label: countryLabel,
      href: `/countries/${encodeURIComponent(geography.countryCode)}`,
    });
  }

  if (geography.countryCode && geography.regionCode) {
    const regionLabel = getLocalizedAdminRegionDisplayName(
      geography.countryCode,
      geography.regionCode,
      locale,
      geography.regionName ?? geography.regionCode,
    );
    levels.push({
      key: "region",
      label: regionLabel,
      href: `/region/${encodeURIComponent(geography.regionCode)}`,
    });
  }

  if (geography.cityName) {
    levels.push({
      key: "city",
      label: geography.cityName,
    });
  }

  return levels;
}

export function ApproximateIpGeographicNavigator() {
  const t = useTranslations("initiativeExperience");
  const locale = useLocale();
  const [geography, setGeography] = useState<ApproximateIpGeography>({ source: "unavailable" });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void fetchApproximateIpGeography()
      .then(setGeography)
      .catch(() => setGeography({ source: "unavailable" }))
      .finally(() => setLoading(false));
  }, []);

  const worldLabel = t("geography.world");
  const levels = useMemo(
    () => buildNavigatorLevels(geography, worldLabel, locale),
    [geography, worldLabel, locale],
  );
  const screenReaderSummary = levels.map((level) => level.label).join(", ");

  return (
    <nav
      className="geographic-navigator approximate-ip-geographic-navigator"
      aria-label={t("geography.approximateLocationAria")}
      data-hu-surface="home-geo-navigator"
    >
      <div className="geographic-navigator__inner">
        <p className="approximate-ip-geographic-navigator__label" data-hu-semantic="ui">
          {t("geography.approximateLocation")}
        </p>
        <p className="public-home-v2__visually-hidden" id="approximate-location-summary">
          {t("geography.approximateLocationSummary", { summary: screenReaderSummary })}
        </p>
        {loading ? (
          <p className="approximate-ip-geographic-navigator__loading" role="status">
            {t("geography.resolvingApproximateLocation")}
          </p>
        ) : (
          <ol className="geographic-navigator__list" aria-labelledby="approximate-location-summary">
            {levels.map((level, index) => {
              const isLast = index === levels.length - 1;

              return (
                <li key={level.key}>
                  {!isLast && level.href ? (
                    <Link
                      className="geographic-navigator__scope geographic-navigator__scope--link"
                      href={level.href}
                      data-hu-semantic={level.key === "world" ? "ui" : "auto"}
                    >
                      {level.label}
                    </Link>
                  ) : (
                    <span
                      className="geographic-navigator__scope geographic-navigator__scope--active"
                      aria-current={isLast ? "location" : undefined}
                      data-hu-semantic={
                        level.key === "world" || level.key === "city" ? "ui" : "auto"
                      }
                    >
                      {level.label}
                    </span>
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </nav>
  );
}
