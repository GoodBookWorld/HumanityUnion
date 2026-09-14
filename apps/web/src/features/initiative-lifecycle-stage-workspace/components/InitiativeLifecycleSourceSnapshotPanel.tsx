"use client";

import { useLocale, useTranslations } from "next-intl";

import type { InitiativeLifecycleSourceSnapshotSummary } from "@hu/types";

/**
 * Initiative Lifecycle — Part A Completion Part 13: source-snapshot UI
 * boundary. Renders whatever `InitiativeLifecycleSourceSnapshotSummary`
 * the caller supplies — Part A never aggregates real sources itself (no
 * Analysis source aggregation yet, per scope protection), so every stage
 * shows the honest empty/missing-source state today.
 *
 * Pack 02G 08D.2 — chrome only. Item `label` / `summary` are server-built
 * projection prose and are preserved unchanged.
 */
export function InitiativeLifecycleSourceSnapshotPanel({
  snapshot,
}: {
  snapshot: InitiativeLifecycleSourceSnapshotSummary;
}) {
  const t = useTranslations("initiativeExperience");
  const locale = useLocale();
  const capturedAtLabel = (() => {
    try {
      return new Date(snapshot.capturedAt).toLocaleString(locale, {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
    } catch {
      return null;
    }
  })();

  return (
    <section className="lsw-sources" aria-labelledby="lsw-sources-title">
      <h3 id="lsw-sources-title" className="lsw-sources__title">
        {t("author.shared.sourcesUsed")}
      </h3>

      {snapshot.isEmpty ? (
        <p className="lsw-sources__missing" role="status">
          {t("author.shared.sourcesEmpty")}
        </p>
      ) : (
        <ul className="lsw-sources__list" aria-label={t("author.shared.sourcesListAria")}>
          {snapshot.items.map((item) => (
            <li key={item.sourceId} className="lsw-sources__item">
              <span className="lsw-sources__item-label">{item.label}</span>
              <span className="lsw-sources__item-summary">{item.summary}</span>
            </li>
          ))}
        </ul>
      )}

      {capturedAtLabel ? (
        <p className="lsw-sources__captured-at">
          {t("author.shared.sourcesCollectedAt", { date: capturedAtLabel })}
        </p>
      ) : null}
    </section>
  );
}
