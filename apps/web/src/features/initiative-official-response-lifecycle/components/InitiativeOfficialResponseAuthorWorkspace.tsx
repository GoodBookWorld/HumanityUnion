"use client";

import { useCallback, useEffect, useState } from "react";
import { useAfterLifecyclePublish } from "../../public-initiative-experience/initiative-experience-refresh-context";

import type {
  InitiativeOfficialResponseLifecycleDraft,
  InitiativeOfficialResponseLifecycleDraftContext,
} from "@hu/types";

import { resolveSaveButtonLabel, useSaveButtonPhase } from "../../member-profile/use-save-button-phase";
import { useAuthorActionLabels } from "../../public-initiative-experience/use-author-action-labels";
import { WorkspaceButton, WorkspaceErrorState } from "../../initiative-workspace-ux";
import { generateInitiativeOfficialResponseDraft, getInitiativeOfficialResponseWorkspace } from "../api";
import { InitiativeOfficialResponseEditor } from "./InitiativeOfficialResponseEditor";
import { InitiativeOfficialResponseIntelligenceSnapshotPanel } from "./InitiativeOfficialResponseIntelligenceSnapshotPanel";

import "./initiative-official-response-stage-workspace.css";

interface InitiativeOfficialResponseAuthorWorkspaceProps {
  readonly initiativeId: string;
  readonly onTogglePreview: () => void;
  /** Threaded from the shared Lifecycle shell so Publish can offer "Open Public Impact" navigation. */
  readonly onNavigate?: (stageId: string, hash: string) => void;
}

export function InitiativeOfficialResponseAuthorWorkspace({
  initiativeId,
  onTogglePreview,
  onNavigate,
}: InitiativeOfficialResponseAuthorWorkspaceProps) {
  const actions = useAuthorActionLabels();
  const [context, setContext] = useState<InitiativeOfficialResponseLifecycleDraftContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [showSourcePanel, setShowSourcePanel] = useState(false);
  const generatePhase = useSaveButtonPhase();

  const loadWorkspace = useCallback(async () => {
    setLoading(true);
    setLoadFailed(false);

    try {
      const workspace = await getInitiativeOfficialResponseWorkspace(initiativeId);
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

  function handleDraftUpdated(draft: InitiativeOfficialResponseLifecycleDraft) {
    setContext((current) => (current ? { ...current, draft } : current));
  }

  async function handleGenerateFirstDraft() {
    try {
      const created = await generatePhase.runSave(() =>
        generateInitiativeOfficialResponseDraft(initiativeId),
      );
      setContext((current) => (current ? { ...current, draft: created } : current));
    } catch {
      // phase reverts; Sources panel remains available
    }
  }

  if (loadFailed) {
    return (
      <div className="lsw-main">
        <WorkspaceErrorState message="The Official Responses workspace could not be loaded." />
        <WorkspaceButton variant="secondary" onClick={() => void loadWorkspace()}>
          {actions.retry}
        </WorkspaceButton>
      </div>
    );
  }

  if (loading || !context) {
    return <p className="ior-source-panel__empty">Loading Official Responses workspace…</p>;
  }

  if (context.publishedPackageId) {
    return (
      <p className="ior-source-panel__empty">
        Official Responses have already been published for this Initiative. Use Public Preview to review
        them, or continue to Public Impact.
      </p>
    );
  }

  const hasContent = Boolean(
    context.draft &&
      (context.draft.title.trim() ||
        context.draft.summary.trim() ||
        context.draft.candidates.length > 0 ||
        context.draft.outcomeKind === "no_official_response_received"),
  );

  return (
    <div className="lsw-main">
      <div className="ior-editor__actions" style={{ marginBottom: "1rem" }}>
        <WorkspaceButton variant="secondary" onClick={() => setShowSourcePanel((value) => !value)}>
          {showSourcePanel ? actions.hideSources : actions.sources}
        </WorkspaceButton>
      </div>

      {showSourcePanel ? (
        <InitiativeOfficialResponseIntelligenceSnapshotPanel snapshot={context.intelligenceSnapshot} />
      ) : null}

      {!hasContent || !context.draft ? (
        <div className="ior-editor">
          <p className="ior-source-panel__empty">
            Generate an editable Official Responses draft from Tracking / Initiative context, or open
            the editor to record received responses — or explicitly document No official response
            received. The Assistant is advisory only and never invents official statements or publishes.
          </p>
          <WorkspaceButton variant="primary" onClick={() => void handleGenerateFirstDraft()}>
            {resolveSaveButtonLabel(generatePhase.phase, "Generate / Open Draft", actions.phaseLabels)}
          </WorkspaceButton>
        </div>
      ) : (
        <InitiativeOfficialResponseEditor
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
