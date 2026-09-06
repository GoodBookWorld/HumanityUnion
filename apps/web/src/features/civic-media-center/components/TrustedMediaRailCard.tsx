/**
 * Pack 08K.3.1 — Trusted media rail card.
 * Outlet name stays protected identity; explanation uses overlay; country uses geography display.
 */

"use client";

import type { TrustedMediaResource } from "@hu/types";
import { getLocalizedCountryDisplayName } from "@hu/geography";
import { useLocale, useTranslations } from "next-intl";

import { Badge, Card } from "../../../design-system";
import { MediaLogo } from "./MediaLogo";

interface TrustedMediaRailCardProps {
  resource: TrustedMediaResource;
  categoryTitle?: string;
  /** Localized explanation overlay; falls back to resource.explanation (identity name untouched). */
  explanation?: string;
  className?: string;
  /** Reset 03C.1 — optional PLP observability hooks (structure unchanged). */
  "data-hu-plp-mode"?: "PUBLISHED_LOCALIZED" | "CANONICAL_FALLBACK";
  "data-hu-plp-entity"?: string;
  "data-hu-plp-id"?: string;
  "data-hu-fallback-nodes"?: string;
}

function isExternalUrl(url: string): boolean {
  return /^https?:\/\//i.test(url);
}

export function TrustedMediaRailCard({
  resource,
  categoryTitle,
  explanation,
  className,
  "data-hu-plp-mode": plpMode,
  "data-hu-plp-entity": plpEntity,
  "data-hu-plp-id": plpId,
  "data-hu-fallback-nodes": fallbackNodes,
}: TrustedMediaRailCardProps) {
  const t = useTranslations("civicMediaPublic");
  const locale = useLocale();
  const catalogCategory = t.has(`trustedCategories.${resource.categoryId}`)
    ? t(`trustedCategories.${resource.categoryId}`)
    : resource.categoryId;
  const resolvedCategoryTitle = categoryTitle ?? catalogCategory;
  const displayExplanation = explanation ?? resource.explanation;
  const countryLabel = resource.countryCode
    ? getLocalizedCountryDisplayName(resource.countryCode, locale, resource.country)
    : resource.country;

  return (
    <Card
      className={[
        "civic-media-resource-card",
        "civic-media-resource-card--trusted",
        "country-media-rail-card",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      data-hu-plp-mode={plpMode}
      data-hu-plp-entity={plpEntity}
      data-hu-plp-id={plpId}
      data-hu-fallback-nodes={fallbackNodes}
    >
      <div className="civic-media-resource-card__header">
        <MediaLogo
          name={resource.name}
          logoUrl={resource.logoUrl}
          logoLabel={resource.logoLabel}
          className="civic-media-center__logo"
          imageClassName="civic-media-center__logo-image"
          width={90}
          height={48}
        />
        <div>
          <h3 data-hu-semantic="protected">{resource.name}</h3>
          <p className="civic-media-resource-card__meta" data-hu-semantic="ui">
            {t("coverageLabel", { country: countryLabel })}
          </p>
        </div>
      </div>
      <Badge status={resolvedCategoryTitle} />
      <p className="civic-media-resource-card__body" data-hu-semantic="auto">
        {displayExplanation}
      </p>
      {isExternalUrl(resource.websiteUrl) ? (
        <a
          href={resource.websiteUrl}
          className="hu-button hu-button--secondary"
          target="_blank"
          rel="noopener noreferrer"
          data-hu-semantic="protected"
        >
          {t("officialWebsite")}
        </a>
      ) : (
        <a
          href={resource.websiteUrl}
          className="hu-button hu-button--secondary"
          data-hu-semantic="protected"
        >
          {t("officialWebsite")}
        </a>
      )}
    </Card>
  );
}
