"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";

import type { WorldInitiativeCardProjection } from "@hu/types";

import { Button } from "../../../design-system";
import { HuxDiscoverySection } from "../../horizontal-experience";
import {
  PublicInitiativeMiniCard,
  PublicInitiativeMiniCardPlaceholder,
} from "../../public-initiative-mini-card";
import { PublicHomeCreateInitiativeCta } from "../../public-home-v2/components/PublicHomeCreateInitiativeCta";
import { fetchLatestPublicInitiatives } from "../api";

type InitiativeCollectionItem =
  | { kind: "initiative"; initiative: WorldInitiativeCardProjection }
  | { kind: "placeholder"; slotNumber: number };

const RELATED_INITIATIVES_SLOT_COUNT = 3;

function mapSearchResultToMiniCard(
  result: Awaited<ReturnType<typeof fetchLatestPublicInitiatives>>[number],
): WorldInitiativeCardProjection {
  const geographyParts = [result.community, result.region, result.country].filter(Boolean);

  return {
    initiativeId: result.entityId,
    title: result.title,
    summary: result.summary,
    imageUrl: result.imageUrl,
    activityArea: result.activityArea ?? "Civic initiative",
    geographyLabel:
      geographyParts.length > 0 ? geographyParts.join(", ") : "Geography not specified",
    publicStatus: result.status,
    currentStageLabel: result.status,
    publishedAt: result.updatedAt,
    publicInitiativeHref: result.publicUrl,
  };
}

export function InstitutionsLatestInitiativesSection() {
  const t = useTranslations("institutionsPublic");
  const [items, setItems] = useState<WorldInitiativeCardProjection[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void fetchLatestPublicInitiatives(RELATED_INITIATIVES_SLOT_COUNT)
      .then((results) => results.map(mapSearchResultToMiniCard))
      .then(setItems)
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

  const collectionItems = useMemo<InitiativeCollectionItem[]>(() => {
    const realItems = items.slice(0, RELATED_INITIATIVES_SLOT_COUNT);
    const placeholderCount = Math.max(0, RELATED_INITIATIVES_SLOT_COUNT - realItems.length);

    return [
      ...realItems.map((initiative) => ({ kind: "initiative" as const, initiative })),
      ...Array.from({ length: placeholderCount }, (_, index) => ({
        kind: "placeholder" as const,
        slotNumber: index + 1,
      })),
    ];
  }, [items]);

  const emptyState = (
    <div className="institutions-related-initiatives__empty">
      <p>{t("relatedEmptyPrimary")}</p>
      <p>{t("relatedEmptySecondary")}</p>
      <PublicHomeCreateInitiativeCta label={t("primaryCta")} />
    </div>
  );

  if (loading) {
    return (
      <section
        id="institutions-related-initiatives"
        className="institutions-related-initiatives institutions-section institutions-section--white"
        aria-labelledby="institutions-related-initiatives-heading"
      >
        <div className="institutions-section__inner">
          <p className="institutions-related-initiatives__loading" role="status">
            {t("relatedLoading")}
          </p>
        </div>
      </section>
    );
  }

  return (
    <section
      id="institutions-related-initiatives"
      className="institutions-related-initiatives institutions-section institutions-section--white"
      aria-labelledby="institutions-related-initiatives-heading"
    >
      <div className="institutions-section__inner">
        <HuxDiscoverySection
          sectionId="institutions-related-initiatives"
          eyebrow={t("relatedEyebrow")}
          title={t("relatedTitle")}
          description={t("relatedDescription")}
          label={t("relatedAriaLabel")}
          items={collectionItems}
          emptyState={emptyState}
          headerAction={
            <Button href="/initiatives" variant="secondary">
              {t("relatedViewAll")}
            </Button>
          }
          getItemKey={(item, index) =>
            item.kind === "initiative"
              ? item.initiative.initiativeId
              : `placeholder-${item.slotNumber}-${index}`
          }
          renderItem={(item) =>
            item.kind === "initiative" ? (
              <PublicInitiativeMiniCard initiative={item.initiative} />
            ) : (
              <PublicInitiativeMiniCardPlaceholder slotNumber={item.slotNumber} />
            )
          }
        />
      </div>
    </section>
  );
}
