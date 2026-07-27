"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import type { ApproximateIpGeography } from "@hu/types";

import { fetchApproximateIpGeography } from "../ip-geography-api";

import "../../global-experience/components/geographic-navigator.css";
import "./approximate-ip-geographic-navigator.css";

interface NavigatorLevel {
  key: string;
  label: string;
  href?: string;
}

function buildNavigatorLevels(geography: ApproximateIpGeography): NavigatorLevel[] {
  const levels: NavigatorLevel[] = [{ key: "world", label: "World", href: "/initiatives" }];

  if (geography.countryCode && geography.countryName) {
    levels.push({
      key: "country",
      label: geography.countryName,
      href: `/countries/${encodeURIComponent(geography.countryCode)}`,
    });
  }

  if (geography.countryCode && geography.regionCode && geography.regionName) {
    levels.push({
      key: "region",
      label: geography.regionName,
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
  const [geography, setGeography] = useState<ApproximateIpGeography>({ source: "unavailable" });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void fetchApproximateIpGeography()
      .then(setGeography)
      .catch(() => setGeography({ source: "unavailable" }))
      .finally(() => setLoading(false));
  }, []);

  const levels = useMemo(() => buildNavigatorLevels(geography), [geography]);
  const screenReaderSummary = levels.map((level) => level.label).join(", ");

  return (
    <nav
      className="geographic-navigator approximate-ip-geographic-navigator"
      aria-label="Approximate location demonstration"
    >
      <div className="geographic-navigator__inner">
        <p className="approximate-ip-geographic-navigator__label">Approximate location</p>
        <p className="public-home-v2__visually-hidden" id="approximate-location-summary">
          Approximate location: {screenReaderSummary}.
        </p>
        {loading ? (
          <p className="approximate-ip-geographic-navigator__loading" role="status">
            Resolving approximate location…
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
                    >
                      {level.label}
                    </Link>
                  ) : (
                    <span
                      className="geographic-navigator__scope geographic-navigator__scope--active"
                      aria-current={isLast ? "location" : undefined}
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
