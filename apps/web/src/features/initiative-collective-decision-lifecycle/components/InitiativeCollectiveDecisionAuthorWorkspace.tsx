"use client";

import { useCallback, useEffect, useState } from "react";
import { useAfterLifecyclePublish } from "../../public-initiative-experience/initiative-experience-refresh-context";

import type {
  InitiativeCollectiveDecisionLifecycleDraft,
  InitiativeCollectiveDecisionLifecycleDraftContext,
  InitiativeLifecycleProfile,
} from "@hu/types";
import { resolveInitiativeLifecycleProfile } from "@hu/types";

import { resolveSaveButtonLabel, useSaveButtonPhase } from "../../member-profile/use-save-button-phase";
import { WorkspaceButton, WorkspaceErrorState } from "../../initiative-workspace-ux";
import {
  generateInitiativeCollectiveDecisionDraft,
  getInitiativeCollectiveDecisionWorkspace,
} from "../api";
import { InitiativeCollectiveDecisionEditor } from "./InitiativeCollectiveDecisionEditor";
import { InitiativeCollectiveDecisionIntelligenceSnapshotPanel } from "./InitiativeCollectiveDecisionIntelligenceSnapshotPanel";

import "./initiative-collective-decision-stage-workspace.css";

interface InitiativeCollectiveDecisionAuthorWorkspaceProps {
  readonly initiativeId: string;
  readonly onTogglePreview: () => void;
  /** Threaded from the shared Lifecycle shell so Publish can offer "Open Implementation Commitments" navigation. */
  readonly onNavigate?: (stageId: string, hash: string) => void;
  /** Canonical shell/resolver profile — no frontend progression logic. */
  readonly lifecycleProfile?: InitiativeLifecycleProfile | string | null;
}

export function InitiativeCollectiveDecisionAuthorWorkspace({
  initiativeId,
  onTogglePreview,
  onNavigate,
  lifecycleProfile,
}: InitiativeCollectiveDecisionAuthorWorkspaceProps) {
  const profile = resolveInitiativeLifecycleProfile(lifecycleProfile);
  const [context, setContext] = useState<InitiativeCollectiveDecisionLifecycleDraftContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [showSourcePanel, setShowSourcePanel] = useState(false);
  const generatePhase = useSaveButtonPhase();

  const loadWorkspace = useCallback(async () => {
    setLoading(true);
    setLoadFailed(false);

    try {
      const workspace = await getInitiativeCollectiveDecisionWorkspace(initiativeId);
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

  function handleDraftUpdated(draft: InitiativeCollectiveDecisionLifecycleDraft) {
    setContext((current) => (current ? { ...current, draft } : current));
  }

  async function handleGenerateFirstDraft() {
    try {
      const created = await generatePhase.runSave(() =>
        generateInitiativeCollectiveDecisionDraft(initiativeId),
      );
      setContext((current) => (current ? { ...current, draft: created } : current));
    } catch {
      // phase reverts; Sources panel remains available
    }
  }

  if (loadFailed) {
    return (
      <div className="lsw-main">
        <WorkspaceErrorState message="The Collective Decision workspace could not be loaded." />
        <WorkspaceButton variant="secondary" onClick={() => void loadWorkspace()}>
          Retry
        </WorkspaceButton>
      </div>
    );
  }

  if (loading || !context) {
    return <p className="icd-source-panel__empty">Loading Collective Decision workspace…</p>;
  }

  if (context.publishedDecisionId) {
    return (
      <p className="icd-source-panel__empty">
        This Collective Decision has already been published. Use Public Preview to review it, or
        continue to Implementation Commitments.
      </p>
    );
  }

  const hasContent = Boolean(
    context.draft &&
      (context.draft.title.trim() ||
        context.draft.decisionSummary.trim() ||
        context.draft.approvedActions.length > 0),
  );

  return (
    <div className="lsw-main">
      <div className="icd-editor__actions" style={{ marginBottom: "1rem" }}>
        <WorkspaceButton variant="secondary" onClick={() => setShowSourcePanel((value) => !value)}>
          {showSourcePanel ? "Hide Sources" : "Sources"}
        </WorkspaceButton>
      </div>

      {showSourcePanel ? (
        <InitiativeCollectiveDecisionIntelligenceSnapshotPanel
          snapshot={context.intelligenceSnapshot}
          lifecycleProfile={profile}
        />
      ) : null}

      {!hasContent || !context.draft ? (
        <div className="icd-editor">
          <p className="icd-source-panel__empty">
            Generate a structured Decision Result from upstream Lifecycle sources. The Decision
            Assistant remains advisory — nothing publishes automatically.
          </p>
          <WorkspaceButton variant="primary" onClick={() => void handleGenerateFirstDraft()}>
            {resolveSaveButtonLabel(generatePhase.phase, "Generate Collective Decision Draft")}
          </WorkspaceButton>
        </div>
      ) : (
        <InitiativeCollectiveDecisionEditor
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
