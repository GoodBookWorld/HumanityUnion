"use client";

import { useCallback, useEffect, useState } from "react";

import type { InitiativeRevisionDraft, InitiativeRevisionDraftContext } from "@hu/types";

import { resolveSaveButtonLabel, useSaveButtonPhase } from "../../member-profile/use-save-button-phase";
import { useAuthorActionLabels } from "../../public-initiative-experience/use-author-action-labels";
import { WorkspaceButton, WorkspaceErrorState } from "../../initiative-workspace-ux";
import { createInitiativeRevisionDraft, getInitiativeRevisionWorkspace } from "../api";
import { InitiativeRevisionEditor } from "./InitiativeRevisionEditor";
import { InitiativeRevisionIntelligenceSnapshotPanel } from "./InitiativeRevisionIntelligenceSnapshotPanel";

import "./initiative-revision-stage-workspace.css";

interface InitiativeRevisionAuthorWorkspaceProps {
  readonly initiativeId: string;
  readonly onTogglePreview: () => void;
}

/**
 * Initiative Lifecycle — Part E. The Revision stage's `authorEditorSlot`
 * for `InitiativeLifecycleStageWorkspace` — this component only ever
 * renders inside the Author Workspace branch of that shared shell, never a
 * second standalone page (Part 12).
 *
 * Self-fetches (mirrors `InitiativeImprovementProposalsAuthorWorkspace`,
 * Part D): loads the Author's one canonical Revision draft context
 * (Revision Sources + Intelligence Snapshot, Section 2/3) in a single
 * request, then renders the "Start Revision Draft" empty state or the
 * Revision Editor, entirely from real persisted data.
 */
export function InitiativeRevisionAuthorWorkspace({
  initiativeId,
  onTogglePreview,
}: InitiativeRevisionAuthorWorkspaceProps) {
  const actions = useAuthorActionLabels();
  const [context, setContext] = useState<InitiativeRevisionDraftContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [showSourcePanel, setShowSourcePanel] = useState(false);
  const createPhase = useSaveButtonPhase();

  const loadWorkspace = useCallback(async () => {
    setLoading(true);
    setLoadFailed(false);

    try {
      const workspace = await getInitiativeRevisionWorkspace(initiativeId);
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

  function handleDraftUpdated(draft: InitiativeRevisionDraft) {
    setContext((current) => (current ? { ...current, draft } : current));
  }

  async function handleCreateDraft() {
    try {
      const created = await createPhase.runSave(() => createInitiativeRevisionDraft(initiativeId));
      setContext((current) => (current ? { ...current, draft: created } : current));
    } catch {
      // The Save-button phase already reverts to idle on failure; the
      // Revision Sources panel below (toggled open) lets the Author see
      // what data exists to retry with informed context.
    }
  }

  if (loadFailed) {
    return (
      <div className="lsw-main">
        <WorkspaceErrorState message="The Revision workspace could not be loaded." />
        <WorkspaceButton variant="secondary" onClick={() => void loadWorkspace()}>
          {actions.retry}
        </WorkspaceButton>
      </div>
    );
  }

  if (loading || !context) {
    return <p className="lsw-sources__missing">Loading Revision workspace…</p>;
  }

  if (context.currentVersion === 0) {
    return (
      <p className="irv-source-panel__empty">
        Initiative revisions are available after the Initiative is published.
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
          {showSourcePanel ? "Hide Revision Sources" : "Show Revision Sources"}
        </button>
      ) : null}

      {!context.draft || showSourcePanel ? (
        <InitiativeRevisionIntelligenceSnapshotPanel snapshot={context.intelligenceSnapshot} />
      ) : null}

      {context.draft ? (
        <InitiativeRevisionEditor
          initiativeId={initiativeId}
          context={context}
          draft={context.draft}
          onDraftUpdated={handleDraftUpdated}
          onPublished={() => void loadWorkspace()}
          onTogglePreview={onTogglePreview}
        />
      ) : (
        <div className="irv-editor">
          <h3>No Revision draft yet</h3>
          <p>
            Start a Revision draft from the current published Initiative, then generate suggested changes
            from included Improvement Proposals or add your own Author-originated changes.
          </p>
          <div className="irv-editor__header-actions">
            <WorkspaceButton
              variant="primary"
              disabled={createPhase.isBusy}
              onClick={() => void handleCreateDraft()}
            >
              {resolveSaveButtonLabel(createPhase.phase, "Start Revision Draft", actions.phaseLabels)}
            </WorkspaceButton>
          </div>
        </div>
      )}
    </div>
  );
}
