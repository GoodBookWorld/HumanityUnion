import Link from "next/link";

import { GEOGRAPHY_COUNTRIES, getRegionsForCountry } from "../../../data/geography";
import { buildSearchUrlForGeographyScope } from "../../../data/geography/helpers";

import "./geographic-navigator.css";

export type GeographicNavigatorScope = "world" | "country" | "region" | "community";

export interface GeographicNavigatorProps {
  activeScope?: GeographicNavigatorScope;
  countrySlug?: string;
  regionSlug?: string;
  communitySlug?: string;
}

const FEATURED_COUNTRY_CODE = "CA";
const FEATURED_REGION_CODE = "CA-BC";
const FEATURED_COMMUNITY_SLUG = "nelson-community-garden";

export function GeographicNavigator({
  activeScope = "world",
  countrySlug = FEATURED_COUNTRY_CODE,
  regionSlug = FEATURED_REGION_CODE,
  communitySlug = FEATURED_COMMUNITY_SLUG,
}: GeographicNavigatorProps) {
  const country =
    GEOGRAPHY_COUNTRIES.find((entry) => entry.slug === countrySlug) ??
    GEOGRAPHY_COUNTRIES.find((entry) => entry.slug === FEATURED_COUNTRY_CODE);

  const region = getRegionsForCountry(country?.slug ?? FEATURED_COUNTRY_CODE).find(
    (entry) => entry.slug === regionSlug,
  );

  const communityLabel = communitySlug.replace(/-/g, " ");

  return (
    <nav className="geographic-navigator" aria-label="Geographic scope">
      <div className="geographic-navigator__inner">
        <p className="geographic-navigator__label" id="geographic-scope-label">
          Explore by place
        </p>
        <ol className="geographic-navigator__list" aria-labelledby="geographic-scope-label">
          <li>
            {activeScope === "world" ? (
              <span
                className="geographic-navigator__scope geographic-navigator__scope--active"
                aria-current="location"
              >
                World
              </span>
            ) : (
              <Link
                className="geographic-navigator__scope geographic-navigator__scope--link"
                href="/initiatives"
              >
                World
              </Link>
            )}
          </li>
          <li>
            {activeScope === "country" ? (
              <span
                className="geographic-navigator__scope geographic-navigator__scope--active"
                aria-current="location"
              >
                {country?.label ?? "Country"}
              </span>
            ) : (
              <Link
                className="geographic-navigator__scope geographic-navigator__scope--link"
                href={`/countries/${country?.slug ?? FEATURED_COUNTRY_CODE}`}
              >
                {country?.label ?? "Country"}
              </Link>
            )}
          </li>
          <li>
            {activeScope === "region" ? (
              <span
                className="geographic-navigator__scope geographic-navigator__scope--active"
                aria-current="location"
              >
                {region?.label ?? "Region"}
              </span>
            ) : (
              <Link
                className="geographic-navigator__scope geographic-navigator__scope--link"
                href={buildSearchUrlForGeographyScope({
                  countrySlug: country?.slug,
                  regionSlug: region?.slug ?? regionSlug,
                })}
              >
                {region?.label ?? "Region"}
              </Link>
            )}
          </li>
          <li>
            {activeScope === "community" ? (
              <span
                className="geographic-navigator__scope geographic-navigator__scope--active"
                aria-current="location"
              >
                {communityLabel}
              </span>
            ) : (
              <Link
                className="geographic-navigator__scope geographic-navigator__scope--link"
                href={buildSearchUrlForGeographyScope({
                  countrySlug: country?.slug,
                  regionSlug: region?.slug ?? regionSlug,
                  communitySlug,
                })}
              >
                {communityLabel}
              </Link>
            )}
          </li>
        </ol>
      </div>
    </nav>
  );
}
