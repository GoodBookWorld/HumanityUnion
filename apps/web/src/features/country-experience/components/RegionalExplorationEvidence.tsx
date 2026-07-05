import Link from "next/link";

import type { CountryRegionalCatalogPublicProjection, RegionPublicRecord } from "@hu/types";

import { REGIONAL_EXPLORATION_CONTENT } from "../content";

function isActiveRegionRoute(region: RegionPublicRecord): boolean {
  return region.regionRouteStatus === "active" && region.regionHref.length > 0;
}

interface RegionalExplorationEvidenceProps {
  catalog: CountryRegionalCatalogPublicProjection;
  countryName: string;
}

export function RegionalExplorationEvidence({
  catalog,
  countryName,
}: RegionalExplorationEvidenceProps) {
  return (
    <div className="regional-exploration">
      <p className="regional-exploration__note">
        Regions within {countryName} on Humanity Union — Region Experience routes are not yet
        available.
      </p>

      <p className="regional-exploration__browse-label">
        {REGIONAL_EXPLORATION_CONTENT.browseLabel}
      </p>

      {catalog.regions.length > 0 ? (
        <ul className="regional-exploration__list">
          {catalog.regions.map((region) => (
            <li key={region.slug} className="regional-exploration__item">
              <article aria-labelledby={`region-record-${region.slug}`}>
                <h3 className="regional-exploration__title" id={`region-record-${region.slug}`}>
                  {isActiveRegionRoute(region) ? (
                    <Link href={region.regionHref}>{region.name}</Link>
                  ) : (
                    <span>
                      {region.name}
                      <span className="regional-exploration__unavailable-note">
                        {" "}
                        (Region Experience coming soon)
                      </span>
                    </span>
                  )}
                </h3>
                <p className="regional-exploration__description">{region.description}</p>
                <dl className="regional-exploration__meta">
                  <div>
                    <dt>Country</dt>
                    <dd>{region.countryLabel}</dd>
                  </div>
                  <div>
                    <dt>Public initiatives</dt>
                    <dd>{region.initiativeCount}</dd>
                  </div>
                </dl>
                {isActiveRegionRoute(region) ? (
                  <p className="regional-exploration__link">
                    <Link href={region.regionHref}>Observe this region</Link>
                  </p>
                ) : (
                  <p className="regional-exploration__placeholder" role="status">
                    Region route not yet available — preview only.
                  </p>
                )}
              </article>
            </li>
          ))}
        </ul>
      ) : (
        <p className="regional-exploration__empty" role="status">
          No regional civic contexts are listed for this country yet.
        </p>
      )}

      {catalog.source === "bootstrap" ? (
        <p className="regional-exploration__source" role="note">
          Bootstrap demonstration data — {catalog.regions.length} regional preview records
        </p>
      ) : null}
    </div>
  );
}
