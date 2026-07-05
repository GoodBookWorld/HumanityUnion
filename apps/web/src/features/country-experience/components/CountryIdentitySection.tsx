import Link from "next/link";

import type { CountryIdentityPublicProjection } from "@hu/types";

import { countryIdentityContextIntroduction } from "../content";
import { ExperienceBlockShell } from "../../public-experience";
import { CountryIdentityVisual } from "./CountryIdentityVisual";

interface CountryIdentitySectionProps {
  identity: CountryIdentityPublicProjection;
}

export function CountryIdentitySection({ identity }: CountryIdentitySectionProps) {
  return (
    <ExperienceBlockShell
      id="country-identity"
      title={identity.name}
      architecturalName="Hero · Geographic Summary"
      stage="Identity"
      contextIntroduction={countryIdentityContextIntroduction(identity.name)}
      headingLevel="h1"
      visitorConclusion="This country is a geographic civic context within Humanity Union — not a separate national platform or administrative portal."
    >
      <div className="country-identity">
        <div className="country-identity__hero">
          <CountryIdentityVisual
            countryName={identity.name}
            visual={identity.representativeVisual}
          />

          <div className="country-identity__summary">
            <p className="country-identity__scope">Country scope · {identity.name}</p>
            <dl className="country-identity__details">
              <div className="country-identity__detail">
                <dt>Country Description</dt>
                <dd>{identity.description}</dd>
              </div>
            </dl>
          </div>
        </div>

        <p className="country-identity__ascent">
          <Link href="/">Return to World public square</Link>
        </p>
        {identity.source === "bootstrap" ? (
          <p className="country-identity__source" role="note">
            Bootstrap demonstration data
          </p>
        ) : null}
      </div>
    </ExperienceBlockShell>
  );
}
