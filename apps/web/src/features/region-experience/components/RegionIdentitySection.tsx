"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";

import { useLocalizedBrand } from "../../brand-localization/useLocalizedBrand";

import type { RegionIdentityPublicProjection } from "@hu/types";

import { normalizeCountryInput } from "@hu/geography";
import { ExperienceBlockShell } from "../../public-experience";
import { RegionIdentityVisual } from "./RegionIdentityVisual";

interface RegionIdentitySectionProps {
  identity: RegionIdentityPublicProjection;
}

export function RegionIdentitySection({ identity }: RegionIdentitySectionProps) {
  const t = useTranslations("publicGeo");
  const brand = useLocalizedBrand();
  const siteName = { siteName: brand.siteName };

  return (
    <ExperienceBlockShell
      id="region-identity"
      title={identity.name}
      architecturalName={t("region.identity.architecturalName")}
      stage={t("region.identity.stage")}
      contextIntroduction={t("region.identity.contextIntroduction", {
        regionName: identity.name,
        ...siteName,
      })}
      headingLevel="h1"
      visitorConclusion={t("region.identity.visitorConclusion", siteName)}
    >
      <div className="region-identity">
        <div className="region-identity__hero">
          <RegionIdentityVisual regionName={identity.name} visual={identity.representativeVisual} />

          <div className="region-identity__summary">
            <p className="region-identity__scope">
              {t("region.identity.scopeLine", {
                regionName: identity.name,
                countryName: identity.countryLabel,
              })}
            </p>
            <dl className="region-identity__details">
              <div className="region-identity__detail">
                <dt>{t("region.identity.descriptionLabel")}</dt>
                <dd>{identity.description}</dd>
              </div>
            </dl>
          </div>
        </div>

        <p className="region-identity__ascent">
          <Link
            href={`/countries/${encodeURIComponent(normalizeCountryInput(identity.countrySlug) ?? identity.countrySlug.toUpperCase())}`}
          >
            {t("shared.returnToCountrySquare", { countryName: identity.countryLabel })}
          </Link>
        </p>
        {identity.source === "bootstrap" ? (
          <p className="region-identity__source" role="note">
            {t("shared.bootstrapSource")}
          </p>
        ) : null}
      </div>
    </ExperienceBlockShell>
  );
}
