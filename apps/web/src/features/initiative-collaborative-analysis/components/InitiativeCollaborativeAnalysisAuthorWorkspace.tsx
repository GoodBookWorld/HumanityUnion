"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import type { InitiativeAnalysisSourceSnapshot, InitiativeCollaborativeAnalysis } from "@hu/types";

import { resolveSaveButtonLabel, useSaveButtonPhase } from "../../member-profile/use-save-button-phase";
import { useAuthorActionLabels } from "../../public-initiative-experience/use-author-action-labels";
import { WorkspaceButton, WorkspaceErrorState } from "../../initiative-workspace-ux";
import {
  generateInitiativeAnalysisDraft,
  getInitiativeAnalysisSourceSnapshot,
  getMyCurrentInitiativeAnalysis,
} from "../api";
import { InitiativeAnalysisSourceSnapshotPanel } from "./InitiativeAnalysisSourceSnapshotPanel";
import { InitiativeCollaborativeAnalysisForm } from "./InitiativeCollaborativeAnalysisForm";
import { useInitiativeExperienceRefresh } from "../../public-initiative-experience/initiative-experience-refresh-context";

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
 *
 * Pack 02G 08D.4 — Analysis-specific chrome via author.analysis.*;
 * shared verbs via author.actions / useAuthorActionLabels.
 */
export function InitiativeCollaborativeAnalysisAuthorWorkspace({
  initiativeId,
  onTogglePreview,
}: InitiativeCollaborativeAnalysisAuthorWorkspaceProps) {
  const t = useTranslations("initiativeExperience");
  const actions = useAuthorActionLabels();
  const experienceRefresh = useInitiativeExperienceRefresh();
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
        <WorkspaceErrorState message={t("author.analysis.loadFailed")} />
        <WorkspaceButton variant="secondary" onClick={() => void loadAnalysis()}>
          {actions.retry}
        </WorkspaceButton>
      </div>
    );
  }

  if (loading) {
    return <p className="lsw-sources__missing">{t("author.analysis.loading")}</p>;
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
          {showSourcePanel
            ? t("author.analysis.hideSourceSnapshot")
            : t("author.analysis.showSourceSnapshot")}
        </button>
      ) : null}

      {!analysis || showSourcePanel ? (
        <AnalysisSourceSnapshotSection initiativeId={initiativeId} />
      ) : null}

      {analysis ? (
        <InitiativeCollaborativeAnalysisForm
          initiativeId={initiativeId}
          analysis={analysis}
          onUpdated={(updated) => {
            setAnalysis(updated);
            if (updated.status === "published") {
              void experienceRefresh?.refresh();
            }
          }}
          onTogglePreview={onTogglePreview}
        />
      ) : (
        <div className="ica-editor">
          <h3>{t("author.analysis.noDraftYet")}</h3>
          <p className="ica-editor__readonly">{t("author.analysis.noDraftExplanation")}</p>
          <div className="ica-editor__actions">
            <WorkspaceButton
              variant="primary"
              disabled={generatePhase.isBusy}
              onClick={() => void handleGenerateFirstDraft()}
            >
              {resolveSaveButtonLabel(
                generatePhase.phase,
                t("author.analysis.generateAnalysisDraft"),
                actions.phaseLabels,
              )}
            </WorkspaceButton>
          </div>
        </div>
      )}
    </div>
  );
}

function AnalysisSourceSnapshotSection({ initiativeId }: { initiativeId: string }) {
  const t = useTranslations("initiativeExperience");
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
    return <p className="ica-source-panel__empty">{t("author.analysis.sourceSnapshot.loadFailed")}</p>;
  }

  if (!snapshot) {
    return <p className="ica-source-panel__empty">{t("author.analysis.sourceSnapshot.loading")}</p>;
  }

  return <InitiativeAnalysisSourceSnapshotPanel snapshot={snapshot} />;
}
