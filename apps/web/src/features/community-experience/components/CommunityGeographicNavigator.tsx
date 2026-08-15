import Link from "next/link";

import type { CommunityIdentityPublicProjection } from "@hu/types";

import { normalizeCountryInput } from "@hu/geography";

interface CommunityGeographicNavigatorProps {
  identity: CommunityIdentityPublicProjection;
}

function buildCountryHref(countrySlug: string): string {
  const code = normalizeCountryInput(countrySlug) ?? countrySlug.toUpperCase();
  return `/countries/${encodeURIComponent(code)}`;
}

export function CommunityGeographicNavigator({ identity }: CommunityGeographicNavigatorProps) {
  const countryHref = identity.countrySlug
    ? buildCountryHref(identity.countrySlug)
    : "/countries/CA";
  const regionHref = identity.regionSlug
    ? `/region/${encodeURIComponent(identity.regionSlug)}`
    : "/region/british-columbia";

  return (
    <nav className="geographic-navigator" aria-label="Geographic and community scope">
      <div className="geographic-navigator__inner">
        <p className="geographic-navigator__label" id="geographic-scope-label">
          Scope
        </p>
        <ol className="geographic-navigator__list" aria-labelledby="geographic-scope-label">
          <li>
            <Link
              className="geographic-navigator__scope geographic-navigator__scope--link"
              href="/"
            >
              World
            </Link>
          </li>
          <li>
            <Link
              className="geographic-navigator__scope geographic-navigator__scope--link"
              href={countryHref}
            >
              {identity.countryLabel}
            </Link>
          </li>
          <li>
            <Link
              className="geographic-navigator__scope geographic-navigator__scope--link"
              href={regionHref}
            >
              {identity.regionExperienceLabel ?? identity.regionLabel}
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
