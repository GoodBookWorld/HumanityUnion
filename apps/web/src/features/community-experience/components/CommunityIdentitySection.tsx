"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";

import type { CommunityIdentityPublicProjection } from "@hu/types";

import { normalizeCountryInput } from "@hu/geography";
import { ExperienceBlockShell } from "../../public-experience";
import { CommunityIdentityVisual } from "./CommunityIdentityVisual";

interface CommunityIdentitySectionProps {
  identity: CommunityIdentityPublicProjection;
}

export function CommunityIdentitySection({ identity }: CommunityIdentitySectionProps) {
  const t = useTranslations("publicGeo");

  return (
    <ExperienceBlockShell
      id="community-identity"
      title={identity.name}
      architecturalName={t("community.identity.architecturalName")}
      stage={t("community.identity.stage")}
      contextIntroduction={t("community.identity.contextIntroduction", {
        communityName: identity.name,
      })}
      headingLevel="h1"
      visitorConclusion={t("community.identity.visitorConclusion")}
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
              {t("community.identity.scopeLabel", {
                regionName: identity.regionLabel,
                countryName: identity.countryLabel,
              })}
            </p>
            <dl className="community-identity__details">
              <div className="community-identity__detail">
                <dt>{t("community.identity.descriptionLabel")}</dt>
                <dd>{identity.description}</dd>
              </div>
              <div className="community-identity__detail">
                <dt>{t("shared.activityArea")}</dt>
                <dd>{identity.activityArea}</dd>
              </div>
            </dl>
          </div>
        </div>

        <p className="community-identity__ascent">
          {identity.regionSlug ? (
            <>
              <Link href={`/region/${encodeURIComponent(identity.regionSlug)}`}>
                {t("shared.returnToRegionScope", {
                  regionName: identity.regionExperienceLabel ?? identity.regionLabel,
                })}
              </Link>
              {" · "}
            </>
          ) : null}
          {identity.countrySlug ? (
            <>
              <Link
                href={`/countries/${encodeURIComponent(normalizeCountryInput(identity.countrySlug) ?? identity.countrySlug.toUpperCase())}`}
              >
                {t("shared.returnToCountrySquare", { countryName: identity.countryLabel })}
              </Link>
              {" · "}
            </>
          ) : null}
          <Link href="/">{t("shared.returnToWorldSquare")}</Link>
        </p>
        {identity.source === "bootstrap" ? (
          <p className="community-identity__source" role="note">
            {t("shared.bootstrapSource")}
          </p>
        ) : null}
      </div>
    </ExperienceBlockShell>
  );
}
