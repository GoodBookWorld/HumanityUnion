"use client";

import type { Initiative, InitiativeCollaborativeAnalysis } from "@hu/types";
import { useCallback, useEffect, useState } from "react";

import { createInitiativeAnalysisDraft, listMyInitiativeAnalysesForInitiative } from "../api";

import {
  WorkspaceEmptyState,
  WorkspaceMetricsRow,
  WorkspacePublicLink,
  WorkspaceSectionShell,
  WorkspaceStatusBadge,
  WorkspaceStatusCard,
} from "../../initiative-workspace-ux";
import { InitiativeAnalysisEditor } from "./InitiativeAnalysisEditor";
import { InitiativeImprovementProposalWorkspace } from "../../initiative-improvement-proposal/components/InitiativeImprovementProposalWorkspace";

import "./initiative-analysis-workspace.css";

interface InitiativeAnalysisWorkspaceProps {
  initiative: Initiative;
}

function isEligibleForAnalysis(initiative: Initiative): boolean {
  return initiative.lifecyclePhase === "published" || initiative.lifecyclePhase === "projected";
}

export function InitiativeAnalysisWorkspace({ initiative }: InitiativeAnalysisWorkspaceProps) {
  const [analyses, setAnalyses] = useState<InitiativeCollaborativeAnalysis[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const loadAnalyses = useCallback(async () => {
    setLoading(true);

    try {
      const items = await listMyInitiativeAnalysesForInitiative(initiative.initiativeId);
      setAnalyses(items);
      setSelectedId((current) => {
        if (current && items.some((item) => item.analysisId === current)) {
          return current;
        }

        return items[0]?.analysisId ?? null;
      });
    } catch {
      setAnalyses([]);
      setSelectedId(null);
    } finally {
      setLoading(false);
    }
  }, [initiative.initiativeId]);

  useEffect(() => {
    if (isEligibleForAnalysis(initiative)) {
      void loadAnalyses();
    } else {
      setAnalyses([]);
      setSelectedId(null);
    }
  }, [initiative, loadAnalyses]);

  const selectedAnalysis = analyses.find((analysis) => analysis.analysisId === selectedId) ?? null;

  async function handleCreateDraft() {
    setCreating(true);
    setMessage(null);

    try {
      const created = await createInitiativeAnalysisDraft({
        initiativeId: initiative.initiativeId,
        title: "Untitled analysis",
        summary: "Summary pending.",
        supportingEvidence: "Evidence pending.",
        risks: "Risks pending.",
        suggestedImprovements: "Improvements pending.",
        references: "References pending.",
      });

      setAnalyses((current) => [created, ...current]);
      setSelectedId(created.analysisId);
      setMessage("Draft created.");
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Unknown error";
      setMessage(`Create failed: ${detail}`);
    } finally {
      setCreating(false);
    }
  }

  function handleUpdated(analysis: InitiativeCollaborativeAnalysis) {
    setAnalyses((current) =>
      current.map((item) => (item.analysisId === analysis.analysisId ? analysis : item)),
    );
  }

  if (!isEligibleForAnalysis(initiative)) {
    return (
      <WorkspaceSectionShell
        purpose="Structured analysis improves initiative quality. Analysis never edits the initiative directly."
        emptyState={
          <WorkspaceEmptyState
            title="Collaborative analysis is not available yet"
            explanation="Analysis workspaces open after an initiative is published."
            nextStep="Publish the initiative, then create an analysis draft here."
          />
        }
      />
    );
  }

  return (
    <WorkspaceSectionShell
      purpose="Structured analysis improves initiative quality. Analysis never edits the initiative directly."
      loading={loading ? "Loading analyses..." : null}
      metrics={
        <WorkspaceMetricsRow>
          <WorkspaceStatusCard label="Analyses" value={analyses.length} />
          <WorkspaceStatusCard label="Selected status" value={selectedAnalysis?.status ?? "None"} />
        </WorkspaceMetricsRow>
      }
      emptyState={
        !loading && analyses.length === 0 ? (
          <WorkspaceEmptyState
            title="No collaborative analyses have been created yet"
            explanation="Analysis drafts collect evidence, risks, and improvement ideas."
            nextStep="Create an analysis draft to begin collaborative analysis."
          />
        ) : null
      }
      actions={
        <button
          type="button"
          className="initiative-analysis-workspace__create"
          disabled={creating}
          onClick={() => void handleCreateDraft()}
        >
          {creating ? "Creating..." : "Create Analysis Draft"}
        </button>
      }
    >
      <div className="initiative-analysis-workspace">
        {analyses.length > 0 ? (
          <div className="initiative-analysis-workspace__list">
            {analyses.map((analysis) => (
              <div key={analysis.analysisId} className="initiative-analysis-workspace__item">
                <strong>{analysis.title}</strong>
                <span>
                  <WorkspaceStatusBadge status={analysis.status} />
                </span>
                <button
                  type="button"
                  data-selected={selectedId === analysis.analysisId ? "true" : "false"}
                  onClick={() => setSelectedId(analysis.analysisId)}
                >
                  {selectedId === analysis.analysisId ? "Selected" : "Open"}
                </button>
                {analysis.status === "published" ? (
                  <WorkspacePublicLink
                    href={`/initiative-analyses/public/${encodeURIComponent(analysis.analysisId)}`}
                    label="View Public Analysis"
                  />
                ) : null}
              </div>
            ))}
          </div>
        ) : null}

        {selectedAnalysis ? (
          <>
            <InitiativeAnalysisEditor analysis={selectedAnalysis} onUpdated={handleUpdated} />
            <InitiativeImprovementProposalWorkspace analysis={selectedAnalysis} />
          </>
        ) : null}

        {message ? <p className="initiative-analysis-workspace__note">{message}</p> : null}
      </div>
    </WorkspaceSectionShell>
  );
}
