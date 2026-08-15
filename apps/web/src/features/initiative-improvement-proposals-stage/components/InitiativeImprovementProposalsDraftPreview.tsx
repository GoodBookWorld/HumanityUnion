"use client";

import { useEffect, useState } from "react";

import type { InitiativeImprovementProposalsCollection } from "@hu/types";

import { getMyCurrentImprovementProposalsCollection } from "../api";
import { InitiativeImprovementProposalsContentFields } from "./InitiativeImprovementProposalsContentFields";

import "./initiative-improvement-proposals-stage-workspace.css";

/**
 * Initiative Lifecycle — Part D, Section 11 (Preview).
 *
 * "Preview uses the same renderer as Public ... only difference: Preview
 * displays the current draft ... no duplicate renderer." The Author's
 * Preview action must work on a draft that has never been published yet
 * — that is the entire point of previewing before Publish — so this
 * renders the Author's own current (unpublished) draft proposals through
 * the identical `InitiativeImprovementProposalsContentFields` body used
 * by the real `InitiativeImprovementProposalsPublicResult`, self-fetched
 * the same way `InitiativeImprovementProposalsAuthorWorkspace` already
 * does.
 *
 * Once a collection has actually been published, Preview renders
 * `InitiativeImprovementProposalsPublicResult` instead (see
 * `PublicInitiativeCenterPanel`) — this component only covers the
 * "nothing published yet" gap that the shell's generic Upcoming boundary
 * otherwise leaves empty.
 */
export function InitiativeImprovementProposalsDraftPreview({ initiativeId }: { readonly initiativeId: string }) {
  const [collection, setCollection] = useState<InitiativeImprovementProposalsCollection | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadFailed(false);

    getMyCurrentImprovementProposalsCollection(initiativeId)
      .then((result) => {
        if (!cancelled) {
          setCollection(result);
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

  if (!collection || collection.proposals.length === 0) {
    return (
      <p className="lsw-result__placeholder">
        There are no draft proposals yet — generate or add one, then Preview again.
      </p>
    );
  }

  return (
    <div className="iip-public-result">
      <div className="iip-public-result__field">
        <h4>Author</h4>
        <p>You</p>
      </div>

      {collection.proposals.map((proposal) => (
        <article key={proposal.proposalId} className="iip-public-result__proposal">
          <div className="iip-proposal-card__header">
            <h3>{proposal.title || "Untitled Proposal"}</h3>
          </div>

          <InitiativeImprovementProposalsContentFields
            summary={proposal.summary}
            description={proposal.description}
            reason={proposal.reason}
            expectedImprovement={proposal.expectedImprovement}
            supportingSources={proposal.supportingSources}
            relatedDiscussionReferences={proposal.relatedDiscussionReferences}
            originalAuthorDisplayNames={proposal.originalAuthorDisplayNames}
          />

          <section className="iip-reaction" aria-label="Proposal reaction preview">
            <p className="iip-reaction__title">Reaction</p>
            <p className="iip-reaction__note">
              0 Support · 0 Do Not Support — the Reaction widget unlocks for visitors once this proposal is
              published.
            </p>
          </section>
        </article>
      ))}
    </div>
  );
}
