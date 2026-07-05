import Link from "next/link";

import type { CommunityCatalogPublicProjection, CommunityPublicRecord } from "@hu/types";

import { COMMUNITY_DISCOVERY_CONTENT } from "../content";

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
  const availableCommunities = catalog.communities.filter(isActiveCommunityRoute);

  return (
    <div className="community-discovery">
      <p className="community-discovery__note">{COMMUNITY_DISCOVERY_CONTENT.participationNote}</p>

      <p className="community-discovery__browse-label">
        {COMMUNITY_DISCOVERY_CONTENT.browseLabel} · {regionName}
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
                <p className="community-discovery__description">{community.description}</p>
                <dl className="community-discovery__meta">
                  <div>
                    <dt>Activity Area</dt>
                    <dd>{community.activityArea}</dd>
                  </div>
                  <div>
                    <dt>Local geographic context</dt>
                    <dd>
                      {community.regionLabel}, {community.countryLabel}
                    </dd>
                  </div>
                  <div>
                    <dt>Public initiatives</dt>
                    <dd>{community.initiativeCount}</dd>
                  </div>
                </dl>
                <p className="community-discovery__link">
                  <Link href={community.communityHref}>Observe this community</Link>
                </p>
              </article>
            </li>
          ))}
        </ul>
      ) : (
        <p className="community-discovery__empty" role="status">
          No participant-created communities with active public routes are listed for this region
          yet.
        </p>
      )}

      {catalog.source === "bootstrap" ? (
        <p className="community-discovery__source" role="note">
          Bootstrap demonstration data — {availableCommunities.length} participant-created communit
          {availableCommunities.length === 1 ? "y" : "ies"} available to observe in {regionName}.
        </p>
      ) : null}
    </div>
  );
}
