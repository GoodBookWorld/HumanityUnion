"use client";

import type { PublicInitiativeWithVersionHistory } from "@hu/types";
import { useLocale, useTranslations } from "next-intl";

import { formatInitiativeExperienceDate } from "../initiative-experience-i18n";

interface PublicInitiativeRevisionHistoryProps {
  initiativeId: string;
  history: PublicInitiativeWithVersionHistory;
  onRevisionSelect: (version: number) => void;
}

export function PublicInitiativeRevisionHistory({
  initiativeId,
  history,
  onRevisionSelect,
}: PublicInitiativeRevisionHistoryProps) {
  const t = useTranslations("initiativeExperience");
  const locale = useLocale();
  const originalVersion = history.revisions.at(-1)?.version;

  return (
    <section className="pie-revisions" aria-labelledby="pie-revisions-title">
      <div className="pie-revisions__header">
        <h2 id="pie-revisions-title">{t("sidebar.revisions.title")}</h2>
        {history.revisions.length > 0 ? (
          <button
            type="button"
            className="pie-revisions__view-all"
            onClick={() => onRevisionSelect(history.revisions[0]!.version)}
          >
            {t("sidebar.revisions.viewAll")}
          </button>
        ) : null}
      </div>

      {history.revisions.length === 0 ? (
        <p className="pie-empty">{t("sidebar.revisions.empty")}</p>
      ) : (
        <ol className="pie-revisions__list">
          {history.revisions.map((revision) => (
            <li key={revision.revisionId}>
              <button
                type="button"
                className="pie-revisions__item"
                onClick={() => onRevisionSelect(revision.version)}
              >
                <span className="pie-revisions__version">
                  {t("common.versionN", { version: revision.version })}
                  {revision.isCurrent ? t("common.currentSuffix") : ""}
                  {revision.version === originalVersion
                    ? t("sidebar.revisions.originalSuffix")
                    : ""}
                </span>
                <span className="pie-revisions__date">
                  {formatInitiativeExperienceDate(locale, revision.publishedAt, {
                    month: "short",
                  })}
                </span>
                <span className="pie-revisions__summary">{revision.revisionSummary}</span>
              </button>
            </li>
          ))}
        </ol>
      )}

      <p className="pie-revisions__route-note">
        {t.rich("sidebar.revisions.routeNote", {
          initiativeId,
          id: (chunks) => <span className="pie-revisions__initiative-id">{chunks}</span>,
        })}
      </p>
    </section>
  );
}
