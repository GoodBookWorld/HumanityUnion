"use client";

import { useCallback, useEffect, useState } from "react";

import type {
  InitiativeImplementationTrackingLifecycleDraft,
  InitiativeImplementationTrackingLifecycleDraftContext,
} from "@hu/types";

import { resolveSaveButtonLabel, useSaveButtonPhase } from "../../member-profile/use-save-button-phase";
import { WorkspaceButton, WorkspaceErrorState } from "../../initiative-workspace-ux";
import {
  generateInitiativeImplementationTrackingDraft,
  getInitiativeImplementationTrackingWorkspace,
} from "../api";
import { InitiativeImplementationTrackingEditor } from "./InitiativeImplementationTrackingEditor";
import { InitiativeImplementationTrackingIntelligenceSnapshotPanel } from "./InitiativeImplementationTrackingIntelligenceSnapshotPanel";

import "./initiative-implementation-tracking-stage-workspace.css";

interface InitiativeImplementationTrackingAuthorWorkspaceProps {
  readonly initiativeId: string;
  readonly onTogglePreview: () => void;
  /** Threaded from the shared Lifecycle shell so Publish can offer "Open Official Responses" navigation. */
  readonly onNavigate?: (stageId: string, hash: string) => void;
}

export function InitiativeImplementationTrackingAuthorWorkspace({
  initiativeId,
  onTogglePreview,
  onNavigate,
}: InitiativeImplementationTrackingAuthorWorkspaceProps) {
  const [context, setContext] = useState<InitiativeImplementationTrackingLifecycleDraftContext | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [showSourcePanel, setShowSourcePanel] = useState(false);
  const generatePhase = useSaveButtonPhase();

  const loadWorkspace = useCallback(async () => {
    setLoading(true);
    setLoadFailed(false);

    try {
      const workspace = await getInitiativeImplementationTrackingWorkspace(initiativeId);
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

  function handleDraftUpdated(draft: InitiativeImplementationTrackingLifecycleDraft) {
    setContext((current) => (current ? { ...current, draft } : current));
  }

  async function handleGenerateFirstDraft() {
    try {
      const created = await generatePhase.runSave(() =>
        generateInitiativeImplementationTrackingDraft(initiativeId),
      );
      setContext((current) => (current ? { ...current, draft: created } : current));
    } catch {
      // phase reverts; Sources panel remains available
    }
  }

  if (loadFailed) {
    return (
      <div className="lsw-main">
        <WorkspaceErrorState message="The Implementation Tracking workspace could not be loaded." />
        <WorkspaceButton variant="secondary" onClick={() => void loadWorkspace()}>
          Retry
        </WorkspaceButton>
      </div>
    );
  }

  if (loading || !context) {
    return <p className="iit-source-panel__empty">Loading Implementation Tracking workspace…</p>;
  }

  if (context.publishedPackageId) {
    return (
      <p className="iit-source-panel__empty">
        Implementation Tracking has already been published for this Initiative. Use Public Preview to
        review it, or continue to Official Responses.
      </p>
    );
  }

  const hasContent = Boolean(
    context.draft &&
      (context.draft.title.trim() || context.draft.summary.trim() || context.draft.candidates.length > 0),
  );

  const zeroCommitmentHint = !context.intelligenceSnapshot.isCommitmentPackageAvailable;

  return (
    <div className="lsw-main">
      <div className="iit-editor__actions" style={{ marginBottom: "1rem" }}>
        <WorkspaceButton variant="secondary" onClick={() => setShowSourcePanel((value) => !value)}>
          {showSourcePanel ? "Hide Sources" : "Sources"}
        </WorkspaceButton>
      </div>

      {showSourcePanel ? (
        <InitiativeImplementationTrackingIntelligenceSnapshotPanel
          snapshot={context.intelligenceSnapshot}
        />
      ) : null}

      {!hasContent || !context.draft ? (
        <div className="iit-editor">
          <p className="iit-source-panel__empty">
            Generate an initial implementation plan from Collective Decision results, Implementation
            Commitments (when accepted), and Initiative scope. With zero accepted commitments,
            milestones are created as Unassigned / To be determined — Lifecycle does not block.
            The Assistant remains advisory and never publishes.
          </p>
          {zeroCommitmentHint ? (
            <p className="iit-source-panel__empty">
              No Accepted Commitments yet — Generate will still produce an editable plan.
            </p>
          ) : null}
          <WorkspaceButton variant="primary" onClick={() => void handleGenerateFirstDraft()}>
            {resolveSaveButtonLabel(generatePhase.phase, "Generate Implementation Tracking Draft")}
          </WorkspaceButton>
        </div>
      ) : (
        <InitiativeImplementationTrackingEditor
          initiativeId={initiativeId}
          draft={context.draft}
          onDraftUpdated={handleDraftUpdated}
          onPublished={() => void loadWorkspace()}
          onTogglePreview={onTogglePreview}
          onNavigate={onNavigate}
        />
      )}
    </div>
  );
}
