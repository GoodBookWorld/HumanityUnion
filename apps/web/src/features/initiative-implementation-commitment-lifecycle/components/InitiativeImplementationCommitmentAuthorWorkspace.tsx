"use client";

import { useCallback, useEffect, useState } from "react";
import { useAfterLifecyclePublish } from "../../public-initiative-experience/initiative-experience-refresh-context";

import type {
  InitiativeImplementationCommitmentLifecycleDraft,
  InitiativeImplementationCommitmentLifecycleDraftContext,
} from "@hu/types";

import { resolveSaveButtonLabel, useSaveButtonPhase } from "../../member-profile/use-save-button-phase";
import { WorkspaceButton, WorkspaceErrorState } from "../../initiative-workspace-ux";
import {
  generateInitiativeImplementationCommitmentDraft,
  getInitiativeImplementationCommitmentWorkspace,
} from "../api";
import { InitiativeImplementationCommitmentEditor } from "./InitiativeImplementationCommitmentEditor";
import { InitiativeImplementationCommitmentIntelligenceSnapshotPanel } from "./InitiativeImplementationCommitmentIntelligenceSnapshotPanel";

import "./initiative-implementation-commitment-stage-workspace.css";

interface InitiativeImplementationCommitmentAuthorWorkspaceProps {
  readonly initiativeId: string;
  readonly onTogglePreview: () => void;
  /** Threaded from the shared Lifecycle shell so Publish can offer "Open Implementation Tracking" navigation. */
  readonly onNavigate?: (stageId: string, hash: string) => void;
}

export function InitiativeImplementationCommitmentAuthorWorkspace({
  initiativeId,
  onTogglePreview,
  onNavigate,
}: InitiativeImplementationCommitmentAuthorWorkspaceProps) {
  const [context, setContext] = useState<InitiativeImplementationCommitmentLifecycleDraftContext | null>(
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
      const workspace = await getInitiativeImplementationCommitmentWorkspace(initiativeId);
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

  const onLifecyclePublished = useAfterLifecyclePublish(loadWorkspace);

  function handleDraftUpdated(draft: InitiativeImplementationCommitmentLifecycleDraft) {
    setContext((current) => (current ? { ...current, draft } : current));
  }

  async function handleGenerateFirstDraft() {
    try {
      const created = await generatePhase.runSave(() =>
        generateInitiativeImplementationCommitmentDraft(initiativeId),
      );
      setContext((current) => (current ? { ...current, draft: created } : current));
    } catch {
      // phase reverts; Sources panel remains available
    }
  }

  if (loadFailed) {
    return (
      <div className="lsw-main">
        <WorkspaceErrorState message="The Implementation Commitments workspace could not be loaded." />
        <WorkspaceButton variant="secondary" onClick={() => void loadWorkspace()}>
          Retry
        </WorkspaceButton>
      </div>
    );
  }

  if (loading || !context) {
    return <p className="iic-source-panel__empty">Loading Implementation Commitments workspace…</p>;
  }

  if (context.publishedPackageId) {
    return (
      <p className="iic-source-panel__empty">
        Implementation Commitments have already been published for this Initiative. Use Public
        Preview to review them, or continue to Implementation Tracking.
      </p>
    );
  }

  const hasContent = Boolean(
    context.draft &&
      (context.draft.title.trim() || context.draft.summary.trim() || context.draft.candidates.length > 0),
  );

  return (
    <div className="lsw-main">
      <div className="iic-editor__actions" style={{ marginBottom: "1rem" }}>
        <WorkspaceButton variant="secondary" onClick={() => setShowSourcePanel((value) => !value)}>
          {showSourcePanel ? "Hide Sources" : "Sources"}
        </WorkspaceButton>
      </div>

      {showSourcePanel ? (
        <InitiativeImplementationCommitmentIntelligenceSnapshotPanel
          snapshot={context.intelligenceSnapshot}
        />
      ) : null}

      {!hasContent || !context.draft ? (
        <div className="iic-editor">
          <p className="iic-source-panel__empty">
            Generate Commitment Candidates from the published Collective Decision&rsquo;s Approved
            Actions. The Implementation Assistant remains advisory — nothing publishes
            automatically.
          </p>
          <WorkspaceButton variant="primary" onClick={() => void handleGenerateFirstDraft()}>
            {resolveSaveButtonLabel(generatePhase.phase, "Generate Implementation Commitments Draft")}
          </WorkspaceButton>
        </div>
      ) : (
        <InitiativeImplementationCommitmentEditor
          initiativeId={initiativeId}
          draft={context.draft}
          onDraftUpdated={handleDraftUpdated}
          onPublished={onLifecyclePublished}
          onTogglePreview={onTogglePreview}
          onNavigate={onNavigate}
        />
      )}
    </div>
  );
}
