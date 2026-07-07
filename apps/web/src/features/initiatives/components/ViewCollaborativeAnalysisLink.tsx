"use client";

import { useEffect, useState } from "react";

import {
  WorkspaceEmptyState,
  WorkspaceLoadingState,
  WorkspacePublicLink,
} from "../../initiative-workspace-ux";
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
    return (
      <WorkspaceEmptyState
        title="No initiative selected"
        explanation="Select an initiative to open its collaborative analysis workspace."
        nextStep="Choose an initiative from My Initiatives."
      />
    );
  }

  if (loading) {
    return <WorkspaceLoadingState message="Loading collaborative analysis..." />;
  }

  if (!analysisId) {
    return (
      <WorkspaceEmptyState
        title="No collaborative analysis is linked yet"
        explanation="This initiative does not have a linked collaborative analysis workspace."
        nextStep="Create or publish collaborative analysis from the Collaborative Analysis section."
      />
    );
  }

  return (
    <WorkspacePublicLink
      href={`/collaborative-analysis/${encodeURIComponent(analysisId)}`}
      label="View Collaborative Analysis"
    />
  );
}
