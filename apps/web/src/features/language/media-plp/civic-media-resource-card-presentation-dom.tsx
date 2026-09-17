/**
 * Version 5.0 — Civic Media verification / analysis card DOM boundaries
 * for rendered-consumer acceptance (classnames used on Live /media).
 */

import React from "react";

/** Verification card body + chips (fact-check mission / coverage chips). */
export function CivicMediaVerificationCardPresentationDom(props: {
  readonly mission: string;
  readonly chips: readonly string[];
}) {
  return (
    <article className="hu-card civic-media-resource-card civic-media-resource-card--verification">
      <p className="civic-media-resource-card__body">{props.mission}</p>
      <div className="civic-media-resource-card__chips">
        {props.chips.map((chip) => (
          <span key={chip} className="civic-media-chip">
            {chip}
          </span>
        ))}
      </div>
    </article>
  );
}

/** Analysis card neutral badge + body (propaganda focus / explanation). */
export function CivicMediaAnalysisCardPresentationDom(props: {
  readonly focus: string;
  readonly explanation: string;
}) {
  return (
    <article className="hu-card civic-media-resource-card civic-media-resource-card--analysis">
      <span className="workspace-badge workspace-badge--neutral">{props.focus}</span>
      <p className="civic-media-resource-card__body">{props.explanation}</p>
    </article>
  );
}
