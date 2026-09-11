"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";

import type { CommunityCollaborationOpportunityProjection } from "@hu/types";

import { buildCiRailPresentation } from "../../language/adapters/ci-rail-presentation";
import { resolveWorkspaceCiReasonLabel } from "../../workspace-home/workspace-home-i18n";

import "./collaboration-opportunities-widget.css";

export function CollaborationOpportunitiesWidget({
  items,
  emptyMessage,
}: {
  items: readonly CommunityCollaborationOpportunityProjection[];
  emptyMessage?: string;
}) {
  const t = useTranslations("workspace");
  const resolvedEmpty = emptyMessage ?? t("home.ciEmpty");

  return (
    <section
      className="ci-collab"
      aria-labelledby="workspace-collaboration-opportunities-title"
    >
      <h2 id="workspace-collaboration-opportunities-title">
        {t("home.collaborationOpportunitiesTitle")}
      </h2>
      {items.length === 0 ? (
        <p className="ci-collab__empty">{resolvedEmpty}</p>
      ) : (
        <ul className="ci-collab__list">
          {items.map((item) => {
            const presentation = buildCiRailPresentation({
              recordId: item.opportunityId,
              title: item.title,
              summary: item.summary,
            });
            const reason = item.reasons[0];
            return (
              <li key={item.opportunityId} className="ci-collab__item">
                <h3 className="ci-collab__title">
                  <Link href={item.href}>{presentation.title}</Link>
                </h3>
                <p className="ci-collab__summary">{presentation.summary}</p>
                {reason ? (
                  <p className="ci-collab__why">
                    <span className="ci-collab__why-label">{t("home.ciWhyRelevant")} </span>
                    {resolveWorkspaceCiReasonLabel(t, reason.code, reason.message)}
                  </p>
                ) : null}
                <p className="ci-collab__actions">
                  <Link href={item.href}>{t("home.ciView")}</Link>
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
