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
import { useAuthorActionLabels } from "../../public-initiative-experience/use-author-action-labels";
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
  const actions = useAuthorActionLabels();
  const { t } = actions;
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
        <WorkspaceErrorState message={t("author.collectiveDecision.loadFailed")} />
        <WorkspaceButton variant="secondary" onClick={() => void loadWorkspace()}>
          {actions.retry}
        </WorkspaceButton>
      </div>
    );
  }

  if (loading || !context) {
    return <p className="icd-source-panel__empty">{t("author.collectiveDecision.loading")}</p>;
  }

  if (context.publishedDecisionId) {
    return (
      <p className="icd-source-panel__empty">{t("author.collectiveDecision.alreadyPublished")}</p>
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
          {showSourcePanel ? actions.hideSources : actions.sources}
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
          <p className="icd-source-panel__empty">{t("author.collectiveDecision.noDraftExplanation")}</p>
          <WorkspaceButton variant="primary" onClick={() => void handleGenerateFirstDraft()}>
            {resolveSaveButtonLabel(
              generatePhase.phase,
              t("author.collectiveDecision.generateCollectiveDecisionDraft"),
              actions.phaseLabels,
            )}
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
