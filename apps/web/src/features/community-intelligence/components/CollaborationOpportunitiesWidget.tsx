"use client";

import Link from "next/link";

import type { CommunityCollaborationOpportunityProjection } from "@hu/types";

import { buildCiRailPresentation } from "../../language/adapters/ci-rail-presentation";

import "./collaboration-opportunities-widget.css";

export function CollaborationOpportunitiesWidget({
  items,
  emptyMessage = "No collaboration opportunities are available yet.",
}: {
  items: readonly CommunityCollaborationOpportunityProjection[];
  emptyMessage?: string;
}) {
  return (
    <section
      className="ci-collab"
      aria-labelledby="workspace-collaboration-opportunities-title"
    >
      <h2 id="workspace-collaboration-opportunities-title">Collaboration Opportunities</h2>
      {items.length === 0 ? (
        <p className="ci-collab__empty">{emptyMessage}</p>
      ) : (
        <ul className="ci-collab__list">
          {items.map((item) => {
            // Pack 08K — CI rail semantic titles via PublicPresentationNode.
            const presentation = buildCiRailPresentation({
              recordId: item.opportunityId,
              title: item.title,
              summary: item.summary,
            });
            return (
              <li key={item.opportunityId} className="ci-collab__item">
                <h3 className="ci-collab__title">
                  <Link href={item.href}>{presentation.title}</Link>
                </h3>
                <p className="ci-collab__summary">{presentation.summary}</p>
                {item.reasons[0] ? (
                  <p className="ci-collab__why">
                    <span className="ci-collab__why-label">Why this is relevant: </span>
                    {item.reasons[0].message}
                  </p>
                ) : null}
                <p className="ci-collab__actions">
                  <Link href={item.href}>View</Link>
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
