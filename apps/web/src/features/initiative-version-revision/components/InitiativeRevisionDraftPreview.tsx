"use client";

import { useEffect, useState } from "react";

import type { InitiativeRevisionDraftContext } from "@hu/types";

import { getInitiativeRevisionWorkspace } from "../api";

import "./initiative-revision-stage-workspace.css";

/**
 * Initiative Lifecycle — Part E, Section 6 (Preview).
 *
 * "Preview uses the same renderer as Public ... only difference: Preview
 * displays the current draft ... no duplicate renderer." The Author's
 * Preview action must work on a draft that has never been published yet —
 * that is the entire point of previewing before Publish — so this renders
 * the Author's own current (unpublished) draft changes, self-fetched the
 * same way `InitiativeRevisionAuthorWorkspace` already does.
 *
 * Once a Revision has actually been published, Preview renders
 * `InitiativeRevisionPublicResult` instead (see `PublicInitiativeCenterPanel`)
 * — this component only covers the "nothing published yet" gap that the
 * shell's generic Upcoming boundary otherwise leaves empty.
 */
export function InitiativeRevisionDraftPreview({ initiativeId }: { readonly initiativeId: string }) {
  const [context, setContext] = useState<InitiativeRevisionDraftContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadFailed(false);

    getInitiativeRevisionWorkspace(initiativeId)
      .then((result) => {
        if (!cancelled) {
          setContext(result);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLoadFailed(true);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [initiativeId]);

  if (loadFailed) {
    return <p className="lsw-result__placeholder">This draft could not be loaded.</p>;
  }

  if (loading) {
    return <p className="lsw-result__placeholder">Loading draft…</p>;
  }

  const draft = context?.draft ?? null;

  if (!draft) {
    return (
      <p className="lsw-result__placeholder">
        There is no Revision draft yet — start one, then Preview again.
      </p>
    );
  }

  return (
    <div className="irv-public-result">
      <div className="irv-public-result__field">
        <h4>Author</h4>
        <p>You</p>
      </div>

      <div className="irv-public-result__field">
        <h4>Change Summary</h4>
        <p>{draft.revisionSummary || "No summary provided yet."}</p>
      </div>

      <div className="irv-public-result__field">
        <h4>Title</h4>
        <p>{draft.title || "Untitled"}</p>
      </div>

      <div className="irv-public-result__field">
        <h4>Description</h4>
        <p>{draft.description}</p>
      </div>

      <div className="irv-editor__section">
        <h4>Before / After</h4>
        {draft.changes.length > 0 ? (
          <div className="irv-change-list">
            {draft.changes.map((change) => (
              <article key={change.changeId} className="irv-change-card">
                <div className="irv-change-card__header">
                  <h4>{change.sectionLabel}</h4>
                  <span className="irv-change-card__origin" data-origin={change.origin}>
                    {change.origin === "proposal" ? "From Proposal" : "Author-originated"}
                  </span>
                </div>
                <div className="irv-change-card__before-after">
                  <div className="irv-change-card__field">
                    <label>Before</label>
                    <p>{change.before || "(empty)"}</p>
                  </div>
                  <div className="irv-change-card__field">
                    <label>After</label>
                    <p>{change.after || "(empty)"}</p>
                  </div>
                </div>
                <div className="irv-change-card__field">
                  <label>Author explanation</label>
                  <p>{change.explanation}</p>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="irv-public-result__empty">No structured changes drafted yet.</p>
        )}
      </div>

      <section className="irv-reaction" aria-label="Revision reaction preview">
        <p className="irv-reaction__title">Reaction</p>
        <p className="irv-reaction__note">
          0 Support · 0 Do Not Support — the Reaction widget unlocks for visitors once this Revision is
          published.
        </p>
      </section>
    </div>
  );
}
