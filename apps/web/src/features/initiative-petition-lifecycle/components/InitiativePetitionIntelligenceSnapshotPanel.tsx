"use client";

import { useTranslations } from "next-intl";

import type { InitiativePetitionIntelligenceSnapshot } from "@hu/types";

import { resolvePetitionProposalAcceptanceDisplayLabel } from "../../public-initiative-experience/initiative-experience-i18n";
import {
  resolveApiConsistencyCheckDisplay,
  resolveApiConsistencyLabelDisplay,
} from "../../initiative-lifecycle-stage-workspace/resolve-api-consistency-display";

/**
 * Initiative Lifecycle — Part F, Section 2/3 (Petition Sources / Petition
 * Draft Builder).
 *
 * Renders the deterministic Petition Intelligence Snapshot — the Published
 * Revision this Petition is built from, the Published Collaborative
 * Analysis and Improvement Proposals that informed it, and read-only
 * consistency checks. Nothing here is editable — this is a display of
 * already-persisted, deterministically-derived data, never a form and
 * never AI-invented.
 *
 * Mirrors `InitiativeRevisionIntelligenceSnapshotPanel` (Part E) in spirit
 * and layout.
 */
export function InitiativePetitionIntelligenceSnapshotPanel({
  snapshot,
}: {
  snapshot: InitiativePetitionIntelligenceSnapshot;
}) {
  const t = useTranslations("initiativeExperience");

  if (snapshot.isEmpty) {
    return (
      <section className="ipl-source-panel" aria-labelledby="ipl-source-panel-title">
        <h3 id="ipl-source-panel-title" className="ipl-source-panel__title">
          {t("author.petition.sourceSnapshot.title")}
        </h3>
        <p className="ipl-source-panel__lede" role="status">
          {t("author.petition.sourceSnapshot.emptyLede")}
        </p>
      </section>
    );
  }

  return (
    <section className="ipl-source-panel" aria-labelledby="ipl-source-panel-title">
      <h3 id="ipl-source-panel-title" className="ipl-source-panel__title">
        {t("author.petition.sourceSnapshot.title")}
      </h3>
      <p className="ipl-source-panel__lede">
        {t("author.petition.sourceSnapshot.lede")}
      </p>

      <div className="ipl-source-panel__section">
        <h4 className="ipl-source-panel__section-title">
          {t("author.petition.sourceSnapshot.publishedRevision")}
        </h4>
        {snapshot.revisionReference ? (
          <div className="ipl-source-panel__item">
            <strong>
              {t("author.petition.sourceSnapshot.versionLabel", {
                version: snapshot.revisionReference.version,
              })}
            </strong>
            <span className="ipl-source-panel__item-meta">{snapshot.revisionReference.revisionSummary}</span>
          </div>
        ) : (
          <p className="ipl-source-panel__empty">
            {t("author.petition.sourceSnapshot.noRevision")}
          </p>
        )}
      </div>

      <div className="ipl-source-panel__section">
        <h4 className="ipl-source-panel__section-title">
          {t("author.petition.sourceSnapshot.publishedAnalysis")}
        </h4>
        {snapshot.analysisReference ? (
          <div className="ipl-source-panel__item">
            <strong>{snapshot.analysisReference.title}</strong>
            <span className="ipl-source-panel__item-meta">{snapshot.analysisReference.summary}</span>
          </div>
        ) : (
          <p className="ipl-source-panel__empty">
            {t("author.petition.sourceSnapshot.noAnalysis")}
          </p>
        )}
      </div>

      <div className="ipl-source-panel__section">
        <h4 className="ipl-source-panel__section-title">
          {t("author.petition.sourceSnapshot.publishedProposals")}
        </h4>
        {snapshot.proposalReferences.length > 0 ? (
          <ul
            className="ipl-source-panel__list"
            aria-label={t("author.petition.sourceSnapshot.proposalsAria")}
          >
            {snapshot.proposalReferences.map((proposal) => (
              <li key={proposal.proposalId} className="ipl-source-panel__item">
                <strong>{proposal.title}</strong>
                <span className="ipl-source-panel__item-meta">
                  {resolvePetitionProposalAcceptanceDisplayLabel(proposal.status, t)} ·{" "}
                  {proposal.summary}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="ipl-source-panel__empty">
            {t("author.petition.sourceSnapshot.noProposals")}
          </p>
        )}
      </div>

      <div className="ipl-source-panel__section">
        <h4 className="ipl-source-panel__section-title">
          {t("author.petition.sourceSnapshot.consistencyTitle")}
        </h4>
        <ul
          className="ipl-source-panel__list"
          aria-label={t("author.petition.sourceSnapshot.consistencyAria")}
        >
          {snapshot.consistencyChecks.map((check) => (
            <li
              key={check.checkId}
              className="ipl-source-panel__item"
              data-tone={check.status === "warning" ? "warning" : undefined}
            >
              <strong>{resolveApiConsistencyLabelDisplay("petition", check, t)}</strong>
              <span className="ipl-source-panel__item-meta">
                {resolveApiConsistencyCheckDisplay("petition", check, t).text}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
