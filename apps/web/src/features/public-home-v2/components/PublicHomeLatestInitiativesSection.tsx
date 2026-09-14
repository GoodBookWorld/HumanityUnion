"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";

import type { WorldInitiativeCardProjection } from "@hu/types";

import Link from "next/link";

import { HuxDiscoverySection } from "../../horizontal-experience";
import {
  PublicInitiativeMiniCard,
  PublicInitiativeMiniCardPlaceholder,
} from "../../public-initiative-mini-card";
import { HOME_INITIATIVE_PLACEHOLDER_MAX } from "../constants";
import { fetchHomeLatestInitiatives, HOME_LATEST_INITIATIVES_SLOT_COUNT } from "../api";

type InitiativeCollectionItem =
  | { kind: "initiative"; initiative: WorldInitiativeCardProjection }
  | { kind: "placeholder"; slotNumber: number };

export function PublicHomeLatestInitiativesSection() {
  const t = useTranslations("publicHome");
  const [items, setItems] = useState<WorldInitiativeCardProjection[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void fetchHomeLatestInitiatives(HOME_LATEST_INITIATIVES_SLOT_COUNT)
      .then(setItems)
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

  const collectionItems = useMemo<InitiativeCollectionItem[]>(() => {
    const realItems = items.slice(0, HOME_LATEST_INITIATIVES_SLOT_COUNT);
    const placeholderCount = Math.min(
      HOME_INITIATIVE_PLACEHOLDER_MAX,
      Math.max(0, HOME_LATEST_INITIATIVES_SLOT_COUNT - realItems.length),
    );

    return [
      ...realItems.map((initiative) => ({ kind: "initiative" as const, initiative })),
      ...Array.from({ length: placeholderCount }, (_, index) => ({
        kind: "placeholder" as const,
        slotNumber: index + 1,
      })),
    ];
  }, [items]);

  if (loading) {
    return (
      <section className="public-home-v2__section" aria-labelledby="public-home-initiatives-heading">
        <p className="public-home-v2__loading" role="status">
          {t("latestInitiatives.loading")}
        </p>
      </section>
    );
  }

  return (
    <HuxDiscoverySection
      sectionId="public-home-initiatives"
      eyebrow={t("latestInitiatives.eyebrow")}
      title={t("latestInitiatives.title")}
      description={t("latestInitiatives.intro")}
      label={t("latestInitiatives.ariaLabel")}
      items={collectionItems}
      showScrollHint
      headerAction={<Link href="/initiatives">{t("latestInitiatives.viewAll")}</Link>}
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
  );
}
