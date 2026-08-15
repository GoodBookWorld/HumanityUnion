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
 */
export function InitiativeAnalysisSourceSnapshotPanel({
  snapshot,
}: {
  snapshot: InitiativeAnalysisSourceSnapshot;
}) {
  if (snapshot.isEmpty) {
    return (
      <section className="ica-source-panel" aria-labelledby="ica-source-panel-title">
        <h3 id="ica-source-panel-title" className="ica-source-panel__title">
          Source Snapshot
        </h3>
        <p className="ica-source-panel__lede" role="status">
          No Discussion activity has been collected for this Initiative yet. This panel will populate
          automatically once participants begin commenting.
        </p>
      </section>
    );
  }

  return (
    <section className="ica-source-panel" aria-labelledby="ica-source-panel-title">
      <h3 id="ica-source-panel-title" className="ica-source-panel__title">
        Source Snapshot
      </h3>
      <p className="ica-source-panel__lede">
        Automatically collected from Discussion — nothing below is editable or invented.
      </p>

      <div className="ica-source-panel__stats" role="list" aria-label="Discussion statistics">
        <div className="ica-source-panel__stat" role="listitem">
          <span className="ica-source-panel__stat-value">{snapshot.discussionStatistics.commentCount}</span>
          <span className="ica-source-panel__stat-label">Comments</span>
        </div>
        <div className="ica-source-panel__stat" role="listitem">
          <span className="ica-source-panel__stat-value">{snapshot.discussionStatistics.helpfulCount}</span>
          <span className="ica-source-panel__stat-label">Helpful</span>
        </div>
        <div className="ica-source-panel__stat" role="listitem">
          <span className="ica-source-panel__stat-value">
            {snapshot.discussionStatistics.notHelpfulCount}
          </span>
          <span className="ica-source-panel__stat-label">Not Helpful</span>
        </div>
        <div className="ica-source-panel__stat" role="listitem">
          <span className="ica-source-panel__stat-value">{snapshot.activeAlliesCount}</span>
          <span className="ica-source-panel__stat-label">Active Allies</span>
        </div>
        <div className="ica-source-panel__stat" role="listitem">
          <span className="ica-source-panel__stat-value">{snapshot.readyToCollaborateCount}</span>
          <span className="ica-source-panel__stat-label">Ready to Collaborate</span>
        </div>
      </div>

      <div className="ica-source-panel__section">
        <h4 className="ica-source-panel__section-title">Most Discussed Topics</h4>
        {snapshot.mostDiscussedTopics.length > 0 ? (
          <ul className="ica-source-panel__topics" aria-label="Most discussed topics">
            {snapshot.mostDiscussedTopics.map((topic) => (
              <li key={topic.topic} className="ica-source-panel__topic">
                {topic.topic} ({topic.mentionCount})
              </li>
            ))}
          </ul>
        ) : (
          <p className="ica-source-panel__empty">No repeated topics identified yet.</p>
        )}
      </div>

      <div className="ica-source-panel__section">
        <h4 className="ica-source-panel__section-title">Open Questions</h4>
        {snapshot.openQuestions.length > 0 ? (
          <ul className="ica-source-panel__list" aria-label="Open questions from Discussion">
            {snapshot.openQuestions.map((item) => (
              <li key={item.commentId} className="ica-source-panel__item">
                <span className="ica-source-panel__item-excerpt">&ldquo;{item.excerpt}&rdquo;</span>
                <span className="ica-source-panel__item-meta">
                  — {item.authorDisplayName}
                  <a className="ica-source-panel__item-link" href={item.discussionUrl}>
                    View in Discussion
                  </a>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="ica-source-panel__empty">No open questions identified in Discussion yet.</p>
        )}
      </div>

      <div className="ica-source-panel__section">
        <h4 className="ica-source-panel__section-title">Repeated Arguments</h4>
        {snapshot.repeatedArguments.length > 0 ? (
          <ul className="ica-source-panel__list" aria-label="Repeated arguments from Discussion">
            {snapshot.repeatedArguments.map((item) => (
              <li key={item.commentId} className="ica-source-panel__item">
                <span className="ica-source-panel__item-excerpt">&ldquo;{item.excerpt}&rdquo;</span>
                <span className="ica-source-panel__item-meta">
                  — {item.authorDisplayName} · {item.helpfulCount} Helpful
                  <a className="ica-source-panel__item-link" href={item.discussionUrl}>
                    View in Discussion
                  </a>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="ica-source-panel__empty">No comments have received Helpful reactions yet.</p>
        )}
      </div>

      <div className="ica-source-panel__section">
        <h4 className="ica-source-panel__section-title">Repeated Concerns</h4>
        {snapshot.repeatedConcerns.length > 0 ? (
          <ul className="ica-source-panel__list" aria-label="Repeated concerns from Discussion">
            {snapshot.repeatedConcerns.map((item) => (
              <li key={item.commentId} className="ica-source-panel__item">
                <span className="ica-source-panel__item-excerpt">&ldquo;{item.excerpt}&rdquo;</span>
                <span className="ica-source-panel__item-meta">
                  — {item.authorDisplayName} · {item.notHelpfulCount} Not Helpful
                  <a className="ica-source-panel__item-link" href={item.discussionUrl}>
                    View in Discussion
                  </a>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="ica-source-panel__empty">No comments have been marked Not Helpful yet.</p>
        )}
      </div>

      <div className="ica-source-panel__section">
        <h4 className="ica-source-panel__section-title">Proposal Candidates</h4>
        {snapshot.proposalCandidates.length > 0 ? (
          <ul className="ica-source-panel__list" aria-label="Proposal candidates from Discussion">
            {snapshot.proposalCandidates.map((item) => (
              <li key={item.commentId} className="ica-source-panel__item">
                <span className="ica-source-panel__item-excerpt">&ldquo;{item.excerpt}&rdquo;</span>
                <span className="ica-source-panel__item-meta">
                  — {item.authorDisplayName}
                  <a className="ica-source-panel__item-link" href={item.discussionUrl}>
                    View in Discussion
                  </a>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="ica-source-panel__empty">No contributions have been marked as proposals yet.</p>
        )}
      </div>
    </section>
  );
}
