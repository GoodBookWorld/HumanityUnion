import Link from "next/link";

import type { CountryIdentityPublicProjection } from "@hu/types";

interface CountryGeographicNavigatorProps {
  identity: CountryIdentityPublicProjection;
}

export function CountryGeographicNavigator({ identity }: CountryGeographicNavigatorProps) {
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
            <span
              className="geographic-navigator__scope geographic-navigator__scope--active"
              aria-current="location"
            >
              {identity.name}
            </span>
          </li>
          <li>
            <Link
              className="geographic-navigator__scope geographic-navigator__scope--link"
              href="/region/british-columbia"
            >
              British Columbia
            </Link>
          </li>
        </ol>
      </div>
    </nav>
  );
}
