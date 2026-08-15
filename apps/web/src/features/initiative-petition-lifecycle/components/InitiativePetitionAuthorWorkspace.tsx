"use client";

import { useCallback, useEffect, useState } from "react";

import type { InitiativePetitionDraft, InitiativePetitionDraftContext } from "@hu/types";

import { resolveSaveButtonLabel, useSaveButtonPhase } from "../../member-profile/use-save-button-phase";
import { WorkspaceButton, WorkspaceErrorState } from "../../initiative-workspace-ux";
import { generateInitiativePetitionDraft, getInitiativePetitionWorkspace } from "../api";
import { InitiativePetitionEditor } from "./InitiativePetitionEditor";
import { InitiativePetitionIntelligenceSnapshotPanel } from "./InitiativePetitionIntelligenceSnapshotPanel";

import "./initiative-petition-stage-workspace.css";

interface InitiativePetitionAuthorWorkspaceProps {
  readonly initiativeId: string;
  readonly onTogglePreview: () => void;
}

/**
 * Initiative Lifecycle — Part F. The Petition stage's `authorEditorSlot`
 * for `InitiativeLifecycleStageWorkspace` — this component only ever
 * renders inside the Author Workspace branch of that shared shell, never a
 * second standalone page or a new editor implementation.
 *
 * Self-fetches (mirrors `InitiativeRevisionAuthorWorkspace`, Part E): loads
 * the Author's Petition workspace context (Petition Sources + Intelligence
 * Snapshot) in a single request, then renders the "Generate Petition
 * Draft" empty state or the Petition Editor, entirely from real persisted
 * data. Once a Petition has already been published for this Initiative,
 * this instead shows the published state — Petition supports only one
 * publish per Initiative, unlike Analysis/Proposal/Revision's repeatable
 * draft cycle.
 */
export function InitiativePetitionAuthorWorkspace({
  initiativeId,
  onTogglePreview,
}: InitiativePetitionAuthorWorkspaceProps) {
  const [context, setContext] = useState<InitiativePetitionDraftContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [showSourcePanel, setShowSourcePanel] = useState(false);
  const generatePhase = useSaveButtonPhase();

  const loadWorkspace = useCallback(async () => {
    setLoading(true);
    setLoadFailed(false);

    try {
      const workspace = await getInitiativePetitionWorkspace(initiativeId);
      setContext(workspace);
    } catch {
      setLoadFailed(true);
    } finally {
      setLoading(false);
    }
  }, [initiativeId]);

  useEffect(() => {
    void loadWorkspace();
  }, [loadWorkspace]);

  function handleDraftUpdated(draft: InitiativePetitionDraft) {
    setContext((current) => (current ? { ...current, draft } : current));
  }

  async function handleGenerateFirstDraft() {
    try {
      const created = await generatePhase.runSave(() => generateInitiativePetitionDraft(initiativeId));
      setContext((current) => (current ? { ...current, draft: created } : current));
    } catch {
      // The Save-button phase already reverts to idle on failure; the
      // Petition Sources panel below (toggled open) lets the Author see
      // what data exists to retry with informed context.
    }
  }

  if (loadFailed) {
    return (
      <div className="lsw-main">
        <WorkspaceErrorState message="The Petition workspace could not be loaded." />
        <WorkspaceButton variant="secondary" onClick={() => void loadWorkspace()}>
          Retry
        </WorkspaceButton>
      </div>
    );
  }

  if (loading || !context) {
    return <p className="lsw-sources__missing">Loading Petition workspace…</p>;
  }

  if (context.publishedPetitionId) {
    return (
      <p className="ipl-source-panel__empty">
        This Petition has already been published. Use Public Preview to review it, or continue to the
        Decision Session stage.
      </p>
    );
  }

  if (!context.intelligenceSnapshot.isRevisionAvailable) {
    return (
      <p className="ipl-source-panel__empty">
        A Petition can be built once this Initiative has a Published Revision.
      </p>
    );
  }

  return (
    <div className="lsw-main">
      {context.draft ? (
        <button
          type="button"
          className="workspace-button workspace-button--secondary"
          aria-expanded={showSourcePanel}
          onClick={() => setShowSourcePanel((current) => !current)}
        >
          {showSourcePanel ? "Hide Petition Sources" : "Show Petition Sources"}
        </button>
      ) : null}

      {!context.draft || showSourcePanel ? (
        <InitiativePetitionIntelligenceSnapshotPanel snapshot={context.intelligenceSnapshot} />
      ) : null}

      {context.draft ? (
        <InitiativePetitionEditor
          initiativeId={initiativeId}
          draft={context.draft}
          onDraftUpdated={handleDraftUpdated}
          onPublished={() => void loadWorkspace()}
          onTogglePreview={onTogglePreview}
        />
      ) : (
        <div className="ipl-editor">
          <h3>No Petition draft yet</h3>
          <p>
            Generate a Petition draft from the Published Revision, Collaborative Analysis, and accepted
            Improvement Proposals, then review and edit before Publish.
          </p>
          <div className="ipl-editor__header-actions">
            <WorkspaceButton
              variant="primary"
              disabled={generatePhase.isBusy}
              onClick={() => void handleGenerateFirstDraft()}
            >
              {resolveSaveButtonLabel(generatePhase.phase, "Generate Petition Draft")}
            </WorkspaceButton>
          </div>
        </div>
      )}
    </div>
  );
}
