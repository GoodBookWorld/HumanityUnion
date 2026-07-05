import Link from "next/link";

import type { RegionIdentityPublicProjection } from "@hu/types";

import { regionIdentityContextIntroduction } from "../content";
import { ExperienceBlockShell } from "../../public-experience";
import { RegionIdentityVisual } from "./RegionIdentityVisual";

interface RegionIdentitySectionProps {
  identity: RegionIdentityPublicProjection;
}

export function RegionIdentitySection({ identity }: RegionIdentitySectionProps) {
  return (
    <ExperienceBlockShell
      id="region-identity"
      title={identity.name}
      architecturalName="Hero · Geographic Summary"
      stage="Identity"
      contextIntroduction={regionIdentityContextIntroduction(identity.name)}
      headingLevel="h1"
      visitorConclusion="This region is a geographic civic context within Humanity Union — not a separate regional portal or administrative directory."
    >
      <div className="region-identity">
        <div className="region-identity__hero">
          <RegionIdentityVisual regionName={identity.name} visual={identity.representativeVisual} />

          <div className="region-identity__summary">
            <p className="region-identity__scope">
              Region scope · {identity.name}, {identity.countryLabel}
            </p>
            <dl className="region-identity__details">
              <div className="region-identity__detail">
                <dt>Region Description</dt>
                <dd>{identity.description}</dd>
              </div>
            </dl>
          </div>
        </div>

        <p className="region-identity__ascent">
          <Link href={`/country/${encodeURIComponent(identity.countrySlug)}`}>
            Return to {identity.countryLabel} public square
          </Link>
        </p>
        {identity.source === "bootstrap" ? (
          <p className="region-identity__source" role="note">
            Bootstrap demonstration data
          </p>
        ) : null}
      </div>
    </ExperienceBlockShell>
  );
}
