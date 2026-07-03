"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import type { CollectiveDecision } from "@hu/types";

import { getCollaborativeAnalysisByInitiativeId } from "../../collaborative-analysis/api";
import { getPetitionByCollectiveDecisionId } from "../../petition/api";

import "./decision-actions.css";

interface DecisionActionsProps {
  decision: CollectiveDecision;
}

export function DecisionActions({ decision }: DecisionActionsProps) {
  const [analysisLink, setAnalysisLink] = useState<string | null>(null);
  const [petitionId, setPetitionId] = useState<string | null>(null);

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

  useEffect(() => {
    let cancelled = false;

    async function loadPetitionLink() {
      try {
        const petition = await getPetitionByCollectiveDecisionId(decision.decisionId);
        if (!cancelled) {
          setPetitionId(petition.petitionId);
        }
      } catch {
        if (!cancelled) {
          setPetitionId(null);
        }
      }
    }

    void loadPetitionLink();

    return () => {
      cancelled = true;
    };
  }, [decision.decisionId]);

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
      {petitionId ? (
        <Link
          className="decision-actions__link"
          href={`/petitions/${encodeURIComponent(petitionId)}`}
        >
          Open Petition Workspace
        </Link>
      ) : null}
    </div>
  );
}
