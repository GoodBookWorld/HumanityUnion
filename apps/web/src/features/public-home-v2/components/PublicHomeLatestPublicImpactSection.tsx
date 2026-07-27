"use client";

import { useEffect, useMemo, useState } from "react";

import type { CivicSearchResult } from "@hu/types";

import { Badge, Button, Card } from "../../../design-system";
import { HuxDiscoverySection } from "../../horizontal-experience";

import { HOME_PUBLIC_IMPACT_PLACEHOLDER_MAX, PUBLIC_HOME_LATEST_PUBLIC_IMPACT } from "../constants";
import { fetchLatestPublicImpactRecords } from "../api";

type PublicImpactCollectionItem =
  | { kind: "record"; result: CivicSearchResult }
  | { kind: "placeholder"; slotNumber: number };

function formatGeography(result: CivicSearchResult): string {
  const parts = [result.community, result.region, result.country].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : "Geography not specified";
}

function PublicImpactCarouselCard({ result }: { result: CivicSearchResult }) {
  return (
    <Card className="public-home-v2__record-card">
      <h3>{result.title}</h3>
      <p>{result.summary}</p>
      <p className="public-home-v2__record-meta">{formatGeography(result)}</p>
      <Badge status={result.status} />
      <Button href={result.publicUrl} variant="secondary">
        Explore →
      </Button>
    </Card>
  );
}

function PublicImpactPlaceholderCard({ slotNumber }: { slotNumber: number }) {
  return (
    <Card
      className="public-home-v2__record-card public-home-v2__record-card--placeholder"
      aria-label={`Public impact record awaiting publication ${slotNumber}`}
    >
      <h3>Public impact record awaiting publication</h3>
      <p>
        Documented outcomes will appear here after implementation results are reviewed and
        published.
      </p>
    </Card>
  );
}

export function PublicHomeLatestPublicImpactSection() {
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
          Loading public impact records…
        </p>
      </section>
    );
  }

  return (
    <HuxDiscoverySection
      sectionId="public-home-impact"
      eyebrow="PUBLIC RESULTS"
      title={PUBLIC_HOME_LATEST_PUBLIC_IMPACT.title}
      description={PUBLIC_HOME_LATEST_PUBLIC_IMPACT.intro}
      label="public impact records"
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
