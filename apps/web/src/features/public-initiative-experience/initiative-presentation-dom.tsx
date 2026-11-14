/**
 * Pack 08I.14A — presentational Initiative DOM boundaries for final-DOM acceptance.
 * These render the participant-visible classnames used on Live surfaces.
 */

import React from "react";

import type { InitiativePublicPresentation } from "./initiative-public-presentation";

/** Compact public Initiative card title — description must never appear here. */
export function InitiativeCompactCardTitleDom(props: {
  readonly title: string;
  readonly className?: string;
}) {
  return (
    <h3 className={props.className ?? "public-initiative-mini-card__title"}>{props.title}</h3>
  );
}

/** PIE Hero title + description inside `.pie-layout__hero`. */
export function InitiativePieHeroPresentationDom(props: {
  readonly presentation: Pick<InitiativePublicPresentation, "title" | "description">;
}) {
  return (
    <div className="pie-layout__hero">
      <section className="pie-hero" aria-labelledby="pie-hero-title">
        <h1 id="pie-hero-title" className="pie-hero__title">
          <span dir="auto">{props.presentation.title}</span>
        </h1>
        {props.presentation.description ? (
          <div className="pie-hero__description" dir="auto">
            {props.presentation.description}
          </div>
        ) : null}
      </section>
    </div>
  );
}

/** Overview full description section. */
export function InitiativeOverviewDescriptionDom(props: {
  readonly label: string;
  readonly description: string;
}) {
  if (!props.description) {
    return null;
  }
  return (
    <section className="pie-overview__section">
      <h3>{props.label}</h3>
      <p dir="auto">{props.description}</p>
    </section>
  );
}
