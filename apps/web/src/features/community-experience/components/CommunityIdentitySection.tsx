import Link from "next/link";

import type { CommunityIdentityPublicProjection } from "@hu/types";

import { communityIdentityContextIntroduction } from "../content";
import { ExperienceBlockShell } from "../../public-experience";
import { CommunityIdentityVisual } from "./CommunityIdentityVisual";

interface CommunityIdentitySectionProps {
  identity: CommunityIdentityPublicProjection;
}

export function CommunityIdentitySection({ identity }: CommunityIdentitySectionProps) {
  return (
    <ExperienceBlockShell
      id="community-identity"
      title={identity.name}
      architecturalName="Hero · Community Summary"
      stage="Identity"
      contextIntroduction={communityIdentityContextIntroduction(identity.name)}
      headingLevel="h1"
      visitorConclusion="This community is a participant-created civic context — not an administrator-defined administrative unit."
    >
      <div className="community-identity">
        <div className="community-identity__hero">
          <CommunityIdentityVisual
            communityName={identity.name}
            activityArea={identity.activityArea}
            visual={identity.representativeVisual}
          />

          <div className="community-identity__summary">
            <p className="community-identity__scope">
              Community scope · {identity.regionLabel}, {identity.countryLabel}
            </p>
            <dl className="community-identity__details">
              <div className="community-identity__detail">
                <dt>Community Description</dt>
                <dd>{identity.description}</dd>
              </div>
              <div className="community-identity__detail">
                <dt>Activity Area</dt>
                <dd>{identity.activityArea}</dd>
              </div>
            </dl>
          </div>
        </div>

        <p className="community-identity__ascent">
          {identity.regionSlug ? (
            <>
              <Link href={`/region/${encodeURIComponent(identity.regionSlug)}`}>
                Return to {identity.regionExperienceLabel ?? identity.regionLabel} regional scope
              </Link>
              {" · "}
            </>
          ) : null}
          {identity.countrySlug ? (
            <>
              <Link href={`/country/${encodeURIComponent(identity.countrySlug)}`}>
                Return to {identity.countryLabel} public square
              </Link>
              {" · "}
            </>
          ) : null}
          <Link href="/">Return to World public square</Link>
        </p>
        {identity.source === "bootstrap" ? (
          <p className="community-identity__source" role="note">
            Bootstrap demonstration data
          </p>
        ) : null}
      </div>
    </ExperienceBlockShell>
  );
}
