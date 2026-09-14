"use client";

import { useCallback, useEffect, useState } from "react";
import { useAfterLifecyclePublish } from "../../public-initiative-experience/initiative-experience-refresh-context";

import type {
  InitiativeImplementationTrackingLifecycleDraft,
  InitiativeImplementationTrackingLifecycleDraftContext,
} from "@hu/types";

import { resolveSaveButtonLabel, useSaveButtonPhase } from "../../member-profile/use-save-button-phase";
import { useAuthorActionLabels } from "../../public-initiative-experience/use-author-action-labels";
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
  const actions = useAuthorActionLabels();
  const { t } = actions;
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

  const onLifecyclePublished = useAfterLifecyclePublish(loadWorkspace);

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
        <WorkspaceErrorState message={t("author.tracking.loadFailed")} />
        <WorkspaceButton variant="secondary" onClick={() => void loadWorkspace()}>
          {actions.retry}
        </WorkspaceButton>
      </div>
    );
  }

  if (loading || !context) {
    return <p className="iit-source-panel__empty">{t("author.tracking.loading")}</p>;
  }

  if (context.publishedPackageId) {
    return (
      <p className="iit-source-panel__empty">{t("author.tracking.alreadyPublished")}</p>
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
          {showSourcePanel ? actions.hideSources : actions.sources}
        </WorkspaceButton>
      </div>

      {showSourcePanel ? (
        <InitiativeImplementationTrackingIntelligenceSnapshotPanel
          snapshot={context.intelligenceSnapshot}
        />
      ) : null}

      {!hasContent || !context.draft ? (
        <div className="iit-editor">
          <p className="iit-source-panel__empty">{t("author.tracking.noDraftExplanation")}</p>
          {zeroCommitmentHint ? (
            <p className="iit-source-panel__empty">{t("author.tracking.zeroCommitmentHint")}</p>
          ) : null}
          <WorkspaceButton variant="primary" onClick={() => void handleGenerateFirstDraft()}>
            {resolveSaveButtonLabel(
              generatePhase.phase,
              t("author.tracking.generateTrackingDraft"),
              actions.phaseLabels,
            )}
          </WorkspaceButton>
        </div>
      ) : (
        <InitiativeImplementationTrackingEditor
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
