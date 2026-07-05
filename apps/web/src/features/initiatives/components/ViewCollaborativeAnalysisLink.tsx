"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { getCollaborativeAnalysisByInitiativeId } from "../../collaborative-analysis/api";

import "./view-collaborative-analysis-link.css";

interface ViewCollaborativeAnalysisLinkProps {
  initiativeId: string | null;
}

export function ViewCollaborativeAnalysisLink({
  initiativeId,
}: ViewCollaborativeAnalysisLinkProps) {
  const [analysisId, setAnalysisId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!initiativeId) {
      setAnalysisId(null);
      return;
    }

    let cancelled = false;

    async function loadAnalysisLink() {
      setLoading(true);
      const currentInitiativeId = initiativeId;

      if (!currentInitiativeId) {
        setLoading(false);
        return;
      }

      try {
        const analysis = await getCollaborativeAnalysisByInitiativeId(currentInitiativeId);
        if (!cancelled) {
          setAnalysisId(analysis.analysisId);
        }
      } catch {
        if (!cancelled) {
          setAnalysisId(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadAnalysisLink();

    return () => {
      cancelled = true;
    };
  }, [initiativeId]);

  if (!initiativeId) {
    return <p className="view-collaborative-analysis-link__empty">Select an initiative first.</p>;
  }

  if (loading) {
    return (
      <p className="view-collaborative-analysis-link__empty">Loading collaborative analysis...</p>
    );
  }

  if (!analysisId) {
    return (
      <p className="view-collaborative-analysis-link__empty">
        No collaborative analysis is linked to this initiative.
      </p>
    );
  }

  return (
    <Link
      className="view-collaborative-analysis-link"
      href={`/collaborative-analysis/${encodeURIComponent(analysisId)}`}
    >
      Open Collaborative Analysis Workspace
    </Link>
  );
}
