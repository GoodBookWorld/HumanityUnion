"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import {
  WorkspaceEmptyState,
  WorkspaceLoadingState,
  WorkspacePublicLink,
} from "../../initiative-workspace-ux";
import { listPublicInitiativeAnalyses } from "../../initiative-collaborative-analysis/api";

import "./view-collaborative-analysis-link.css";

interface ViewCollaborativeAnalysisLinkProps {
  initiativeId: string | null;
  /** Localized link label; defaults to catalog English for callers outside Manage. */
  label?: string;
}

/**
 * Phase 03 — links to the canonical Initiative shell (#collaborative-analysis).
 * Uses initiative-analyses (canonical), not the legacy `/initiatives/:id/analysis` route.
 */
export function ViewCollaborativeAnalysisLink({
  initiativeId,
  label,
}: ViewCollaborativeAnalysisLinkProps) {
  const t = useTranslations("initiativeExperience");
  const resolvedLabel = label ?? t("manage.links.viewCollaborativeAnalysis");
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
        title={t("manage.links.collaborativeAnalysisNoInitiativeTitle")}
        explanation={t("manage.links.collaborativeAnalysisNoInitiativeExplanation")}
        nextStep={t("manage.links.collaborativeAnalysisNoInitiativeNext")}
      />
    );
  }

  if (loading) {
    return (
      <WorkspaceLoadingState message={t("manage.links.collaborativeAnalysisLoading")} />
    );
  }

  if (!hasAnalysis) {
    return (
      <WorkspaceEmptyState
        title={t("manage.links.collaborativeAnalysisEmptyTitle")}
        explanation={t("manage.links.collaborativeAnalysisEmptyExplanation")}
        nextStep={t("manage.links.collaborativeAnalysisEmptyNext")}
      />
    );
  }

  return (
    <WorkspacePublicLink
      href={`/initiatives/public/${encodeURIComponent(initiativeId)}#collaborative-analysis`}
      label={resolvedLabel}
    />
  );
}
