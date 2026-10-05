"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import type { CommunityInitiativeRelationshipProjection } from "@hu/types";

import { fetchRelatedInitiatives } from "../api";
import { RelatedInitiativesWidget } from "./RelatedInitiativesWidget";

import "./related-initiatives-widget.css";

/**
 * Loads Related Initiatives after the primary Initiative experience renders.
 * One request. Failure stays inside this section.
 */
export function DeferredRelatedInitiatives({
  initiativeId,
}: {
  readonly initiativeId: string;
}) {
  const tExperience = useTranslations("initiativeExperience");
  const tCommon = useTranslations("common");
  const [items, setItems] = useState<
    readonly CommunityInitiativeRelationshipProjection[] | null
  >(null);

  useEffect(() => {
    let cancelled = false;
    setItems(null);

    void fetchRelatedInitiatives(initiativeId)
      .then((response) => {
        if (!cancelled) {
          setItems(response.items);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setItems([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [initiativeId]);

  if (items === null) {
    return (
      <section
        className="ci-related"
        aria-busy="true"
        aria-labelledby="related-initiatives-title"
      >
        <h2 id="related-initiatives-title">{tExperience("sidebar.related.title")}</h2>
        <p className="ci-related__empty" role="status">
          {tCommon("loading")}
        </p>
      </section>
    );
  }

  return <RelatedInitiativesWidget items={items} />;
}
