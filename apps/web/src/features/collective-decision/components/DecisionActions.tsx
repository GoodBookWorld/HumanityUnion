"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import type { CollectiveDecision } from "@hu/types";

import { getCollaborativeAnalysisByInitiativeId } from "../../collaborative-analysis/api";

import "./decision-actions.css";

interface DecisionActionsProps {
  decision: CollectiveDecision;
}

export function DecisionActions({ decision }: DecisionActionsProps) {
  const [analysisLink, setAnalysisLink] = useState<string | null>(null);

  useEffect(() => {
    if (decision.decisionSubjectType !== "Initiative") {
      setAnalysisLink(null);
      return;
    }

    let cancelled = false;

    async function loadAnalysisLink() {
      try {
        const analysis = await getCollaborativeAnalysisByInitiativeId(decision.decisionSubjectId);
        if (!cancelled) {
          setAnalysisLink(`/collaborative-analysis/${encodeURIComponent(analysis.analysisId)}`);
        }
      } catch {
        if (!cancelled) {
          setAnalysisLink(null);
        }
      }
    }

    void loadAnalysisLink();

    return () => {
      cancelled = true;
    };
  }, [decision.decisionSubjectId, decision.decisionSubjectType]);

  if (decision.decisionSubjectType !== "Initiative") {
    return null;
  }

  return (
    <div className="decision-actions">
      <Link
        className="decision-actions__link"
        href={`/initiatives/public/${encodeURIComponent(decision.decisionSubjectId)}`}
      >
        View Initiative
      </Link>
      {analysisLink ? (
        <Link className="decision-actions__link" href={analysisLink}>
          View Collaborative Analysis
        </Link>
      ) : null}
    </div>
  );
}
