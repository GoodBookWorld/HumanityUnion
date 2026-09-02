"use client";

import { useCallback, useEffect, useState } from "react";
import { useAfterLifecyclePublish } from "../../public-initiative-experience/initiative-experience-refresh-context";

import type {
  InitiativeDecisionSessionDraft,
  InitiativeDecisionSessionDraftContext,
} from "@hu/types";

import { resolveSaveButtonLabel, useSaveButtonPhase } from "../../member-profile/use-save-button-phase";
import { useAuthorActionLabels } from "../../public-initiative-experience/use-author-action-labels";
import { WorkspaceButton, WorkspaceErrorState } from "../../initiative-workspace-ux";
import {
  generateInitiativeDecisionSessionDraft,
  getInitiativeDecisionSessionWorkspace,
} from "../api";
import { InitiativeDecisionSessionEditor } from "./InitiativeDecisionSessionEditor";
import { InitiativeDecisionSessionIntelligenceSnapshotPanel } from "./InitiativeDecisionSessionIntelligenceSnapshotPanel";

import "./initiative-decision-session-stage-workspace.css";

interface InitiativeDecisionSessionAuthorWorkspaceProps {
  readonly initiativeId: string;
  readonly onTogglePreview: () => void;
}

export function InitiativeDecisionSessionAuthorWorkspace({
  initiativeId,
  onTogglePreview,
}: InitiativeDecisionSessionAuthorWorkspaceProps) {
  const actions = useAuthorActionLabels();
  const { t } = actions;
  const [context, setContext] = useState<InitiativeDecisionSessionDraftContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [showSourcePanel, setShowSourcePanel] = useState(false);
  const generatePhase = useSaveButtonPhase();

  const loadWorkspace = useCallback(async () => {
    setLoading(true);
    setLoadFailed(false);

    try {
      const workspace = await getInitiativeDecisionSessionWorkspace(initiativeId);
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

  function handleDraftUpdated(draft: InitiativeDecisionSessionDraft) {
    setContext((current) => (current ? { ...current, draft } : current));
  }

  async function handleGenerateFirstDraft() {
    try {
      const created = await generatePhase.runSave(() =>
        generateInitiativeDecisionSessionDraft(initiativeId),
      );
      setContext((current) => (current ? { ...current, draft: created } : current));
    } catch {
      // phase reverts; Sources panel remains available
    }
  }

  if (loadFailed) {
    return (
      <div className="lsw-main">
        <WorkspaceErrorState message={t("author.decisionSession.loadFailed")} />
        <WorkspaceButton variant="secondary" onClick={() => void loadWorkspace()}>
          {actions.retry}
        </WorkspaceButton>
      </div>
    );
  }

  if (loading || !context) {
    return <p className="lsw-sources__missing">{t("author.decisionSession.loading")}</p>;
  }

  if (context.publishedSessionId) {
    return (
      <p className="ids-source-panel__empty">{t("author.decisionSession.alreadyPublished")}</p>
    );
  }

  const hasContent = Boolean(
    context.draft &&
      (context.draft.title.trim() ||
        context.draft.decisionQuestion.trim() ||
        context.draft.options.length > 0),
  );

  return (
    <div className="lsw-main">
      <div className="ids-editor__actions" style={{ marginBottom: "1rem" }}>
        <WorkspaceButton variant="secondary" onClick={() => setShowSourcePanel((value) => !value)}>
          {showSourcePanel ? actions.hideSources : actions.sources}
        </WorkspaceButton>
      </div>

      {showSourcePanel ? (
        <InitiativeDecisionSessionIntelligenceSnapshotPanel snapshot={context.intelligenceSnapshot} />
      ) : null}

      {!hasContent || !context.draft ? (
        <div className="ids-editor">
          <p className="ids-source-panel__empty">{t("author.decisionSession.noDraftExplanation")}</p>
          <WorkspaceButton variant="primary" onClick={() => void handleGenerateFirstDraft()}>
            {resolveSaveButtonLabel(
              generatePhase.phase,
              t("author.decisionSession.generateDecisionDraft"),
              actions.phaseLabels,
            )}
          </WorkspaceButton>
        </div>
      ) : (
        <InitiativeDecisionSessionEditor
          initiativeId={initiativeId}
          draft={context.draft}
          onDraftUpdated={handleDraftUpdated}
          onPublished={onLifecyclePublished}
          onTogglePreview={onTogglePreview}
        />
      )}
    </div>
  );
}
