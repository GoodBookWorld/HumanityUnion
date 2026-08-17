"use client";

import { useEffect, useState } from "react";

import {
  WorkspaceEmptyState,
  WorkspaceLoadingState,
  WorkspacePublicLink,
} from "../../initiative-workspace-ux";
import { listPublicInitiativeAnalyses } from "../../initiative-collaborative-analysis/api";

import "./view-collaborative-analysis-link.css";

interface ViewCollaborativeAnalysisLinkProps {
  initiativeId: string | null;
}

/**
 * Phase 03 — links to the canonical Initiative shell (#collaborative-analysis).
 * Uses initiative-analyses (canonical), not the legacy `/initiatives/:id/analysis` route.
 */
export function ViewCollaborativeAnalysisLink({
  initiativeId,
}: ViewCollaborativeAnalysisLinkProps) {
  const [hasAnalysis, setHasAnalysis] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!initiativeId) {
      setHasAnalysis(false);
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
        const analyses = await listPublicInitiativeAnalyses(currentInitiativeId);
        if (!cancelled) {
          setHasAnalysis(analyses.length > 0);
        }
      } catch {
        if (!cancelled) {
          setHasAnalysis(false);
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

  if (!hasAnalysis) {
    return (
      <WorkspaceEmptyState
        title="No collaborative analysis has been created yet."
        explanation="This initiative does not have a linked collaborative analysis workspace."
        nextStep="Create or publish collaborative analysis from the Collaborative Analysis section."
      />
    );
  }

  return (
    <WorkspacePublicLink
      href={`/initiatives/public/${encodeURIComponent(initiativeId)}#collaborative-analysis`}
      label="View Collaborative Analysis"
    />
  );
}
