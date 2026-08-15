"use client";

import { useCallback, useEffect, useState } from "react";

import type { InitiativeAnalysisSourceSnapshot, InitiativeCollaborativeAnalysis } from "@hu/types";

import { resolveSaveButtonLabel, useSaveButtonPhase } from "../../member-profile/use-save-button-phase";
import { WorkspaceButton, WorkspaceErrorState } from "../../initiative-workspace-ux";
import {
  generateInitiativeAnalysisDraft,
  getInitiativeAnalysisSourceSnapshot,
  getMyCurrentInitiativeAnalysis,
} from "../api";
import { InitiativeAnalysisSourceSnapshotPanel } from "./InitiativeAnalysisSourceSnapshotPanel";
import { InitiativeCollaborativeAnalysisForm } from "./InitiativeCollaborativeAnalysisForm";

import "./initiative-collaborative-analysis-workspace.css";

interface InitiativeCollaborativeAnalysisAuthorWorkspaceProps {
  readonly initiativeId: string;
  readonly onTogglePreview: () => void;
}

/**
 * Initiative Lifecycle — Part B. The Analysis stage's `authorEditorSlot`
 * for `InitiativeLifecycleStageWorkspace` (Section 0's ONE-renderer rule
 * — this component only ever renders inside the Author Workspace branch
 * of that shared shell, never a second standalone page).
 *
 * Self-fetches (mirrors `InitiativeActiveAlliesWidget`/
 * `InitiativeLifecycleWorkingSidebar`'s convention): loads the Author's
 * one canonical Analysis (Section 2) and the full Source Snapshot
 * (Section 3), then renders the Generate-draft empty state, the
 * Analysis Editor (Section 5), or the published/archived read-only
 * state, entirely from real persisted data.
 */
export function InitiativeCollaborativeAnalysisAuthorWorkspace({
  initiativeId,
  onTogglePreview,
}: InitiativeCollaborativeAnalysisAuthorWorkspaceProps) {
  const [analysis, setAnalysis] = useState<InitiativeCollaborativeAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [showSourcePanel, setShowSourcePanel] = useState(false);
  const generatePhase = useSaveButtonPhase();

  const loadAnalysis = useCallback(async () => {
    setLoading(true);
    setLoadFailed(false);

    try {
      const current = await getMyCurrentInitiativeAnalysis(initiativeId);
      setAnalysis(current);
    } catch {
      setLoadFailed(true);
    } finally {
      setLoading(false);
    }
  }, [initiativeId]);

  useEffect(() => {
    void loadAnalysis();
  }, [loadAnalysis]);

  async function handleGenerateFirstDraft() {
    try {
      const created = await generatePhase.runSave(() => generateInitiativeAnalysisDraft(initiativeId));
      setAnalysis(created);
    } catch {
      // The Save-button phase already reverts to idle on failure; the
      // Source Snapshot Panel below (toggled open) lets the Author see
      // what data exists to retry with informed context.
    }
  }

  if (loadFailed) {
    return (
      <div className="lsw-main">
        <WorkspaceErrorState message="This Analysis could not be loaded." />
        <WorkspaceButton variant="secondary" onClick={() => void loadAnalysis()}>
          Retry
        </WorkspaceButton>
      </div>
    );
  }

  if (loading) {
    return <p className="lsw-sources__missing">Loading Analysis…</p>;
  }

  return (
    <div className="lsw-main">
      {analysis ? (
        <button
          type="button"
          className="workspace-button workspace-button--secondary"
          aria-expanded={showSourcePanel}
          onClick={() => setShowSourcePanel((current) => !current)}
        >
          {showSourcePanel ? "Hide Source Snapshot" : "Show Source Snapshot"}
        </button>
      ) : null}

      {!analysis || showSourcePanel ? (
        <AnalysisSourceSnapshotSection initiativeId={initiativeId} />
      ) : null}

      {analysis ? (
        <InitiativeCollaborativeAnalysisForm
          initiativeId={initiativeId}
          analysis={analysis}
          onUpdated={setAnalysis}
          onTogglePreview={onTogglePreview}
        />
      ) : (
        <div className="ica-editor">
          <h3>No draft yet</h3>
          <p className="ica-editor__readonly">
            Generate a structured draft from the Source Snapshot above, or start from a blank draft and
            fill it in yourself.
          </p>
          <div className="ica-editor__actions">
            <WorkspaceButton
              variant="primary"
              disabled={generatePhase.isBusy}
              onClick={() => void handleGenerateFirstDraft()}
            >
              {resolveSaveButtonLabel(generatePhase.phase, "Generate Analysis Draft")}
            </WorkspaceButton>
          </div>
        </div>
      )}
    </div>
  );
}

function AnalysisSourceSnapshotSection({ initiativeId }: { initiativeId: string }) {
  const [snapshot, setSnapshot] = useState<InitiativeAnalysisSourceSnapshot | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setSnapshot(null);
    setLoadFailed(false);

    getInitiativeAnalysisSourceSnapshot(initiativeId)
      .then((result) => {
        if (!cancelled) {
          setSnapshot(result);
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
  }, [initiativeId]);

  if (loadFailed) {
    return <p className="ica-source-panel__empty">The Source Snapshot could not be loaded.</p>;
  }

  if (!snapshot) {
    return <p className="ica-source-panel__empty">Loading Source Snapshot…</p>;
  }

  return <InitiativeAnalysisSourceSnapshotPanel snapshot={snapshot} />;
}
