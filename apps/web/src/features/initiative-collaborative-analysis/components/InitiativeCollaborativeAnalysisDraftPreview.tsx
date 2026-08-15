"use client";

import { useEffect, useState } from "react";

import type { InitiativeCollaborativeAnalysis } from "@hu/types";

import { getMyCurrentInitiativeAnalysis } from "../api";
import { InitiativeCollaborativeAnalysisContentFields } from "./InitiativeCollaborativeAnalysisContentFields";

import "./initiative-collaborative-analysis-workspace.css";

/**
 * Initiative Lifecycle — Part B, Section 7 (Public Preview).
 *
 * "Preview uses exactly the same renderer ... result shown exactly as
 * visitors will see it." The Author's Preview action must work on a
 * draft that has never been published yet — that is the entire point
 * of previewing before Publish — so this renders the Author's own
 * current (unpublished) draft through the identical
 * `InitiativeCollaborativeAnalysisContentFields` body used by the real
 * `InitiativeCollaborativeAnalysisPublicResult`, self-fetched the same
 * way `InitiativeCollaborativeAnalysisAuthorWorkspace` already does
 * (Part 23 self-fetch convention — no lifting draft state up through
 * the shared shell).
 *
 * Once an Analysis has actually been published, Preview renders
 * `InitiativeCollaborativeAnalysisPublicResult` instead (see
 * `PublicInitiativeCenterPanel`) — this component only covers the
 * "nothing published yet" gap that the shell's generic Upcoming
 * boundary otherwise leaves empty.
 */
export function InitiativeCollaborativeAnalysisDraftPreview({ initiativeId }: { readonly initiativeId: string }) {
  const [analysis, setAnalysis] = useState<InitiativeCollaborativeAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadFailed(false);

    getMyCurrentInitiativeAnalysis(initiativeId)
      .then((result) => {
        if (!cancelled) {
          setAnalysis(result);
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

  if (!analysis) {
    return (
      <p className="lsw-result__placeholder">
        There is no draft yet — generate or create one, then Preview again.
      </p>
    );
  }

  return (
    <div className="ica-public-result">
      <InitiativeCollaborativeAnalysisContentFields
        title={analysis.title}
        summary={analysis.summary}
        supportingEvidence={analysis.supportingEvidence}
        risks={analysis.risks}
        openQuestions={analysis.openQuestions}
        suggestedImprovements={analysis.suggestedImprovements}
        references={analysis.references}
      />
      <div className="ica-public-result__field">
        <h4>Author</h4>
        <p>You</p>
      </div>

      <section className="ica-reaction" aria-label="Analysis reaction preview">
        <p className="ica-reaction__title">Reaction</p>
        <p className="ica-reaction__note">
          0 Support · 0 Do Not Support — the Reaction widget unlocks for visitors once this Analysis is
          published.
        </p>
      </section>
    </div>
  );
}
