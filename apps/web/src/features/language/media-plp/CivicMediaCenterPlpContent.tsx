/**
 * Reset 03 — /media PLP-mode page content (no semantic translation hooks/overlays).
 */

"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";

import type {
  CivicMediaCenterPublic,
  CivicMediaSelectionPrinciple,
  TrustedMediaResource,
} from "@hu/types";

import { Card } from "../../../design-system";
import { CIVIC_MEDIA_ROUTE } from "../../civic-media-center/routes";
import {
  HuxDirectorySection,
  HuxDirectoryShell,
} from "../../horizontal-experience";
import { TrustedMediaCategoryTabs } from "../../civic-media-center/components/TrustedMediaCategoryTabs";
import { MediaPlpTrustedCard } from "./MediaPlpTrustedCard";
import type { MediaPlpResolvedPresentation } from "./presentation";
import { readMediaPlpStringField } from "./presentation";

function PlpPrincipleCard(input: {
  readonly principle: CivicMediaSelectionPrinciple;
  readonly resolved?: MediaPlpResolvedPresentation;
}) {
  const title = input.resolved
    ? readMediaPlpStringField(input.resolved.presentation, "title")
    : input.principle.title;
  const description = input.resolved
    ? readMediaPlpStringField(input.resolved.presentation, "description")
    : input.principle.description;

  return (
    <Card
      className="civic-media-resource-card civic-media-resource-card--principle"
      data-hu-plp-mode={input.resolved?.mode ?? "CANONICAL_FALLBACK"}
      data-hu-plp-entity={input.resolved?.entityType}
      data-hu-plp-id={input.resolved?.entityId}
    >
      <h3 data-hu-semantic="auto">{title}</h3>
      <p className="civic-media-resource-card__body" data-hu-semantic="auto">
        {description}
      </p>
    </Card>
  );
}

export function CivicMediaCenterPlpContent(input: {
  readonly media: CivicMediaCenterPublic;
  readonly trustedById: Readonly<Record<string, MediaPlpResolvedPresentation>>;
  readonly principlesById: Readonly<Record<string, MediaPlpResolvedPresentation>>;
}) {
  const t = useTranslations("civicMediaPublic");

  return (
    <main className="civic-media-page" data-hu-media-plp="true">
      <div className="civic-media-page__inner">
        <HuxDirectorySection
          sectionId="selection-principles"
          eyebrow={t("selectionPrinciples.eyebrow")}
          title={t("selectionPrinciples.title")}
          description={t("selectionPrinciples.description")}
          label={t("selectionPrinciples.ariaLabel")}
          items={[...input.media.selectionPrinciples]}
          layout="four-two-one"
          getItemKey={(principle) => principle.id}
          renderItem={(principle) => (
            <PlpPrincipleCard
              principle={principle}
              resolved={input.principlesById[principle.id]}
            />
          )}
          footerAction={
            <Link href={`${CIVIC_MEDIA_ROUTE}#faq`}>{t("selectionPrinciples.readFaq")}</Link>
          }
        />

        <HuxDirectoryShell
          sectionId="trusted-media"
          eyebrow={t("trustedMedia.eyebrow")}
          title={t("trustedMedia.title")}
          description={t("trustedMedia.description")}
        >
          <TrustedMediaCategoryTabs
            sectionId="trusted-media"
            categories={input.media.trustedMediaCategories}
            resources={input.media.trustedMedia}
            renderItem={(resource: TrustedMediaResource, categoryTitle) => {
              const resolved = input.trustedById[resource.id];
              if (!resolved) {
                return null;
              }
              return (
                <MediaPlpTrustedCard
                  resource={resource}
                  resolved={resolved}
                  categoryTitle={categoryTitle}
                />
              );
            }}
          />
        </HuxDirectoryShell>
      </div>
    </main>
  );
}
