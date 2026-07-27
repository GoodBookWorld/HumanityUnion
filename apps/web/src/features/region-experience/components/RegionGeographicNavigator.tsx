import Link from "next/link";

import type { RegionIdentityPublicProjection } from "@hu/types";

import { normalizeCountryInput } from "../../../data/geography";

interface RegionGeographicNavigatorProps {
  identity: RegionIdentityPublicProjection;
}

function buildCountryHref(countrySlug: string): string {
  const code = normalizeCountryInput(countrySlug) ?? countrySlug.toUpperCase();
  return `/countries/${encodeURIComponent(code)}`;
}

export function RegionGeographicNavigator({ identity }: RegionGeographicNavigatorProps) {
  return (
    <nav className="geographic-navigator" aria-label="Geographic scope">
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
