"use client";

import type { TrustedMediaResource } from "@hu/types";
import { useTranslations } from "next-intl";

import { Badge, Card } from "../../../design-system";
import { MediaLogo } from "./MediaLogo";

interface TrustedMediaRailCardProps {
  resource: TrustedMediaResource;
  categoryTitle?: string;
  className?: string;
}

function isExternalUrl(url: string): boolean {
  return /^https?:\/\//i.test(url);
}

export function TrustedMediaRailCard({
  resource,
  categoryTitle,
  className,
}: TrustedMediaRailCardProps) {
  const t = useTranslations("civicMediaPublic");
  const catalogCategory = t.has(`trustedCategories.${resource.categoryId}`)
    ? t(`trustedCategories.${resource.categoryId}`)
    : resource.categoryId;
  const resolvedCategoryTitle = categoryTitle ?? catalogCategory;

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
          <h3>{resource.name}</h3>
          <p className="civic-media-resource-card__meta">Coverage: {resource.country}</p>
        </div>
      </div>
      <Badge status={resolvedCategoryTitle} />
      <p className="civic-media-resource-card__body">{resource.explanation}</p>
      {isExternalUrl(resource.websiteUrl) ? (
        <a
          href={resource.websiteUrl}
          className="hu-button hu-button--secondary"
          target="_blank"
          rel="noopener noreferrer"
        >
          {t("officialWebsite")}
        </a>
      ) : (
        <a href={resource.websiteUrl} className="hu-button hu-button--secondary">
          {t("officialWebsite")}
        </a>
      )}
    </Card>
  );
}
