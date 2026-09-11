"use client";

import type { CommunityInitiativeRelationshipProjection } from "@hu/types";
import { useTranslations } from "next-intl";

import { buildCiRailPresentation } from "../../language/adapters/ci-rail-presentation";
import {
  boundOverlapNoticeItems,
  buildConsiderCollaborationHref,
} from "../overlap-ux";

import "./initiative-overlap-notice.css";

function relationshipTypeKey(
  type: CommunityInitiativeRelationshipProjection["relationshipType"],
): "possible_duplicate" | "complementary" | "related" {
  if (type === "possible_duplicate" || type === "complementary") {
    return type;
  }
  return "related";
}

export function InitiativeOverlapNotice({
  items,
  onContinue,
}: {
  items: readonly CommunityInitiativeRelationshipProjection[];
  onContinue?: () => void;
}) {
  const t = useTranslations("initiativeExperience.manage.overlap");
  const bounded = boundOverlapNoticeItems(items);
  if (bounded.length === 0) {
    return null;
  }

  return (
    <aside className="ci-overlap" aria-labelledby="ci-overlap-title" role="region">
      <h2 id="ci-overlap-title">{t("title")}</h2>
      <p className="ci-overlap__intro">{t("intro")}</p>
      <ul className="ci-overlap__list">
        {bounded.map((item) => {
          const presentation = buildCiRailPresentation({
            recordId: item.initiativeId,
            title: item.title,
            summary: item.reasons[0]?.message,
          });
          const collaborationHref = buildConsiderCollaborationHref(item.publicUrl);
          const typeLabel = t(`types.${relationshipTypeKey(item.relationshipType)}`);
          const reason = presentation.summary || item.reasons[0]?.message;

          return (
            <li key={item.initiativeId}>
              <p className="ci-overlap__title">{presentation.title}</p>
              <p className="ci-overlap__meta">{typeLabel}</p>
              {reason ? <p className="ci-overlap__reason">{reason}</p> : null}
              <p className="ci-overlap__actions">
                <a
                  href={item.publicUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={t("viewAria", { title: presentation.title })}
                >
                  {t("viewInitiative")}
                </a>
                <span aria-hidden="true"> · </span>
                <a
                  href={collaborationHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={t("collaborateAria", { title: presentation.title })}
                  title={t("collaborateTitle")}
                >
                  {t("considerCollaboration")}
                </a>
              </p>
            </li>
          );
        })}
      </ul>
      {onContinue ? (
        <button type="button" className="ci-overlap__continue" onClick={onContinue}>
          {t("continue")}
        </button>
      ) : null}
    </aside>
  );
}
