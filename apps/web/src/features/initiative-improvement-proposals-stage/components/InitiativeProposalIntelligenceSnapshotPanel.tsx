"use client";

import { useTranslations } from "next-intl";

import type { InitiativeProposalIntelligenceSnapshot } from "@hu/types";

/**
 * Initiative Lifecycle — Part D, Section 2/3 (Automatic Proposal
 * Collection / Proposal Intelligence Panel).
 *
 * Renders the deterministic Proposal Intelligence Snapshot — Grouped
 * Improvements, Duplicate Detection, Proposal Categories, Evidence
 * (Helpful totals), Authors, and Open Proposal Questions. Every listed
 * item links back to Discussion via `discussionUrl`. Nothing here is
 * editable — this is a read-only display of already-persisted,
 * deterministically-derived data, never a form and never AI-invented.
 *
 * Mirrors `InitiativeAnalysisSourceSnapshotPanel` (Part B) in spirit and
 * layout, adapted to Proposal Groups instead of Topics/Arguments/Concerns.
 */
export function InitiativeProposalIntelligenceSnapshotPanel({
  snapshot,
}: {
  snapshot: InitiativeProposalIntelligenceSnapshot;
}) {
  const t = useTranslations("initiativeExperience");

  if (snapshot.isEmpty) {
    return (
      <section className="iip-source-panel" aria-labelledby="iip-source-panel-title">
        <h3 id="iip-source-panel-title" className="iip-source-panel__title">
          {t("author.proposal.sourceSnapshot.title")}
        </h3>
        <p className="iip-source-panel__lede" role="status">
          {t("author.proposal.sourceSnapshot.emptyLede")}
        </p>
      </section>
    );
  }

  return (
    <section className="iip-source-panel" aria-labelledby="iip-source-panel-title">
      <h3 id="iip-source-panel-title" className="iip-source-panel__title">
        {t("author.proposal.sourceSnapshot.title")}
      </h3>
      <p className="iip-source-panel__lede">
        {t("author.proposal.sourceSnapshot.lede")}
      </p>

      <div
        className="iip-source-panel__stats"
        role="list"
        aria-label={t("author.proposal.sourceSnapshot.statsAria")}
      >
        <div className="iip-source-panel__stat" role="listitem">
          <span className="iip-source-panel__stat-value">{snapshot.totalCandidateCount}</span>
          <span className="iip-source-panel__stat-label">
            {t("author.proposal.sourceSnapshot.candidates")}
          </span>
        </div>
        <div className="iip-source-panel__stat" role="listitem">
          <span className="iip-source-panel__stat-value">{snapshot.groups.length}</span>
          <span className="iip-source-panel__stat-label">
            {t("author.proposal.sourceSnapshot.groupedImprovements")}
          </span>
        </div>
        <div className="iip-source-panel__stat" role="listitem">
          <span className="iip-source-panel__stat-value">{snapshot.duplicateGroupCount}</span>
          <span className="iip-source-panel__stat-label">
            {t("author.proposal.sourceSnapshot.likelyDuplicates")}
          </span>
        </div>
        <div className="iip-source-panel__stat" role="listitem">
          <span className="iip-source-panel__stat-value">{snapshot.openProposalQuestions.length}</span>
          <span className="iip-source-panel__stat-label">
            {t("author.proposal.sourceSnapshot.openQuestions")}
          </span>
        </div>
      </div>

      {snapshot.analysisReference ? (
        <p className="iip-source-panel__lede">
          {t("author.proposal.sourceSnapshot.analysisReference", {
            title: snapshot.analysisReference.title,
          })}
        </p>
      ) : null}

      <div className="iip-source-panel__section">
        <h4 className="iip-source-panel__section-title">
          {t("author.proposal.sourceSnapshot.groupedTitle")}
        </h4>
        {snapshot.groups.length > 0 ? (
          <ul
            className="iip-source-panel__group-list"
            aria-label={t("author.proposal.sourceSnapshot.groupedAria")}
          >
            {snapshot.groups.map((group) => (
              <li key={group.groupId} className="iip-source-panel__group" data-duplicate={group.isDuplicateGroup}>
                <span>&ldquo;{group.representativeExcerpt}&rdquo;</span>
                <span className="iip-source-panel__group-meta">
                  {t("author.proposal.sourceSnapshot.groupMeta", {
                    category: group.category,
                    count: group.memberCount,
                    helpful: group.totalHelpfulCount,
                  })}
                  {group.isDuplicateGroup
                    ? ` · ${t("author.proposal.sourceSnapshot.likelyDuplicate")}`
                    : ""}
                  {" · "}
                  {group.authorDisplayNames.join(", ")}
                  {" · "}
                  <a href={group.discussionUrl}>
                    {t("author.proposal.sourceSnapshot.viewInDiscussion")}
                  </a>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="iip-source-panel__empty">
            {t("author.proposal.sourceSnapshot.emptyGroups")}
          </p>
        )}
      </div>

      <div className="iip-source-panel__section">
        <h4 className="iip-source-panel__section-title">
          {t("author.proposal.sourceSnapshot.openQuestionsTitle")}
        </h4>
        {snapshot.openProposalQuestions.length > 0 ? (
          <ul
            className="iip-source-panel__group-list"
            aria-label={t("author.proposal.sourceSnapshot.openQuestionsAria")}
          >
            {snapshot.openProposalQuestions.map((item) => (
              <li key={item.candidateId} className="iip-source-panel__group">
                <span>&ldquo;{item.excerpt}&rdquo;</span>
                <span className="iip-source-panel__group-meta">
                  — {item.authorDisplayName} ·{" "}
                  <a href={item.discussionUrl}>
                    {t("author.proposal.sourceSnapshot.viewInDiscussion")}
                  </a>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="iip-source-panel__empty">
            {t("author.proposal.sourceSnapshot.emptyOpenQuestions")}
          </p>
        )}
      </div>
    </section>
  );
}
