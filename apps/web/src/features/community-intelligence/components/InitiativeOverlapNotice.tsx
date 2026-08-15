"use client";

import type { CommunityInitiativeRelationshipProjection } from "@hu/types";

import {
  CONSIDER_COLLABORATION_BEHAVIOR,
  OVERLAP_NOTICE_INTRO,
  boundOverlapNoticeItems,
  buildConsiderCollaborationHref,
  relationshipTypeLabel,
} from "../overlap-ux";

import "./initiative-overlap-notice.css";

export function InitiativeOverlapNotice({
  items,
  onContinue,
}: {
  items: readonly CommunityInitiativeRelationshipProjection[];
  onContinue?: () => void;
}) {
  const bounded = boundOverlapNoticeItems(items);
  if (bounded.length === 0) {
    return null;
  }

  return (
    <aside className="ci-overlap" aria-labelledby="ci-overlap-title" role="region">
      <h2 id="ci-overlap-title">Related Initiatives already exist</h2>
      <p className="ci-overlap__intro">{OVERLAP_NOTICE_INTRO}</p>
      <ul className="ci-overlap__list">
        {bounded.map((item) => {
          const collaborationHref = buildConsiderCollaborationHref(item.publicUrl);
          const typeLabel = relationshipTypeLabel(item.relationshipType);
          const reason = item.reasons[0]?.message;

          return (
            <li key={item.initiativeId}>
              <p className="ci-overlap__title">{item.title}</p>
              <p className="ci-overlap__meta">{typeLabel}</p>
              {reason ? <p className="ci-overlap__reason">{reason}</p> : null}
              <p className="ci-overlap__actions">
                <a
                  href={item.publicUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`View Initiative ${item.title} (opens in a new tab)`}
                >
                  View Initiative
                </a>
                <span aria-hidden="true"> · </span>
                <a
                  href={collaborationHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Consider collaboration on ${item.title} (opens in a new tab)`}
                  title={CONSIDER_COLLABORATION_BEHAVIOR}
                >
                  Consider collaboration
                </a>
              </p>
            </li>
          );
        })}
      </ul>
      {onContinue ? (
        <button type="button" className="ci-overlap__continue" onClick={onContinue}>
          Continue creating
        </button>
      ) : null}
    </aside>
  );
}
