"use client";

import Link from "next/link";

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
  emptyMessage = "No closely related Initiatives were found.",
  headingId = "related-initiatives-title",
  title = "Related Initiatives",
}: {
  items: readonly CommunityInitiativeRelationshipProjection[];
  emptyMessage?: string;
  headingId?: string;
  title?: string;
}) {
  // Deterministic initial contract: empty and result shells share the same
  // section/heading structure. No browser-only APIs, dates, or random IDs.
  if (items.length === 0) {
    return (
      <section className="ci-related" aria-labelledby={headingId}>
        <h2 id={headingId}>{title}</h2>
        <p className="ci-related__empty">{emptyMessage}</p>
      </section>
    );
  }

  return (
    <section className="ci-related" aria-labelledby={headingId}>
      <h2 id={headingId}>{title}</h2>
      <ul className="ci-related__list">
        {items.map((raw) => {
          const item = normalizeRelatedItem(raw);
          const typeLabel = relatedRelationshipLabel(item.relationshipType);
          const topic = sharedTopicLabel(item);
          const themes = overlappingThemesLabel(item.sharedTopics);
          const why = whyRelevantLabel(item.reasons[0]?.message);
          const differences = keyDifferencesLabel(item);

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
                  View Initiative
                </Link>
              </p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
