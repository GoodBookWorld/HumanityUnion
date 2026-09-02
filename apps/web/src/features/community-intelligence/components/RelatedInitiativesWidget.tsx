"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";

import type { CommunityInitiativeRelationshipProjection } from "@hu/types";

import {
  keyDifferencesLabel,
  normalizeRelatedItem,
  overlappingThemesLabel,
  relatedRelationshipLabel,
  sharedTopicLabel,
  whyRelevantLabel,
} from "../related-initiatives-presentation";

import "./related-initiatives-widget.css";

export function RelatedInitiativesWidget({
  items,
  emptyMessage,
  headingId = "related-initiatives-title",
  title,
}: {
  items: readonly CommunityInitiativeRelationshipProjection[];
  emptyMessage?: string;
  headingId?: string;
  title?: string;
}) {
  const t = useTranslations("initiativeExperience");
  const resolvedTitle = title ?? t("sidebar.related.title");
  const resolvedEmpty = emptyMessage ?? t("sidebar.related.empty");

  // Deterministic initial contract: empty and result shells share the same
  // section/heading structure. No browser-only APIs, dates, or random IDs.
  if (items.length === 0) {
    return (
      <section className="ci-related" aria-labelledby={headingId}>
        <h2 id={headingId}>{resolvedTitle}</h2>
        <p className="ci-related__empty">{resolvedEmpty}</p>
      </section>
    );
  }

  return (
    <section className="ci-related" aria-labelledby={headingId}>
      <h2 id={headingId}>{resolvedTitle}</h2>
      <ul className="ci-related__list">
        {items.map((raw) => {
          const item = normalizeRelatedItem(raw);
          const typeLabel = relatedRelationshipLabel(item.relationshipType, (key) =>
            t(`sidebar.related.${key}`),
          );
          const topic = sharedTopicLabel(item, (topicValue) =>
            t("sidebar.related.sharedTopic", { topic: topicValue }),
          );
          const themes = overlappingThemesLabel(item.sharedTopics, (count) =>
            t("sidebar.related.overlappingThemes", { count }),
          );
          const why = whyRelevantLabel(item.reasons[0]?.message, (reason) =>
            t("sidebar.related.whyRelevant", { reason }),
          );
          const differences = keyDifferencesLabel(item, (text) =>
            t("sidebar.related.keyDifferences", { differences: text }),
          );

          return (
            <li key={item.initiativeId} className="ci-related__item">
              <p className="ci-related__type">
                <span className="ci-related__type-label">{typeLabel}</span>
              </p>
              <h3 className="ci-related__title">
                <Link href={item.publicUrl}>{item.title}</Link>
              </h3>
              {topic ? <p className="ci-related__meta">{topic}</p> : null}
              {themes ? <p className="ci-related__meta">{themes}</p> : null}
              {why ? <p className="ci-related__why">{why}</p> : null}
              {differences ? <p className="ci-related__diff">{differences}</p> : null}
              <p className="ci-related__actions">
                <Link href={item.publicUrl} className="ci-related__link">
                  {t("sidebar.related.viewInitiative")}
                </Link>
              </p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
