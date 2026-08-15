"use client";

import { useEffect, useState } from "react";

import type { PublicInitiativeCollaborativeAnalysisProjection } from "@hu/types";

import { PublicTranslatedFields } from "../../language";
import { getPublicInitiativeAnalysis } from "../api";
import { InitiativeAnalysisReactionWidget } from "./InitiativeAnalysisReactionWidget";

import "./initiative-collaborative-analysis-workspace.css";

interface InitiativeCollaborativeAnalysisPublicResultProps {
  readonly analysisId: string;
  /**
   * True in Public Preview — Section 7: "editing disabled ... result
   * shown exactly as visitors will see it". The body fields render
   * identically either way; only the Reaction widget itself is replaced
   * with a read-only count display, so previewing can never record a
   * real reaction.
   */
  readonly isPreview?: boolean;
}

/**
 * Initiative Lifecycle — Part B, Section 8/9 (Public Result / Reaction
 * Model). Pack 02: published body fields resolve through provider-backed
 * translation when available.
 */
export function InitiativeCollaborativeAnalysisPublicResult({
  analysisId,
  isPreview = false,
}: InitiativeCollaborativeAnalysisPublicResultProps) {
  const [projection, setProjection] = useState<PublicInitiativeCollaborativeAnalysisProjection | null>(
    null,
  );
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setProjection(null);
    setLoadFailed(false);

    getPublicInitiativeAnalysis(analysisId)
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
  }, [analysisId]);

  if (loadFailed) {
    return <p className="lsw-result__placeholder">This Analysis could not be loaded.</p>;
  }

  if (!projection) {
    return <p className="lsw-result__placeholder">Loading Analysis…</p>;
  }

  return (
    <div className="ica-public-result">
      <PublicTranslatedFields
        sourceKind="collaborative_analysis"
        sourceRecordId={analysisId}
        fieldOrder={[
          "title",
          "summary",
          "supportingEvidence",
          "risks",
          "openQuestions",
          "suggestedImprovements",
          "references",
        ]}
        fieldLabels={{
          title: "Title",
          summary: "Executive Summary",
          supportingEvidence: "Supporting Arguments",
          risks: "Concerns",
          openQuestions: "Open Questions",
          suggestedImprovements: "Recommendations",
          references: "References",
        }}
        fallbackFields={{
          title: projection.title,
          summary: projection.summary,
          supportingEvidence: projection.supportingEvidence,
          risks: projection.risks,
          openQuestions: projection.openQuestions ?? "",
          suggestedImprovements: projection.suggestedImprovements,
          references: projection.references,
        }}
      />

      <div className="ica-public-result__field">
        <h4>Author</h4>
        <p>{projection.authorDisplayName}</p>
      </div>

      {isPreview ? (
        <section className="ica-reaction" aria-label="Analysis reaction preview">
          <p className="ica-reaction__title">Reaction</p>
          <p className="ica-reaction__note">
            {projection.reactionSummary.support} Support · {projection.reactionSummary.doNotSupport}{" "}
            Do Not Support — the Reaction widget is disabled while previewing.
          </p>
        </section>
      ) : (
        <InitiativeAnalysisReactionWidget
          analysisId={analysisId}
          reactionSummary={projection.reactionSummary}
          onReactionSummaryChange={(summary) =>
            setProjection((current) => (current ? { ...current, reactionSummary: summary } : current))
          }
        />
      )}
    </div>
  );
}
