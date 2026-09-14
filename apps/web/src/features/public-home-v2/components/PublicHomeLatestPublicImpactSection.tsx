"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";

import type { CivicSearchResult } from "@hu/types";

import { Badge, Button, Card } from "../../../design-system";
import { HuxDiscoverySection } from "../../horizontal-experience";

import { HOME_PUBLIC_IMPACT_PLACEHOLDER_MAX } from "../constants";
import { fetchLatestPublicImpactRecords } from "../api";

type PublicImpactCollectionItem =
  | { kind: "record"; result: CivicSearchResult }
  | { kind: "placeholder"; slotNumber: number };

function formatGeography(
  result: CivicSearchResult,
  unspecifiedLabel: string,
): string {
  const parts = [result.community, result.region, result.country].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : unspecifiedLabel;
}

function PublicImpactCarouselCard({ result }: { result: CivicSearchResult }) {
  const t = useTranslations("publicHome");

  return (
    <Card className="public-home-v2__record-card">
      <h3>{result.title}</h3>
      <p>{result.summary}</p>
      <p className="public-home-v2__record-meta">
        {formatGeography(result, t("latestPublicImpact.geographyUnspecified"))}
      </p>
      <Badge status={result.status} />
      <Button href={result.publicUrl} variant="secondary">
        {t("latestPublicImpact.explore")}
      </Button>
    </Card>
  );
}

function PublicImpactPlaceholderCard({ slotNumber }: { slotNumber: number }) {
  const t = useTranslations("publicHome");

  return (
    <Card
      className="public-home-v2__record-card public-home-v2__record-card--placeholder"
      aria-label={t("latestPublicImpact.placeholderAria", { slotNumber })}
    >
      <h3>{t("latestPublicImpact.placeholderTitle")}</h3>
      <p>{t("latestPublicImpact.placeholderBody")}</p>
    </Card>
  );
}

export function PublicHomeLatestPublicImpactSection() {
  const t = useTranslations("publicHome");
  const [items, setItems] = useState<CivicSearchResult[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void fetchLatestPublicImpactRecords(10)
      .then(setItems)
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

  const collectionItems = useMemo<PublicImpactCollectionItem[]>(() => {
    if (items.length > 0) {
      return items.map((result) => ({ kind: "record" as const, result }));
    }

    return Array.from({ length: HOME_PUBLIC_IMPACT_PLACEHOLDER_MAX }, (_, index) => ({
      kind: "placeholder" as const,
      slotNumber: index + 1,
    }));
  }, [items]);

  if (loading) {
    return (
      <section className="public-home-v2__section" aria-labelledby="public-home-impact-heading">
        <p className="public-home-v2__loading" role="status">
          {t("latestPublicImpact.loading")}
        </p>
      </section>
    );
  }

  return (
    <HuxDiscoverySection
      sectionId="public-home-impact"
      eyebrow={t("latestPublicImpact.eyebrow")}
      title={t("latestPublicImpact.title")}
      description={t("latestPublicImpact.intro")}
      label={t("latestPublicImpact.ariaLabel")}
      items={collectionItems}
      getItemKey={(item, index) =>
        item.kind === "record"
          ? item.result.entityId
          : `impact-placeholder-${item.slotNumber}-${index}`
      }
      renderItem={(item) =>
        item.kind === "record" ? (
          <PublicImpactCarouselCard result={item.result} />
        ) : (
          <PublicImpactPlaceholderCard slotNumber={item.slotNumber} />
        )
      }
    />
  );
}
