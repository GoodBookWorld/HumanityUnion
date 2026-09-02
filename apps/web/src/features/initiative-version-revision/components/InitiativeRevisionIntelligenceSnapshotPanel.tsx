"use client";

import { useTranslations } from "next-intl";

import type { InitiativeRevisionIntelligenceSnapshot } from "@hu/types";

import { resolveProposalCurationDisplayLabel } from "../../public-initiative-experience/initiative-experience-i18n";
import { resolveApiConflictWarningDisplay } from "../../initiative-lifecycle-stage-workspace/resolve-api-consistency-display";

/**
 * Initiative Lifecycle — Part E, Section 2/3 (Revision Sources / Intelligent
 * Revision Builder).
 *
 * Renders the deterministic Revision Intelligence Snapshot — Published
 * Improvement Proposals (eligible / unresolved), Missing References,
 * Conflict Warnings, and Consistency Checks. Every listed item links back
 * to Discussion via `discussionUrl` where applicable. Nothing here is
 * editable — this is a read-only display of already-persisted,
 * deterministically-derived data, never a form and never AI-invented.
 *
 * Mirrors `InitiativeProposalIntelligenceSnapshotPanel` (Part D) in spirit
 * and layout, adapted to Revision's Conflict Detection / Change Summary
 * tools (Part 6).
 */
export function InitiativeRevisionIntelligenceSnapshotPanel({
  snapshot,
}: {
  snapshot: InitiativeRevisionIntelligenceSnapshot;
}) {
  const t = useTranslations("initiativeExperience");

  if (snapshot.isEmpty) {
    return (
      <section className="irv-source-panel" aria-labelledby="irv-source-panel-title">
        <h3 id="irv-source-panel-title" className="irv-source-panel__title">
          {t("author.revision.sourceSnapshot.title")}
        </h3>
        <p className="irv-source-panel__lede" role="status">
          {t("author.revision.sourceSnapshot.emptyLede")}
        </p>
      </section>
    );
  }

  const unresolved = snapshot.eligibleProposals.filter((proposal) => proposal.status === "published");

  return (
    <section className="irv-source-panel" aria-labelledby="irv-source-panel-title">
      <h3 id="irv-source-panel-title" className="irv-source-panel__title">
        {t("author.revision.sourceSnapshot.title")}
      </h3>
      <p className="irv-source-panel__lede">
        {t("author.revision.sourceSnapshot.lede")}
      </p>

      <div
        className="irv-source-panel__stats"
        role="list"
        aria-label={t("author.revision.sourceSnapshot.statsAria")}
      >
        <div className="irv-source-panel__stat" role="listitem">
          <span className="irv-source-panel__stat-value">{snapshot.eligibleProposals.length}</span>
          <span className="irv-source-panel__stat-label">
            {t("author.revision.sourceSnapshot.eligibleProposals")}
          </span>
        </div>
        <div className="irv-source-panel__stat" role="listitem">
          <span className="irv-source-panel__stat-value">{unresolved.length}</span>
          <span className="irv-source-panel__stat-label">
            {t("author.revision.sourceSnapshot.unresolved")}
          </span>
        </div>
        <div className="irv-source-panel__stat" role="listitem">
          <span className="irv-source-panel__stat-value">{snapshot.missingReferenceProposalIds.length}</span>
          <span className="irv-source-panel__stat-label">
            {t("author.revision.sourceSnapshot.missingReferences")}
          </span>
        </div>
        <div className="irv-source-panel__stat" role="listitem">
          <span className="irv-source-panel__stat-value">{snapshot.conflictWarnings.length}</span>
          <span className="irv-source-panel__stat-label">
            {t("author.revision.sourceSnapshot.conflictWarnings")}
          </span>
        </div>
      </div>

      {snapshot.analysisReference ? (
        <p className="irv-source-panel__lede">
          {t("author.revision.sourceSnapshot.analysisReference", {
            title: snapshot.analysisReference.title,
          })}
        </p>
      ) : null}

      <div className="irv-source-panel__section">
        <h4 className="irv-source-panel__section-title">
          {t("author.revision.sourceSnapshot.publishedProposalsTitle")}
        </h4>
        {snapshot.eligibleProposals.length > 0 ? (
          <ul
            className="irv-source-panel__list"
            aria-label={t("author.revision.sourceSnapshot.publishedProposalsAria")}
          >
            {snapshot.eligibleProposals.map((proposal) => (
              <li key={proposal.proposalId} className="irv-source-panel__item">
                <strong>{proposal.title}</strong>
                <span className="irv-source-panel__item-meta">
                  {resolveProposalCurationDisplayLabel(proposal.status, t)} ·{" "}
                  {proposal.originalAuthorDisplayNames.join(", ")}
                  {" · "}
                  <a href={snapshot.discussionUrl}>
                    {t("author.revision.sourceSnapshot.viewInDiscussion")}
                  </a>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="irv-source-panel__empty">
            {t("author.revision.sourceSnapshot.emptyEligible")}
          </p>
        )}
      </div>

      <div className="irv-source-panel__section">
        <h4 className="irv-source-panel__section-title">
          {t("author.revision.sourceSnapshot.conflictWarningsTitle")}
        </h4>
        {snapshot.conflictWarnings.length > 0 ? (
          <ul
            className="irv-source-panel__list"
            aria-label={t("author.revision.sourceSnapshot.conflictWarningsAria")}
          >
            {snapshot.conflictWarnings.map((warning) => {
              const presentation = resolveApiConflictWarningDisplay(warning, t);
              return (
                <li key={warning.section} className="irv-source-panel__item" data-tone="warning">
                  <strong>{presentation.sectionLabel}</strong>
                  <span className="irv-source-panel__item-meta">{presentation.text}</span>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="irv-source-panel__empty">
            {t("author.revision.sourceSnapshot.emptyConflicts")}
          </p>
        )}
      </div>

      <div className="irv-source-panel__section">
        <h4 className="irv-source-panel__section-title">
          {t("author.revision.sourceSnapshot.consistencyTitle")}
        </h4>
        <ul
          className="irv-source-panel__list"
          aria-label={t("author.revision.sourceSnapshot.consistencyAria")}
        >
          {snapshot.consistencyChecks.map((check) => (
            <li
              key={check.checkId}
              className="irv-source-panel__item"
              data-tone={check.status === "warning" ? "warning" : undefined}
            >
              <strong>{check.label}</strong>
              <span className="irv-source-panel__item-meta">{check.detail}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
