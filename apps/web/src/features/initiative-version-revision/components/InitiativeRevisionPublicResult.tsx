"use client";

import { useEffect, useState } from "react";

import type { PublicInitiativeVersionRevisionProjection } from "@hu/types";

import { getPublicInitiativeVersionRevision } from "../api";
import { InitiativeRevisionReactionWidget } from "./InitiativeRevisionReactionWidget";

import "./initiative-revision-stage-workspace.css";

interface InitiativeRevisionPublicResultProps {
  readonly initiativeId: string;
  readonly version: number;
  /**
   * True in Public Preview — Section 6/9: "editing disabled ... result
   * shown exactly as visitors will see it". The body fields render
   * identically either way; only the Reaction widget is replaced with a
   * read-only count display, so previewing can never record a real
   * reaction.
   */
  readonly isPreview?: boolean;
}

/**
 * Initiative Lifecycle — Part E, Section 9 (Public Presentation / Community
 * Reactions). Renders inside the shared shell's
 * `InitiativeLifecyclePublicResultPanel` boundary as its `publicResultSlot`
 * — that boundary already renders the stage title, Publication Date, and
 * Version generically; this adds Published Revision content: the full
 * Before -> After -> Origin -> Related Proposal IDs -> Author explanation
 * chain for every changed section (Section 7 — "No hidden edits"), the
 * Change Summary, Proposal references, and Support / Do Not Support
 * Revision reactions, all fetched in a single request.
 */
export function InitiativeRevisionPublicResult({
  initiativeId,
  version,
  isPreview = false,
}: InitiativeRevisionPublicResultProps) {
  const [projection, setProjection] = useState<PublicInitiativeVersionRevisionProjection | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setProjection(null);
    setLoadFailed(false);

    getPublicInitiativeVersionRevision(initiativeId, version)
      .then((result) => {
        if (!cancelled) {
          setProjection(result);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLoadFailed(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [initiativeId, version]);

  if (loadFailed) {
    return <p className="lsw-result__placeholder">This Revision could not be loaded.</p>;
  }

  if (!projection) {
    return <p className="lsw-result__placeholder">Loading Revision…</p>;
  }

  const proposalReferences = [
    ...new Set([...projection.acceptedProposalIds, ...projection.partiallyAcceptedProposalIds]),
  ];

  return (
    <div className="irv-public-result">
      <div className="irv-public-result__field">
        <h4>Author</h4>
        <p>{projection.authorDisplayName}</p>
      </div>

      <div className="irv-public-result__field">
        <h4>Change Summary</h4>
        <p>{projection.revisionSummary || "No summary provided."}</p>
      </div>

      {proposalReferences.length > 0 ? (
        <div className="irv-public-result__field">
          <h4>Proposal references</h4>
          <p>{proposalReferences.join(", ")}</p>
        </div>
      ) : null}

      <div className="irv-public-result__field">
        <h4>Title</h4>
        <p>{projection.title}</p>
      </div>

      <div className="irv-public-result__field">
        <h4>Description</h4>
        <p>{projection.description}</p>
      </div>

      <div className="irv-editor__section">
        <h4>Before / After</h4>
        {projection.changes.length > 0 ? (
          <div className="irv-change-list">
            {projection.changes.map((change) => (
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
                <div className="irv-change-card__meta">
                  {change.origin === "proposal" ? (
                    <span>Proposal reference(s): {change.proposalIds.join(", ") || "none"}</span>
                  ) : (
                    <span>Reason: {change.authorOriginatedReason}</span>
                  )}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="irv-public-result__empty">No structured changes were recorded for this Revision.</p>
        )}
      </div>

      {isPreview ? (
        <section className="irv-reaction" aria-label="Revision reaction preview">
          <p className="irv-reaction__title">Reaction</p>
          <p className="irv-reaction__note">
            {projection.reactionSummary.support} Support · {projection.reactionSummary.doNotSupport} Do Not
            Support — the Reaction widget is disabled while previewing.
          </p>
        </section>
      ) : (
        <InitiativeRevisionReactionWidget
          initiativeId={initiativeId}
          version={projection.version}
          reactionSummary={projection.reactionSummary}
          onReactionSummaryChange={(summary) =>
            setProjection((current) => (current ? { ...current, reactionSummary: summary } : current))
          }
        />
      )}
    </div>
  );
}
