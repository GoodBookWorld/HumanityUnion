"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";

import type { CommunityCatalogPublicProjection, CommunityPublicRecord } from "@hu/types";

function isActiveCommunityRoute(community: CommunityPublicRecord): boolean {
  return community.communityRouteStatus === "active" && community.communityHref.length > 0;
}

interface CommunityDiscoveryEvidenceProps {
  catalog: CommunityCatalogPublicProjection;
  regionName: string;
}

export function CommunityDiscoveryEvidence({
  catalog,
  regionName,
}: CommunityDiscoveryEvidenceProps) {
  const t = useTranslations("publicGeo.region.discovery");
  const tShared = useTranslations("publicGeo.shared");
  const availableCommunities = catalog.communities.filter(isActiveCommunityRoute);

  return (
    <div className="community-discovery">
      <p className="community-discovery__note">{t("participationNote")}</p>

      <p className="community-discovery__browse-label">
        {t("browseLabel")} · {regionName}
      </p>

      {availableCommunities.length > 0 ? (
        <ul className="community-discovery__list">
          {availableCommunities.map((community) => (
            <li key={community.slug} className="community-discovery__item">
              <article aria-labelledby={`community-discovery-${community.slug}`}>
                <h3
                  className="community-discovery__title"
                  id={`community-discovery-${community.slug}`}
                >
                  <Link href={community.communityHref}>{community.name}</Link>
                </h3>
                {community.description ? (
                  <p className="community-discovery__description">{community.description}</p>
                ) : null}
                <dl className="community-discovery__meta">
                  {community.activityArea ? (
                    <div>
                      <dt>{tShared("activityArea")}</dt>
                      <dd>{community.activityArea}</dd>
                    </div>
                  ) : null}
                  <div>
                    <dt>{tShared("localGeographicContext")}</dt>
                    <dd>
                      {community.regionLabel}, {community.countryLabel}
                    </dd>
                  </div>
                  <div>
                    <dt>{tShared("publicInitiatives")}</dt>
                    <dd>{community.initiativeCount}</dd>
                  </div>
                </dl>
                <p className="community-discovery__link">
                  <Link href={community.communityHref}>{tShared("observeCommunity")}</Link>
                </p>
              </article>
            </li>
          ))}
        </ul>
      ) : (
        <p className="community-discovery__empty" role="status">
          {t("empty")}
        </p>
      )}

      {catalog.source === "bootstrap" ? (
        <p className="community-discovery__source" role="note">
          {tShared("bootstrapCommunitiesObserveInRegion", {
            count: availableCommunities.length,
            regionName,
          })}
        </p>
      ) : null}
    </div>
  );
}
