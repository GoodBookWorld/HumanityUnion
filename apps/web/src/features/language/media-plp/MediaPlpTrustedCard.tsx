/**
 * Reset 03 — PLP-mode trusted media card (renders resolved presentation only).
 */

"use client";

import type { TrustedMediaResource } from "@hu/types";
import { useTranslations } from "next-intl";

import { Badge, Card } from "../../../design-system";
import { MediaLogo } from "../../civic-media-center/components/MediaLogo";
import type { MediaPlpResolvedPresentation } from "./presentation";
import { readMediaPlpStringField } from "./presentation";

function isExternalUrl(url: string): boolean {
  return /^https?:\/\//i.test(url);
}

export function MediaPlpTrustedCard(input: {
  readonly resource: TrustedMediaResource;
  readonly resolved: MediaPlpResolvedPresentation;
  readonly categoryTitle?: string;
}) {
  const t = useTranslations("civicMediaPublic");
  const catalogCategory = t.has(`trustedCategories.${input.resource.categoryId}`)
    ? t(`trustedCategories.${input.resource.categoryId}`)
    : input.resource.categoryId;
  const resolvedCategoryTitle = input.categoryTitle ?? catalogCategory;
  const explanation = readMediaPlpStringField(input.resolved.presentation, "explanation");
  const name =
    readMediaPlpStringField(input.resolved.presentation, "name") || input.resource.name;
  const websiteUrl =
    readMediaPlpStringField(input.resolved.presentation, "websiteUrl") ||
    input.resource.websiteUrl;

  return (
    <Card
      className={[
        "civic-media-resource-card",
        "civic-media-resource-card--trusted",
        "country-media-rail-card",
      ].join(" ")}
      data-hu-plp-mode={input.resolved.mode}
      data-hu-plp-entity={input.resolved.entityType}
      data-hu-plp-id={input.resolved.entityId}
      data-hu-fallback-nodes={input.resolved.mode === "CANONICAL_FALLBACK" ? "all" : "0"}
    >
      <div className="civic-media-resource-card__header">
        <MediaLogo
          name={name}
          logoUrl={input.resource.logoUrl}
          logoLabel={input.resource.logoLabel}
          className="civic-media-center__logo"
          imageClassName="civic-media-center__logo-image"
          width={90}
          height={48}
        />
        <div>
          <h3 data-hu-semantic="protected">{name}</h3>
        </div>
      </div>
      <Badge status={resolvedCategoryTitle} />
      <p className="civic-media-resource-card__body" data-hu-semantic="auto">
        {explanation}
      </p>
      {isExternalUrl(websiteUrl) ? (
        <a
          href={websiteUrl}
          className="hu-button hu-button--secondary"
          target="_blank"
          rel="noopener noreferrer"
          data-hu-semantic="protected"
        >
          {t("officialWebsite")}
        </a>
      ) : (
        <a href={websiteUrl} className="hu-button hu-button--secondary" data-hu-semantic="protected">
          {t("officialWebsite")}
        </a>
      )}
    </Card>
  );
}
