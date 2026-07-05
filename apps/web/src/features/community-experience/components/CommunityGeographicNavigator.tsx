import Link from "next/link";

import type { CommunityIdentityPublicProjection } from "@hu/types";

interface CommunityGeographicNavigatorProps {
  identity: CommunityIdentityPublicProjection;
}

export function CommunityGeographicNavigator({ identity }: CommunityGeographicNavigatorProps) {
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
              href="/country/canada"
            >
              {identity.countryLabel}
            </Link>
          </li>
          <li>
            <span
              className="geographic-navigator__scope geographic-navigator__scope--disabled"
              aria-disabled="true"
              title="Region Experience is not yet available"
            >
              {identity.regionLabel}
              <span className="geographic-navigator__scope-note"> (coming soon)</span>
            </span>
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
