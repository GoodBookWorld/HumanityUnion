"use client";

import { useTranslations } from "next-intl";

import type { InitiativeAnalysisSourceSnapshot } from "@hu/types";

/**
 * Initiative Lifecycle — Part B, Section 3 (Source Snapshot Panel).
 *
 * Renders the full, richly-categorized Automatic Source Collection for
 * Collaborative Analysis (Section 2) — Discussion Statistics, Most
 * Discussed Topics, Open Questions, Repeated Arguments, Repeated
 * Concerns, Proposal Candidates, Active Allies count, Ready to
 * Collaborate count. Every listed item links back to Discussion via
 * `discussionUrl`. Nothing here is editable — this is a read-only
 * display of already-persisted data, never a form.
 *
 * This is deliberately separate from the shell's generic, condensed
 * `InitiativeLifecycleSourceSnapshotPanel` (Part A) — that one renders a
 * short label/summary list identical in shape for every stage; this one
 * is the Analysis-specific full breakdown, rendered inside this stage's
 * `authorEditorSlot` per the shell's extension-seam architecture.
 *
 * Pack 02G 08D.4 — section/empty/aria chrome via author.analysis.sourceSnapshot.*;
 * excerpts, author names, URLs, and counts remain canonical source data.
 */
export function InitiativeAnalysisSourceSnapshotPanel({
  snapshot,
}: {
  snapshot: InitiativeAnalysisSourceSnapshot;
}) {
  const t = useTranslations("initiativeExperience");

  if (snapshot.isEmpty) {
    return (
      <section className="ica-source-panel" aria-labelledby="ica-source-panel-title">
        <h3 id="ica-source-panel-title" className="ica-source-panel__title">
          {t("author.analysis.sourceSnapshot.title")}
        </h3>
        <p className="ica-source-panel__lede" role="status">
          {t("author.analysis.sourceSnapshot.emptyLede")}
        </p>
      </section>
    );
  }

  return (
    <section className="ica-source-panel" aria-labelledby="ica-source-panel-title">
      <h3 id="ica-source-panel-title" className="ica-source-panel__title">
        {t("author.analysis.sourceSnapshot.title")}
      </h3>
      <p className="ica-source-panel__lede">{t("author.analysis.sourceSnapshot.lede")}</p>

      <div className="ica-source-panel__stats" role="list" aria-label={t("author.analysis.sourceSnapshot.statsAria")}>
        <div className="ica-source-panel__stat" role="listitem">
          <span className="ica-source-panel__stat-value">{snapshot.discussionStatistics.commentCount}</span>
          <span className="ica-source-panel__stat-label">{t("author.analysis.sourceSnapshot.comments")}</span>
        </div>
        <div className="ica-source-panel__stat" role="listitem">
          <span className="ica-source-panel__stat-value">{snapshot.discussionStatistics.helpfulCount}</span>
          <span className="ica-source-panel__stat-label">{t("author.analysis.sourceSnapshot.helpful")}</span>
        </div>
        <div className="ica-source-panel__stat" role="listitem">
          <span className="ica-source-panel__stat-value">
            {snapshot.discussionStatistics.notHelpfulCount}
          </span>
          <span className="ica-source-panel__stat-label">{t("author.analysis.sourceSnapshot.notHelpful")}</span>
        </div>
        <div className="ica-source-panel__stat" role="listitem">
          <span className="ica-source-panel__stat-value">{snapshot.activeAlliesCount}</span>
          <span className="ica-source-panel__stat-label">{t("author.analysis.sourceSnapshot.activeAllies")}</span>
        </div>
        <div className="ica-source-panel__stat" role="listitem">
          <span className="ica-source-panel__stat-value">{snapshot.readyToCollaborateCount}</span>
          <span className="ica-source-panel__stat-label">
            {t("author.analysis.sourceSnapshot.readyToCollaborate")}
          </span>
        </div>
      </div>

      <div className="ica-source-panel__section">
        <h4 className="ica-source-panel__section-title">
          {t("author.analysis.sourceSnapshot.mostDiscussedTopics")}
        </h4>
        {snapshot.mostDiscussedTopics.length > 0 ? (
          <ul
            className="ica-source-panel__topics"
            aria-label={t("author.analysis.sourceSnapshot.mostDiscussedTopicsAria")}
          >
            {snapshot.mostDiscussedTopics.map((topic) => (
              <li key={topic.topic} className="ica-source-panel__topic">
                {topic.topic} ({topic.mentionCount})
              </li>
            ))}
          </ul>
        ) : (
          <p className="ica-source-panel__empty">{t("author.analysis.sourceSnapshot.emptyTopics")}</p>
        )}
      </div>

      <div className="ica-source-panel__section">
        <h4 className="ica-source-panel__section-title">
          {t("author.analysis.sourceSnapshot.openQuestions")}
        </h4>
        {snapshot.openQuestions.length > 0 ? (
          <ul
            className="ica-source-panel__list"
            aria-label={t("author.analysis.sourceSnapshot.openQuestionsAria")}
          >
            {snapshot.openQuestions.map((item) => (
              <li key={item.commentId} className="ica-source-panel__item">
                <span className="ica-source-panel__item-excerpt">&ldquo;{item.excerpt}&rdquo;</span>
                <span className="ica-source-panel__item-meta">
                  — {item.authorDisplayName}
                  <a className="ica-source-panel__item-link" href={item.discussionUrl}>
                    {t("author.analysis.sourceSnapshot.viewInDiscussion")}
                  </a>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="ica-source-panel__empty">
            {t("author.analysis.sourceSnapshot.emptyOpenQuestions")}
          </p>
        )}
      </div>

      <div className="ica-source-panel__section">
        <h4 className="ica-source-panel__section-title">
          {t("author.analysis.sourceSnapshot.repeatedArguments")}
        </h4>
        {snapshot.repeatedArguments.length > 0 ? (
          <ul
            className="ica-source-panel__list"
            aria-label={t("author.analysis.sourceSnapshot.repeatedArgumentsAria")}
          >
            {snapshot.repeatedArguments.map((item) => (
              <li key={item.commentId} className="ica-source-panel__item">
                <span className="ica-source-panel__item-excerpt">&ldquo;{item.excerpt}&rdquo;</span>
                <span className="ica-source-panel__item-meta">
                  — {item.authorDisplayName} ·{" "}
                  {t("author.analysis.sourceSnapshot.helpfulCount", { count: item.helpfulCount })}
                  <a className="ica-source-panel__item-link" href={item.discussionUrl}>
                    {t("author.analysis.sourceSnapshot.viewInDiscussion")}
                  </a>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="ica-source-panel__empty">{t("author.analysis.sourceSnapshot.emptyArguments")}</p>
        )}
      </div>

      <div className="ica-source-panel__section">
        <h4 className="ica-source-panel__section-title">
          {t("author.analysis.sourceSnapshot.repeatedConcerns")}
        </h4>
        {snapshot.repeatedConcerns.length > 0 ? (
          <ul
            className="ica-source-panel__list"
            aria-label={t("author.analysis.sourceSnapshot.repeatedConcernsAria")}
          >
            {snapshot.repeatedConcerns.map((item) => (
              <li key={item.commentId} className="ica-source-panel__item">
                <span className="ica-source-panel__item-excerpt">&ldquo;{item.excerpt}&rdquo;</span>
                <span className="ica-source-panel__item-meta">
                  — {item.authorDisplayName} ·{" "}
                  {t("author.analysis.sourceSnapshot.notHelpfulCount", {
                    count: item.notHelpfulCount,
                  })}
                  <a className="ica-source-panel__item-link" href={item.discussionUrl}>
                    {t("author.analysis.sourceSnapshot.viewInDiscussion")}
                  </a>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="ica-source-panel__empty">{t("author.analysis.sourceSnapshot.emptyConcerns")}</p>
        )}
      </div>

      <div className="ica-source-panel__section">
        <h4 className="ica-source-panel__section-title">
          {t("author.analysis.sourceSnapshot.proposalCandidates")}
        </h4>
        {snapshot.proposalCandidates.length > 0 ? (
          <ul
            className="ica-source-panel__list"
            aria-label={t("author.analysis.sourceSnapshot.proposalCandidatesAria")}
          >
            {snapshot.proposalCandidates.map((item) => (
              <li key={item.commentId} className="ica-source-panel__item">
                <span className="ica-source-panel__item-excerpt">&ldquo;{item.excerpt}&rdquo;</span>
                <span className="ica-source-panel__item-meta">
                  — {item.authorDisplayName}
                  <a className="ica-source-panel__item-link" href={item.discussionUrl}>
                    {t("author.analysis.sourceSnapshot.viewInDiscussion")}
                  </a>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="ica-source-panel__empty">{t("author.analysis.sourceSnapshot.emptyProposals")}</p>
        )}
      </div>
    </section>
  );
}
