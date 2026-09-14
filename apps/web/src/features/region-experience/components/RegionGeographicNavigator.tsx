"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";

import type { RegionIdentityPublicProjection } from "@hu/types";

import { normalizeCountryInput } from "@hu/geography";

interface RegionGeographicNavigatorProps {
  identity: RegionIdentityPublicProjection;
}

function buildCountryHref(countrySlug: string): string {
  const code = normalizeCountryInput(countrySlug) ?? countrySlug.toUpperCase();
  return `/countries/${encodeURIComponent(code)}`;
}

export function RegionGeographicNavigator({ identity }: RegionGeographicNavigatorProps) {
  const t = useTranslations("publicGeo");

  return (
    <nav className="geographic-navigator" aria-label={t("region.navigatorAria")}>
      <div className="geographic-navigator__inner">
        <p className="geographic-navigator__label" id="geographic-scope-label">
          {t("shared.scope")}
        </p>
        <ol className="geographic-navigator__list" aria-labelledby="geographic-scope-label">
          <li>
            <Link
              className="geographic-navigator__scope geographic-navigator__scope--link"
              href="/"
            >
              {t("shared.world")}
            </Link>
          </li>
          <li>
            <Link
              className="geographic-navigator__scope geographic-navigator__scope--link"
              href={buildCountryHref(identity.countrySlug)}
            >
              {identity.countryLabel}
            </Link>
          </li>
          <li>
            <span
              className="geographic-navigator__scope geographic-navigator__scope--active"
              aria-current="location"
            >
              {identity.name}
            </span>
          </li>
        </ol>
      </div>
    </nav>
  );
}
