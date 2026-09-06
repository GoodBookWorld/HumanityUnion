/**
 * Pack 08K.3.1 — Trusted media rail card.
 * Outlet name stays protected identity; explanation uses explicit presentation overlay.
 * Reset 03E.1 — rendered semantic owner+result contracts on participant-facing nodes.
 * Reset 03E.5 — presentation body is explicit; canonical fallback cannot claim LOCALIZED.
 */

"use client";

import type { TrustedMediaResource } from "@hu/types";
import { getLocalizedCountryDisplayName } from "@hu/geography";
import { useLocale, useTranslations } from "next-intl";

import { Card } from "../../../design-system/components/Card";
import { WorkspaceStatusBadge as Badge } from "../../initiative-workspace-ux/components/WorkspaceStatusBadge";
import {
  MediaSemanticNode,
  plpModeToSemanticResult,
} from "../../language/media-plp/media-semantic-contract";
import { MediaLogo } from "./MediaLogo";

interface TrustedMediaRailCardProps {
  resource: TrustedMediaResource;
  categoryTitle?: string;
  /**
   * Explicit presentation explanation from PLP projection.
   * When PLP mode is PUBLISHED_LOCALIZED, this must carry the localized value —
   * never silently prefer resource.explanation while claiming LOCALIZED.
   */
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
  const presentationExplanation = (explanation ?? "").trim();
  const canonicalExplanation = resource.explanation;
  const usedPresentation =
    plpMode === "PUBLISHED_LOCALIZED" && presentationExplanation.length > 0;
  const displayExplanation = usedPresentation
    ? presentationExplanation
    : presentationExplanation || canonicalExplanation;
  const explanationResult = usedPresentation
    ? plpModeToSemanticResult("PUBLISHED_LOCALIZED")
    : plpModeToSemanticResult(
        plpMode === "PUBLISHED_LOCALIZED" ? "CANONICAL_FALLBACK" : plpMode,
      );
  const countryLabel = resource.countryCode
    ? getLocalizedCountryDisplayName(resource.countryCode, locale, resource.country)
    : resource.country;

  const cta = (
    <MediaSemanticNode as="span" owner="UI_DICTIONARY" result="LOCALIZED_DICTIONARY">
      {t("officialWebsite")}
    </MediaSemanticNode>
  );

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
      data-hu-plp-mode={
        usedPresentation
          ? "PUBLISHED_LOCALIZED"
          : plpMode === "PUBLISHED_LOCALIZED"
            ? "CANONICAL_FALLBACK"
            : plpMode
      }
      data-hu-plp-entity={plpEntity}
      data-hu-plp-id={plpId}
      data-hu-fallback-nodes={
        usedPresentation ? "0" : (fallbackNodes ?? (plpMode ? "all" : undefined))
      }
      data-hu-consumer-lineage={
        plpMode === "PUBLISHED_LOCALIZED" && !usedPresentation
          ? "LOCALIZED_PRESENTATION_CONSUMER_BYPASS"
          : usedPresentation
            ? "RENDERED_LOCALIZED"
            : undefined
      }
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
          <MediaSemanticNode as="h3" owner="PROTECTED_CANONICAL" result="PROTECTED_CANONICAL">
            {resource.name}
          </MediaSemanticNode>
          <MediaSemanticNode
            as="p"
            className="civic-media-resource-card__meta"
            owner="UI_DICTIONARY"
            result="LOCALIZED_DICTIONARY"
          >
            {t("coverageLabel", { country: countryLabel })}
          </MediaSemanticNode>
        </div>
      </div>
      <MediaSemanticNode as="span" owner="UI_DICTIONARY" result="LOCALIZED_DICTIONARY">
        <Badge status={resolvedCategoryTitle} />
      </MediaSemanticNode>
      {resource.countryCode ? (
        <MediaSemanticNode
          as="span"
          className="civic-media-resource-card__visually-hidden"
          owner="GEOGRAPHY"
          result="LOCALIZED_DICTIONARY"
          style={{
            position: "absolute",
            width: 1,
            height: 1,
            overflow: "hidden",
            clip: "rect(0 0 0 0)",
          }}
        >
          {countryLabel}
        </MediaSemanticNode>
      ) : null}
      <MediaSemanticNode
        as="p"
        className="civic-media-resource-card__body"
        owner="PLP_ENTITY"
        result={explanationResult}
        entityType={plpEntity}
        entityId={plpId}
        semanticPath="explanation"
      >
        {displayExplanation}
      </MediaSemanticNode>
      {isExternalUrl(resource.websiteUrl) ? (
        <a
          href={resource.websiteUrl}
          className="hu-button hu-button--secondary"
          target="_blank"
          rel="noopener noreferrer"
        >
          {cta}
        </a>
      ) : (
        <a href={resource.websiteUrl} className="hu-button hu-button--secondary">
          {cta}
        </a>
      )}
    </Card>
  );
}
